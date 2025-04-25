import express from 'express';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import { defer, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { config } from '../config.js';

function urlQueryPage(searchParams) {
  return `https://linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(searchParams.searchText)}&start=${searchParams.pageNumber * 25}${searchParams.locationText ? '&location=' + encodeURIComponent(searchParams.locationText) : ''}`;
}

function navigateToJobsPage(page, searchParams) {
  return page.goto(urlQueryPage(searchParams), { waitUntil: 'networkidle0' });
}

let reqSearchText = '';
let reqLocationText = '';
let reqStacks = '';
// Global storage for scraped jobs.
global.lastScrapedJobs = [];

function getJobsFromLinkedinPage(page) {
  return defer(() =>
    from(
      page.evaluate(
        (pageEvalData) => {
          const collection = document.body.children;
          const results = [];
          for (let i = 0; i < collection.length; i++) {
            try {
              const item = collection.item(i);
              const title = item.getElementsByClassName('base-search-card__title')[0].textContent.trim();
              const imgSrc = item.getElementsByTagName('img')[0]?.getAttribute('data-delayed-url') || '';
              const url = (
                item.getElementsByClassName('base-card__full-link')[0] ||
                item.getElementsByClassName('base-search-card--link')[0]
              ).href;
              const companyNameAndLinkContainer = item.getElementsByClassName('base-search-card__subtitle')[0];
              const companyUrl = companyNameAndLinkContainer?.getElementsByTagName('a')[0]?.href;
              const companyName = companyNameAndLinkContainer.textContent.trim();
              const companyLocation = item.getElementsByClassName('job-search-card__location')[0].textContent.trim();
              const toDate = (dateString) => {
                const [year, month, day] = dateString.split('-');
                return new Date(parseFloat(year), parseFloat(month) - 1, parseFloat(day));
              };
              const dateTime = (
                item.getElementsByClassName('job-search-card__listdate')[0] ||
                item.getElementsByClassName('job-search-card__listdate--new')[0]
              ).getAttribute('datetime');
              const postedDate = toDate(dateTime).toISOString();
              const descriptionElem = item.getElementsByClassName('job-search-card__snippet')[0];
              const description = descriptionElem ? descriptionElem.textContent.trim() : '';
              const result = {
                id: item.children[0].getAttribute('data-entity-urn'),
                city: companyLocation,
                url: url,
                companyUrl: companyUrl || '',
                img: imgSrc,
                date: new Date().toISOString(),
                postedDate: postedDate,
                title: title,
                company: companyName,
                location: companyLocation,
                description: description
              };
              results.push(result);
            } catch (e) {
              console.error(`Error retrieving linkedin page item: ${i} on url: ${window.location}`, e);
            }
          }
          return results;
        },
      )
    )
  );
}

function goToLinkedinJobsPageAndExtractJobs(page, searchParams) {
  return defer(() => from(navigateToJobsPage(page, searchParams)))
    .pipe(switchMap(() => getJobsFromLinkedinPage(page)));
}

async function scrapeJobs(searchParams, stacksInput) {
  const MAX_PAGES = 10; // Adjust as needed.
  let allJobs = [];
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox'
    ],
  });
  const page = await browser.newPage();
  for (let currentPage = 0; currentPage < MAX_PAGES; currentPage++) {
    console.log(`Extracting jobs from page ${currentPage} ...`);
    searchParams.pageNumber = currentPage;
    try {
      const jobs = await goToLinkedinJobsPageAndExtractJobs(page, searchParams).toPromise();
      if (!jobs || jobs.length === 0) {
        console.log(`No jobs found on page ${currentPage}. Ending pagination.`);
        break;
      }
      allJobs = allJobs.concat(jobs);
    } catch (err) {
      console.error(`Error on page ${currentPage}:`, err);
      break;
    }
  }
  await browser.close();
  console.log(`Total jobs extracted: ${allJobs.length}`);
  return allJobs;
}

