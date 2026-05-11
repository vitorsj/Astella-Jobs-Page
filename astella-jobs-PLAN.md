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
          │  jobs_sync.py   │  (Railway cron, 1x/semana)
          │                 │
          │  1. git pull    │  ← jobs.json atual do repo
          │  2. fetch API   │  ← skip-and-log por empresa
          │  3. merge       │  ← dedup + soft-delete (com outage guard)
          │  4. hash check  │  ← só prossegue se conteúdo mudou
          │  5. write JSON  │
          │  6. gen HTML    │  ← index.html + /empresas/:slug.html + JSON-LD
          │  7. git push    │  ← GITHUB_TOKEN (Railway env var)
          │  8. hc ping     │  ← Healthchecks.io (DEPOIS do push)
          └────────┬────────┘
                   │ git push
          ┌────────▼────────┐
          │   GitHub repo   │
          │   jobs.json     │  ← estado + display data
          │   index.html    │  ← JSON-LD para Google Jobs
          │   /empresas/    │  ← company pages
          │   *.html        │
          └────────┬────────┘
                   │ auto-deploy on push
          ┌────────▼──────────┐
          │  Vercel (free)    │
          │  jobs.astella.vc  │
          │                   │
          │  Plausible script │  ← click tracking
          └───────────────────┘
```

**Componentes:**

- **Cron**: Railway (~$5–10/mês), Python 3, roda 1x/semana (segunda-feira, 9h BRT — cron: `0 12 * * 1`).
- **Frontend**: Vercel free tier, serve HTML/CSS/JS estático. Auto-deploy no git push.
- **Analytics**: Plausible (client-side, sem backend).
- **Monitoring**: Healthchecks.io (free).
- **Data sources MVP**: LinkedIn-only (Gupy/Greenhouse/Lever deferidos).

## Decisões Locked

1. **Persistência: JSON-only**. `jobs.json` no repo é a fonte de verdade. Sem SQLite no Railway. Estado entre runs vive no git.

2. **Click tracking: Plausible**. Sem endpoint de escrita próprio (elimina spam de métricas).

3. **Soft-delete com guard**:
   - Se `last_seen_at < now() - 7 days`, `is_active = false`.
   - **Guard de outage**: se `total_fetched == 0` em um run, **não** aplicar soft-delete. Preserva vagas existentes durante outage da API.

4. **Frontend pattern**: HTML estático gerado pelo cron com JSON-LD embutido (Google Jobs SEO). Filtros em JS lendo `jobs.json` separado.

5. **UTM tracking**: Todos os links "Ver vaga" levam `?utm_source=astella&utm_medium=jobs_board`.

6. **Git auth (Railway → GitHub)**: Fine-grained PAT, 1 ano expiry, `GITHUB_TOKEN` env var no Railway. Escopo: write apenas neste repo.

7. **No-op check**: Hash do `jobs.json` antes vs depois. Só commitar se mudou.

8. **Error handling**: Skip-and-log por empresa. API 4xx/5xx para empresa X → log + próxima empresa.

9. **Healthchecks.io ping ocorre DEPOIS do git push**. Se o push falhar, o ping não acontece — alerta dispara. Detecta token expirado, repo offline, etc.

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
- `is_active`: false quando `last_seen_at < now() - 7 days`. Frontend mostra apenas `is_active = true`.
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

| # | Test | O que verifica |
|---|------|----------------|
| 1 | `test_dedup_new_job` | Vaga nova → adicionada ao jobs list |
| 2 | `test_dedup_existing_job` | Mesma vaga vista de novo → `last_seen_at` atualizado, sem duplicata |
| 3 | `test_soft_delete_active` | `last_seen_at = hoje` → `is_active = True` |
| 4 | `test_soft_delete_expired` | `last_seen_at = 8 dias atrás` → `is_active = False` |
| 5 | `test_soft_delete_floor_on_outage` | `total_fetched = 0` → soft-delete **não** aplicado |
| 6 | `test_jsonld_valid_posting` | `generate_jsonld(job)` → schema.org/JobPosting válido |
| 7 | `test_jsonld_remote_job` | `remote=True` → `jobLocationType="TELECOMMUTE"` |
| 8 | `test_error_handling_skip_and_log` | HTTP 500 para empresa X → X pulada, outras OK |

## Failure Modes

| Codepath | Failure | Test? | Error handling | User vê |
|----------|---------|-------|----------------|---------|
| LinkedIn API 429/500 | Rate limit ou server error | ✅ #8 | Skip + log | Empresa sem update — vaga some em 7 dias |
| LinkedIn API down 8+ dias | Outage total | ✅ #5 | Guard: skip soft-delete | Nada — vagas preservadas |
| `git push` falha (token expirado) | GITHUB_TOKEN expirou | ❌ | Healthchecks.io alerta (ping após push) | Site congela; alerta dispara |
| JSON-LD inválido | Campo obrigatório ausente | ✅ #6 | Validação no test | Google Jobs não indexa |
| Logo 404 | URL inválida | ❌ | Fallback: inicial + cor | Visual fallback, não quebra |

**Critical mitigation**: Healthchecks.io ping **depois** do git push. Push falhar = ping não acontece = alerta.

## Setup Checklist

```
[x] Criar repo → vitorsj/Astella-Jobs-Page
[x] Vercel: conectar ao repo, free tier
[ ] Configurar subdomain jobs.astella.vc → Vercel (CNAME: cname.vercel-dns.com)
[x] Railway: criar projeto, cron job, GITHUB_TOKEN + APIFY_TOKEN configurados
[x] GitHub: Fine-grained PAT (1 ano, write neste repo)
[ ] Healthchecks.io: criar check, adicionar HEALTHCHECKS_URL no Railway
[ ] Plausible: criar site jobs.astella.vc, adicionar script no template HTML
[x] companies.json: 10 empresas com linkedin_search_url (Gabriel, Purple Metrics,
    Cienty, Cayena, Bem-Te-Vi, Kompa, Estoca, Sallve, TaOn, Lastlink)
[x] jobs_sync.py: implementação com Apify + 11 unit tests
[x] /empresas/:slug.html gerado automaticamente pelo sync
[x] First run manual no Railway validado — 60 vagas reais
[x] Cron schedule no Railway: 0 12 * * 1 (segunda, 9h BRT)
[ ] Spot-check 5–10 vagas no site antes de divulgar
```

## Stack atual (maio/2026)

- **Frontend**: React + Vite + Tailwind — 3 variações de layout (V1, V2, V3)
- **Backend**: `scripts/jobs_sync.py` — Apify `hKByXkMQaC5Qt9UMN` (curious_coder/linkedin-jobs-scraper)
- **Dados**: `jobs.json` + `src/data/jobs.generated.json` no repo (fonte de verdade)
- **Cron**: Railway, `bash scripts/run_cron.sh`, `0 12 * * 1`
- **Deploy**: Vercel auto-deploy a cada push no `main`
- **Repo**: vitorsj/Astella-Jobs-Page (privado)
- **Apify token**: configurado como env var `APIFY_TOKEN` no Railway
- **Input format**: `{"urls": ["<linkedin_search_url>"]}` (strings, não objetos)

## NÃO no escopo (deferido)

- **Gupy integration**: Gupy API gratuita por empresa (`https://{slug}.gupy.io/api/v1/jobs`). Adicionar após MVP LinkedIn validado. Dedup entre fontes: `hash(company_slug + title.lower().strip())`, manter ATS quando conflitar.
- **Greenhouse / Lever**: depois do audit do portfólio (quem usa o quê).
- **Email capture / candidate profiles**: após mês 1 com tráfego.
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
