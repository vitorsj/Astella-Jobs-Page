#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/vitorsj/Astella-Jobs-Page.git"
WORK_DIR="/tmp/astella-jobs"

# Clone fresh so we have a proper .git directory for commit + push
git clone "$REPO_URL" "$WORK_DIR"
cd "$WORK_DIR"

git config user.email "cron@astella.vc"
git config user.name "Astella Jobs Cron"

# Run sync
python scripts/jobs_sync.py

# Commit and push only if data files changed
if ! git diff --quiet -- jobs.json public/jobs.json public/job-postings.jsonld src/data/jobs.generated.json public/empresas/; then
  git add jobs.json public/jobs.json public/job-postings.jsonld src/data/jobs.generated.json public/empresas/
  git commit -m "chore: sync jobs $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git push origin main
  echo "Pushed updated jobs to GitHub — Vercel rebuild triggered."
else
  echo "No changes detected, skipping push."
fi

# Healthchecks.io ping — runs AFTER push so a push failure = no ping = alert fires
if [ -n "${HEALTHCHECKS_URL:-}" ]; then
  curl -fsS --retry 3 "${HEALTHCHECKS_URL}" > /dev/null
  echo "Healthcheck pinged."
fi
