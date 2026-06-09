#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import html
import json
import logging
import os
import re
import time
import unicodedata
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
# ATENÇÃO: todo caminho de SAÍDA novo precisa entrar também em DATA_PATHS no
# scripts/run_cron.sh — senão o cron nunca commita/pusha o arquivo.
JOBS_PATH = ROOT / "jobs.json"
PUBLIC_JOBS_PATH = ROOT / "public" / "jobs.json"
GENERATED_JOBS_PATH = ROOT / "src" / "data" / "jobs.generated.json"
SYNC_LOG_PATH = ROOT / "src" / "data" / "sync_log.json"
SYNC_LOG_KEEP = 20
COMPANY_PAGES_DIR = ROOT / "public" / "empresas"
JSONLD_PATH = ROOT / "public" / "job-postings.jsonld"
UTM_PARAMS = {"utm_source": "astella", "utm_medium": "jobs_board"}
MISSING_SOURCE_GRACE_DAYS = 0
# Backstop p/ empresa que falha no scrape: se o scrape de uma empresa der erro
# por vários runs seguidos, suas vagas nunca renovam last_seen_at NEM são
# desativadas (a desativação normal só vale p/ empresas raspadas com sucesso).
# Resultado: vagas fantasma ativas indefinidamente. Aqui, se a empresa não é
# raspada com sucesso há mais de N dias, escondemos as vagas dela — preferimos
# esconder vaga real a mostrar vaga que talvez não exista. 4 dias tolera UMA
# falha isolada (cron roda seg/qua/sex; maior intervalo entre runs é 3 dias) e
# age só quando a empresa falha ~2 runs seguidos.
try:
    COMPANY_UNREACHABLE_DAYS = int(os.environ.get("SYNC_COMPANY_UNREACHABLE_DAYS", "4"))
except ValueError:
    COMPANY_UNREACHABLE_DAYS = 4  # env malformado não deve derrubar o sync inteiro
# validThrough do JSON-LD (Google for Jobs): mantido perto da cadência do cron.
# Com 7 dias, o Google podia continuar exibindo um link morto por até uma semana
# após a vaga sair do ar. 4 cobre o intervalo de fim de semana (Sex→Seg = 3d) com
# 1 dia de folga, sem marcar como expirada uma vaga ainda ativa entre runs.
JSONLD_VALID_THROUGH_DAYS = 4
STALE_POSTED_DAYS = 100
APIFY_BASE_URL = "https://api.apify.com/v2"
APIFY_ACTOR_ID = "hKByXkMQaC5Qt9UMN"
APIFY_POLL_INTERVAL_S = 5
APIFY_MAX_ATTEMPTS = 60  # ~5 min timeout
# Trava de sanidade: aborta (sem escrever/commitar) se as vagas ativas caírem
# abaixo desta fração do total anterior. Evita publicar um board vazio/quebrado
# por causa de uma resposta vazia da Apify ou fallback de fixtures. 0 desliga.
SYNC_MIN_ACTIVE_RATIO_DEFAULT = 0.5


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


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_text.lower()).strip()


def normalize_title_key(title: str) -> str:
    return normalize_text(title)


def normalize_location_key(location: str) -> str:
    text = normalize_text(location)
    if not text or "remot" in text:
        return "remote"
    first_part = normalize_text((location or "").split(",")[0])
    return first_part or text


def job_unique_key(title: str, location: str) -> str:
    return f"{normalize_title_key(title)}|{normalize_location_key(location)}"


def canonical_job_key(job: dict[str, Any]) -> str:
    return ":".join(
        [
            job.get("source", "linkedin"),
            job["company_slug"],
            job_unique_key(job["title"], job["location"]),
        ]
    )


def job_id(source: str, company_slug: str, unique_key: str) -> str:
    raw = f"{source}:{company_slug}:{unique_key}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:16]


