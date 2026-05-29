# Painel de Admin — Astella Jobs

Painel interno para editar as vagas do board sem mexer no código. Vive em `/admin`
(produção: https://astella-jobs-page.vercel.app/admin).

## O que dá pra fazer

- **Login por senha** (senha única compartilhada).
- **Editar vagas**: título (PT/EN), descrição, área, senioridade, local, modelo.
- **Status**: rascunho / publicada / arquivada.
- **Sinais**: destacar (homepage), bilíngue, sigilosa, ocultar do board público.
- **Ver logs** do último sync (alimentados pelo cron do Railway).

Não faz (por opção, mai/2026): adicionar empresas novas nem disparar o sync manualmente.
Empresa nova entra editando `companies.json` (input do cron); o sync roda toda segunda 9h.

## Como funciona (arquitetura)

O `jobs.generated.json` é **sobrescrito** pelo sync semanal. Para as edições do admin
sobreviverem, elas vivem numa camada separada:

```
sync (Railway, semanal) ──> jobs.generated.json  ─┐
                                                   ├─ merge por id (src/data/jobs.js) ──> board
admin (edição) ──> overrides.json ────────────────┘
```

- **`src/data/overrides.json`** é a "base de dados" das edições, casada com as vagas
  pelo `id` estável (`sha256("linkedin:{slug}:{título}|{local}")[:16]`). Sobrevive ao sync.
- Salvar no admin faz um **commit** em `overrides.json` via GitHub Contents API → push →
  rebuild da Vercel. O board público reflete em **~1 min** (latência do rebuild).
- Vaga sincronizada **nasce publicada** (sem fila de moderação).
- Borda conhecida: se o LinkedIn muda o título da vaga, o `id` muda e o override "desgruda".

## Endpoints (`api/`, funções serverless da Vercel)

| Rota | O que faz |
|------|-----------|
| `POST /api/login` | valida a senha, seta cookie de sessão HttpOnly assinado (HMAC) |
| `GET /api/session` | `{ authenticated: bool }` (gate do cliente) |
| `POST /api/logout` | limpa o cookie |
| `GET/PUT /api/overrides` | lê/grava `overrides.json` (commit via GitHub API) — exige sessão |

A proteção real é no servidor: toda escrita valida a sessão. O gate no React é só UX.

## Configuração (env vars na Vercel)

Project Settings → Environment Variables:

| Var | Para quê |
|-----|----------|
| `ADMIN_PASSWORD` | senha de acesso ao /admin |
| `SESSION_SECRET` | segredo p/ assinar o cookie (gere: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `GITHUB_TOKEN` | PAT fine-grained com **Contents: write** neste repo (commitar overrides.json) |
| `GITHUB_REPO` | `vitorsj/Astella-Jobs-Page` |
| `GITHUB_BRANCH` | `main` |

Sem `ADMIN_PASSWORD`/`SESSION_SECRET` o login retorna erro de config. Sem `GITHUB_TOKEN`
o login funciona mas salvar falha. Ver `.env.example`.

## Dev local

`vite dev` **não roda as funções `/api`**. Em DEV o gate libera o acesso para mexer na UI,
mas login/edição reais precisam de `vercel dev` (com as env vars em `.env.local`).

## Limitações conhecidas

- **Sem rate limiting no `/api/login`** — força-bruta na senha é possível. Aceitável para
  uso interno com senha forte; endurecer (delay / Vercel KV) se necessário.
- Edição depende do rebuild da Vercel (~1 min) para refletir no público — é o custo do
  modelo git-as-DB (sem servidor de estado).
