// Cliente das funções serverless de admin (/api/*).
// Sempre inclui cookies (credentials: 'include') para carregar a sessão.

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  let data = null
  try { data = await res.json() } catch { /* sem corpo */ }
  return { ok: res.ok, status: res.status, data }
}

export async function checkSession() {
  const { ok, data } = await jsonFetch('/api/session', { method: 'GET' })
  return ok && !!data?.authenticated
}

export async function login(password) {
  const { ok, status, data } = await jsonFetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
  return { ok, status, error: data?.error }
}

export async function logout() {
  await jsonFetch('/api/logout', { method: 'POST' })
}

// Estado vivo de overrides.json (mais novo que o build, reflete saves recentes).
export async function getOverrides() {
  const { ok, data } = await jsonFetch('/api/overrides', { method: 'GET' })
  return ok ? data : null
}

// Aplica uma operação de override e commita. Retorna { ok, overrides | error }.
export async function putOverride(op) {
  const { ok, status, data } = await jsonFetch('/api/overrides', {
    method: 'PUT',
    body: JSON.stringify(op),
  })
  return { ok, status, overrides: data?.overrides, error: data?.error }
}

export const saveJob = (id, patch) => putOverride({ kind: 'job', id, patch })
export const resetJob = id => putOverride({ kind: 'reset_job', id })
export const saveCompany = (slug, patch) => putOverride({ kind: 'company', slug, patch })
export const saveManualJob = job => putOverride({ kind: 'manual_job', job })

// Dispara o workflow de sync no GitHub Actions.
export async function triggerSync() {
  const { ok, status, data } = await jsonFetch('/api/sync', { method: 'POST' })
  return { ok, status, error: data?.error }
}

// companies.json (fonte do sync) — adicionar empresa entra no próximo sync.
export async function addCompany(company) {
  const { ok, status, data } = await jsonFetch('/api/companies', {
    method: 'POST',
    body: JSON.stringify(company),
  })
  return { ok, status, company: data?.company, error: data?.error }
}
