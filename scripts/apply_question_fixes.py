import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_DIR = ROOT / "data" / "questions"

CORRECTIONS = {
    ("accenture.json", 10): {
        "correctAnswer": 2,  # '5 days'
        "explanation": (
            "**Given:**\n"
            "- A completes the task in 10 days (Rate = 1/10 per day).\n"
            "- B completes the task in 15 days (Rate = 1/15 per day).\n"
            "- A and B work together for 4 days before A leaves.\n\n"
            "**Formula / Method:**\n"
            "- Combined 1-day work = Rate(A) + Rate(B).\n"
            "- Work done = Combined rate × Days worked.\n"
            "- Remaining days for B = Remaining work ÷ Rate(B).\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Combined 1-day work = 1/10 + 1/15 = 3/30 + 2/30 = 5/30 = 1/6 per day.\n"
            "2. Work completed in 4 days together = 4 × (1/6) = 4/6 = 2/3.\n"
            "3. Remaining work = 1 − 2/3 = 1/3.\n"
            "4. Time required by B alone = (1/3) ÷ (1/15) = (1/3) × 15 = 5 days.\n\n"
            "**Final Answer:**\n"
            "B will take **5 days** to finish the remaining work."
        ),
    },
    ("amazon.json", 1): {
        "correctAnswer": 3,  # '8 days'
        "explanation": (
            "**Given:**\n"
            "- A completes the task in 12 days (Rate = 1/12 per day).\n"
            "- B completes the task in 18 days (Rate = 1/18 per day).\n"
            "- They work together for 4 days, then A leaves.\n\n"
            "**Formula / Method:**\n"
            "- Combined 1-day rate = Rate(A) + Rate(B).\n"
            "- Remaining days for B = (1 − Work done) ÷ Rate(B).\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Combined rate = 1/12 + 1/18 = 3/36 + 2/36 = 5/36 per day.\n"
            "2. Work done in 4 days = 4 × (5/36) = 20/36 = 5/9.\n"
            "3. Remaining work = 1 − 5/9 = 4/9.\n"
            "4. Time for B to finish alone = (4/9) ÷ (1/18) = (4/9) × 18 = 8 days.\n\n"
            "**Final Answer:**\n"
            "B will take **8 days** to finish the remaining work."
        ),
    },
    ("amazon.json", 21): {
        "correctAnswer": 3,  # '12'
        "explanation": (
            "**Given:**\n"
            "- Symbol rules: '+' means '×', '–' means '÷', '×' means '+', and '÷' means '–'.\n"
            "- Expression: 12 + 3 – 6 × 8 ÷ 2\n\n"
            "**Formula / Method:**\n"
            "- Substitute all operators according to the specified rules.\n"
            "- Evaluate the resulting arithmetic expression using standard BODMAS order of operations.\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Substituting operators: 12 × 3 ÷ 6 + 8 – 2.\n"
            "2. Multiplication and Division (left-to-right): 12 × 3 = 36; then 36 ÷ 6 = 6.\n"
            "3. Addition: 6 + 8 = 14.\n"
            "4. Subtraction: 14 – 2 = 12.\n\n"
            "**Final Answer:**\n"
            "The value of the expression is **12**."
        ),
    },
    ("cognizant.json", 11): {
        "correctAnswer": 0,  # '60 liters'
        "explanation": (
            "**Given:**\n"
            "- Initial ratio of Milk to Water = 7:3.\n"
            "- 10 liters of mixture is removed and replaced with 10 liters of pure milk.\n"
            "- Resulting ratio of Milk to Water = 3:1.\n\n"
            "**Formula / Method:**\n"
            "- Let total initial quantity = x liters.\n"
            "- When mixture is removed, milk and water are removed in the ratio 7:3.\n"
            "- Total volume remains x after replacement.\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Initial water content = (3/10)x liters.\n"
            "2. In 10 liters of removed mixture, water removed = 10 × (3/10) = 3 liters.\n"
            "3. Water remaining = (3/10)x − 3 (no water is added in the replacement).\n"
            "4. In the new 3:1 mixture, water fraction is 1/(3 + 1) = 1/4 of total volume x.\n"
            "5. Setting up the equation: (3/10)x − 3 = x / 4.\n"
            "6. Multiply by 20: 6x − 60 = 5x  =>  x = 60 liters.\n\n"
            "**Final Answer:**\n"
            "The original quantity of the mixture was **60 liters**."
        ),
    },
    ("cognizant.json", 18): {
        "correctAnswer": 1,  # 'North-East'
        "explanation": (
            "**Given:**\n"
            "- Initial facing direction: West (270° on standard compass).\n"
            "- Turn 1: 45° clockwise.\n"
            "- Turn 2: 90° anticlockwise.\n"
            "- Turn 3: 180° clockwise.\n\n"
            "**Formula / Method:**\n"
            "- Net angular change = (Clockwise angles) − (Anticlockwise angles).\n"
            "- Final direction = Initial angle + Net angular change (mod 360°).\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Net rotation = +45° − 90° + 180° = +135° (net clockwise rotation).\n"
            "2. Turning 135° clockwise from West:\n"
            "   - West + 90° clockwise = North (360°/0°).\n"
            "   - North + 45° clockwise = North-East (45°).\n\n"
            "**Final Answer:**\n"
            "The man is now facing **North-East**."
        ),
    },
    ("google.json", 2): {
        "correctAnswer": 2,  # '120'
        "explanation": (
            "**Given:**\n"
            "- Word: 'GOOGLE' (6 letters: 2 G's, 2 O's, 1 L, 1 E).\n"
            "- Condition: The two O's must never be together.\n\n"
            "**Formula / Method:**\n"
            "- Arrangements (never together) = (Total permutations) − (Permutations where O's are together).\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Total permutations of GOOGLE = 6! / (2! × 2!) = 720 / 4 = 180.\n"
            "2. Permutations where both O's are together: Treat (OO) as a single letter.\n"
            "   - Letters to arrange: (OO), G, G, L, E (5 items with 2 G's).\n"
            "   - Ways = 5! / 2! = 120 / 2 = 60.\n"
            "3. Permutations where O's are never together = 180 − 60 = 120.\n\n"
            "**Final Answer:**\n"
            "There are **120** ways to arrange the letters so that the two O's are never together."
        ),
    },
    ("google.json", 7): {
        "correctAnswer": 0,  # '7/9'
        "explanation": (
            "**Given:**\n"
            "- 10 balls numbered 1 to 10 in a jar.\n"
            "- 2 balls drawn at random without replacement.\n"
            "- Even numbers: {2, 4, 6, 8, 10} (5 numbers); Odd numbers: {1, 3, 5, 7, 9} (5 numbers).\n\n"
            "**Formula / Method:**\n"
            "- Product of two numbers is odd if and only if both numbers are odd.\n"
            "- P(product is even) = 1 − P(both numbers are odd).\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Total ways to select 2 balls from 10 = C(10, 2) = (10 × 9) / 2 = 45.\n"
            "2. Ways to select 2 odd numbers from 5 = C(5, 2) = (5 × 4) / 2 = 10.\n"
            "3. P(both numbers are odd) = 10 / 45 = 2/9.\n"
            "4. P(product is even) = 1 − 2/9 = 7/9.\n\n"
            "**Final Answer:**\n"
            "The probability that the product is even is **7/9**."
        ),
    },
    ("google.json", 9): {
        "correctAnswer": 1,  # '125'
        "explanation": (
            "**Given:**\n"
            "- Available digits: {1, 2, 3, 4, 5} with repetition allowed.\n"
            "- Target: 4-digit numbers divisible by 4.\n\n"
            "**Formula / Method:**\n"
            "- A number is divisible by 4 if and only if its last two digits form a number divisible by 4.\n"
            "- Total numbers = (Choices for 1st digit) × (Choices for 2nd digit) × (Valid last-2-digit pairs).\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. First digit (thousands place): 5 choices (1, 2, 3, 4, 5).\n"
            "2. Second digit (hundreds place): 5 choices (1, 2, 3, 4, 5).\n"
            "3. Last two digits: Must form a 2-digit multiple of 4 using {1, 2, 3, 4, 5}:\n"
            "   - Ending in 2: 12, 32, 52 (3 valid pairs)\n"
            "   - Ending in 4: 24, 44 (2 valid pairs)\n"
            "   - Total valid pairs for last two digits = 3 + 2 = 5 pairs (12, 24, 32, 44, 52).\n"
            "4. Total valid 4-digit numbers = 5 × 5 × 5 = 125.\n\n"
            "**Final Answer:**\n"
            "A total of **125** four-digit numbers can be formed."
        ),
    },
    ("google.json", 20): {
        "correctAnswer": 3,  # 'P'
        "explanation": (
            "**Given:**\n"
            "- 5 friends P, Q, R, S, T sitting in a row facing north.\n"
            "- T is at one of the extreme ends.\n"
            "- Q is sitting between P and T.\n"
            "- R is to the immediate right of S.\n\n"
            "**Formula / Method:**\n"
            "- Test both possible positions for extreme end T (position 1 or position 5) and verify all constraints.\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. If T is at the left end (position 1):\n"
            "   - Q is between P and T, so Q must be at position 2 and P at position 3.\n"
            "   - Remaining positions 4 and 5 must hold S and R.\n"
            "   - R is to the immediate right of S, placing S at position 4 and R at position 5.\n"
            "   - Complete arrangement: T - Q - P - S - R.\n"
            "2. If T is at the right end (position 5):\n"
            "   - Q is between P and T, so Q is at position 4 and P at position 3.\n"
            "   - Remaining positions 1 and 2 must hold S and R.\n"
            "   - R to immediate right of S places S at position 1 and R at position 2.\n"
            "   - Complete arrangement: S - R - P - Q - T.\n"
            "3. In both valid configurations, position 3 (the middle) is occupied by P.\n\n"
            "**Final Answer:**\n"
            "**P** is sitting in the middle."
        ),
    },
    ("hcl.json", 15): {
        "correctAnswer": 3,  # '128'
        "explanation": (
            "**Given:**\n"
            "- 3-digit numbers range from 100 to 999.\n"
            "- Divisor: 7.\n\n"
            "**Formula / Method:**\n"
            "- First 3-digit multiple of 7 = 7 × ceil(100/7).\n"
            "- Last 3-digit multiple of 7 = 7 × floor(999/7).\n"
            "- Total multiples in range = (n_max − n_min) + 1.\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. 100 ÷ 7 = 14.28...  =>  Smallest multiplier n_min = 15 (15 × 7 = 105).\n"
            "2. 999 ÷ 7 = 142.71... =>  Largest multiplier n_max = 142 (142 × 7 = 994).\n"
            "3. Total number of multiples = 142 − 15 + 1 = 128.\n\n"
            "**Final Answer:**\n"
            "There are **128** three-digit numbers divisible by 7."
        ),
    },
    ("ibm.json", 12): {
        "correctAnswer": 1,  # '80'
        "explanation": (
            "**Given:**\n"
            "- Group composition: 4 men and 5 women (total = 9 people).\n"
            "- Committee size: 3 people.\n"
            "- Condition: At least one woman must be included.\n\n"
            "**Formula / Method:**\n"
            "- Total ways (at least 1 woman) = Total selections − Selections with all men (0 women).\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Total ways to select 3 people from 9 = C(9, 3) = (9 × 8 × 7) / (3 × 2 × 1) = 84.\n"
            "2. Ways to select a committee of 3 with all men from 4 men = C(4, 3) = 4.\n"
            "3. Ways with at least one woman = 84 − 4 = 80.\n\n"
            "**Final Answer:**\n"
            "The committee can be formed in **80** ways."
        ),
    },
    ("infosys.json", 16): {
        "correctAnswer": 3,  # 'BMHPSJUIN'
        "explanation": (
            "**Given:**\n"
            "- 'COMPUTATION' is coded with each letter shifted by +1 in alphabetical order:\n"
            "  C(+1)=D, O(+1)=P, M(+1)=N, P(+1)=Q, U(+1)=V, T(+1)=U, A(+1)=B, T(+1)=U, I(+1)=J, O(+1)=P, N(+1)=O.\n\n"
            "**Formula / Method:**\n"
            "- Apply the +1 alphabetical shift to each letter of 'ALGORITHM'.\n\n"
            "**Step-by-Step Calculation:**\n"
            "- A (+1) = B\n"
            "- L (+1) = M\n"
            "- G (+1) = H\n"
            "- O (+1) = P\n"
            "- R (+1) = S\n"
            "- I (+1) = J\n"
            "- T (+1) = U\n"
            "- H (+1) = I\n"
            "- M (+1) = N\n\n"
            "**Final Answer:**\n"
            "'ALGORITHM' is coded as **BMHPSJUIN**."
        ),
    },
    ("tcs.json", 5): {
        "correctAnswer": 0,  # '8 days'
        "explanation": (
            "**Given:**\n"
            "- A completes the work in 12 days (Rate = 1/12 per day).\n"
            "- B completes the work in 18 days (Rate = 1/18 per day).\n"
            "- A and B work together for 4 days, then A leaves.\n\n"
            "**Formula / Method:**\n"
            "- Combined 1-day rate = Rate(A) + Rate(B).\n"
            "- Work done = Combined rate × 4.\n"
            "- Remaining days for B = (1 − Work done) ÷ Rate(B).\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. Combined rate = 1/12 + 1/18 = 3/36 + 2/36 = 5/36 per day.\n"
            "2. Work completed in 4 days = 4 × (5/36) = 20/36 = 5/9.\n"
            "3. Remaining work = 1 − 5/9 = 4/9.\n"
            "4. Time for B alone to complete 4/9 work = (4/9) ÷ (1/18) = (4/9) × 18 = 8 days.\n\n"
            "**Final Answer:**\n"
            "B will take **8 days** to finish the remaining work."
        ),
    },
    ("tcs.json", 20): {
        "correctAnswer": 3,  # 'Q'
        "explanation": (
            "**Given:**\n"
            "- 6 people P, Q, R, S, T, U sitting in a row facing north (positions 1 to 6 from left to right).\n"
            "- P sits 3rd from the left (position 3).\n"
            "- Q sits to the immediate left of T (adjacent pair: [Q, T]).\n"
            "- S sits at an extreme end (position 1 or 6).\n"
            "- R is not adjacent to S.\n\n"
            "**Formula / Method:**\n"
            "- Evaluate possible positions for [Q, T] and extreme position S, verifying the non-adjacency constraint for R.\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. P is fixed at position 3: [_, _, P, _, _, _].\n"
            "2. The pair [Q, T] requires two consecutive empty seats. Since P is at 3, the pair must be at positions 4 and 5 (Q at 4, T at 5).\n"
            "3. With Q at 4 and T at 5, positions 1, 2, and 6 remain for S, R, and U.\n"
            "4. S is at an extreme end (position 1 or 6):\n"
            "   - If S is at 1, R cannot be at 2 (not adjacent to S), so R is at 6 and U is at 2: [S, U, P, Q, T, R].\n"
            "   - If S is at 6, R cannot be at 5 (already occupied by T anyway), so R is at 1 or 2, and U takes the other: [R/U, U/R, P, Q, T, S].\n"
            "5. In all valid arrangements, position 4 is occupied by Q.\n"
            "6. The person to the immediate right of P (position 3) is at position 4, which is Q.\n\n"
            "**Final Answer:**\n"
            "**Q** sits to the immediate right of P."
        ),
    },
    ("tcs.json", 22): {
        "correctAnswer": 1,  # 'P is the mother of S'
        "explanation": (
            "**Given:**\n"
            "- 'A + B' means 'A is the father of B'.\n"
            "- 'A - B' means 'A is the wife of B'.\n"
            "- 'A × B' means 'A is the sister of B'.\n"
            "- Expression: 'P - Q + R × S'\n\n"
            "**Formula / Method:**\n"
            "- Decode relationships left to right according to the specified definitions.\n\n"
            "**Step-by-Step Calculation:**\n"
            "1. 'P - Q': P is the wife of Q (Q is husband, P is wife).\n"
            "2. 'Q + R': Q is the father of R.\n"
            "3. Since P is the wife of Q and Q is the father of R, P is the mother of R.\n"
            "4. 'R × S': R is the sister of S (R and S share the same parents, Q and P).\n"
            "5. Therefore, P is the mother of S.\n\n"
            "**Final Answer:**\n"
            "The expression means **P is the mother of S**."
        ),
    },
}

def main():
    modified_files = set()
    for (filename, qid), update in CORRECTIONS.items():
        filepath = QUESTIONS_DIR / filename
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        for q in data.get("questions", []):
            if q["id"] == qid:
                q["correctAnswer"] = update["correctAnswer"]
                q["explanation"] = update["explanation"]
                modified_files.add(filename)
                print(f"Updated {filename} Q{qid} -> correctAnswer: {update['correctAnswer']}")
                break
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print(f"Successfully updated {len(CORRECTIONS)} questions across {len(modified_files)} files.")

if __name__ == "__main__":
    main()

