# Data and Content Guide

## Runtime data files

### `data/companies.json`

This is the main company catalogue. Each company has an `id` used in URLs and question filenames. Common fields include:

```json
{
  "id": "tcs",
  "name": "Tata Consultancy Services",
  "shortName": "TCS",
  "category": "IT Services",
  "countries": ["India", "United States"],
  "jobRoles": [],
  "testPattern": {},
  "tips": []
}
```

Keep these relationships consistent:

- `id` must be URL-safe and unique.
- `company.html?id=<id>` must find the record.
- `data/questions/<id>.json` should exist for a working quiz.
- `countries` values should use the same country names as `data/countries.json`.
- `category` should match the categories used by the home-page filter.

After the Supabase schema is applied, [`scripts/import_json_to_supabase.py`](./scripts/import_json_to_supabase.py) can repeatably upsert these datasets into PostgreSQL. It requires `SUPABASE_URL` and the server-only `SUPABASE_SECRET_KEY`; it does not delete or rewrite local JSON.

### `data/questions/<company-id>.json`

Each question file has a company id, summary metadata, and a `questions` array. A question normally contains:

```json
{
  "id": 1,
  "category": "Technical",
  "difficulty": "Beginner",
  "level": "Beginner",
  "question": "Question text",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": 0,
  "explanation": "Step-by-step explanation"
}
```

`correctAnswer` is a zero-based array index: `0` means the first option. Use one of the four runtime categories:

- `Quantitative Aptitude`
- `Logical Reasoning`
- `Verbal Ability`
- `Technical`

Use one of the four level names:

- `Beginner`
- `Intermediate`
- `Advanced`
- `Legend`

The quiz falls back to `difficulty` when `level` is absent, so keeping both fields aligned is safest.

### `data/countries.json`

The homepage sorts this list by `name` and uses `name` and `flag` to build the country dropdown. The company filter compares the selected country with each company’s `countries` array.

### `data/news.json`

News records drive the ticker and news cards. Important fields include `company`, `badge`, `title`, `summary`, `category`, `timestamp`, `eligibleBatches`, `cutoff`, `applyLink`, and `link`.

The frontend also contains a small simulated breaking-alert pool in [`js/news.js`](./js/news.js). Editing `news.json` alone does not remove or change that pool.

## Content-generation scripts

| Script | Intended use |
| --- | --- |
| [`generate_countries.py`](./generate_countries.py) | Create the country dataset |
| [`update_country_mappings.py`](./update_country_mappings.py) | Apply company-to-country mappings |
| [`enrich_data.py`](./enrich_data.py) | Add or enrich company/question content |
| [`enrich_fresher_roles.py`](./enrich_fresher_roles.py) | Add fresher role details and compensation fields |
| [`generate_extra_questions.py`](./generate_extra_questions.py) | Generate question sets for companies |

These scripts use absolute Windows `base_dir` values from an older workspace. Change that path before running them on this checkout.

## Safe content workflow

1. Make a backup or commit existing work.
2. Edit one source file or run one generator.
3. Validate that the JSON still parses.
4. Review the diff.
5. Serve the site and test the affected page.

A quick JSON check from PowerShell:

```powershell
python -c "import json, pathlib; [json.loads(p.read_text(encoding='utf-8')) for p in pathlib.Path('data').rglob('*.json')]; print('All JSON files are valid')"
```

## Content quality notes

- Treat salary, hiring dates, eligibility, and “verified” claims as content that needs source review.
- Keep explanations understandable to a beginner.
- Avoid changing an existing company id because links and question filenames depend on it.
- If adding a company, add its catalogue record, question file, and any country mappings together.
