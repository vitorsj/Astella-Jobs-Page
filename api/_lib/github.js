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

export async function readOverrides() {
  const { token, repo, branch, path } = config()
  const url = `${API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`
  const res = await fetch(url, { headers: ghHeaders(token) })
  if (res.status === 404) return { data: { ...EMPTY }, sha: null }
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
  return { data: normalize(parsed), sha: json.sha }
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
  return res.json()
}
