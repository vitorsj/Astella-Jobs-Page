// Lê e grava src/data/overrides.json no repo via GitHub Contents API.
// Usa o GITHUB_TOKEN (PAT fine-grained com escrita neste repo). Cada gravação
// é um commit no branch → dispara rebuild da Vercel → board público atualiza.
// fetch é global no runtime Node da Vercel.

const API = 'https://api.github.com'
const EMPTY = { version: 1, jobs: {}, companies: {}, manual_jobs: [] }

function config() {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  const branch = process.env.GITHUB_BRANCH || 'main'
  const path = process.env.OVERRIDES_PATH || 'src/data/overrides.json'
  if (!token || !repo) {
    const err = new Error('github_not_configured')
    err.status = 500
    throw err
  }
  return { token, repo, branch, path }
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'astella-jobs-admin',
  }
}

function normalize(data) {
  return {
    version: data.version ?? 1,
    jobs: data.jobs ?? {},
    companies: data.companies ?? {},
    manual_jobs: data.manual_jobs ?? [],
  }
}

// Cache em memória do último read, validado por ETag. Sobrevive entre
// invocações "warm" da função serverless; um 304 do GitHub não conta contra o
// rate limit e evita re-baixar o arquivo a cada load do painel admin.
let cache = null // { etag, data, sha }

export async function readOverrides() {
  const { token, repo, branch, path } = config()
  const url = `${API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`
  // Snapshot local: um write concorrente pode anular `cache` enquanto o fetch
  // está em voo — sem o snapshot, o 304 cairia no throw de !res.ok abaixo.
  const snap = cache
  const headers = ghHeaders(token)
  if (snap?.etag) headers['If-None-Match'] = snap.etag
  const res = await fetch(url, { headers })
  // Clone: applyOp (api/overrides.js) muta o objeto retornado in place; sem
  // clone, um write que falha deixaria o cache com edições nunca gravadas.
  if (res.status === 304 && snap) return { data: structuredClone(snap.data), sha: snap.sha }
  if (res.status === 404) {
    cache = null
    return { data: { ...EMPTY }, sha: null }
  }
  if (!res.ok) {
    const err = new Error(`github_read_failed`)
    err.status = res.status
    err.detail = await res.text().catch(() => '')
    throw err
  }
  const json = await res.json()
  let parsed
  try {
    parsed = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'))
  } catch {
    parsed = { ...EMPTY }
  }
  const data = normalize(parsed)
  cache = { etag: res.headers.get('etag'), data: structuredClone(data), sha: json.sha }
  return { data, sha: json.sha }
}

export async function writeOverrides(data, sha, message) {
  const { token, repo, branch, path } = config()
  const url = `${API}/repos/${repo}/contents/${path}`
  const content = Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64')
  const body = { message, content, branch }
  if (sha) body.sha = sha
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = new Error('github_write_failed')
    err.status = res.status
    err.detail = await res.text().catch(() => '')
    throw err
  }
  cache = null // o conteúdo mudou; o próximo read revalida do zero
  return res.json()
}
