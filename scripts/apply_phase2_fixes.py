#!/usr/bin/env python3
"""Apply verified corrections for confirmed unambiguous questions in PrepWise question bank."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUESTION_DIR = ROOT / "data" / "questions"

CORRECTIONS = {
    ("tcs.json", 9): {
        "options": ["30 litres", "24 litres", "35 litres", "28 litres"],
        "correctAnswer": 2,
        "explanation": (
            "**Given:**\n"
            "- Initial mixture volume = 40 litres\n"
            "- Initial ratio of Milk to Water = 3 : 1\n"
            "- Target ratio of Milk to Water = 2 : 3\n\n"
            "**Formula / Method:**\n"
            "- Initial Milk = (3 / (3 + 1)) × 40 = 30 litres\n"
            "- Initial Water = (1 / (3 + 1)) × 40 = 10 litres\n"
            "- Let x litres of water be added. The quantity of milk remains 30 litres.\n"
            "- Mixture equation: Milk / (Water + x) = 2 / 3\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. 30 / (10 + x) = 2 / 3\n"
            "2. Cross-multiplying: 30 × 3 = 2 × (10 + x)\n"
            "3. 90 = 20 + 2x\n"
            "4. 2x = 90 - 20 = 70\n"
            "5. x = 70 / 2 = 35 litres\n\n"
            "**Final Answer:**\n"
            "The quantity of water that must be added is 35 litres. (C) 35 litres"
        )
    },
    ("amazon.json", 26): {
        "options": ["Thursday", "Wednesday", "Tuesday", "Monday"],
        "correctAnswer": 1,
        "explanation": (
            "**Given:**\n"
            "- The day before yesterday was Thursday.\n\n"
            "**Formula / Method:**\n"
            "- Yesterday = Thursday + 1 day = Friday\n"
            "- Today = Friday + 1 day = Saturday\n"
            "- Tomorrow = Saturday + 1 day = Sunday\n"
            "- Target day = Tomorrow + 3 days\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Today is Saturday, so tomorrow is Sunday.\n"
            "2. 1 day after tomorrow = Monday\n"
            "3. 2 days after tomorrow = Tuesday\n"
            "4. 3 days after tomorrow = Sunday + 3 days = Wednesday\n\n"
            "**Final Answer:**\n"
            "Three days after tomorrow will be Wednesday. (B) Wednesday"
        )
    },
    ("cognizant.json", 47): {
        "options": ["2", "4", "1", "3"],
        "correctAnswer": 2,
        "explanation": (
            "**Given:**\n"
            "- SQL query: SELECT COUNT(*) FROM (SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 1 UNION SELECT 1) AS t;\n\n"
            "**Formula / Method:**\n"
            "- In standard SQL (ANSI SQL, PostgreSQL, SQLite, MySQL), UNION and UNION ALL have equal precedence and are evaluated from left to right.\n"
            "- UNION ALL preserves duplicate rows, while UNION performs set union and eliminates duplicate rows across the combined result.\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. First operation: (SELECT 1) UNION ALL (SELECT 1) produces 2 rows: {1, 1}.\n"
            "2. Second operation: {1, 1} UNION ALL (SELECT 1) produces 3 rows: {1, 1, 1}.\n"
            "3. Third operation: {1, 1, 1} UNION (SELECT 1) combines the rows and eliminates all duplicates, yielding a single distinct row: {1}.\n"
            "4. COUNT(*) evaluates the outer result set of 1 row, returning 1.\n\n"
            "**Final Answer:**\n"
            "The output of the query is 1. (C) 1"
        )
    },
    ("microsoft.json", 8): {
        "options": ["120/2300", "211/2300", "56/2300", "200/2300"],
        "correctAnswer": 1,
        "explanation": (
            "**Given:**\n"
            "- Drawer contents: 10 blue, 8 black, 7 red socks (Total = 25 socks)\n"
            "- 3 socks are drawn randomly without replacement.\n\n"
            "**Formula / Method:**\n"
            "- Total possible outcomes = C(25, 3)\n"
            "- Favorable outcomes = C(10, 3) [all blue] + C(8, 3) [all black] + C(7, 3) [all red]\n"
            "- Probability = Favorable outcomes / Total outcomes\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. C(25, 3) = (25 × 24 × 23) / (3 × 2 × 1) = 25 × 4 × 23 = 2300\n"
            "2. C(10, 3) = (10 × 9 × 8) / (3 × 2 × 1) = 120 (all blue)\n"
            "3. C(8, 3) = (8 × 7 × 6) / (3 × 2 × 1) = 56 (all black)\n"
            "4. C(7, 3) = (7 × 6 × 5) / (3 × 2 × 1) = 35 (all red)\n"
            "5. Total favorable outcomes = 120 + 56 + 35 = 211\n"
            "6. Probability = 211 / 2300\n\n"
            "**Final Answer:**\n"
            "The probability that all 3 socks are of the same color is 211/2300. (B) 211/2300"
        )
    },
    ("microsoft.json", 27): {
        "options": ["118", "98", "124", "107"],
        "correctAnswer": 0,
        "explanation": (
            "**Given:**\n"
            "- Coding rule: Letter values are based on alphabetical positions (A=1, B=2, ..., Z=26).\n"
            "- Example: APPLE = 1 + 16 + 16 + 12 + 5 = 50\n\n"
            "**Formula / Method:**\n"
            "- Code for MICROSOFT = Sum of alphabetical positions of all letters in 'MICROSOFT'.\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. M = 13\n"
            "2. I = 9\n"
            "3. C = 3\n"
            "4. R = 18\n"
            "5. O = 15\n"
            "6. S = 19\n"
            "7. O = 15\n"
            "8. F = 6\n"
            "9. T = 20\n"
            "10. Sum = 13 + 9 + 3 + 18 + 15 + 19 + 15 + 6 + 20 = 118\n\n"
            "**Final Answer:**\n"
            "The code for MICROSOFT is 118. (A) 118"
        )
    },
    ("ibm.json", 3): {
        "options": ["20/3 days", "7.5 days", "8 days", "6 days"],
        "correctAnswer": 0,
        "explanation": (
            "**Given:**\n"
            "- A can finish the work in 15 days.\n"
            "- B can finish the work in 20 days.\n"
            "- C can finish the work in 30 days.\n\n"
            "**Formula / Method:**\n"
            "- Combined work rate per day = 1/A + 1/B + 1/C\n"
            "- Total time required = 1 / (Combined work rate)\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. A's 1-day work = 1/15\n"
            "2. B's 1-day work = 1/20\n"
            "3. C's 1-day work = 1/30\n"
            "4. LCM of 15, 20, and 30 is 60.\n"
            "5. Combined work = 4/60 + 3/60 + 2/60 = (4 + 3 + 2)/60 = 9/60 = 3/20 per day.\n"
            "6. Total time = 1 / (3/20) = 20/3 days (or 6 2/3 days).\n\n"
            "**Final Answer:**\n"
            "Together they can finish the work in 20/3 days. (A) 20/3 days"
        )
    },
    ("wipro.json", 1): {
        "options": ["Rs. 180", "Rs. 160", "Rs. 240", "Rs. 200"],
        "correctAnswer": 2,
        "explanation": (
            "**Given:**\n"
            "- Original profit = 20%\n"
            "- Hypothetical cost price = 10% less than original CP\n"
            "- Hypothetical selling price = Rs. 18 less than original SP\n"
            "- Resulting profit in hypothetical scenario = 25%\n\n"
            "**Formula / Method:**\n"
            "- Let original cost price = C\n"
            "- Original SP = 1.20C\n"
            "- New CP = 0.90C\n"
            "- New SP = 1.20C - 18\n"
            "- Since new profit is 25%: New SP = 1.25 × New CP\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. 1.20C - 18 = 1.25 × (0.90C)\n"
            "2. 1.20C - 18 = 1.125C\n"
            "3. 1.20C - 1.125C = 18\n"
            "4. 0.075C = 18\n"
            "5. C = 18 / 0.075 = 18000 / 75 = 240\n\n"
            "**Final Answer:**\n"
            "The cost price of the article is Rs. 240. (C) Rs. 240"
        )
    },
    ("hcl.json", 14): {
        "options": ["10 years", "13 years", "12 years", "15 years"],
        "correctAnswer": 1,
        "explanation": (
            "**Given:**\n"
            "- Sum of present ages of father (F) and son (S) = 50 years\n"
            "- 5 years ago, father's age was 4 times son's age.\n\n"
            "**Formula / Method:**\n"
            "- F + S = 50 => F = 50 - S\n"
            "- 5 years ago: Father's age = F - 5, Son's age = S - 5\n"
            "- Equation: (F - 5) = 4 × (S - 5)\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Substitute F = 50 - S: (50 - S - 5) = 4(S - 5)\n"
            "2. 45 - S = 4S - 20\n"
            "3. 45 + 20 = 4S + S\n"
            "4. 65 = 5S\n"
            "5. S = 65 / 5 = 13 years\n\n"
            "**Final Answer:**\n"
            "The present age of the son is 13 years. (B) 13 years"
        )
    },
    ("amazon.json", 2): {
        "options": ["43.75%", "37.5%", "56.25%", "38.89%"],
        "correctAnswer": 3,
        "explanation": (
            "**Given:**\n"
            "- Merchant purchases goods at 20% discount on initial marked price (M).\n"
            "- Desired profit = 25% on cost price (CP).\n"
            "- Discount offered to customer on new marked price (M') = 10%.\n\n"
            "**Formula / Method:**\n"
            "- CP = M × (1 - 0.20) = 0.80M\n"
            "- Selling Price (SP) = CP × (1 + 0.25) = 0.80M × 1.25 = M\n"
            "- Customer discount gives SP = M' × (1 - 0.10) = 0.90M'\n"
            "- Markup % above CP = ((M' - CP) / CP) × 100\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. 0.90M' = M => M' = M / 0.90 = (10/9)M\n"
            "2. CP = 0.80M = (4/5)M\n"
            "3. Markup amount = M' - CP = (10/9 - 4/5)M = ((50 - 36) / 45)M = (14/45)M\n"
            "4. Markup % = ((14/45)M / (4/5)M) × 100 = (14 × 5) / (45 × 4) × 100\n"
            "5. Markup % = (70 / 180) × 100 = (7 / 18) × 100 = 38.888...% ≈ 38.89%\n\n"
            "**Final Answer:**\n"
            "The merchant should mark the goods 38.89% above cost price. (D) 38.89%"
        )
    }
}


def apply_fixes():
    total_applied = 0
    by_file = {}
    for (filename, qid), fix_data in CORRECTIONS.items():
        by_file.setdefault(filename, {})[qid] = fix_data

    for filename, fixes in by_file.items():
        filepath = QUESTION_DIR / filename
        data = json.loads(filepath.read_text(encoding="utf-8"))
        modified = False

        for question in data.get("questions", []):
            qid = question.get("id")
            if qid in fixes:
                fix = fixes[qid]
                question["options"] = fix["options"]
                question["correctAnswer"] = fix["correctAnswer"]
                question["explanation"] = fix["explanation"]
                modified = True
                total_applied += 1
                print(f"Applied fix to {filename} Q{qid} (correctAnswer: {fix['correctAnswer']})")

        if modified:
            filepath.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\nSuccessfully applied {total_applied} confirmed question fixes across {len(by_file)} datasets.")


if __name__ == "__main__":
    apply_fixes()

