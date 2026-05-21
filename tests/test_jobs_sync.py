from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from jobs_sync import (  # noqa: E402
    add_utm,
    canonical_area,
    fetch_all_company_jobs,
    generate_jsonld,
    job_id,
    merge_jobs,
    normalize_job,
    _map_apify_raw,
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

    fetched, logs, successful_slugs = fetch_all_company_jobs(companies, fixtures, NOW, error_slugs={"nubank"})

    assert len(fetched) == 1
    assert fetched[0]["id"] == job_id("linkedin", "olist", "senior software engineer|sao paulo")
    assert successful_slugs == {"olist"}
    assert any("skip nubank" in line for line in logs)


def test_apify_field_mapping():
    item = {
        "id": "4087123",
        "title": "Senior Software Engineer",
        "companyName": "Nubank",
        "location": "Sao Paulo, SP",
        "postedAt": "2 days ago",
        "employmentType": "Full-time",
        "jobFunction": "Engineering",
    }
    mapped = _map_apify_raw(item)

    assert mapped["external_id"] == "4087123"
    assert mapped["title"] == "Senior Software Engineer"
    assert mapped["department"] == "Engineering"
    assert mapped["location"] == "Sao Paulo, SP"
    assert mapped["remote"] is False
    assert mapped["url"] == "https://www.linkedin.com/jobs/view/4087123/"
    assert mapped["created_at"] is None
    assert mapped["posted_at"] == "2 days ago"


def test_skip_company_without_search_url():
    from jobs_sync import fetch_apify_jobs, SyncError
    import pytest

    company = {
        "id": "widget-001",
        "name": "Widget Co",
        "slug": "widget-co",
        "logo_url": "",
        "linkedin_url": "https://www.linkedin.com/company/widget-co/",
    }
    with pytest.raises(SyncError, match="no linkedin_search_url"):
        fetch_apify_jobs(company, token="fake-token", now=NOW)


def test_utm_tracking_is_added_without_dropping_existing_params():
    url = add_utm("https://www.linkedin.com/jobs/view/1/?foo=bar")

    assert "foo=bar" in url
    assert "utm_source=astella" in url
    assert "utm_medium=jobs_board" in url


def test_dedup_reposted_same_title_and_location():
    first = make_job(raw={
        "external_id": "4399577168",
        "title": "Analista Sênior de Eventos & Brand Experience",
        "department": "Marketing",
        "location": "São Paulo, Brazil",
    })
    repost = make_job(raw={
        "external_id": "4393035167",
        "title": "Analista Sênior de Eventos & Brand Experience",
        "department": "Business Development and Sales",
        "location": "São Paulo, São Paulo, Brazil",
    })

    merged = merge_jobs([], [first, repost], NOW, total_fetched=2, successful_company_slugs={"nubank"})

    assert len(merged) == 1
    assert merged[0]["external_ids"] == ["4393035167", "4399577168"]
    assert merged[0]["department"] == "Marketing"


def test_same_title_different_cities_are_not_deduped():
    sao_paulo = make_job(raw={
        "external_id": "sp-1",
        "title": "Executivo de Contas [Farma Indireto]",
        "location": "São Paulo, São Paulo, Brazil",
    })
    rio = make_job(raw={
        "external_id": "rio-1",
        "title": "Executivo de Contas [Farma Indireto]",
        "location": "Rio de Janeiro, Rio de Janeiro, Brazil",
    })

    merged = merge_jobs([], [sao_paulo, rio], NOW, total_fetched=2, successful_company_slugs={"nubank"})

    assert len(merged) == 2


def test_skipped_company_does_not_expire_old_jobs():
    existing = make_job(last_seen_at="2026-04-30T18:00:00Z", is_active=True)

    merged = merge_jobs([existing], [], NOW, total_fetched=1, successful_company_slugs={"olist"})

    assert merged[0]["is_active"] is True
    assert merged[0]["inactive_reason"] is None


def test_reliable_old_posted_at_expires_job():
    existing = make_job(
        raw={"created_at": "2026-01-01T12:00:00Z"},
        last_seen_at="2026-05-08T18:00:00Z",
        is_active=True,
    )

    merged = merge_jobs([existing], [], NOW, total_fetched=1, successful_company_slugs={"nubank"})

    assert merged[0]["is_active"] is False
    assert merged[0]["inactive_reason"] == "stale_posted_at"


def test_canonical_area_prefers_title_signal():
    assert canonical_area(
        "Analista Sênior de Eventos & Brand Experience",
        "Business Development and Sales",
    ) == "Marketing"