AREA_RULES = [
    ("Design", [r"\bdesign", r"\bdesigner", r"\bux\b", r"\bui\b", r"creative", r"art/creative"]),
    ("Marketing", [r"marketing", r"brand", r"growth", r"eventos?", r"events?", r"performance"]),
    ("Product", [r"product", r"produto", r"\bpm\b"]),
    ("Data", [r"\bdata\b", r"dados", r"analytics?", r"analyst", r"research", r"bi\b"]),
    ("Engineering", [r"engineering", r"engenharia", r"software", r"developer", r"frontend", r"backend", r"technology", r"\bit\b"]),
    ("Customer Success", [r"customer success", r"\bcs\b", r"customer", r"support", r"suporte"]),
    ("Sales", [r"sales", r"vendas", r"comercial", r"business development", r"account executive"]),
    ("People", [r"people", r"talent", r"recruit", r"rh\b", r"human resources"]),
    ("Finance", [r"finance", r"financial", r"financ", r"accounting", r"contabil"]),
    ("Legal", [r"legal", r"juridic"]),
    ("Operations", [r"operations", r"operacoes", r"operações", r"logistic", r"quality", r"controle de qualidade"]),
]


def canonical_area(title: str, department: str | None) -> str:
    haystack = normalize_text(f"{title} {department or ''}")
    for area, patterns in AREA_RULES:
        if any(re.search(pattern, haystack) for pattern in patterns):
            return area
    return "Other"


def parse_source_posted_at(value: Any, now: datetime) -> str | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return isoformat_z(value)
    text = str(value).strip()
    if not text:
        return None

    try:
        return isoformat_z(parse_iso(text))
    except ValueError:
        pass

    lower = text.lower()
    if lower in {"today", "just now", "agora", "hoje"}:
        return isoformat_z(now)

    match = re.search(r"(\d+)\s*(day|days|dia|dias|week|weeks|semana|semanas|month|months|mes|meses|mês|year|years|ano|anos)", lower)
    if not match:
        return None

    amount = int(match.group(1))
    unit = match.group(2)
    if unit.startswith(("day", "dia")):
        days = amount
    elif unit.startswith(("week", "semana")):
        days = amount * 7
    elif unit.startswith(("month", "mes", "mês")):
        days = amount * 30
    else:
        days = amount * 365
    return isoformat_z(now - timedelta(days=days))


