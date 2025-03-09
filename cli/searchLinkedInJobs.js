import { defer, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import dotenv from 'dotenv';
import { stacks } from "../constants.js";

dotenv.config();

export const urlQueryPage = (searchParams) =>
    `https://linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(searchParams.searchText)}&start=${searchParams.pageNumber * 25}${searchParams.locationText ? '&location=' + encodeURIComponent(searchParams.locationText) : ''}`;
  
function navigateToJobsPage(page, searchParams) {
return page.goto(urlQueryPage(searchParams), { waitUntil: 'networkidle0' });
}

export function getJobsFromLinkedinPage(page) {
  return defer(() =>
    from(
      page.evaluate(
        (pageEvalData) => {
          const collection = document.body.children;
          const results = [];
          for (let i = 0; i < collection.length; i++) {
            try {
              const item = collection.item(i);
              // Extract job title and image (if available)
              const title = item.getElementsByClassName('base-search-card__title')[0].textContent.trim();
              const imgSrc = item.getElementsByTagName('img')[0]?.getAttribute('data-delayed-url') || '';
  
              // Extract URL from available link elements
              const url = (
                item.getElementsByClassName('base-card__full-link')[0] ||
                item.getElementsByClassName('base-search-card--link')[0]
              ).href;
  
              // Extract company details
              const companyNameAndLinkContainer = item.getElementsByClassName('base-search-card__subtitle')[0];
              const companyUrl = companyNameAndLinkContainer?.getElementsByTagName('a')[0]?.href;
              const companyName = companyNameAndLinkContainer.textContent.trim();
              const companyLocation = item.getElementsByClassName('job-search-card__location')[0].textContent.trim();
  
              // Convert datetime string to ISO
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
  
              // Build job object (salary, remote status, and stack removed)
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
                description
              };
              results.push(result);
            } catch (e) {
              console.error(`Error retrieving linkedin page item: ${i} on url: ${window.location}`, e);
            }
          }
          return results;
        },
        { stacks } // Passed for legacy; not used in extraction anymore.
      )
    )
  );
}

export function goToLinkedinJobsPageAndExtractJobs(page, searchParams) {
  return defer(() => from(navigateToJobsPage(page, searchParams)))
    .pipe(switchMap(() => getJobsFromLinkedinPage(page)));
}
