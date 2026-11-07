# PrepWise — Global MNC Interview Prep & Freshers Placement Accelerator

A zero-login, frictionless platform providing verified company-specific interview preparation, entry-level job descriptions with in-hand CTC breakdowns, and real-time auto-updating MNC hiring news for engineering and science graduates globally.

---

## 🌟 What's New: Freshers 2025/2026 Edition

1. **🟡 Electric Yellow & ⬛ Deep Black Brand Identity:**
   - Redesigned visual branding with an electric yellow (`#facc15`) and deep solid black (`#000000`) logo icon, brand badge, and high-energy contrast theme.

2. **📰 Real-Time MNC Hiring News & Live Ticker:**
   - **MNC Live Recruitment Ticker**: Placed right under the navigation bar across all pages with a live pulsing red beacon (`🔴`), automatically rotating breaking hiring bulletins from TCS, Infosys, Google, Microsoft, Amazon, Accenture, Wipro, and Cognizant.
   - **MNC Freshers News Grid**: Dedicated live feed with category filters (*Campus Drives*, *Big Tech*, *Massive Openings*, *Pattern Updates*).
   - **Auto-Updating Engine**: Simulated real-time stream that updates timestamps and injects breaking MNC recruitment alerts, plus a **"🔄 Live Refresh MNC News"** manual fetcher.

3. **💼 Detailed Fresher Job Descriptions & CTC Breakdowns:**
   - Every company hub now features dedicated **Freshers / Campus Hire roles** (Batch 2025 & 2026):
     - **Graduate Engineer Trainee (GET) / Associate Software Engineer (ASE)** (₹4.5 - ₹7.5 LPA / $75,000)
     - **Software Development Engineer I (College Hire)** (₹22 - ₹36 LPA / $145,000 - $175,000)
     - **Digital Specialist / Ninja & Prime Programmer** (₹9.0 - ₹15.0 LPA / $90,000)
     - **Associate Cloud & Systems Engineer** (₹14 - ₹22 LPA / $115,000)
     - **Junior QA & Automation Test Engineer** (₹4.8 - ₹7.0 LPA / $78,000)
   - **Full In-Hand CTC Breakdown**: Fixed Base Pay, Relocation / Joining Bonus, Annual Performance Variable, Stock Grants (RSUs), and Retention Incentives.
   - **Fresher Eligibility Criteria**: Batch years (2025 & 2026), minimum percentage / CGPA cutoff (60% or 6.5 CGPA), branch criteria, and backlog policies.
   - **Day-to-Day Responsibilities**: Plain-English breakdown of what a fresh graduate actually does on the job.
   - **4-Phase Fresher Placement Roadmap**: Step-by-step month-by-month study plan.

4. **⚡ 4 Difficulty Tiers (Beginner to Legend):**
   - **🌱 Level 1: Beginner** — Syntax foundations, arithmetic, grammar, basic logic.
   - **⚡ Level 2: Intermediate** — Standard campus placement tests, trees/arrays, OOP, SQL.
   - **⚔️ Level 3: Advanced** — Dynamic programming, graph algorithms, concurrency, system architecture.
   - **👑 Level 4: Legend** — Extreme FAANG-tier algorithmic challenges with animated gold-glow styling.

5. **🌍 Clean 50-Country Filter:**
   - Clean, standard alphabetical dropdown with flag icons.
   - Strict matching: shows only companies actively operating in the chosen country.

6. **📢 High-Impact Stealth Advertising System:**
   - In-feed native company cards, sponsored fresher job listings, in-question study tools, sticky bottom anchor bar, desktop wallpaper gutters, and floating corner outstream video player.

---

## 📂 Project Architecture

```
prepwise/
├── index.html                 # Homepage with yellow & black branding, MNC news ticker & feed
├── company.html               # Company Hub with rich fresher JDs, CTC breakdown & level tests
├── quiz.html                  # Interactive quiz engine with live difficulty switcher & role banner
├── about.html                 # Mission, FAQ, zero-login philosophy
├── css/
│   └── style.css              # Yellow/black logo, news ticker, fresher CTC box, level glow
├── js/
│   ├── app.js                 # 50-country strict filtering, stealth in-feed sponsor cards
│   ├── news.js                # Auto-updating MNC hiring news ticker & live news feed
│   ├── company.js             # Detailed fresher JDs, CTC calculator, roles & level practice
│   ├── quiz.js                # Quiz logic, 4 difficulty levels, role preparation, step solutions
│   └── ads.js                 # Wallpaper takeover, sticky anchor, floating video, ad control pill
└── data/
    ├── news.json              # Live MNC campus drive announcements & eligibility updates
    ├── countries.json         # Top 50 countries, flags, tech hubs, top employers
    ├── companies.json         # 22+ companies with full fresher JDs, CTC benchmarks & country lists
    └── questions/             # 1,100+ questions across 22 companies with level calibration
```

---

## 📚 Beginner Documentation

Start with the guides below:

- [Master Project Summary](./PROJECT_SUMMARY.md) — architecture, pages, data flow, and maintenance notes
- [Beginner Guide](./BEGINNER_GUIDE.md) — first steps, folder tour, and common debugging
- [How To Run and Work on PrepWise](./HOW_TO_RUN.md) — local server, URLs, validation, and release checklist
- [Data and Content Guide](./DATA_AND_CONTENT.md) — JSON shapes, relationships, and generator scripts

## 🚀 How to Run Locally

```powershell
cd C:\Users\ra416\OneDrive\Desktop\prepwise
python -m http.server 3456
```

Open your browser to: **`http://localhost:3456`**
