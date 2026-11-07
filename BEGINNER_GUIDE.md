# PrepWise Beginner Guide

This guide explains the project as if you are opening it for the first time.

## 1. What you need

- Windows, macOS, or Linux
- A modern browser
- Python 3 for the local web server
- A code editor such as VS Code

You do not need Node.js or `npm` for the current project.

## 2. Run the website

Open PowerShell in the repository folder:

```powershell
cd C:\Users\ra416\OneDrive\Desktop\prepwise
python -m http.server 3456
```

Then open <http://localhost:3456> in a browser. Keep the PowerShell window open while using the site. Press `Ctrl+C` to stop the server.

Do not double-click the HTML files. Browser security rules can block the JSON `fetch()` calls when pages are opened with a `file:///` URL.

## 3. Understand the folders

```text
prepwise/
├── *.html                  Pages shown in the browser
├── css/style.css           Shared visual styles
├── js/                     Browser behavior
├── data/                   JSON content loaded at runtime
├── data/questions/         One question file per company
└── *.py                    Optional content-generation scripts
```

## 4. Follow one feature

### Company cards

1. [`index.html`](./index.html) contains the search and filter controls.
2. [`js/app.js`](./js/app.js) fetches `data/companies.json` and `data/countries.json`.
3. `renderCompanies()` creates each company card.
4. Clicking a card opens `company.html?id=<company-id>`.

### Company details

1. [`company.html`](./company.html) provides empty containers such as `companyHeader` and `rolesGrid`.
2. [`js/company.js`](./js/company.js) reads the `id` query parameter.
3. It loads the company record and matching question file.
4. It fills the tabs with HTML.

### Quiz

1. `quiz.html` provides the quiz containers.
2. [`js/quiz.js`](./js/quiz.js) reads `company`, `category`, `level`, and `role`.
3. It filters the loaded questions.
4. It renders one question at a time and calculates the score in the browser.

## 5. Make a safe first change

Try changing a visible sentence in an HTML page or a CSS color:

1. Edit the file.
2. Refresh the browser.
3. Check both desktop and narrow/mobile widths.
4. Open the browser developer console if data does not load.

For a data-only change, keep valid JSON syntax. A missing comma or extra comma can prevent the page from loading its data.

## 6. Debug common problems

### “Failed to load companies database”

Check that:

- the server was started in the repository root;
- `data/companies.json` exists;
- the browser URL starts with `http://localhost:3456`;
- the browser console does not show a JSON syntax error.

### Company page shows the wrong company

Check the URL. The `id` must match the `id` field in `data/companies.json`, for example `company.html?id=google`.

### Quiz is empty

Check that `data/questions/<company-id>.json` exists and has a `questions` array. The file name must match the company id.

### News does not appear

Check `data/news.json` and the browser console. The homepage, company page, and quiz page each load the shared news module independently.

## 7. Recommended learning order

1. HTML elements and links
2. CSS selectors and custom properties
3. JavaScript variables, functions, arrays, and DOM events
4. `fetch()` and JSON
5. URL query parameters
6. Async functions and error handling

