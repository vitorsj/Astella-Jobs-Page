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

// Contagem de clicks por vaga (mapa { jobId: count }). Requer sessão de admin.
export async function getClicks() {
  const { ok, data } = await jsonFetch('/api/clicks', { method: 'GET' })
  return ok ? (data?.clicks || {}) : {}
}
