#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import html
import json
import logging
import os
import time
from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests


ROOT = Path(__file__).resolve().parents[1]
COMPANIES_PATH = ROOT / "companies.json"
FAKE_SOURCE_PATH = ROOT / "data" / "fake_linkedin_jobs.json"
JOBS_PATH = ROOT / "jobs.json"
PUBLIC_JOBS_PATH = ROOT / "public" / "jobs.json"
GENERATED_JOBS_PATH = ROOT / "src" / "data" / "jobs.generated.json"
COMPANY_PAGES_DIR = ROOT / "public" / "empresas"
JSONLD_PATH = ROOT / "public" / "job-postings.jsonld"
UTM_PARAMS = {"utm_source": "astella", "utm_medium": "jobs_board"}
SOFT_DELETE_DAYS = 7
APIFY_BASE_URL = "https://api.apify.com/v2"
APIFY_ACTOR_ID = "hKByXkMQaC5Qt9UMN"
APIFY_POLL_INTERVAL_S = 5
APIFY_MAX_ATTEMPTS = 60  # ~5 min timeout


class SyncError(RuntimeError):
    pass


@dataclass
class SyncResult:
    changed: bool
    total_fetched: int
    total_active: int
    logs: list[str]


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def isoformat_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return deepcopy(default)
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def stable_json(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def job_id(source: str, company_slug: str, external_id: str) -> str:
    raw = f"{source}:{company_slug}:{external_id}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


def add_utm(url: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(UTM_PARAMS)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def normalize_job(raw: dict[str, Any], company: dict[str, Any], now: datetime) -> dict[str, Any]:
    external_id = str(raw["external_id"])
    created_at = raw.get("created_at") or isoformat_z(now)
    updated_at = raw.get("updated_at") or isoformat_z(now)
    return {
        "id": job_id("linkedin", company["slug"], external_id),
        "external_id": external_id,
        "source": "linkedin",
        "company_slug": company["slug"],
        "title": raw["title"],
        "department": raw.get("department") or "Operations",
        "location": raw.get("location") or "Remoto",
        "remote": bool(raw.get("remote", False)),
        "url": add_utm(raw["url"]),
        "created_at": created_at,
        "updated_at": updated_at,
        "last_seen_at": isoformat_z(now),
        "is_active": True,
    }


def _map_apify_raw(item: dict[str, Any]) -> dict[str, Any]:
    external_id = str(item["id"])
    location = item.get("location") or "Remoto"
    return {
        "external_id": external_id,
        "title": item.get("title") or "",
        "department": item.get("jobFunction") or item.get("employmentType") or "Operations",
        "location": location,
        "remote": "remot" in location.lower(),
        "url": f"https://www.linkedin.com/jobs/view/{external_id}/",
        "created_at": None,  # postedAt do Apify é texto relativo, não ISO
    }


def fetch_apify_jobs(
    company: dict[str, Any],
    token: str,
    now: datetime,
) -> list[dict[str, Any]]:
    search_url = company.get("linkedin_search_url")
    if not search_url:
        raise SyncError(f"no linkedin_search_url configured for {company['slug']}")

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # 1. Disparar run
    run_resp = requests.post(
        f"{APIFY_BASE_URL}/acts/{APIFY_ACTOR_ID}/runs",
        headers=headers,
        json={"urls": [search_url]},
        timeout=30,
    )
    if not run_resp.ok:
        raise SyncError(
            f"Apify run start failed for {company['slug']}: "
            f"HTTP {run_resp.status_code} — {run_resp.text[:200]}"
        )
    run_data = run_resp.json()["data"]
    run_id = run_data["id"]
    dataset_id = run_data["defaultDatasetId"]
    logging.info("Apify run started for %s: runId=%s", company["slug"], run_id)

    # 2. Polling até status terminal
    terminal = {"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"}
    status = "RUNNING"
    for attempt in range(1, APIFY_MAX_ATTEMPTS + 1):
        time.sleep(APIFY_POLL_INTERVAL_S)
        status_resp = requests.get(
            f"{APIFY_BASE_URL}/acts/{APIFY_ACTOR_ID}/runs/{run_id}",
            headers=headers,
            timeout=30,
        )
        if not status_resp.ok:
            raise SyncError(
                f"Apify status check failed for {company['slug']}: "
                f"HTTP {status_resp.status_code}"
            )
        status = status_resp.json()["data"]["status"]
        logging.debug("Apify run %s status=%s attempt=%d", run_id, status, attempt)
        if status in terminal:
            break
    else:
        raise SyncError(
            f"Apify run timed out after {APIFY_MAX_ATTEMPTS} attempts for {company['slug']}"
        )

    if status != "SUCCEEDED":
        raise SyncError(f"Apify run ended with status={status} for {company['slug']}")

    # 3. Buscar itens do dataset
    items_resp = requests.get(
        f"{APIFY_BASE_URL}/datasets/{dataset_id}/items",
        headers=headers,
        params={"format": "json"},
        timeout=60,
    )
    if not items_resp.ok:
        raise SyncError(
            f"Apify dataset fetch failed for {company['slug']}: "
            f"HTTP {items_resp.status_code}"
        )
    items = items_resp.json()
    logging.info("Apify fetched %d items for %s", len(items), company["slug"])

    return [normalize_job(_map_apify_raw(item), company, now) for item in items]


def fetch_fake_jobs(
    company: dict[str, Any],
    fixtures: dict[str, list[dict[str, Any]]],
    now: datetime,
    error_slugs: set[str] | None = None,
) -> list[dict[str, Any]]:
    error_slugs = error_slugs or set()
    if company["slug"] in error_slugs:
        raise SyncError(f"fake 500 for {company['slug']}")
    return [normalize_job(raw, company, now) for raw in fixtures.get(company["slug"], [])]


def fetch_all_company_jobs(
    companies: list[dict[str, Any]],
    fetch_fn_or_fixtures,  # callable (company) -> list[dict] OU dict de fixtures (legado)
    now: datetime,
    error_slugs: set[str] | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    if callable(fetch_fn_or_fixtures):
        fetch_fn = fetch_fn_or_fixtures
    else:
        # Caminho legado: fixtures dict (usado pelos testes existentes)
        fixtures = fetch_fn_or_fixtures
        def fetch_fn(company: dict[str, Any]) -> list[dict[str, Any]]:
            return fetch_fake_jobs(company, fixtures, now, error_slugs)

    fetched: list[dict[str, Any]] = []
    logs: list[str] = []
    for company in companies:
        try:
            company_jobs = fetch_fn(company)
            fetched.extend(company_jobs)
            logs.append(f"ok {company['slug']}: {len(company_jobs)} jobs")
        except SyncError as exc:
            logs.append(f"skip {company['slug']}: {exc}")
            logging.warning("Skipping %s: %s", company["slug"], exc)
    return fetched, logs


def merge_jobs(
    existing_jobs: list[dict[str, Any]],
    fetched_jobs: list[dict[str, Any]],
    now: datetime,
    total_fetched: int,
) -> list[dict[str, Any]]:
    by_id = {job["id"]: deepcopy(job) for job in existing_jobs}
    for fetched in fetched_jobs:
        current = by_id.get(fetched["id"], {})
        merged = {**current, **fetched}
        merged["created_at"] = current.get("created_at", fetched["created_at"])
        merged["updated_at"] = isoformat_z(now)
        merged["last_seen_at"] = isoformat_z(now)
        merged["is_active"] = True
        by_id[fetched["id"]] = merged

    if total_fetched > 0:
        expires_before = now - timedelta(days=SOFT_DELETE_DAYS)
        for job in by_id.values():
            if parse_iso(job["last_seen_at"]) < expires_before:
                job["is_active"] = False

    return sorted(by_id.values(), key=lambda j: (not j["is_active"], j["company_slug"], j["title"]))


def build_payload(companies: list[dict[str, Any]], jobs: list[dict[str, Any]], now: datetime) -> dict[str, Any]:
    active_jobs = [job for job in jobs if job.get("is_active")]
    return {
        "generated_at": isoformat_z(now),
        "total_active": len(active_jobs),
        "jobs": jobs,
        "companies": companies,
    }


def comparable_payload(payload: dict[str, Any]) -> dict[str, Any]:
    clone = deepcopy(payload)
    clone.pop("generated_at", None)
    for job in clone.get("jobs", []):
        job.pop("updated_at", None)
        job.pop("last_seen_at", None)
    return clone


def generate_jsonld(job: dict[str, Any], company: dict[str, Any]) -> dict[str, Any]:
    posting: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": job["title"],
        "datePosted": job["created_at"][:10],
        "validThrough": (parse_iso(job["last_seen_at"]) + timedelta(days=SOFT_DELETE_DAYS)).date().isoformat(),
        "employmentType": "FULL_TIME",
        "hiringOrganization": {
            "@type": "Organization",
            "name": company["name"],
            "sameAs": company["linkedin_url"],
        },
        "industry": job["department"],
        "directApply": False,
        "url": job["url"],
    }
    if company.get("logo_url"):
        posting["hiringOrganization"]["logo"] = company["logo_url"]
    if job.get("remote"):
        posting["jobLocationType"] = "TELECOMMUTE"
        posting["applicantLocationRequirements"] = {"@type": "Country", "name": "Brazil"}
    else:
        posting["jobLocation"] = {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": job["location"],
                "addressCountry": "BR",
            },
        }
    return posting


def render_company_page(company: dict[str, Any], jobs: list[dict[str, Any]], jsonld: list[dict[str, Any]]) -> str:
    title = f"{company['name']} jobs | Astella Jobs"
    jsonld_text = json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/")
    rows = "\n".join(
        f'<li><a href="{html.escape(job["url"])}">{html.escape(job["title"])}</a> '
        f'<span>{html.escape(job["location"])}</span></li>'
        for job in jobs
    )
    return f"""<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{html.escape(title)}</title>
    <meta name="description" content="Vagas abertas na {html.escape(company['name'])}, empresa do portfólio Astella." />
    <script type="application/ld+json">{jsonld_text}</script>
  </head>
  <body>
    <main>
      <h1>{html.escape(company['name'])}</h1>
      <p>Vagas abertas no portfólio Astella.</p>
      <ul>
        {rows}
      </ul>
      <p><a href="/">Ver todas as vagas</a></p>
    </main>
  </body>
</html>
"""


def generate_static_assets(payload: dict[str, Any]) -> None:
    companies_by_slug = {company["slug"]: company for company in payload["companies"]}
    active_jobs = [job for job in payload["jobs"] if job.get("is_active")]
    all_jsonld = [generate_jsonld(job, companies_by_slug[job["company_slug"]]) for job in active_jobs]
    write_json(JSONLD_PATH, all_jsonld)
    COMPANY_PAGES_DIR.mkdir(parents=True, exist_ok=True)
    for company in payload["companies"]:
        company_jobs = [job for job in active_jobs if job["company_slug"] == company["slug"]]
        company_jsonld = [generate_jsonld(job, company) for job in company_jobs]
        page = render_company_page(company, company_jobs, company_jsonld)
        (COMPANY_PAGES_DIR / f"{company['slug']}.html").write_text(page, encoding="utf-8")


def run_sync(
    now: datetime | None = None,
    error_slugs: set[str] | None = None,
    apify_token: str | None = None,
) -> SyncResult:
    now = now or utc_now()
    companies = read_json(COMPANIES_PATH, [])
    existing_payload = read_json(JOBS_PATH, {"jobs": [], "companies": companies})

    if apify_token:
        def fetch_fn(company: dict[str, Any]) -> list[dict[str, Any]]:
            return fetch_apify_jobs(company, apify_token, now)
    else:
        fixtures = read_json(FAKE_SOURCE_PATH, {})
        def fetch_fn(company: dict[str, Any]) -> list[dict[str, Any]]:
            return fetch_fake_jobs(company, fixtures, now, error_slugs)

    fetched_jobs, logs = fetch_all_company_jobs(companies, fetch_fn, now)
    merged_jobs = merge_jobs(existing_payload.get("jobs", []), fetched_jobs, now, len(fetched_jobs))
    next_payload = build_payload(companies, merged_jobs, now)
    changed = stable_json(comparable_payload(existing_payload)) != stable_json(comparable_payload(next_payload))

    write_json(JOBS_PATH, next_payload)
    write_json(PUBLIC_JOBS_PATH, next_payload)
    write_json(GENERATED_JOBS_PATH, next_payload)
    generate_static_assets(next_payload)

    return SyncResult(
        changed=changed,
        total_fetched=len(fetched_jobs),
        total_active=next_payload["total_active"],
        logs=logs,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync Astella portfolio jobs from LinkedIn via Apify."
    )
    parser.add_argument(
        "--simulate-error",
        action="append",
        default=[],
        help="Company slug to skip with a fake API error (fake mode only).",
    )
    parser.add_argument(
        "--apify-token",
        default=None,
        help="Apify API token. Falls back to APIFY_TOKEN env var. Sem nenhum: usa fixtures.",
    )
    return parser.parse_args()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args()
    apify_token = args.apify_token or os.environ.get("APIFY_TOKEN")
    result = run_sync(
        error_slugs=set(args.simulate_error) if not apify_token else None,
        apify_token=apify_token,
    )
    for line in result.logs:
        logging.info(line)
    logging.info("fetched=%s active=%s changed=%s", result.total_fetched, result.total_active, result.changed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