// ----- Express Server with a Simple UI -----
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Update the configuration form in the '/' route to include email field
app.get('/', (req, res) => {
  // The page checks client-side (via localStorage) whether a user config exists.
  // If not, it shows the configuration form; if yes, it shows the filters form.
  res.send(`
    <html>
      <head>
        <title>LinkedIn Career Hunter</title>
        <style>
          body { font-family: Arial, sans-serif; background: #eef2f7; padding: 20px; }
          .container { max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          h1 { text-align: center; color: #0073b1; }
          label { font-weight: bold; }
          input[type="text"], input[type="password"], input[type="email"] { width: 100%; padding: 8px; margin: 5px 0 15px; border: 1px solid #ccc; border-radius: 4px; }
          button { padding: 10px 15px; background: #0073b1; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #005a87; }
          .hidden { display: none; }
          .tabs { display: flex; margin-bottom: 20px; }
          .tab { padding: 10px 20px; cursor: pointer; background: #eee; border-radius: 4px 4px 0 0; }
          .tab.active { background: #0073b1; color: white; }
          .tab-content { display: none; }
          .tab-content.active { display: block; }
        </style>
        <script>
          window.onload = function() {
            // Check if user config exists in localStorage.
            const userConfig = localStorage.getItem('userConfig');
            if (userConfig) {
              document.getElementById('configForm').classList.add('hidden');
              document.getElementById('filterForm').classList.remove('hidden');
            } else {
              document.getElementById('configForm').classList.remove('hidden');
              document.getElementById('filterForm').classList.add('hidden');
            }
            
            // Set up tab functionality
            setupTabs();
          };
          
          function setupTabs() {
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(tab => {
              tab.addEventListener('click', () => {
                // Remove active class from all tabs and content
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and related content
                tab.classList.add('active');
                document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
              });
            });
            
            // Activate first tab by default
            if (tabs.length > 0) {
              tabs[0].click();
            }
          }

          function saveConfig() {
            const recipientEmail = document.getElementById('recipientEmail').value;
            if (!recipientEmail) {
              alert('Please enter your email address where you want to receive job notifications');
              return;
            }
            
            let userConfig = {
              recipientEmail
            };
            
            localStorage.setItem('userConfig', JSON.stringify(userConfig));
            alert('Configuration saved! Reloading page...');
            window.location.reload();
          }

          function onSearchSubmit() {
            document.getElementById('searchButton').disabled = true;
            document.getElementById('searchButton').innerText = 'Loading...';
            
            // Add user config to the form submission
            const userConfig = localStorage.getItem('userConfig');
            if (userConfig) {
              const hiddenInput = document.createElement('input');
              hiddenInput.type = 'hidden';
              hiddenInput.name = 'userConfig';
              hiddenInput.value = userConfig;
              document.getElementById('searchForm').appendChild(hiddenInput);
            }
          }
        </script>
      </head>
      <body>
        <div class="container">
          <h1>LinkedIn Career Hunter</h1>
          <!-- Configuration Form -->
          <div id="configForm">
            <h2>Initial Configuration</h2>
            <p>Please provide your configuration details. These will be stored locally.</p>
            
            <label for="recipientEmail">Your Email Address (to receive job listings):</label>
            <input type="email" id="recipientEmail" placeholder="youremail@example.com" required />
            
            <button onclick="saveConfig();">Save Configuration</button>
            <br/><br/>
          </div>
          <!-- Filter Form (displayed when config exists) -->
          <div id="filterForm" class="hidden">
            <p>Use the filters below to search for job listings on LinkedIn. You can choose to receive an email notification with the results.</p>
            <form id="searchForm" action="/search" method="post" onsubmit="onSearchSubmit();">
              <label for="searchText">Search Text:</label><br />
              <input type="text" name="searchText" id="searchText" value="software engineer" /><br />
              
              <label for="locationText">Location:</label><br />
              <input type="text" name="locationText" id="locationText" value="Berlin, Germany" /><br />
              
              <label for="stacks">Other Filters (comma-separated, optional):</label><br />
              <input type="text" name="stacks" id="stacks" placeholder="e.g. reactjs, nodejs, nextjs" /><br />
              
              <button type="submit" id="searchButton">Search Jobs</button>
            </form>
          </div>
        </div>
        <!-- Info Cards and Footer -->
        <div style="width: 60%; margin: auto; margin-top: 40px;">
          <div style="display: flex; flex-wrap: wrap; justify-content: center; margin-bottom: 40px;">
            <div style="background: #fff; border-radius: 8px; padding: 20px; margin: 10px; flex: 1 1 300px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #0073b1;">How It Works</h2>
              <p>This tool automatically scrapes job listings from LinkedIn using our advanced scraper API. It applies your filters (job title, location, and other filters of your choice) and displays the most relevant jobs either on the website or sends you an email with the results.</p>
            </div>
            <div style="background: #fff; border-radius: 8px; padding: 20px; margin: 10px; flex: 1 1 300px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #0073b1;">Why Use It</h2>
              <p>Save time and never miss a great opportunity. Our solution is designed to help job seekers land their dream job on LinkedIn by delivering the latest job listings directly to your inbox or displaying them on our user-friendly platform.</p>
            </div>
          </div>
          <footer style="text-align: center; padding: 20px; background: #eee; border-radius: 8px;">
            <p style="font-size: 13px;">Designed and Developed by <a href="https://nicanor.me" target="_blank" style="color: #0073b1;">Nicanor Korir</a></p>
            <p style="font-size: 12px; color: darkorange;">Hunt your Dream Job Easily</p>
          </footer>
        </div>
      </body>
    </html>
  `);
});

