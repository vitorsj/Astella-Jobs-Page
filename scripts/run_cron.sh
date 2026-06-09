#!/usr/bin/env bash
set -Eeuo pipefail

healthcheck_ping() {
  local suffix="${1:-}"
  if [ -z "${HEALTHCHECKS_URL:-}" ]; then
    return 0
  fi

  if curl -fsS --retry 3 --max-time 20 "${HEALTHCHECKS_URL%/}${suffix}" > /dev/null; then
    return 0
  fi

  echo "Healthcheck ping failed (${suffix:-success})." >&2
}

on_error() {
  local exit_code="$?"
  echo "Cron failed with exit code ${exit_code}." >&2
  healthcheck_ping "/${exit_code}"
  exit "${exit_code}"
}

trap on_error ERR

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"

# Mesmo repo que o admin API (api/_lib/github.js) usa via GITHUB_REPO — manter
# uma única fonte evita sync e edições de admin divergirem em repos diferentes.
GITHUB_REPO="${GITHUB_REPO:-vitorsj/Astella-Jobs-Page}"
REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git"
WORK_DIR="${WORK_DIR:-$(mktemp -d)}"

healthcheck_ping "/start"

# Clone fresh so we have a proper .git directory for commit + push
git clone "$REPO_URL" "$WORK_DIR"
cd "$WORK_DIR"

git config user.email "cron@astella.vc"
git config user.name "Astella Jobs Cron"

# Run sync
python scripts/jobs_sync.py

# Commit and push only if data files changed. `git status --porcelain` também
# detecta arquivos NOVOS (untracked, ex.: public/empresas/<slug>.html de uma
# empresa nova) — `git diff` só vê arquivos já rastreados.
# Manter em sincronia com os caminhos de saída em scripts/jobs_sync.py.
DATA_PATHS=(jobs.json public/jobs.json public/job-postings.jsonld src/data/jobs.generated.json src/data/sync_log.json public/empresas/)
if [ -n "$(git status --porcelain -- "${DATA_PATHS[@]}")" ]; then
  git add "${DATA_PATHS[@]}"
  git commit -m "chore: sync jobs $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git push origin main
  echo "Pushed updated jobs to GitHub — Vercel rebuild triggered."
else
  echo "No changes detected, skipping push."
fi

# Healthchecks.io success ping — runs only after sync + optional push complete.
healthcheck_ping
if [ -n "${HEALTHCHECKS_URL:-}" ]; then
  echo "Healthcheck success pinged."
else
  echo "Healthcheck not configured; skipping ping."
fi
