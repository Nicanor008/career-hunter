import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { config } from "./config.js";
import { searchParams, stacks } from "./constants.js";

dotenv.config();

async function sendJobsEmail(jobs) {
    if (!jobs || jobs.length === 0) {
      console.log("No jobs found. Email not sent.");
      return;
    }
    const transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass,
      },
    });
  
    console.log(`============================\n${jobs.length} jobs found & sent to ${config.applicant.email}\n============================`);
  
    // Build an HTML email with a centered container
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
          hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <p style="text-align: left; padding-top: 14px; padding-left: 14px;">
            Hi ${config.applicant.name},<br /><br />
            Here are the latest ${jobs.length} LinkedIn Job listings that match your preferences: <strong>${stacks.join(', ')}</strong> at <strong>${searchParams.locationText}</strong>.<br />
            Click on the job title to view more details and apply.<br /><br />
            Best of luck on your job search!<br />
            ${config.resumePath && `<a href="${config.resumePath}" class="button" style="color: #ffffff; text-decoration: none;">View My Resume</a>`}
          </p>
          ${jobs.map(job => {
            const postedDate = new Date(job.postedDate).toLocaleString('en-US', { dateStyle: 'medium' });
            return `
              <div class="card">
                <div class="header">
                  ${job.img ? `<img src="${job.img}" alt="Company Logo" />` : ''}
                  <div>
                    <h2><a href="${job.url}" style="color: #0073b1; text-decoration: none;">${job.title}</a></h2>
                    <p>Company: <a href="${job.companyUrl || '#'}" style="color: #0073b1; text-decoration: none;">${job.company}</a></p>
                  </div>
                </div>
                <p><strong>City:</strong> ${job.city}</p>
                <p><strong>Location:</strong> ${job.location}</p>
                <p><strong>Posted Date:</strong> ${postedDate}</p>
                ${job.description && `<p><strong>Description:</strong> ${
                  job.description.length > 150 ? job.description.substring(0, 150) + '...' : job.description
                }</p>`}
                <a class="button" href="${job.url}" style="color: #ffffff; text-decoration: none;">View</a>
              </div>
              <hr />
            `;
          }).join('')}
        </div>
      </body>
      </html>
    `;
  
    const mailOptions = {
      from: config.email.from,
      to: config.applicant.email,
      subject: `New LinkedIn Jobs - ${jobs.length} Job Listings Found at ${searchParams.locationText}`,
      html: htmlBody,
    };
  
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Jobs email sent: ${info.response}`);
    } catch (error) {
      console.error("Error sending jobs email:", error);
    }
}

export default sendJobsEmail
