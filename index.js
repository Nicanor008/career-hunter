import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer'
import dotenv from 'dotenv';
import sendJobsEmail from './sendJobsEmail.js';
import { goToLinkedinJobsPageAndExtractJobs } from './searchLinkedInJobs.js';
import { searchParams, stacks } from './constants.js';

dotenv.config();

//----------------------
// Main Function & Emailing Logic
//----------------------

(async () => {
  console.log('Launching Chrome...');
  const isLambda = false;
  const browser = isLambda
    ? await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
      })
    : await puppeteer.launch({
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-sandbox'
        ],
      });
  
  const page = await browser.newPage();
  // Define search parameters
  // const searchParams = {
  //   searchText: stacks.toString(),
  //   locationText: 'Nairobi,Kenya',
  //   pageNumber: 0,
  // };

  const MAX_PAGES = 100; // Increase max pages to scrape more jobs if available
  let allJobs = [];
  
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
  
  console.log(`Total jobs extracted: ${allJobs.length}`);
  await sendJobsEmail(allJobs);
  console.log('Job extraction and email sending complete.');
  await browser.close();
})();
