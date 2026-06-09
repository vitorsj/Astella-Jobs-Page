from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


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


def test_missing_job_stays_active_when_seen_now():
    existing = make_job(last_seen_at="2026-05-08T18:00:00Z")

    merged = merge_jobs([existing], [], NOW, total_fetched=1)

    assert merged[0]["is_active"] is True


def test_missing_job_expires_immediately_after_successful_company_fetch():
    existing = make_job(last_seen_at="2026-05-08T17:59:59Z")

    merged = merge_jobs([existing], [], NOW, total_fetched=0, successful_company_slugs={"nubank"})

    assert merged[0]["is_active"] is False
    assert merged[0]["inactive_reason"] == "missing_from_source"


def test_missing_job_is_preserved_on_total_outage():
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


def test_jsonld_valid_through_tracks_last_seen():
    # validThrough = last_seen_at + JSONLD_VALID_THROUGH_DAYS (4): perto da cadência
    # do cron p/ o Google expirar links mortos rápido, sem expirar vaga ainda ativa.
    job = make_job(last_seen_at="2026-05-08T18:00:00Z")

    jsonld = generate_jsonld(job, COMPANY)

    assert jsonld["validThrough"] == "2026-05-12"


def test_jsonld_remote_job():
    job = make_job(raw={"location": "Remoto", "remote": True})

    jsonld = generate_jsonld(job, COMPANY)

    assert jsonld["jobLocationType"] == "TELECOMMUTE"
    assert jsonld["applicantLocationRequirements"]["name"] == "Brazil"
    assert "jobLocation" not in jsonld


def test_error_handling_skip_and_log():
    companies = [
        COMPANY,
        {**COMPANY, "id": "estoca-001", "name": "Estoca", "slug": "estoca"},
    ]
    fixtures = {
        "nubank": [RAW_JOB],
        "estoca": [{**RAW_JOB, "external_id": "estoca-1"}],
    }

    fetched, logs, successful_slugs = fetch_all_company_jobs(companies, fixtures, NOW, error_slugs={"nubank"})

    assert len(fetched) == 1
    assert fetched[0]["id"] == job_id("linkedin", "estoca", "senior software engineer|sao paulo")
    assert successful_slugs == {"estoca"}
    assert any("skip nubank" in line for line in logs)


def test_successful_empty_api_response_is_distinct_from_error():
    companies = [COMPANY]
    fixtures = {"nubank": []}

    fetched, logs, successful_slugs = fetch_all_company_jobs(companies, fixtures, NOW)

    assert fetched == []
    assert successful_slugs == {"nubank"}
    assert logs == ["ok nubank: 0 jobs"]


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


def test_transient_skip_keeps_recent_jobs_active():
    # Empresa pulada neste run, mas vista há 2 dias (< COMPANY_UNREACHABLE_DAYS):
    # uma falha isolada de scrape NÃO deve esconder as vagas.
    existing = make_job(last_seen_at="2026-05-06T18:00:00Z", is_active=True)

    merged = merge_jobs([existing], [], NOW, total_fetched=1, successful_company_slugs={"estoca"})

    assert merged[0]["is_active"] is True
    assert merged[0]["inactive_reason"] is None


def test_unreachable_company_jobs_expire_after_backstop():
    # Empresa falha no scrape e não é vista há 8 dias (> COMPANY_UNREACHABLE_DAYS),
    # enquanto OUTRA empresa raspou ok → não dá mais p/ garantir que a vaga existe.
    existing = make_job(last_seen_at="2026-04-30T18:00:00Z", is_active=True)

    merged = merge_jobs([existing], [], NOW, total_fetched=1, successful_company_slugs={"estoca"})

    assert merged[0]["is_active"] is False
    assert merged[0]["inactive_reason"] == "company_unreachable"


def test_unreachable_backstop_inert_on_total_outage():
    # Pane total (nenhuma empresa raspou): mesmo com vaga antiga, nada é desativado.
    existing = make_job(last_seen_at="2026-04-30T18:00:00Z", is_active=True)

    merged = merge_jobs([existing], [], NOW, total_fetched=0)

    assert merged[0]["is_active"] is True
    assert merged[0]["inactive_reason"] is None


def test_missing_last_seen_at_does_not_crash():
    # Registro legado/corrompido sem last_seen_at, de empresa não-raspada: o loop
    # antes pulava com `continue`; agora desreferencia last_seen. Não deve crashar.
    existing = make_job(is_active=True)
    existing.pop("last_seen_at", None)

    merged = merge_jobs([existing], [], NOW, total_fetched=1, successful_company_slugs={"estoca"})

    assert merged[0]["is_active"] is True  # sem como julgar obsolescência → mantém


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


