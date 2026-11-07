"""Import the existing PrepWise JSON datasets into Supabase PostgREST.

This script intentionally uses only the Python standard library so it can run
without adding a dependency to the static frontend. It requires a Supabase
service-role key and must only be run in a trusted environment.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BATCH_SIZE = 100


class SupabaseImportError(RuntimeError):
    """Raised when a Supabase import request fails."""


@dataclass
class ImportReport:
    imported: Counter[str] = field(default_factory=Counter)
    skipped: Counter[str] = field(default_factory=Counter)
    failed: list[str] = field(default_factory=list)

    def add_imported(self, table: str, count: int) -> None:
        self.imported[table] += count

    def add_skipped(self, reason: str, count: int = 1) -> None:
        self.skipped[reason] += count

    def print_summary(self) -> None:
        imported = ", ".join(f"{key}={value}" for key, value in self.imported.items()) or "none"
        skipped = ", ".join(f"{key}={value}" for key, value in self.skipped.items()) or "none"
        print(f"Import report: imported [{imported}], skipped [{skipped}], failed [{len(self.failed)}]")
        for failure in self.failed:
            print(f"Failed: {failure}", file=sys.stderr)


class SupabaseRestClient:
    def __init__(self, project_url: str, service_role_key: str) -> None:
        self.base_url = project_url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }

    def request(
        self,
        method: str,
        table: str,
        rows: list[dict[str, Any]] | None = None,
        query: str = "",
        prefer: str = "return=representation",
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url}/{table}{query}"
        body = None if rows is None else json.dumps(rows, ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=body,
            headers={**self.headers, "Prefer": prefer},
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            raise SupabaseImportError(
                f"{method} {table} failed with HTTP {error.code}: {details}"
            ) from error
        except urllib.error.URLError as error:
            raise SupabaseImportError(f"{method} {table} failed: {error.reason}") from error

        if not payload:
            return []
        decoded = json.loads(payload)
        if isinstance(decoded, list):
            return decoded
        return [decoded]

    def upsert(
        self,
        table: str,
        rows: list[dict[str, Any]],
        conflict_columns: str,
        batch_size: int,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for start in range(0, len(rows), batch_size):
            batch = rows[start : start + batch_size]
            results.extend(
                self.request(
                    "POST",
                    table,
                    batch,
                    query=f"?on_conflict={urllib.parse.quote(conflict_columns)}",
                    prefer="resolution=merge-duplicates,return=representation",
                )
            )
        return results


def load_json(relative_path: str) -> Any:
    path = ROOT / relative_path
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SupabaseImportError(f"Could not load {path}: {error}") from error


def slugify(value: str) -> str:
    characters = []
    previous_dash = False
    for character in value.lower().strip():
        if character.isalnum():
            characters.append(character)
            previous_dash = False
        elif not previous_dash:
            characters.append("-")
            previous_dash = True
    return "".join(characters).strip("-")


def company_category_rows(companies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    names = sorted({company["category"] for company in companies if company.get("category")})
    return [
        {
            "name": name,
            "slug": slugify(name),
            "description": f"PrepWise company category: {name}",
            "is_published": True,
        }
        for name in names
    ]


def question_category_rows() -> list[dict[str, Any]]:
    names = [
        "Quantitative Aptitude",
        "Logical Reasoning",
        "Verbal Ability",
        "Technical",
    ]
    return [
        {
            "name": name,
            "slug": slugify(name),
            "description": f"PrepWise interview question category: {name}",
            "is_published": True,
        }
        for name in names
    ]


def country_rows(countries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "legacy_code": country["code"],
            "name": country["name"],
            "flag": country.get("flag"),
            "currency": country.get("currency"),
            "gdp_rank": country.get("gdpRank"),
            "gdp": country.get("gdp"),
            "top_companies": country.get("topCompanies", []),
            "tech_hubs": country.get("techHubs", []),
        }
        for country in countries
    ]


def company_rows(
    companies: list[dict[str, Any]], category_ids: dict[str, str]
) -> list[dict[str, Any]]:
    rows = []
    for company in companies:
        rows.append(
            {
                "legacy_id": company["id"],
                "name": company["name"],
                "short_name": company["shortName"],
                "slug": company["id"],
                "logo": company.get("logo"),
                "logo_color": company.get("logoColor"),
                "logo_background": company.get("logoBg"),
                "region": company.get("region", []),
                "category_id": category_ids.get(company.get("category", "")),
                "degrees": company.get("degrees", []),
                "industry": company.get("industry"),
                "founded": company.get("founded"),
                "headquarters": company.get("headquarters"),
                "ceo": company.get("ceo"),
                "employees": company.get("employees"),
                "revenue": company.get("revenue"),
                "website": company.get("website"),
                "careers_url": company.get("careersUrl"),
                "countries": company.get("countries", []),
                "description": company.get("description"),
                "history": company.get("history"),
                "milestones": company.get("milestones", []),
                "interview_process": company.get("interviewProcess"),
                "test_pattern": company.get("testPattern", {}),
                "tips": company.get("tips", []),
                "job_roles": company.get("jobRoles", []),
                "is_published": True,
            }
        )
    return rows


def question_rows(
    company: dict[str, Any],
    company_id: str,
    category_ids: dict[str, str],
) -> list[dict[str, Any]]:
    payload = load_json(f"data/questions/{company['id']}.json")
    rows = []
    for question in payload.get("questions", []):
        level = question.get("level") or question.get("difficulty") or "Intermediate"
        rows.append(
            {
                "company_id": company_id,
                "category_id": category_ids.get(question.get("category", "")),
                "legacy_id": question["id"],
                "question_text": question["question"],
                "options": question["options"],
                "correct_answer": question["correctAnswer"],
                "explanation": question.get("explanation"),
                "difficulty": level,
                "level": level,
                "target_roles": question.get("targetRoles", []),
                "is_published": True,
            }
        )
    return rows


def news_rows(news: list[dict[str, Any]], company_ids: dict[str, str]) -> list[dict[str, Any]]:
    rows = []
    for item in news:
        rows.append(
            {
                "legacy_id": item.get("id"),
                "company_id": company_ids.get(item.get("company", "").lower()),
                "company_name": item["company"],
                "logo": item.get("logo"),
                "badge": item.get("badge"),
                "is_internship": item.get("isInternship", False),
                "title": item["title"],
                "summary": item["summary"],
                "category": item["category"],
                "stipend": item.get("stipend"),
                "duration": item.get("duration"),
                "eligible_batches": item.get("eligibleBatches", []),
                "cutoff": item.get("cutoff"),
                "apply_url": item.get("applyLink"),
                "practice_url": item.get("link"),
                "source_url": item.get("applyLink"),
                "is_published": True,
            }
        )
    return rows


def create_quizzes(
    client: SupabaseRestClient,
    companies: list[dict[str, Any]],
    company_ids: dict[str, str],
    question_category_ids: dict[str, str],
    batch_size: int,
    report: ImportReport,
) -> None:
    quiz_rows = [
        {
            "company_id": company_ids[company["id"]],
            "name": f"{company['shortName']} Placement Test",
            "slug": f"{company['id']}-full-test",
            "description": f"Full company-specific PrepWise assessment for {company['shortName']}.",
            "is_published": True,
        }
        for company in companies
    ]
    quizzes = client.upsert("quizzes", quiz_rows, "slug", batch_size)
    report.add_imported("quizzes", len(quiz_rows))
    quiz_ids = {quiz["slug"]: quiz["id"] for quiz in quizzes}

    links: list[dict[str, Any]] = []
    for company in companies:
        questions = client.request(
            "GET",
            "interview_questions",
            query=(
                "?select=id,legacy_id"
                f"&company_id=eq.{urllib.parse.quote(company_ids[company['id']])}"
                "&order=legacy_id.asc"
            ),
        )
        quiz_id = quiz_ids[f"{company['id']}-full-test"]
        links.extend(
            {"quiz_id": quiz_id, "question_id": row["id"], "position": position}
            for position, row in enumerate(questions)
        )
    client.upsert("quiz_questions", links, "quiz_id,question_id", batch_size)
    report.add_imported("quiz_questions", len(links))


def run_import(client: SupabaseRestClient, batch_size: int, report: ImportReport) -> None:
    companies = load_json("data/companies.json")
    countries = load_json("data/countries.json")
    news = load_json("data/news.json")

    company_categories = client.upsert(
        "company_categories", company_category_rows(companies), "slug", batch_size
    )
    report.add_imported("company_categories", len(company_categories))
    question_categories = client.upsert(
        "question_categories", question_category_rows(), "slug", batch_size
    )
    report.add_imported("question_categories", len(question_categories))
    country_payload = country_rows(countries)
    client.upsert("countries", country_payload, "legacy_code", batch_size)
    report.add_imported("countries", len(country_payload))

    company_category_ids = {row["name"]: row["id"] for row in company_categories}
    question_category_ids = {row["name"]: row["id"] for row in question_categories}
    company_result = client.upsert(
        "companies", company_rows(companies, company_category_ids), "legacy_id", batch_size
    )
    report.add_imported("companies", len(company_result))
    company_ids = {row["legacy_id"]: row["id"] for row in company_result}

    country_result = client.request("GET", "countries", query="?select=id,name")
    country_ids = {row["name"]: row["id"] for row in country_result}
    operation_candidates = [
        (company, country)
        for company in companies
        for country in company.get("countries", [])
    ]
    operations = [
        {"company_id": company_ids[company["id"]], "country_id": country_ids[country]}
        for company, country in operation_candidates
        if country in country_ids
    ]
    report.add_skipped(
        "unknown_company_country",
        len(operation_candidates) - len(operations),
    )
    client.upsert(
        "company_country_operations",
        operations,
        "company_id,country_id",
        batch_size,
    )
    report.add_imported("company_country_operations", len(operations))

    for company in companies:
        rows = question_rows(company, company_ids[company["id"]], question_category_ids)
        client.upsert("interview_questions", rows, "company_id,legacy_id", batch_size)
        report.add_imported("interview_questions", len(rows))

    news_payload = news_rows(news, {
        name.lower(): company_ids[company["id"]]
        for company in companies
        for name in (company["name"], company["shortName"], company["id"])
    })
    client.upsert("hiring_news", news_payload, "legacy_id", batch_size)
    report.add_imported("hiring_news", len(news_payload))
    create_quizzes(client, companies, company_ids, question_category_ids, batch_size, report)

    total_questions = sum(
        len(load_json(f"data/questions/{company['id']}.json").get("questions", []))
        for company in companies
    )
    print(f"Loaded source data: {len(companies)} companies, {len(countries)} countries, "
          f"{total_questions} questions, {len(news)} news records.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.batch_size < 1:
        print("--batch-size must be positive", file=sys.stderr)
        return 2
    project_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SECRET_KEY")
    if not project_url or not service_key:
        print(
            "Set SUPABASE_URL and SUPABASE_SECRET_KEY in the environment. "
            "The secret key is server-only and must never be committed.",
            file=sys.stderr,
        )
        return 2
    report = ImportReport()
    try:
        run_import(SupabaseRestClient(project_url, service_key), args.batch_size, report)
    except SupabaseImportError as error:
        report.failed.append(str(error))
        report.print_summary()
        print(f"Import failed: {error}", file=sys.stderr)
        return 1
    report.print_summary()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
