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

// kind:'company' — edita uma empresa do portfólio (chave = slug). Sem criação:
// só empresas existentes são editadas (ver restrição de produto).
export const saveCompany = (slug, patch) => putOverride({ kind: 'company', slug, patch })

// kind:'manual_job' — cria/edita uma vaga manual. job.id obrigatório; job.url
// precisa ser http(s) ou vazio (servidor rejeita com error:'invalid_url').
export const saveManualJob = (job) => putOverride({ kind: 'manual_job', job })

// kind:'delete_manual_job' — remove uma vaga manual.
export const deleteManualJob = (id) => putOverride({ kind: 'delete_manual_job', id })

// kind:'reset_job' — descarta o override de uma vaga sincronizada (volta ao sync).
export const resetJob = (id) => putOverride({ kind: 'reset_job', id })

// Contagem de clicks por vaga (mapa { jobId: count }). Requer sessão de admin.
export async function getClicks() {
  const { ok, data } = await jsonFetch('/api/clicks', { method: 'GET' })
  return ok ? (data?.clicks || {}) : {}
}
