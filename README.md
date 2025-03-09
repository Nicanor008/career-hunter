# LinkedIn Career Hunter

LinkedIn Career Hunter is an automated job search and notification tool designed to help job seekers land their dream job through LinkedIn. The solution scrapes job listings from LinkedIn based on user‑defined filters (job title, location, technical stacks, etc.) and displays the results in a responsive web UI. Users also have the option to receive email notifications with the filtered job listings.

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Usage](#usage)
  - [Running the Server](#running-the-server)
  - [Using the UI](#using-the-ui)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Credits](#credits)
- [License](#license)

## Features

- **Automated Scraping:** Uses Puppeteer and RxJS to scrape job listings from LinkedIn.
- **Flexible Filtering:** Users can search by job title, location, and additional filters.
- **Responsive UI:** Job listings are displayed as responsive cards that adjust based on screen size.
- **Email Notifications:** Option to send an email with the filtered job listings.
- **User Configuration:** On the first visit, users provide configuration details (email settings, resume URL), which are stored in localStorage.
- **Info Cards & Footer:** Informative cards explain how the tool works and its benefits; a footer provides links to the LinkedIn Scraper API and the creator’s website.

## How It Works
1. **Filtering Jobs:**  
   Once configured, the user can fill out the filter form with their desired job title, location, and optional technical stack filters. If the URL contains query parameters (for example, when the user clicks "View on Website" from an email), the filters are auto‑applied.

2. **Job Scraping:**  
   The server uses Puppeteer and RxJS to scrape LinkedIn’s job listings API endpoint. It extracts job details such as the title, company, location, posted date, and description.

3. **Displaying Results:**  
   The results are rendered as responsive cards on the web UI. Each card includes clickable links (which open in new tabs) for viewing detailed job information.

4. **Email Notification:**  
   Users can opt to send an email notification with the results. The email includes buttons to view the user’s resume and to open the results page (with the filters applied).

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/Nicanor008/career-hunter
   cd career-hunter
   ```

Install Dependencies:

Make sure you have Node.js LTS installed, then run:

```bash
npm install
```

The project uses the following dependencies:
- Express
- Puppeteer
- Nodemailer
- RxJS

## Configuration:
A default config.js file is included. The user-specific configuration (email settings, resume URL) is provided via the UI

## Usage
Running the Server

Start the server by running:

```bash
npm run start-server
```

The application will run on http://localhost:3000.

## Using the UI
### Filtering Jobs:
Once configured, the filter form appears. Enter your search criteria (e.g., "software engineer", "Berlin, Germany", and optional stacks) and choose whether to receive an email notification.

### Viewing Results:
The filtered job listings are displayed as responsive cards. Click any job title or button to open details in a new tab.

### Email Notifications:
If you choose to receive email notifications, the server sends an email with the job listings, including a “View on Website” button that applies the filters.

### Navigation:
Both the results page and the email contain a "Back to Filters" link for easy navigation.

## Project Structure
- `ui/server.js`:

Main Express server file containing routes, UI rendering, job scraping, and email notification logic.

- `config.js`:

Contains default configuration values.

## Credits
Project Creator: [Nicanor Korir](https://nicanor.me)

## License
This project is licensed under the MIT License.
