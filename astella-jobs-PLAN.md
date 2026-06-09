# Astella Jobs — Portal de Vagas do Portfólio

Plano de implementação para `jobs.astella.vc`. Documento vivo: editar conforme decisões mudam.

## Problema

A Astella não tem canal centralizado de talentos. Empresas do portfólio postam vagas independentemente no LinkedIn e pedem indicações da rede Astella. Candidatos que descobrem a Astella não têm onde encontrar oportunidades nas investidas. O suporte a talentos é hoje um argumento verbal — não um produto.

## Wedge

`jobs.astella.vc` — página única que agrega vagas ativas das empresas do portfólio, puxadas automaticamente do LinkedIn (via API de terceiro). Cards com logo, cargo, área, cidade. Click redireciona para a candidatura original com UTM tracking.

## 10x Vision (referência futura, não escopo agora)

Rede de talentos two-sided: candidatos criam perfis, portfolio companies acessam o pool, Astella faz matching ativo (modelo a16z Talent / YC Work at a Startup). O `jobs.astella.vc` atual é o wedge que gera o dado e a credibilidade para esse salto.

## MVP scope (3 meses)

```
HOJE                    ESTE PLANO              12 MESES
────────────────────────────────────────────────────────
Founders pedem      →   jobs.astella.vc     →  Candidatos chegam
indicações via          com vagas ativas         ao portfólio via
WhatsApp. Argumento     de 30+ empresas.         Astella antes do
verbal sem métrica.     Analytics mostra         LinkedIn. Founders
                        clicks por empresa.      reconhecem Astella
                        Company pages SEO.       como fonte de
                        Primeiras candidaturas   talentos.
                        em ≤30 dias.
```

## Stack & Arquitetura

```
External Source
┌──────────────────────────────────────┐
│  LinkedIn (via 3rd party API vendor) │
│  Input: companies.json (LinkedIn URLs)│
└──────────────────┬───────────────────┘
                   │
          ┌────────▼────────┐
          │  jobs_sync.py   │  (Railway cron, seg/qua/sex 9h UTC)
          │                 │
          │  1. git clone   │  ← estado atual do repo
          │  2. fetch API   │  ← skip-and-log por empresa
          │  3. merge       │  ← dedup + expiração por empresa
          │  4. diff check  │  ← só commita se conteúdo mudou
          │  5. write JSON  │
          │  6. gen SEO     │  ← /empresas/:slug.html + JSON-LD
          │  7. git push    │  ← GITHUB_TOKEN (Railway env var)
          │  8. hc ping     │  ← Healthchecks.io (start/success/fail)
          └────────┬────────┘
                   │ git push
          ┌────────▼────────┐
          │   GitHub repo   │
          │   jobs.json     │  ← estado + display data
          │   src/data/*.json│  ← dados usados pelo React
          │   /empresas/    │  ← company pages com JSON-LD
          │   job-postings  │  ← JSON-LD agregado
          └────────┬────────┘
                   │ auto-deploy on push
          ┌────────▼──────────┐
          │  Vercel (free)    │
          │  jobs.astella.vc  │
          │  React SPA + /api │
          │  Vercel Analytics │
          └───────────────────┘
                   │
          ┌────────▼──────────┐
          │  Upstash Redis    │  ← contagem de cliques por vaga
          └───────────────────┘
```

**Componentes:**

- **Cron**: Railway (~$5–10/mês), Python 3, roda segunda, quarta e sexta às 9h UTC — cron: `0 9 * * 1,3,5`.
- **Frontend**: Vercel free tier, serve HTML/CSS/JS estático. Auto-deploy no git push.
- **Analytics**: Vercel Analytics para tráfego geral + `/api/clicks` com Upstash Redis para cliques por vaga no admin.
- **Admin**: Vercel Functions (`/api/login`, `/api/overrides`, `/api/clicks`) com cookie assinado e GitHub Contents API para salvar overrides.
- **Monitoring**: Healthchecks.io (free).
- **Data sources MVP**: LinkedIn-only (Gupy/Greenhouse/Lever deferidos).

## Decisões Locked

1. **Persistência: JSON-only**. `jobs.json` no repo é a fonte de verdade. Sem SQLite no Railway. Estado entre runs vive no git.

2. **Click tracking atual: endpoint próprio + Upstash Redis**. O clique público dispara `/api/clicks` fire-and-forget; o admin lê agregados por vaga/empresa. Plausible fica deferido.

