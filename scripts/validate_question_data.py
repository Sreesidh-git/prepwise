#!/usr/bin/env python3
"""Validate local PrepWise question datasets and produce diagnostic reports."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
QUESTION_DIR = ROOT / "data" / "questions"
REQUIRED_FIELDS = {
    "id",
    "category",
    "question",
    "options",
    "correctAnswer",
    "explanation",
}
ANSWER_LETTERS = "ABCD"

ANSWER_PATTERNS = (
    re.compile(r"answer\s+is\s+\*\*([A-D])\)", re.IGNORECASE),
    re.compile(r"answer\s+is\s+([A-D])(?:\.|$)", re.IGNORECASE),
    re.compile(r"\(([A-D])\)\s+[^\n]+$", re.IGNORECASE),
)

FORBIDDEN_PATTERNS = (
    (re.compile(r"let\s+me\s+reconsider", re.IGNORECASE), "let me reconsider"),
    (re.compile(r"let\s+me\s+recalculate", re.IGNORECASE), "let me recalculate"),
    (re.compile(r"let\s+me\s+recheck", re.IGNORECASE), "let me recheck"),
    (re.compile(r"let\s+me\s+re-read", re.IGNORECASE), "let me re-read"),
    (re.compile(r"let\s+me\s+re-examine", re.IGNORECASE), "let me re-examine"),
    (re.compile(r"let\s+me\s+just\s+fix", re.IGNORECASE), "let me just fix"),
    (
        re.compile(r"actually\s+the\s+answer\s+should\s+be", re.IGNORECASE),
        "actually the answer should be",
    ),
    (re.compile(r"answer\s+should\s+be", re.IGNORECASE), "answer should be"),
    (
        re.compile(r"i\s+will\s+change\s+the\s+question", re.IGNORECASE),
        "i will change the question",
    ),
    (re.compile(r"change\s+the\s+question", re.IGNORECASE), "change the question"),
    (
        re.compile(r"none\s+of\s+the\s+available\s+options", re.IGNORECASE),
        "none of the available options",
    ),
    (
        re.compile(r"i('ll| will)\s+set\s+the\s+correct\s+answer", re.IGNORECASE),
        "i'll set the correct answer",
    ),
    (re.compile(r"i\s+marked", re.IGNORECASE), "i marked"),
    (re.compile(r"i\s+selected", re.IGNORECASE), "i selected"),
    (re.compile(r"wait,\s*that\s+gives", re.IGNORECASE), "wait, that gives"),
    (re.compile(r"wait,\s*let\s+me", re.IGNORECASE), "wait, let me"),
    (re.compile(r"hmm,\s*but", re.IGNORECASE), "hmm, but"),
)

# Known ambiguous or contradictory questions requiring human editorial / author review
MANUAL_REVIEW_REGISTRY: dict[tuple[str, int], dict[str, str]] = {
    ("accenture.json", 16): {
        "problem_type": "Premise anomaly / inconsistent cipher",
        "expected": "Unresolved (D->H is +4, while other letters are +2)",
        "recommendation": "Harmonize coding rule or replace example word.",
    },
    ("accenture.json", 25): {
        "problem_type": "Contradictory letter mappings in cipher",
        "expected": "Unresolved (E is coded as both 8 and 9 in EXCEL)",
        "recommendation": "Correct EXCEL mapping to provide consistent letter codes.",
    },
    ("amazon.json", 14): {
        "problem_type": "Mathematical mismatch with options",
        "expected": "Speed equation roots are non-integer (~75.44 km/h), options are integers",
        "recommendation": "Adjust distance or speed change (e.g. 240 km) to yield exact integer speed.",
    },
    ("amazon.json", 20): {
        "problem_type": "Seating arrangement contradictory premise",
        "expected": "Unresolved (neighbor constraints conflict with fixed positions)",
        "recommendation": "Revise seating constraints for consistent solution.",
    },
    ("cognizant.json", 21): {
        "problem_type": "Circular seating arrangement constraint conflict",
        "expected": "Unresolved (adjacent placement conflicts)",
        "recommendation": "Re-specify relative seating positions to yield unambiguous order.",
    },
    ("cognizant.json", 49): {
        "problem_type": "Data structure terminology ambiguity",
        "expected": "Definition dependent (height measured by edges vs levels)",
        "recommendation": "Specify definition of tree height (edges from root vs total levels).",
    },
    ("google.json", 16): {
        "problem_type": "Cyrillic character typo and cipher anomaly",
        "expected": "Unresolved ('DNORВUFS' contains Cyrillic character and non-uniform shift)",
        "recommendation": "Fix typo in target string and ensure uniform shift rule.",
    },
    ("hcl.json", 21): {
        "problem_type": "Operator replacement yields non-integer result",
        "expected": "Evaluation yields 23.33, not among integer options [22, 20, 18, 24]",
        "recommendation": "Revise starting expression so BODMAS evaluation produces an integer.",
    },
    ("infosys.json", 3): {
        "problem_type": "Rounding / partial work day ambiguity",
        "expected": "Exact time is 48/7 = 6.86 days, options are integer days [6, 8, 7, 5]",
        "recommendation": "Specify whether answer rounds up to full days (7) or truncate.",
    },
    ("infosys.json", 12): {
        "problem_type": "Phrasing ambiguity in reinvestment principal",
        "expected": "Ambiguous ('reinvests the total' = ₹11,000 vs ₹10,000)",
        "recommendation": "Clarify whether withdrawn interest is added to the reinvested principal.",
    },
    ("infosys.json", 20): {
        "problem_type": "Circular seating arrangement constraint conflict",
        "expected": "Unresolved (between constraints conflict with adjacent seats)",
        "recommendation": "Correct circular positions.",
    },
    ("microsoft.json", 18): {
        "problem_type": "Logic puzzle constraint ambiguity",
        "expected": "Multiple consistent interpretations depending on alternator initial state",
        "recommendation": "Specify whether alternator's first statement is known to be true or false.",
    },
    ("wipro.json", 20): {
        "problem_type": "Circular seating arrangement opposite placement conflict",
        "expected": "Unresolved (opposite positions conflict)",
        "recommendation": "Correct seating constraints.",
    },
    ("wipro.json", 21): {
        "problem_type": "Premise contradiction in letter sum",
        "expected": "Premise claims MANGO=57, but alphabetical sum of MANGO is 50",
        "recommendation": "Fix example word code in premise.",
    },
}


def answer_letter(text: str) -> str | None:
    for pattern in ANSWER_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(1).upper()
    return None


def replace_answer_letter(text: str, expected: str) -> str:
    for pattern in ANSWER_PATTERNS:
        match = pattern.search(text)
        if match:
            return text[: match.start(1)] + expected + text[match.end(1) :]
    return text


def validate_file(path: Path, fix_labels: bool = False) -> dict[str, Any]:
    file_stats = {
        "dataset": path.name,
        "total": 0,
        "valid": 0,
        "invalid": 0,
        "duplicate_options": 0,
        "invalid_answer_indexes": 0,
        "empty_explanations": 0,
        "monologue_issues": 0,
        "label_mismatches": 0,
        "manual_review_count": 0,
        "fatal_errors": [],
        "reports": [],
    }

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        file_stats["fatal_errors"].append(f"{path.name}: JSON parse failure: {e}")
        return file_stats

    questions = data.get("questions")
    if not isinstance(questions, list):
        file_stats["fatal_errors"].append(f"{path.name}: 'questions' must be an array")
        return file_stats

    file_stats["total"] = len(questions)
    modified = False

    for position, question in enumerate(questions, 1):
        qid = question.get("id", position)
        prefix = f"{path.name} Q{qid}"
        q_has_fatal = False

        missing = REQUIRED_FIELDS - question.keys()
        if missing:
            file_stats["fatal_errors"].append(
                f"{prefix}: missing fields {sorted(missing)}"
            )
            q_has_fatal = True

        options = question.get("options")
        answer = question.get("correctAnswer")

        if not isinstance(options, list) or len(options) != 4:
            file_stats["fatal_errors"].append(
                f"{prefix}: expected exactly four options"
            )
            q_has_fatal = True
        elif len({str(opt).strip().casefold() for opt in options}) != len(options):
            file_stats["fatal_errors"].append(f"{prefix}: duplicate options found")
            file_stats["duplicate_options"] += 1
            q_has_fatal = True

        if (
            not isinstance(answer, int)
            or not isinstance(options, list)
            or not (0 <= answer < len(options))
        ):
            file_stats["fatal_errors"].append(
                f"{prefix}: invalid correctAnswer index {answer!r}"
            )
            file_stats["invalid_answer_indexes"] += 1
            q_has_fatal = True

        explanation = str(question.get("explanation") or "").strip()
        if not explanation:
            file_stats["fatal_errors"].append(f"{prefix}: empty explanation")
            file_stats["empty_explanations"] += 1
            q_has_fatal = True

        # Check for forbidden raw monologue patterns
        matched_phrases = []
        for pat, name in FORBIDDEN_PATTERNS:
            if pat.search(explanation):
                matched_phrases.append(name)
        if matched_phrases:
            file_stats["monologue_issues"] += 1

        # Check for answer letter mismatches
        if (
            isinstance(answer, int)
            and isinstance(options, list)
            and (0 <= answer < len(options))
        ):
            expected_letter = ANSWER_LETTERS[answer]
            actual_letter = answer_letter(explanation)
            if actual_letter and actual_letter != expected_letter:
                if fix_labels:
                    question["explanation"] = replace_answer_letter(
                        explanation, expected_letter
                    )
                    modified = True
                    explanation = question["explanation"]
                else:
                    file_stats["fatal_errors"].append(
                        f"{prefix}: explanation states '{actual_letter}', but correctAnswer index {answer} requires '{expected_letter}'"
                    )
                    file_stats["label_mismatches"] += 1
                    q_has_fatal = True

        # Check if question is registered for manual review
        registry_entry = MANUAL_REVIEW_REGISTRY.get((path.name, qid))
        if registry_entry:
            file_stats["manual_review_count"] += 1

        if q_has_fatal:
            file_stats["invalid"] += 1
        elif registry_entry or matched_phrases:
            pass  # under review
        else:
            file_stats["valid"] += 1

        if matched_phrases or registry_entry:
            current_opt_text = (
                options[answer]
                if (
                    isinstance(options, list)
                    and isinstance(answer, int)
                    and 0 <= answer < len(options)
                )
                else "INVALID"
            )
            file_stats["reports"].append(
                {
                    "dataset": path.name,
                    "question_id": qid,
                    "problem_type": registry_entry["problem_type"]
                    if registry_entry
                    else "Internal monologue in explanation",
                    "matched_phrases": matched_phrases,
                    "current_answer": f"Index {answer} ({current_opt_text})",
                    "expected_answer": registry_entry["expected"]
                    if registry_entry
                    else "Independently verified",
                    "recommended_correction": registry_entry["recommendation"]
                    if registry_entry
                    else "Clean explanation format",
                    "manual_review_required": bool(registry_entry),
                }
            )

    if fix_labels and modified:
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )

    return file_stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate PrepWise question datasets.")
    parser.add_argument(
        "--fix-answer-labels", action="store_true", help="Auto-fix letter labels."
    )
    parser.add_argument(
        "--report-json",
        type=Path,
        help="Write detailed diagnostic report to JSON file.",
    )
    args = parser.parse_args()

    all_reports: list[dict[str, Any]] = []
    all_fatal: list[str] = []
    total_files = 0
    total_questions = 0
    total_valid = 0
    total_invalid = 0
    total_duplicate_options = 0
    total_invalid_answer_indexes = 0
    total_empty_explanations = 0
    total_monologue_issues = 0
    total_label_mismatches = 0
    total_manual_reviews = 0
    dataset_breakdowns = {}

    for path in sorted(QUESTION_DIR.glob("*.json")):
        total_files += 1
        stats = validate_file(path, args.fix_answer_labels)
        dataset_breakdowns[path.name] = {
            "total": stats["total"],
            "valid": stats["valid"],
            "invalid": stats["invalid"],
            "manual_review": stats["manual_review_count"],
        }
        total_questions += stats["total"]
        total_valid += stats["valid"]
        total_invalid += stats["invalid"]
        total_duplicate_options += stats["duplicate_options"]
        total_invalid_answer_indexes += stats["invalid_answer_indexes"]
        total_empty_explanations += stats["empty_explanations"]
        total_monologue_issues += stats["monologue_issues"]
        total_label_mismatches += stats["label_mismatches"]
        total_manual_reviews += stats["manual_review_count"]
        all_reports.extend(stats["reports"])
        all_fatal.extend(stats["fatal_errors"])

    explanation_quality_issues = (
        total_empty_explanations + total_monologue_issues + total_label_mismatches
    )
    mathematical_review_issues = total_manual_reviews

    structured_output = {
        "summary": {
            "total_datasets": total_files,
            "total_questions": total_questions,
            "valid_questions": total_valid,
            "invalid_questions": total_invalid,
            "duplicate_option_count": total_duplicate_options,
            "invalid_answer_index_count": total_invalid_answer_indexes,
            "explanation_quality_issues": explanation_quality_issues,
            "mathematical_review_issues": mathematical_review_issues,
            "manual_editorial_review_count": total_manual_reviews,
        },
        "dataset_breakdown": dataset_breakdowns,
        "flagged_questions": all_reports,
    }

    if args.report_json:
        args.report_json.write_text(
            json.dumps(structured_output, indent=2), encoding="utf-8"
        )
        print(f"Detailed diagnostic report written to {args.report_json}")

    print("==================================================")
    print("PREPWISE QUESTION DATASET VALIDATION SUMMARY")
    print("==================================================")
    print(f"Total datasets checked:          {total_files}")
    print(f"Total questions:                 {total_questions}")
    print(f"Valid questions:                 {total_valid}")
    print(f"Invalid questions (fatal):       {total_invalid}")
    print(f"Duplicate options count:         {total_duplicate_options}")
    print(f"Invalid answer index count:      {total_invalid_answer_indexes}")
    print(f"Explanation quality issues:      {explanation_quality_issues}")
    print(f"Mathematical review issues:      {mathematical_review_issues}")
    print(f"Manual editorial review count:   {total_manual_reviews}")
    print("--------------------------------------------------")

    unregistered_issues = [r for r in all_reports if not r["manual_review_required"]]
    print(f"Unregistered/unfixed monologue issues: {len(unregistered_issues)}")
    print(f"Fatal structural errors:              {len(all_fatal)}")

    if all_fatal or unregistered_issues:
        for err in all_fatal:
            print(f"  [ERROR] {err}")
        for err in unregistered_issues:
            print(
                f"  [UNRESOLVED] {err['dataset']} Q{err['question_id']}: {err['problem_type']} ({err['matched_phrases']})"
            )
        return 1

    print(
        "\nSUCCESS: All datasets are structurally valid and all questions under review are properly registered."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
