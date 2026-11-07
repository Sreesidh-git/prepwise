# PrepWise: Master Project Summary

## What this project is

PrepWise is a static interview-preparation website for engineering and science graduates. Visitors can browse companies, review fresher roles and salary information, read interview patterns, and practise multiple-choice questions without creating an account.

The project has no backend, database, package manager, or build step. The browser loads the HTML, CSS, JavaScript, and JSON files directly from the project folder.

## Main user journey

1. Open the home page.
2. Search or filter the company list by name, sector, country, or preparation level.
3. Open a company profile.
4. Read the overview, roles and salary benchmarks, and test pattern.
5. Choose a question category or start the full test.
6. Answer questions, inspect explanations, and review the result.

## Pages

| Page | Purpose |
| --- | --- |
| [`index.html`](./index.html) | Company directory, search, filters, preparation levels, and hiring news |
| [`company.html`](./company.html) | Dynamic company profile, roles, test pattern, and practice categories |
| [`quiz.html`](./quiz.html) | Dynamic quiz runner with category, level, and role-preparation modes |
| [`about.html`](./about.html) | Product mission, principles, and FAQ |

Company and quiz pages use URL parameters:

```text
company.html?id=tcs
quiz.html?company=tcs
quiz.html?company=tcs&category=Technical
quiz.html?company=tcs&level=Beginner
quiz.html?company=tcs&role=Associate%20Software%20Engineer
```

## Runtime architecture

```text
HTML pages
  ├── css/style.css
  └── JavaScript modules
        ├── app.js      -> companies.json, countries.json
        ├── company.js  -> companies.json, questions/<company>.json
        ├── quiz.js     -> companies.json, questions/<company>.json
        ├── news.js     -> news.json
        ├── public-config.js -> safe browser configuration placeholders
        └── analytics.js -> GA4 and anonymous first-party analytics hooks

Python data scripts
  └── generate or enrich files in data/
```

The scripts are loaded at the bottom of each page, so the DOM exists before the JavaScript initializes. Relative `fetch()` paths require the site to be served from the project root.

## Important behavior

- The home page loads company and country data asynchronously.
- The company page defaults to TCS when no `id` is supplied.
- The quiz page defaults to the TCS full test when no company is supplied.
- A company question file normally contains 50 questions in four categories.
- Questions can have both `difficulty` and `level`; the quiz accepts either field.
- News is loaded from `data/news.json`. The news module rotates items and adds simulated breaking alerts during refreshes; it is not connected to a live news API.
- Advertising is intentionally disabled for the production migration. Future placement configuration must not display fake ads or simulated earnings.
- The website does not currently have authentication, server-side storage, automated API fetching, or a submission system.

## Content scale

At the time this guide was written, the repository contains:

- 22 company records
- 50 country records
- 22 question files
- 1,100 questions total
- Four question categories: Quantitative Aptitude, Logical Reasoning, Verbal Ability, and Technical
- Four preparation levels: Beginner, Intermediate, Advanced, and Legend

## Where to start as a developer

- Change page structure or text: edit the relevant HTML file.
- Change appearance: edit [`css/style.css`](./css/style.css).
- Change home-page filtering/cards: edit [`js/app.js`](./js/app.js).
- Change company rendering: edit [`js/company.js`](./js/company.js).
- Change quiz behavior: edit [`js/quiz.js`](./js/quiz.js).
- Change news rendering: edit [`js/news.js`](./js/news.js) and [`data/news.json`](./data/news.json).
- Change companies, roles, or salary content: edit [`data/companies.json`](./data/companies.json).
- Change questions: edit the matching file under [`data/questions/`](./data/questions/).

## Known maintenance notes

- The Python scripts contain an absolute Windows path from an older workspace. Update `base_dir` before running them on another computer; see [`DATA_AND_CONTENT.md`](./DATA_AND_CONTENT.md).
- JSON is the runtime source of truth. If a Python generator changes a JSON file, inspect the diff before serving the site.
- Salary, hiring, and news values are content in this repository. They should be checked against official sources before being presented as current facts.