3. **Soft-delete com guard**:
   - Se uma empresa foi buscada com sucesso e uma vaga anterior não veio no resultado, `is_active = false` com `inactive_reason = "missing_from_source"`.
   - Se `posted_at` confiável for mais antigo que 100 dias, `is_active = false` com `inactive_reason = "stale_posted_at"`.
   - **Guard de outage/skip**: se a API não retorna nada globalmente, ou uma empresa é pulada por erro, as vagas existentes daquela empresa são preservadas.

4. **Frontend pattern**: React + Vite. A home é uma SPA que importa `src/data/jobs.generated.json` no build; o cron também gera `public/jobs.json`, `public/job-postings.jsonld` e `/empresas/:slug.html` com JSON-LD para SEO.

5. **UTM tracking**: Todos os links "Ver vaga" levam `?utm_source=astella&utm_medium=jobs_board`.

6. **Git auth (Railway → GitHub)**: Fine-grained PAT, 1 ano expiry, `GITHUB_TOKEN` env var no Railway. Escopo: write apenas neste repo.

7. **No-op check**: Hash do `jobs.json` antes vs depois. Só commitar se mudou.

8. **Error handling**: Skip-and-log por empresa. API 4xx/5xx para empresa X → log + próxima empresa.

9. **Healthchecks.io monitora início, sucesso e falha**. O cron pinga `/start` no começo, `/<exit_code>` em erro e a URL base só depois do sync + push opcional concluírem.

10. **Admin overrides vivem fora do sync**. Edições manuais ficam em `src/data/overrides.json`, salvas via GitHub Contents API; o sync recorrente não sobrescreve overrides.

## jobs.json Schema (contrato Python ↔ JS)

```json
{
  "generated_at": "2026-05-08T18:00:00Z",
  "total_active": 47,
  "jobs": [
    {
      "id": "abc123def456",
      "external_id": "4087123",
      "source": "linkedin",
      "company_slug": "nubank",
      "title": "Senior Software Engineer",
      "department": "Engineering",
      "location": "São Paulo, SP",
      "remote": false,
      "url": "https://www.linkedin.com/jobs/view/4087123/?utm_source=astella&utm_medium=jobs_board",
      "created_at": "2026-04-01T00:00:00Z",
      "updated_at": "2026-05-08T00:00:00Z",
      "last_seen_at": "2026-05-08T18:00:00Z",
      "is_active": true
    }
  ],
  "companies": [
    {
      "id": "nubank-001",
      "name": "Nubank",
      "slug": "nubank",
      "logo_url": "https://media.licdn.com/...",
      "linkedin_url": "https://www.linkedin.com/company/nubank/"
    }
  ]
}
```

**Campos de estado** (cron escreve, frontend filtra):
- `last_seen_at`: timestamp do último run que retornou esta vaga. Base do soft-delete.
- `is_active`: false quando a empresa foi buscada com sucesso e a vaga não apareceu mais na fonte, ou quando `posted_at` confiável está acima do limite de idade. Frontend mostra apenas `is_active = true`.
- `generated_at`: timestamp do run. Útil para debug.

## companies.json (input do cron, mantido manualmente)

```json
[
  {
    "id": "nubank-001",
    "name": "Nubank",
    "slug": "nubank",
    "logo_url": "https://media.licdn.com/.../nubank-logo.png",
    "linkedin_url": "https://www.linkedin.com/company/nubank/"
  }
]
```

Editado manualmente quando empresa nova entra no portfólio (~5–10x/ano).

## Tests (pytest, `tests/test_jobs_sync.py`)

17 testes cobrem:
- dedup de vagas novas, existentes e repostadas;
- preservação em outage total e em empresa pulada por erro;
- expiração imediata quando uma empresa foi buscada com sucesso e a vaga sumiu da fonte;
- expiração de vagas com `posted_at` confiável acima de 100 dias;
- JSON-LD presencial/remoto;
- mapeamento do payload Apify;
- UTM sem derrubar query params existentes;
- company sem `linkedin_search_url`;
- classificação canônica de área por título.

## Failure Modes

| Codepath | Failure | Test? | Error handling | User vê |
|----------|---------|-------|----------------|---------|
| LinkedIn API 429/500 | Rate limit ou server error | ✅ | Skip + log; empresa não expira nesse run | Vagas daquela empresa ficam preservadas |
| LinkedIn API down | Outage total | ✅ | Guard: não expira vagas | Nada — vagas preservadas |
| Empresa buscada com sucesso retorna 0 vagas | Fonte realmente vazia ou scraper mudou | ✅ | Vagas anteriores da empresa expiram como `missing_from_source` | Empresa some do board público |
| `git push` falha (token expirado) | GITHUB_TOKEN expirou | ❌ | Healthchecks.io recebe falha / não recebe sucesso | Site congela; alerta dispara |
| JSON-LD inválido | Campo obrigatório ausente | ✅ #6 | Validação no test | Google Jobs não indexa |
| Logo 404 | URL inválida | ❌ | Fallback: inicial + cor | Visual fallback, não quebra |
| Redis/track indisponível | Upstash ou `/api/clicks` falha | ❌ | Tracking engole erro e não bloqueia navegação | Clique abre a vaga; métrica pode não contar |

