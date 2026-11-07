import json
import os

base_dir = r"C:\Users\ssree\.gemini\antigravity\scratch\prepwise"
countries_path = os.path.join(base_dir, "data", "countries.json")
companies_path = os.path.join(base_dir, "data", "companies.json")

with open(countries_path, "r", encoding="utf-8") as f:
    countries = json.load(f)

with open(companies_path, "r", encoding="utf-8") as f:
    companies = json.load(f)

# Comprehensive global operation mapping for multinational and regional employers
global_office_map = {
    "ibm": [
        "United States", "China", "Germany", "Japan", "India", "United Kingdom", "France", "Italy", "Brazil", "Canada",
        "Russia", "Mexico", "South Korea", "Australia", "Spain", "Indonesia", "Turkey", "Netherlands", "Saudi Arabia",
        "Switzerland", "Poland", "Argentina", "Sweden", "Belgium", "Norway", "Ireland", "Israel", "United Arab Emirates",
        "Thailand", "Singapore", "Austria", "Bangladesh", "Vietnam", "Malaysia", "Philippines", "South Africa", "Denmark",
        "Egypt", "Pakistan", "Hong Kong", "Colombia", "Chile", "Romania", "Czech Republic", "Finland", "Portugal",
        "New Zealand", "Peru", "Greece", "Kazakhstan"
    ],
    "accenture": [
        "United States", "India", "United Kingdom", "France", "Germany", "Brazil", "Japan", "Australia", "Spain", "Italy",
        "Singapore", "Canada", "Philippines", "South Africa", "Argentina", "Ireland", "Netherlands", "Switzerland",
        "Poland", "Belgium", "Sweden", "Norway", "Denmark", "Finland", "Austria", "Portugal", "Greece", "Czech Republic",
        "Romania", "Turkey", "Israel", "Saudi Arabia", "United Arab Emirates", "Malaysia", "Thailand", "Indonesia",
        "Vietnam", "Hong Kong", "China", "South Korea", "Mexico", "Colombia", "Chile", "Peru", "New Zealand", "Egypt",
        "Kazakhstan", "Pakistan", "Bangladesh", "Russia"
    ],
    "microsoft": [
        "United States", "China", "Germany", "Japan", "India", "United Kingdom", "France", "Italy", "Brazil", "Canada",
        "Mexico", "South Korea", "Australia", "Spain", "Netherlands", "Saudi Arabia", "Switzerland", "Poland", "Argentina",
        "Sweden", "Belgium", "Norway", "Ireland", "Israel", "United Arab Emirates", "Thailand", "Singapore", "Austria",
        "Vietnam", "Malaysia", "Philippines", "South Africa", "Denmark", "Egypt", "Hong Kong", "Colombia", "Chile",
        "Czech Republic", "Finland", "Portugal", "New Zealand", "Greece", "Turkey", "Indonesia", "Romania"
    ],
    "google": [
        "United States", "China", "Germany", "Japan", "India", "United Kingdom", "France", "Italy", "Brazil", "Canada",
        "South Korea", "Australia", "Spain", "Netherlands", "Switzerland", "Poland", "Sweden", "Belgium", "Norway",
        "Ireland", "Israel", "United Arab Emirates", "Singapore", "Austria", "Denmark", "Hong Kong", "Colombia", "Chile",
        "Czech Republic", "Finland", "Portugal", "New Zealand", "Greece", "Turkey", "Indonesia", "Malaysia", "Thailand",
        "Philippines", "South Africa", "Mexico", "Romania", "Argentina"
    ],
    "amazon": [
        "United States", "China", "Germany", "Japan", "India", "United Kingdom", "France", "Italy", "Brazil", "Canada",
        "Mexico", "South Korea", "Australia", "Spain", "Netherlands", "Saudi Arabia", "Poland", "Sweden", "Belgium",
        "Ireland", "Israel", "United Arab Emirates", "Singapore", "Austria", "South Africa", "Egypt", "Hong Kong",
        "Colombia", "Chile", "Czech Republic", "New Zealand", "Turkey", "Indonesia", "Vietnam", "Romania", "Argentina"
    ],
    "tcs": [
        "India", "United States", "United Kingdom", "Australia", "Singapore", "Canada", "Germany", "Netherlands",
        "United Arab Emirates", "Saudi Arabia", "South Africa", "Malaysia", "Indonesia", "Hong Kong", "Turkey",
        "France", "Switzerland", "Sweden", "Belgium", "Japan", "China", "Philippines", "Brazil", "Mexico", "Chile",
        "Poland", "Ireland", "Denmark", "Norway", "Finland", "Israel", "Thailand", "New Zealand"
    ],
    "infosys": [
        "India", "United States", "United Kingdom", "Germany", "Australia", "Canada", "Japan", "Switzerland", "Singapore",
        "China", "Poland", "Ireland", "Belgium", "France", "Netherlands", "Malaysia", "Romania", "Sweden",
        "United Arab Emirates", "Philippines", "Mexico", "Brazil", "New Zealand", "South Africa", "Czech Republic"
    ],
    "wipro": [
        "India", "United States", "United Kingdom", "United Arab Emirates", "Saudi Arabia", "Germany", "Australia",
        "Canada", "Singapore", "Brazil", "France", "Netherlands", "Switzerland", "Poland", "Romania", "Malaysia",
        "South Africa", "Philippines", "Japan", "Mexico", "Portugal", "Egypt"
    ],
    "cognizant": [
        "United States", "India", "United Kingdom", "Germany", "Netherlands", "Philippines", "Canada", "Australia",
        "Singapore", "Spain", "Poland", "Switzerland", "Malaysia", "Romania", "France", "Brazil", "Mexico",
        "United Arab Emirates", "Sweden", "Belgium", "Norway", "Denmark", "New Zealand", "Thailand"
    ],
    "hcl": [
        "India", "United States", "United Kingdom", "France", "Germany", "Sweden", "Vietnam", "Australia", "Singapore",
        "Poland", "Canada", "South Africa", "Finland", "Portugal", "Romania", "Malaysia", "Brazil", "Mexico",
        "New Zealand", "Switzerland", "Netherlands", "Philippines"
    ],
    "capgemini": [
        "France", "India", "United States", "United Kingdom", "Germany", "Spain", "Italy", "Netherlands", "Poland",
        "Brazil", "Australia", "Canada", "Belgium", "Sweden", "Norway", "Denmark", "Finland", "Portugal", "Romania",
        "Singapore", "Mexico", "Colombia", "Morocco", "Switzerland", "Austria"
    ],
    "sap": [
        "Germany", "United States", "India", "Switzerland", "Austria", "France", "United Kingdom", "Brazil", "Singapore",
        "China", "Canada", "Australia", "Netherlands", "Poland", "Czech Republic", "Japan", "South Korea", "Spain",
        "Italy", "Sweden", "Ireland", "Israel", "United Arab Emirates", "South Africa", "Belgium", "Denmark", "Norway", "Finland", "Portugal"
    ],
    "samsung": [
        "South Korea", "United States", "India", "Vietnam", "Poland", "United Kingdom", "Germany", "China", "Brazil",
        "Japan", "Singapore", "Philippines", "Indonesia", "Malaysia", "Thailand", "Turkey", "Egypt", "Kazakhstan",
        "Russia", "Mexico", "Canada", "Australia", "Netherlands"
    ],
    "sony": [
        "Japan", "United States", "United Kingdom", "Germany", "India", "China", "Canada", "Australia", "Singapore",
        "Sweden", "Belgium", "France", "Netherlands"
    ],
    "atlassian": [
        "Australia", "United States", "India", "United Kingdom", "Poland", "New Zealand", "Singapore", "Canada",
        "Netherlands", "Germany", "France"
    ],
    "spotify": [
        "Sweden", "United States", "United Kingdom", "Germany", "India", "Brazil", "France", "Spain", "Canada",
        "Australia", "Netherlands", "Italy", "Poland"
    ],
    "shopify": [
        "Canada", "United States", "United Kingdom", "Germany", "Ireland", "Australia", "Singapore", "New Zealand", "India"
    ],
    "asml": [
        "Netherlands", "United States", "South Korea", "Germany", "Japan", "China", "Ireland", "Belgium", "Singapore"
    ],
    "stripe": [
        "Ireland", "United States", "United Kingdom", "Singapore", "Canada", "Australia", "Germany", "France", "Japan",
        "Brazil", "India", "Netherlands", "Sweden", "New Zealand"
    ],
    "careem": [
        "United Arab Emirates", "Saudi Arabia", "Egypt", "Pakistan", "Jordan", "Morocco", "Kuwait"
    ],
    "nubank": [
        "Brazil", "Mexico", "Colombia", "United States", "Argentina"
    ],
    "mercadolibre": [
        "Argentina", "Brazil", "Mexico", "Chile", "Colombia", "Peru", "United States"
    ]
}

# Apply global office map to companies.json
for comp in companies:
    cid = comp["id"]
    if cid in global_office_map:
        comp["countries"] = global_office_map[cid]

with open(companies_path, "w", encoding="utf-8") as f:
    json.dump(companies, f, indent=2, ensure_ascii=False)

# Verify coverage of all 50 countries
country_names = [c["name"] for c in countries]
comp_countries = set()
for comp in companies:
    for c in comp.get("countries", []):
        comp_countries.add(c)

missing = set(country_names) - comp_countries
print(f"Total countries: {len(country_names)}")
print(f"Countries covered by at least 1 company: {len(country_names) - len(missing)}/50")
print(f"Missing countries: {missing}")

