// Cliente único do Upstash Redis — store da contagem de clicks por vaga.
// As env vars são injetadas pela integração Upstash/Vercel (KV_REST_API_*),
// com fallback para os nomes nativos do Upstash (UPSTASH_REDIS_REST_*).
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Hash Redis: { jobId → contagem de clicks }
export const CLICKS_KEY = 'job_clicks'