**Critical mitigation**: Healthchecks.io só marca sucesso depois do sync + push opcional. Push falhar = sem sucesso e/ou ping de falha.

## Setup Checklist

```
[x] Criar repo → vitorsj/Astella-Jobs-Page
[x] Vercel: conectar ao repo, free tier
[ ] Configurar subdomain jobs.astella.vc → Vercel (CNAME: cname.vercel-dns.com)
[x] Railway: criar projeto, cron job, GITHUB_TOKEN + APIFY_TOKEN configurados
[x] GitHub: Fine-grained PAT (1 ano, write neste repo)
[x] Healthchecks.io: check configurado com cron 0 9 * * 1,3,5 e HEALTHCHECKS_URL no Railway
[x] Vercel env vars/admin: ADMIN_PASSWORD, SESSION_SECRET, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH
[x] Upstash Redis/Vercel KV: KV_REST_API_URL + KV_REST_API_TOKEN configurados
[x] companies.json: 24 empresas com linkedin_search_url
[x] jobs_sync.py: implementação com Apify + 17 unit tests
[x] /empresas/:slug.html gerado automaticamente pelo sync
[x] Sync real Apify validado — último payload local: 2026-06-09T00:05:00Z, 105 vagas ativas, 184 totais
[x] Cron schedule no Railway: 0 9 * * 1,3,5 (segunda, quarta e sexta, 9h UTC)
[ ] Spot-check 5–10 vagas no site antes de divulgar
```

## Stack atual (junho/2026)

- **Frontend público**: React + Vite, rota `/` usando `JobBoardV2`.
- **Admin**: `/admin` e `/admin/edit/:id`, com login por senha, cookie assinado e overrides via GitHub.
- **Backend**: `scripts/jobs_sync.py` — Apify `hKByXkMQaC5Qt9UMN` (curious_coder/linkedin-jobs-scraper)
- **Dados**: `jobs.json` + `src/data/jobs.generated.json` no repo (fonte de verdade)
- **Overrides**: `src/data/overrides.json`
- **Click tracking**: `/api/clicks` + Upstash Redis
- **Tráfego geral**: Vercel Analytics
- **Cron**: Railway, `bash scripts/run_cron.sh`, `0 9 * * 1,3,5`
- **Deploy**: Vercel auto-deploy a cada push no `main`
- **Repo**: vitorsj/Astella-Jobs-Page (privado)
- **Apify token**: configurado como env var `APIFY_TOKEN` no Railway
- **Input format**: `{"urls": ["<linkedin_search_url>"]}` (strings, não objetos)

## NÃO no escopo (deferido)

- **Gupy integration**: Gupy API gratuita por empresa (`https://{slug}.gupy.io/api/v1/jobs`). Adicionar após MVP LinkedIn validado. Dedup entre fontes: `hash(company_slug + title.lower().strip())`, manter ATS quando conflitar.
- **Greenhouse / Lever**: depois do audit do portfólio (quem usa o quê).
- **Email capture / candidate profiles**: após mês 1 com tráfego.
- **Plausible**: alternativa futura se quisermos um dashboard externo de analytics mais completo; não é o tracking oficial do MVP atual.
- **Sitemap.xml**: ~20 linhas Python, segunda iteração.
- **Two-sided talent platform**: roadmap 12+ meses.
- **astella.vc footer link**: alinhar com time do site após launch (não bloqueia).

## Open Questions (não bloqueiam, resolver antes de escalar)

1. **LinkedIn API vendor**: nomear o serviço. Antes de chegar a 40+ empresas, verificar plano de preços e definir ceiling mensal.
2. **Dedup entre fontes** (relevante quando Gupy entrar): testar `hash(company_slug + title.lower().strip())` em produção.

## Distribuição (launch)

- **SEO**: JSON-LD no HTML → Google Jobs indexa orgânico.
- **Launch**: newsletter Astella + post LinkedIn + share direto com founders do portfólio.
- **Pós-launch**: link no footer/header de astella.vc (alinhar com quem cuida do site).

## Success Criteria

- **Semana 1**: Site no ar com vagas de pelo menos 10 empresas.
- **Mês 1**: Pelo menos 5 empresas reportam ter recebido candidato via Astella.
- **Mês 3**: Founders mencionam espontaneamente a página como diferencial da Astella.
