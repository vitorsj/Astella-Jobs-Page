// Dispara a contagem de click de uma vaga (fire-and-forget, nunca bloqueia o clique).
// Usa sendBeacon para garantir o envio mesmo quando o navegador abre a vaga em outra aba.
export function trackJobClick(jobId) {
  if (!jobId) return
  try {
    const body = JSON.stringify({ jobId })
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/clicks', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/clicks', {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch {
    /* nunca bloquear o clique */
  }
}
