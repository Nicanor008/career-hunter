/**
 * Configuration object including your details.
 * Update SMTP credentials, your applicant details, and the resume path if needed.
 */

export const config = {
    email: {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      from: `Career Hunter <${process.env.EMAIL_USER}>`
    },
    applicant: {
      name: process.env.APPLICANT_NAME,
      email: process.env.EMAIL_USER,
    },
    resumePath: process.env.RESUME_PATH || '', // Optional: Add a link to your resume
};
