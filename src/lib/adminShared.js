// Helpers compartilhados entre as páginas de admin (editor de vaga, vaga
// manual e empresa). Mantém validação e mensagens de erro num lugar só.

// Aceita http(s) ou vazio. Espelha a regra do servidor (isHttpUrl em
// api/overrides.js) para dar feedback no campo antes do save.
export function isHttpUrlOrEmpty(value) {
  if (value == null || value === '') return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// Mensagem padronizada para falha de save/criação nos editores de admin.
// `verb` entra na mensagem genérica ("Erro ao salvar/criar: …").
export function saveErrorMessage(status, error, verb = 'salvar') {
  if (status === 401) return 'Sessão expirada — recarregue e entre de novo.'
  if (status === 0 || status >= 500) return 'Indisponível (rode com `vercel dev` ou em produção).'
  if (error === 'invalid_url') return 'Link inválido — use uma URL http(s).'
  return `Erro ao ${verb}: ${error || status}`
}