def test_main_requires_token_without_allow_fixtures(monkeypatch):
    """Sem APIFY_TOKEN e sem --allow-fixtures, main() aborta (não publica fake)."""
    import jobs_sync

    monkeypatch.delenv("APIFY_TOKEN", raising=False)
    monkeypatch.setattr(sys, "argv", ["jobs_sync.py"])
    # Se run_sync for chamado, falha o teste — não deve chegar lá.
    monkeypatch.setattr(jobs_sync, "run_sync", lambda **kw: pytest.fail("run_sync should not run"))

    assert jobs_sync.main() == 2


def test_sanity_gate_blocks_active_jobs_collapse(monkeypatch, tmp_path):
    """A trava de sanidade aborta (sem escrever) quando as vagas ativas colapsam."""
    import json as _json
    import jobs_sync

    companies_path = tmp_path / "companies.json"
    jobs_path = tmp_path / "jobs.json"
    companies_path.write_text(_json.dumps([COMPANY]))

    existing = [
        make_job(raw={"external_id": f"old-{i}"}, last_seen_at="2026-04-30T18:00:00Z", is_active=True)
        for i in range(10)
    ]
    jobs_path.write_text(_json.dumps({"jobs": existing, "companies": [COMPANY]}))

    monkeypatch.setattr(jobs_sync, "COMPANIES_PATH", companies_path)
    monkeypatch.setattr(jobs_sync, "JOBS_PATH", jobs_path)
    # Apify retorna vazio (sucesso) p/ todas as empresas → tudo expira → 0 ativas.
    monkeypatch.setattr(jobs_sync, "fetch_apify_jobs", lambda company, token, now: [])

    with pytest.raises(jobs_sync.SyncError, match="sanity gate"):
        jobs_sync.run_sync(now=NOW, apify_token="fake-token", min_active_ratio=0.5)

    # Nada foi escrito: o arquivo de saída segue com as 10 vagas originais.
    assert len(_json.loads(jobs_path.read_text())["jobs"]) == 10


def test_sanity_gate_ignores_intentional_unreachable_hides(monkeypatch, tmp_path):
    """Vagas escondidas pelo backstop (company_unreachable) NÃO contam como
    colapso: a trava não deve bloquear o write só porque uma empresa ficou
    inalcançável — senão manteria as vagas-fantasma no ar (oposto do objetivo)."""
    import json as _json
    import jobs_sync

    estoca = {**COMPANY, "id": "estoca-001", "name": "Estoca", "slug": "estoca"}
    companies = [COMPANY, estoca]

    companies_path = tmp_path / "companies.json"
    jobs_path = tmp_path / "jobs.json"
    companies_path.write_text(_json.dumps(companies))

    # 8 vagas antigas da estoca (vistas há 8 dias > backstop), todas ativas.
    existing = [
        {
            **normalize_job(
                {**RAW_JOB, "external_id": f"est-{i}", "title": f"Estoca Role {i}"},
                estoca,
                NOW,
            ),
            "last_seen_at": "2026-04-30T18:00:00Z",
            "is_active": True,
        }
        for i in range(8)
    ]
    jobs_path.write_text(_json.dumps({"jobs": existing, "companies": companies}))

    monkeypatch.setattr(jobs_sync, "COMPANIES_PATH", companies_path)
    monkeypatch.setattr(jobs_sync, "JOBS_PATH", jobs_path)
    # Saídas → tmp_path, p/ não escrever no repo real ao passar pela trava.
    monkeypatch.setattr(jobs_sync, "PUBLIC_JOBS_PATH", tmp_path / "public_jobs.json")
    monkeypatch.setattr(jobs_sync, "GENERATED_JOBS_PATH", tmp_path / "generated.json")
    monkeypatch.setattr(jobs_sync, "JSONLD_PATH", tmp_path / "jobs.jsonld")
    monkeypatch.setattr(jobs_sync, "COMPANY_PAGES_DIR", tmp_path / "empresas")

    # nubank raspa ok (2 vagas novas); estoca falha o scrape.
    def fake_fetch(company, token, now):
        if company["slug"] == "estoca":
            raise jobs_sync.SyncError("boom")
        return [
            make_job(raw={"external_id": "nu-1", "title": "Engineer One"}),
            make_job(raw={"external_id": "nu-2", "title": "Engineer Two"}),
        ]

    monkeypatch.setattr(jobs_sync, "fetch_apify_jobs", fake_fetch)

    # Sem o fix: new_active=2 < 0.5*8=4 → trava dispararia. Com o fix:
    # (2 + 8 inalcançáveis) = 10 ≥ 4 → escreve normalmente.
    result = jobs_sync.run_sync(now=NOW, apify_token="fake-token", min_active_ratio=0.5)

    written = _json.loads(jobs_path.read_text())["jobs"]
    unreachable = [j for j in written if j.get("inactive_reason") == "company_unreachable"]
    assert len(unreachable) == 8
    assert result.total_active == 2  # só as 2 vagas novas da nubank