// Update the sendJobsEmail function to use different email providers
async function sendJobsEmail(jobs, userConfig) {
  const recipientEmail = userConfig.recipientEmail || 'user@example.com';
  
  // Build the email HTML content
  const htmlBody = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background: #f2f2f2; padding: 20px; }
          .container { max-width: 40%; margin: auto; background: #f2f2f2; }
          .card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .card h2 { margin: 0 0 10px 0; font-size: 18px; }
          .card p { margin: 5px 0; font-size: 14px; }
          .card img { max-width: 100px; border-radius: 4px; }
          .card .header { display: flex; align-items: center; }
          .card .header div { margin-left: 10px; }
          .button { display: inline-block; padding: 8px 12px; margin-top: 10px; background: #0073b1; border-radius: 4px; font-size: 14px; font-weight: bolder; }
          .button a { color: #ffffff; text-decoration: none; }
          .nav { text-align: center; margin-bottom: 20px; }
          .nav a, .nav button { padding: 10px 15px; background: #555; color: #fff; text-decoration: none; border-radius: 4px; margin: 5px; border: none; cursor: pointer; }
          .nav a:hover, .nav button:hover { background: #333; }
          hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 style="text-align: center; color: #0073b1;">LinkedIn Career Hunter</h1>
          <p style="text-align: left; padding: 14px;">
            Hi there,<br /><br />
            Here are the latest <b>${jobs.length}</b> LinkedIn Job listings that match your preferences:
            <strong>${encodeURIComponent(reqSearchText)}</strong> at <strong>${encodeURIComponent(reqLocationText)}</strong>.<br />
            Click on a job title to view more details and apply.<br /><br />
            Best of luck on your job search!<br /><br />
            ${userConfig.resumePath ? `<a href="${userConfig.resumePath}" target="_blank" class="button" style="margin-right: 10px;">View My Resume</a>` : ''}
            <a href="https://career-hunter.onrender.com/?searchText=${encodeURIComponent(reqSearchText)}&locationText=${encodeURIComponent(reqLocationText)}&stacks=${encodeURIComponent(reqStacks)}" style="color:white; text-decoration: none" target="_blank" class="button">View on Website</a>
          </p>
          <div class="cards">
            ${jobs.map(job => {
              const postedDate = new Date(job.postedDate).toLocaleDateString('en-US', { 
                year: 'numeric', month: 'long', day: 'numeric' 
              });
              const description = job.description ? (job.description.length > 150 ? job.description.substring(0, 150) + '...' : job.description) : 'N/A';
              return `
                <div class="card">
                  <div class="header">
                    ${job.img ? `<img src="${job.img}" alt="Company Logo" />` : ''}
                    <div>
                      <h2><a target="_blank" href="${job.url}" style="color: #0073b1; text-decoration: none;">${job.title}</a></h2>
                      <p>Company: <a target="_blank" href="${job.companyUrl || '#'}" style="color: #0073b1; text-decoration: none;">${job.company}</a></p>
                    </div>
                  </div>
                  <p><strong>Location:</strong> ${job.location}</p>
                  <p><strong>Posted Date:</strong> ${postedDate}</p>
                  <a class="button" target="_blank" href="${job.url}" style="color: #ffffff; text-decoration: none;">View</a>
                </div>
              `;
            }).join('')}
          </div>
          <div class="nav">
            <a href="/" class="back-btn">Back to Filters</a>
          </div>
        </div>
      </body>
    </html>
  `;
  
  const emailSubject = `New LinkedIn Jobs - ${jobs.length} Listings Found at ${reqLocationText}`;
  
  try {
    // Choose email provider based on user configuration
    // Use SMTP (original method)
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass,
      },
    });
    
    const mailOptions = {
      from: config.email.from,
      to: recipientEmail,
      subject: emailSubject,
      html: htmlBody,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`Jobs email sent via SMTP: ${info.response}`);
  } catch (error) {
    console.error("Error sending jobs email:", error);
    throw error;
  }
}

// Update the server route to handle email errors gracefully
app.post('/search', async (req, res) => {
  const searchText = req.body.searchText || 'software engineer';
  const locationText = req.body.locationText || '';
  const stacksInput = req.body.stacks || '';
  const action = req.body.action || ''; // If "sendEmail", then send email notification
  const sendEmail = req.body.sendEmail === 'on';
  const stacksArray = stacksInput ? stacksInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  const userConfig = req.body.userConfig ? JSON.parse(req.body.userConfig) : {};
  
  // Save filter values globally.
  reqSearchText = searchText;
  reqLocationText = locationText;
  reqStacks = stacksInput;
  
  const searchParams = { searchText, locationText, pageNumber: 0 };
  
  try {
    let jobs;
    if (global.lastScrapedJobs && global.lastScrapedJobs.length > 0 && (action === "sendEmail" || sendEmail)) {
      jobs = global.lastScrapedJobs;
    } else {
      jobs = await scrapeJobs(searchParams, stacksArray);
      global.lastScrapedJobs = jobs;
    }
    
    if (action === "sendEmail" || sendEmail) {
      try {
        await sendJobsEmail(jobs, userConfig);
        res.send(`
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; background: #eef2f7; padding: 20px; }
                .container { max-width: 600px; margin: auto; text-align: center; }
                .button { padding: 10px 15px; background: #0073b1; color: #fff; border: none; border-radius: 4px; text-decoration: none; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Email sent with ${jobs.length} job listings.</h1>
                <p>Email was sent to: ${userConfig.recipientEmail}</p>
                <p><a class="button" href="/">Back to Filters</a></p>
              </div>
            </body>
          </html>
        `);
      } catch (emailError) {
        res.send(`
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; background: #eef2f7; padding: 20px; }
                .container { max-width: 600px; margin: auto; text-align: center; }
                .button { padding: 10px 15px; background: #0073b1; color: #fff; border: none; border-radius: 4px; text-decoration: none; }
                .error { color: red; background: #fff0f0; padding: 15px; border-radius: 4px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Email sending failed</h1>
                <div class="error">
                  <p>There was an error sending the email: ${emailError.message}</p>
                  <p>Please check your email configuration and try again.</p>
                </div>
                <p><a class="button" href="/">Back to Filters</a></p>
              </div>
            </body>
          </html>
        `);
      }
    } else {
      // Display jobs on the website (existing code)
      let html = `
        <html>
          <head>
            <title>Job Results - LinkedIn Career Hunter</title>
            <style>
              body { font-family: Arial, sans-serif; background: #eef2f7; padding: 20px; }
              .container { max-width: 90%; margin: auto; }
              .header { text-align: center; color: #0073b1; }
              .nav { text-align: center; margin-bottom: 20px; }
              .nav a, .nav button { padding: 10px 15px; background: #555; color: #fff; text-decoration: none; border-radius: 4px; margin: 5px; border: none; cursor: pointer; }
              .nav a:hover, .nav button:hover { background: #333; }
              .cards { display: flex; flex-wrap: wrap; justify-content: space-around; }
              .card { background: #fff; border-radius: 8px; padding: 15px; margin: 10px; flex: 1 1 300px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .card h2 { margin: 0 0 10px 0; font-size: 18px; }
              .card p { margin: 5px 0; font-size: 14px; }
              .card a { color: #0073b1; text-decoration: none; }
              .button { display: inline-block; padding: 8px 12px; margin-top: 10px; background: #0073b1; color: #ffffff; text-decoration: none; border-radius: 4px; font-size: 14px; font-weight: bolder; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="nav">
                <a href="/">Back to Filters</a>
                <form action="/search" method="post" style="display:inline;" onsubmit="document.getElementById('emailButton').disabled=true; document.getElementById('emailButton').innerText='Loading...';">
                  <input type="hidden" name="searchText" value="${encodeURIComponent(searchText)}" />
                  <input type="hidden" name="locationText" value="${encodeURIComponent(locationText)}" />
                  <input type="hidden" name="stacks" value="${stacksInput}" />
                  <input type="hidden" name="action" value="sendEmail" />
                  <input type="hidden" name="userConfig" value='${JSON.stringify(userConfig)}' />
                  <button type="submit" id="emailButton">Send Email Notification</button>
                </form>
              </div>
              <a href="/" style="text-decoration: none">
                <h1 class="header">LinkedIn Career Hunter</h1>
              </a>
              <p style="text-align: center;">Found ${jobs.length} job listings matching your filters: <strong>${searchText}</strong> at <strong>${locationText}</strong></p>
              <div class="cards">
      `;
      jobs.forEach(job => {
        html += `
          <div class="card">
            <h2><a target="_blank" href="${job.url}">${job.title}</a></h2>
            <p>Company: <a target="_blank" href="${job.companyUrl || '#'}">${job.company}</a></p>
            <p>Location: ${job.location}, ${job.city}</p>
            <p>Posted: ${new Date(job.postedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p>${job.description ? (job.description.length > 150 ? job.description.substring(0, 150) + '...' : job.description) : ''}</p>
            <a class="button" target="_blank" href="${job.url}" style="color: #ffffff; text-decoration: none;">View</a>
          </div>
        `;
      });
      html += `
              </div>
              <div class="nav">
                <a href="/">Back to Filters</a>
                <form action="/search" method="post" style="display:inline;" onsubmit="document.getElementById('emailButton2').disabled=true; document.getElementById('emailButton2').innerText='Loading...';">
                  <input type="hidden" name="searchText" value="${encodeURIComponent(searchText)}" />
                  <input type="hidden" name="locationText" value="${encodeURIComponent(locationText)}" />
                  <input type="hidden" name="stacks" value="${stacksInput}" />
                  <input type="hidden" name="action" value="sendEmail" />
                  <input type="hidden" name="userConfig" value='${JSON.stringify(userConfig)}' />
                  <button type="submit" id="emailButton2">Send Email Notification</button>
                </form>
              </div>
            </div>
          </body>
        </html>
      `;
      res.send(html);
    }
  } catch (err) {
    console.error("Error during job scraping:", err);
    res.status(500).send(`
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background: #eef2f7; padding: 20px; }
            .container { max-width: 600px; margin: auto; text-align: center; }
            .button { padding: 10px 15px; background: #0073b1; color: #fff; border: none; border-radius: 4px; text-decoration: none; }
            .error { color: red; background: #fff0f0; padding: 15px; border-radius: 4px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Error</h1>
            <div class="error">
              <p>An error occurred while scraping jobs.</p>
              <p>${err.message}</p>
            </div>
            <p><a class="button" href="/">Back to Filters</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

// Start the server
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Job Scraper UI running on https://career-hunter.nicanor.me`);
});
