#!/usr/bin/env bash
set -euo pipefail

# Configure git identity for the commit
git config user.email "cron@astella.vc"
git config user.name "Astella Jobs Cron"

# Inject GITHUB_TOKEN into remote URL so push works without SSH keys
git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/vitorsj/Astella-Jobs-Page.git"

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