def add_utm(url: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.update(UTM_PARAMS)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def normalize_job(raw: dict[str, Any], company: dict[str, Any], now: datetime) -> dict[str, Any]:
    external_id = str(raw["external_id"])
    first_seen_at = raw.get("first_seen_at") or isoformat_z(now)
    posted_at = parse_source_posted_at(raw.get("posted_at") or raw.get("created_at"), now)
    created_at = posted_at or first_seen_at
    updated_at = raw.get("updated_at") or isoformat_z(now)
    raw_department = raw.get("department") or "Operations"
    source = "linkedin"
    unique_key = job_unique_key(raw["title"], raw.get("location") or "Remoto")
    return {
        "id": job_id(source, company["slug"], unique_key),
        "external_id": external_id,
        "external_ids": [external_id],
        "source": source,
        "company_slug": company["slug"],
        "title": raw["title"],
        "department": canonical_area(raw["title"], raw_department),
        "raw_department": raw_department,
        "location": raw.get("location") or "Remoto",
        "remote": bool(raw.get("remote", False)),
        "url": add_utm(raw["url"]),
        "created_at": created_at,
        "posted_at": posted_at,
        "first_seen_at": first_seen_at,
        "updated_at": updated_at,
        "last_seen_at": isoformat_z(now),
        "is_active": True,
        "inactive_reason": None,
        "canonical_key": f"{source}:{company['slug']}:{unique_key}",
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
        "created_at": None,
        "posted_at": item.get("postedAt"),
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
) -> tuple[list[dict[str, Any]], list[str], set[str]]:
    if callable(fetch_fn_or_fixtures):
        fetch_fn = fetch_fn_or_fixtures
    else:
        # Caminho legado: fixtures dict (usado pelos testes existentes)
        fixtures = fetch_fn_or_fixtures
        def fetch_fn(company: dict[str, Any]) -> list[dict[str, Any]]:
            return fetch_fake_jobs(company, fixtures, now, error_slugs)

    fetched: list[dict[str, Any]] = []
    logs: list[str] = []
    successful_company_slugs: set[str] = set()
    for company in companies:
        try:
            company_jobs = fetch_fn(company)
            fetched.extend(company_jobs)
            successful_company_slugs.add(company["slug"])
            logs.append(f"ok {company['slug']}: {len(company_jobs)} jobs")
        except SyncError as exc:
            logs.append(f"skip {company['slug']}: {exc}")
            logging.warning("Skipping %s: %s", company["slug"], exc)
    return fetched, logs, successful_company_slugs


def _safe_min_iso(*values: str | None) -> str | None:
    parsed = [parse_iso(value) for value in values if value]
    return isoformat_z(min(parsed)) if parsed else None


def _safe_max_iso(*values: str | None) -> str | None:
    parsed = [parse_iso(value) for value in values if value]
    return isoformat_z(max(parsed)) if parsed else None


def prepare_job_record(job: dict[str, Any]) -> dict[str, Any]:
    prepared = deepcopy(job)
    source = prepared.get("source", "linkedin")
    external_id = str(prepared.get("external_id", ""))
    external_ids = prepared.get("external_ids") or ([external_id] if external_id else [])
    raw_department = prepared.get("raw_department") or prepared.get("department") or "Operations"
    # Registro legado pode não ter timestamp nenhum — garantir first_seen_at
    # (espelha normalize_job) deixa todos os consumidores downstream seguros:
    # created_at, merge_job_records (parse_iso) e generate_jsonld ([:10]).
    first_seen_at = (
        prepared.get("first_seen_at")
        or prepared.get("created_at")
        or prepared.get("last_seen_at")
        or isoformat_z(utc_now())
    )
    posted_at = prepared.get("posted_at") or parse_source_posted_at(prepared.get("created_at"), parse_iso(first_seen_at))
    unique_key = job_unique_key(prepared["title"], prepared.get("location") or "Remoto")

    prepared["source"] = source
    prepared["external_id"] = external_id
    prepared["external_ids"] = sorted({str(value) for value in external_ids if value})
    prepared["raw_department"] = raw_department
    prepared["department"] = canonical_area(prepared["title"], raw_department)
    prepared["location"] = prepared.get("location") or "Remoto"
    prepared["remote"] = bool(prepared.get("remote", False))
    prepared["first_seen_at"] = first_seen_at
    # last_seen_at também precisa existir: a deativação pula registro sem ele
    # (ficaria ativo) e generate_jsonld faz parse_iso(last_seen_at) sem guarda.
    prepared["last_seen_at"] = prepared.get("last_seen_at") or first_seen_at
    prepared["posted_at"] = posted_at
    prepared["created_at"] = posted_at or first_seen_at
    prepared["inactive_reason"] = prepared.get("inactive_reason") if not prepared.get("is_active", True) else None
    prepared["canonical_key"] = f"{source}:{prepared['company_slug']}:{unique_key}"
    prepared["id"] = job_id(source, prepared["company_slug"], unique_key)
    return prepared


def merge_job_records(current: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    current_seen = parse_iso(current.get("last_seen_at") or current.get("updated_at") or current["created_at"])
    incoming_seen = parse_iso(incoming.get("last_seen_at") or incoming.get("updated_at") or incoming["created_at"])
    base = deepcopy(incoming if incoming_seen >= current_seen else current)
    external_ids = set(current.get("external_ids", [])) | set(incoming.get("external_ids", []))
    if current.get("external_id"):
        external_ids.add(str(current["external_id"]))
    if incoming.get("external_id"):
        external_ids.add(str(incoming["external_id"]))

    base["external_ids"] = sorted(external_ids)
    base["first_seen_at"] = _safe_min_iso(current.get("first_seen_at"), incoming.get("first_seen_at"))
    base["posted_at"] = _safe_min_iso(current.get("posted_at"), incoming.get("posted_at"))
    base["created_at"] = base.get("posted_at") or base.get("first_seen_at")
    base["updated_at"] = _safe_max_iso(current.get("updated_at"), incoming.get("updated_at"))
    base["last_seen_at"] = _safe_max_iso(current.get("last_seen_at"), incoming.get("last_seen_at"))
    base["department"] = canonical_area(base["title"], base.get("raw_department") or base.get("department"))
    return base


def merge_jobs(
    existing_jobs: list[dict[str, Any]],
    fetched_jobs: list[dict[str, Any]],
    now: datetime,
    total_fetched: int,
    successful_company_slugs: set[str] | None = None,
) -> list[dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    for existing in existing_jobs:
        prepared = prepare_job_record(existing)
        current = by_key.get(prepared["canonical_key"])
        by_key[prepared["canonical_key"]] = merge_job_records(current, prepared) if current else prepared

    for fetched in fetched_jobs:
        prepared = prepare_job_record(fetched)
        current = by_key.get(prepared["canonical_key"])
        merged = merge_job_records(current, prepared) if current else prepared
        merged["updated_at"] = isoformat_z(now)
        merged["last_seen_at"] = isoformat_z(now)
        merged["is_active"] = True
        merged["inactive_reason"] = None
        by_key[prepared["canonical_key"]] = merged

    if successful_company_slugs is None and total_fetched > 0:
        successful_company_slugs = {job["company_slug"] for job in by_key.values()}

    if successful_company_slugs:
        expires_before = now - timedelta(days=MISSING_SOURCE_GRACE_DAYS)
        stale_before = now - timedelta(days=STALE_POSTED_DAYS)
        unreachable_before = now - timedelta(days=COMPANY_UNREACHABLE_DAYS)
        for job in by_key.values():
            scraped_ok = job["company_slug"] in successful_company_slugs
            last_seen = job.get("last_seen_at")
            # 1) Posting velho demais → provável vaga-fantasma perpétua (vale mesmo
            #    se a empresa raspou ok neste run).
            if job.get("posted_at") and parse_iso(job["posted_at"]) < stale_before:
                job["is_active"] = False
                job["inactive_reason"] = "stale_posted_at"
            # Sem last_seen_at (registro legado/corrompido) não dá p/ julgar
            # obsolescência por tempo — não mexe, em vez de crashar o run inteiro.
            elif not last_seen:
                continue
            # 2) Empresa raspada com sucesso, mas a vaga não voltou → saiu do ar.
            elif scraped_ok and parse_iso(last_seen) < expires_before:
                job["is_active"] = False
                job["inactive_reason"] = "missing_from_source"
            # 3) Backstop: empresa falhou no scrape e não é vista há > N dias. Não
            #    dá mais p/ garantir que a vaga existe → esconder em vez de mostrar
            #    fantasma. Só atua porque OUTRAS empresas rasparam ok (estamos no
            #    bloco successful_company_slugs); numa pane total nada é desativado.
            elif not scraped_ok and parse_iso(last_seen) < unreachable_before:
                job["is_active"] = False
                job["inactive_reason"] = "company_unreachable"

    return sorted(by_key.values(), key=lambda j: (not j["is_active"], j["company_slug"], j["title"], j["location"]))


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
        "validThrough": (parse_iso(job["last_seen_at"]) + timedelta(days=JSONLD_VALID_THROUGH_DAYS)).date().isoformat(),
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
    min_active_ratio: float | None = None,
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

    fetched_jobs, logs, successful_company_slugs = fetch_all_company_jobs(companies, fetch_fn, now)
    merged_jobs = merge_jobs(
        existing_payload.get("jobs", []),
        fetched_jobs,
        now,
        len(fetched_jobs),
        successful_company_slugs=successful_company_slugs,
    )
    next_payload = build_payload(companies, merged_jobs, now)
    changed = stable_json(comparable_payload(existing_payload)) != stable_json(comparable_payload(next_payload))

    # Vagas escondidas pelo backstop de empresa inalcançável — registrar sempre,
    # para a falha silenciosa de scrape de uma empresa virar sinal observável.
    unreachable = sum(1 for j in merged_jobs if j.get("inactive_reason") == "company_unreachable")
    if unreachable:
        offline = sorted({j["company_slug"] for j in merged_jobs if j.get("inactive_reason") == "company_unreachable"})
        logging.warning(
            "backstop: %d vaga(s) escondida(s) por empresa inalcançável há >%dd: %s",
            unreachable, COMPANY_UNREACHABLE_DAYS, ", ".join(offline),
        )

    # Trava de sanidade: aborta ANTES de escrever se as vagas ativas colapsarem.
    # As vagas escondidas pelo backstop são intencionais (a empresa ficou
    # inalcançável) — somá-las de volta evita que a trava bloqueie o write e, com
    # isso, MANTENHA as vagas-fantasma no ar, o oposto do objetivo do backstop.
    if min_active_ratio:
        prior_active = sum(1 for j in existing_payload.get("jobs", []) if j.get("is_active"))
        new_active = next_payload["total_active"]
        if prior_active > 0 and (new_active + unreachable) < prior_active * min_active_ratio:
            raise SyncError(
                f"sanity gate: active jobs collapsed {prior_active} -> {new_active} "
                f"(+{unreachable} ocultas como inalcançáveis; "
                f"< {min_active_ratio:.0%} of prior); refusing to write/publish"
            )

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


def write_sync_log(result: SyncResult, mode: str, now: datetime) -> None:
    """Anexa um resumo do run em src/data/sync_log.json (mantém os últimos N).

    Lido pelo dashboard de admin para mostrar logs reais de sincronização.
    """
    log = read_json(SYNC_LOG_PATH, {"runs": []})
    runs = log.get("runs", []) if isinstance(log, dict) else []
    runs.insert(0, {
        "ts": isoformat_z(now),
        "mode": mode,
        "total_fetched": result.total_fetched,
        "total_active": result.total_active,
        "changed": result.changed,
        "lines": result.logs,
    })
    write_json(SYNC_LOG_PATH, {"runs": runs[:SYNC_LOG_KEEP]})


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
        help="Apify API token. Falls back to APIFY_TOKEN env var.",
    )
    parser.add_argument(
        "--allow-fixtures",
        action="store_true",
        help="Permite rodar em modo fixtures (fake) quando não há APIFY_TOKEN. "
        "Sem esta flag, a ausência de token é um erro fatal (evita publicar dados fake em produção).",
    )
    return parser.parse_args()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args()
    apify_token = args.apify_token or os.environ.get("APIFY_TOKEN")

    # Sem token e sem opt-in explícito: erro fatal. Em produção isso evita que o
    # cron rode silenciosamente em modo fixtures e publique um board quase vazio.
    if not apify_token and not args.allow_fixtures:
        logging.error(
            "APIFY_TOKEN ausente. Defina o token ou passe --allow-fixtures para "
            "rodar em modo fake explicitamente. Abortando sem escrever."
        )
        return 2

    try:
        ratio = float(os.environ.get("SYNC_MIN_ACTIVE_RATIO", SYNC_MIN_ACTIVE_RATIO_DEFAULT))
    except ValueError:
        ratio = SYNC_MIN_ACTIVE_RATIO_DEFAULT
    # No modo fixtures o dataset é pequeno de propósito — não aplica a trava.
    min_active_ratio = ratio if apify_token else None

    now = utc_now()
    try:
        result = run_sync(
            now=now,
            error_slugs=set(args.simulate_error) if not apify_token else None,
            apify_token=apify_token,
            min_active_ratio=min_active_ratio,
        )
    except SyncError as e:
        logging.error("%s", e)
        return 3

    write_sync_log(result, mode="apify" if apify_token else "fake", now=now)
    for line in result.logs:
        logging.info(line)
    logging.info("fetched=%s active=%s changed=%s", result.total_fetched, result.total_active, result.changed)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
