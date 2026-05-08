from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from jobs_sync import (  # noqa: E402
    add_utm,
    fetch_all_company_jobs,
    generate_jsonld,
    job_id,
    merge_jobs,
    normalize_job,
)


NOW = datetime(2026, 5, 8, 18, 0, tzinfo=timezone.utc)
COMPANY = {
    "id": "nubank-001",
    "name": "Nubank",
    "slug": "nubank",
    "logo_url": "https://example.com/logo.png",
    "linkedin_url": "https://www.linkedin.com/company/nubank/",
}
RAW_JOB = {
    "external_id": "4087123",
    "title": "Senior Software Engineer",
    "department": "Engineering",
    "location": "Sao Paulo, SP",
    "remote": False,
    "url": "https://www.linkedin.com/jobs/view/4087123/",
    "created_at": "2026-04-01T00:00:00Z",
}


def make_job(**overrides):
    raw = {**RAW_JOB, **overrides.pop("raw", {})}
    job = normalize_job(raw, COMPANY, NOW)
    return {**job, **overrides}


def test_dedup_new_job():
    fetched = [make_job()]

    merged = merge_jobs([], fetched, NOW, total_fetched=1)

    assert len(merged) == 1
    assert merged[0]["external_id"] == "4087123"
    assert merged[0]["is_active"] is True


def test_dedup_existing_job():
    yesterday = NOW - timedelta(days=1)
    existing = make_job(last_seen_at=yesterday.isoformat().replace("+00:00", "Z"))
    fetched = [make_job(raw={"title": "Senior Software Engineer"})]

    merged = merge_jobs([existing], fetched, NOW, total_fetched=1)

    assert len(merged) == 1
    assert merged[0]["last_seen_at"] == "2026-05-08T18:00:00Z"


def test_soft_delete_active():
    existing = make_job(last_seen_at="2026-05-08T18:00:00Z")

    merged = merge_jobs([existing], [], NOW, total_fetched=1)

    assert merged[0]["is_active"] is True


def test_soft_delete_expired():
    existing = make_job(last_seen_at="2026-04-30T18:00:00Z")

    merged = merge_jobs([existing], [], NOW, total_fetched=1)

    assert merged[0]["is_active"] is False


def test_soft_delete_floor_on_outage():
    existing = make_job(last_seen_at="2026-04-30T18:00:00Z", is_active=True)

    merged = merge_jobs([existing], [], NOW, total_fetched=0)

    assert merged[0]["is_active"] is True


def test_jsonld_valid_posting():
    job = make_job()

    jsonld = generate_jsonld(job, COMPANY)

    assert jsonld["@context"] == "https://schema.org"
    assert jsonld["@type"] == "JobPosting"
    assert jsonld["title"] == "Senior Software Engineer"
    assert jsonld["hiringOrganization"]["name"] == "Nubank"
    assert jsonld["jobLocation"]["@type"] == "Place"


def test_jsonld_remote_job():
    job = make_job(raw={"location": "Remoto", "remote": True})

    jsonld = generate_jsonld(job, COMPANY)

    assert jsonld["jobLocationType"] == "TELECOMMUTE"
    assert jsonld["applicantLocationRequirements"]["name"] == "Brazil"
    assert "jobLocation" not in jsonld


def test_error_handling_skip_and_log():
    companies = [
        COMPANY,
        {**COMPANY, "id": "olist-001", "name": "Olist", "slug": "olist"},
    ]
    fixtures = {
        "nubank": [RAW_JOB],
        "olist": [{**RAW_JOB, "external_id": "olist-1"}],
    }

    fetched, logs = fetch_all_company_jobs(companies, fixtures, NOW, error_slugs={"nubank"})

    assert len(fetched) == 1
    assert fetched[0]["id"] == job_id("linkedin", "olist", "olist-1")
    assert any("skip nubank" in line for line in logs)


def test_utm_tracking_is_added_without_dropping_existing_params():
    url = add_utm("https://www.linkedin.com/jobs/view/1/?foo=bar")

    assert "foo=bar" in url
    assert "utm_source=astella" in url
    assert "utm_medium=jobs_board" in url
