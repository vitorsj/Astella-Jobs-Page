import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CompanyLogo from '../components/CompanyLogo.jsx'
import { ALL_JOBS, COMPANY } from '../data/jobs.js'
import { getOverrides, saveJob, saveManualJob, deleteManualJob, resetJob, logout } from '../lib/adminApi.js'

// Aceita http(s) ou vazio (link de candidatura de vaga manual). Espelha a regra
// do servidor (isHttpUrl em api/overrides.js) para dar feedback no campo.
function isHttpUrlOrEmpty(value) {
  if (value == null || value === '') return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const LEVELS = ['Junior', 'Mid', 'Senior', 'Lead']
const MODES = ['Remoto', 'Híbrido', 'Presencial']
const STATUSES = ['rascunho', 'publicada', 'arquivada']

// Monta o form a partir da vaga (já com overrides de build) sobreposta pelo
// override vivo (mais novo, vindo de /api/overrides).
function buildForm(job, ov) {
  ov = ov || {}
  const has = (k, fallback) => (typeof ov[k] === 'boolean' ? ov[k] : !!fallback)
  return {
    title_pt: ov.title_pt ?? job.title.pt,
    title_en: ov.title_en ?? job.title.en,
    description: ov.description ?? job.description ?? '',
    area: ov.area ?? job.area ?? '',
    level: ov.level ?? job.level ?? 'Mid',
    loc: ov.loc ?? job.loc ?? '',
    mode: ov.mode ?? job.mode ?? 'Presencial',
    status: ov.status ?? job.status ?? 'publicada',
    url: ov.url ?? job.url ?? '',
    featured: has('featured', job.featured),
    bilingual: has('bilingual', job.bilingual),
    confidential: has('confidential', job.confidential),
    hidden: has('hidden', job.hidden),
  }
}

export default function AdminEditor() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [liveOverrides, setLiveOverrides] = useState(null) // null = ainda carregando/indisponível
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todas')
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  // Carrega o estado vivo de overrides uma vez (reflete saves após o último deploy).
  useEffect(() => {
    let alive = true
    getOverrides()
      .then(data => { if (alive) setLiveOverrides(data || { jobs: {} }) })
      .catch(() => { if (alive) setLiveOverrides({ jobs: {} }) })
    return () => { alive = false }
  }, [])

  const selectedId = useMemo(() => {
    if (id && ALL_JOBS.some(j => j.id === id)) return id
    return ALL_JOBS[0]?.id
  }, [id])

  const sel = useMemo(() => ALL_JOBS.find(j => j.id === selectedId) || ALL_JOBS[0], [selectedId])
  const liveOv = liveOverrides?.jobs?.[selectedId]

  const [form, setForm] = useState(() => (sel ? buildForm(sel, null) : null))

  // Reconstrói o form quando muda a vaga selecionada ou chega o override vivo.
  useEffect(() => {
    if (sel) setForm(buildForm(sel, liveOv))
  }, [selectedId, liveOverrides]) // eslint-disable-line react-hooks/exhaustive-deps

  const queue = useMemo(() => {
    const q = query.trim().toLowerCase()
    return ALL_JOBS.filter(j => {
      if (statusFilter !== 'todas' && (j.status || 'publicada') !== statusFilter) return false
      if (!q) return true
      return (j.title?.pt || '').toLowerCase().includes(q) || (COMPANY[j.company]?.name || '').toLowerCase().includes(q)
    })
  }, [query, statusFilter])

  if (!sel || !form) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--c-paper)' }}>
        <span className="mute hand">nenhuma vaga disponível</span>
      </div>
    )
  }

  const company = COMPANY[sel.company] || { name: sel.company, source: sel.source }
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Patch enviado ao servidor (só campos administrados).
  function buildPatch(extra = {}) {
    return {
      title_pt: form.title_pt,
      title_en: form.title_en,
      description: form.description,
      area: form.area,
      level: form.level,
      loc: form.loc,
      mode: form.mode,
      status: form.status,
      featured: form.featured,
      bilingual: form.bilingual,
      confidential: form.confidential,
      hidden: form.hidden,
      ...extra,
    }
  }

  function reportSaveError(status, error) {
    if (status === 401) showToast('Sessão expirada — recarregue e entre de novo.')
    else if (status === 0 || status >= 500) showToast('Indisponível (rode com `vercel dev` ou em produção).')
    else if (error === 'invalid_url') showToast('Link inválido — use uma URL http(s).')
    else showToast(`Erro ao salvar: ${error || status}`)
  }

  async function persist(extra = {}) {
    if (saving) return
    const patch = buildPatch(extra)
    // Vaga manual carrega url editável; validamos antes (servidor revalida).
    if (sel.manual && !isHttpUrlOrEmpty(form.url)) {
      showToast('Link inválido — use uma URL http(s).')
      return
    }
    setSaving(true)
    const res = sel.manual
      ? await saveManualJob({ id: selectedId, company: sel.company, ...patch, url: form.url || '' })
      : await saveJob(selectedId, patch) // url omitido: jobs.js ignora url em vaga sincronizada
    const { ok, status, error } = res
    setSaving(false)
    if (ok) {
      setForm(f => ({ ...f, ...extra }))
      if (sel.manual) {
        const merged = { id: selectedId, company: sel.company, ...patch, url: form.url || '' }
        setLiveOverrides(prev => {
          const list = (prev?.manual_jobs || []).filter(j => j.id !== selectedId)
          return { ...(prev || {}), manual_jobs: [...list, merged] }
        })
      } else {
        setLiveOverrides(prev => ({ ...(prev || {}), jobs: { ...(prev?.jobs || {}), [selectedId]: { ...(prev?.jobs?.[selectedId] || {}), ...patch } } }))
      }
      setLastSaved(new Date())
      showToast('Salvo. O site público atualiza em ~1 min.')
    } else {
      reportSaveError(status, error)
    }
  }

  // Reverte uma vaga SINCRONIZADA ao estado do sync (descarta o override).
  async function handleResetToSync() {
    if (saving || sel.manual) return
    if (!window.confirm('Reverter esta vaga para o estado do sync? As edições do admin serão descartadas.')) return
    setSaving(true)
    const { ok, status, error } = await resetJob(selectedId)
    setSaving(false)
    if (ok) {
      setForm(buildForm(sel, null))
      setLiveOverrides(prev => {
        const jobs = { ...(prev?.jobs || {}) }
        delete jobs[selectedId]
        return { ...(prev || {}), jobs }
      })
      setLastSaved(null)
      showToast('Revertida ao sync. O site público atualiza em ~1 min.')
    } else {
      reportSaveError(status, error)
    }
  }

  // Exclui uma vaga MANUAL (não existe no sync, some de vez).
  async function handleDeleteManual() {
    if (saving || !sel.manual) return
    if (!window.confirm('Excluir esta vaga manual? Esta ação não pode ser desfeita.')) return
    setSaving(true)
    const { ok, status, error } = await deleteManualJob(selectedId)
    setSaving(false)
    if (ok) {
      showToast('Vaga manual excluída. Some do site em ~1 min.')
      navigate('/admin')
    } else {
      reportSaveError(status, error)
    }
  }

  const savedLabel = lastSaved
    ? `salvo às ${lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : (liveOv?.updated_at ? 'editada anteriormente' : 'sem edições')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--c-paper)' }}>
      {/* App bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 18px', borderBottom: '1.5px solid var(--c-line)',
        background: 'var(--c-paper2)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/admin')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span className="wf-spiral" />
            <span className="wf-label">ASTELLA · ADMIN</span>
          </button>
          <span className="mute hand" style={{ fontSize: 12 }}>/ vagas / editar</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/admin')} className="wf-chip wf-chip-sm" style={{ cursor: 'pointer' }}>← dashboard</button>
          <button
            onClick={async () => { await logout(); window.location.reload() }}
            className="wf-chip wf-chip-sm"
            style={{ cursor: 'pointer' }}
          >
            sair
          </button>
        </div>
      </div>

      {/* 3-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 280px', flex: 1, minHeight: 0 }}>
        {/* Queue rail */}
        <aside style={{ borderRight: '1.5px solid var(--c-line)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1.5px solid var(--c-line)', flexShrink: 0 }}>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: 14 }}>⌕</span>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="wf-input-el wf-input-sm"
                style={{ paddingLeft: 26, width: '100%', height: 30, fontSize: 12 }}
                placeholder="buscar vaga…"
              />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['todas', 'Todas'], ['publicada', 'Publicadas'], ['rascunho', 'Rascunho'], ['arquivada', 'Arquivadas']].map(([val, label]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setStatusFilter(val)}
                  className={`wf-chip wf-chip-sm${statusFilter === val ? ' wf-chip-on' : ''}`}
                  style={{ cursor: 'pointer', border: statusFilter === val ? 'none' : undefined }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {queue.map(j => {
              const isSel = j.id === selectedId
              return (
                <button
                  key={j.id}
                  onClick={() => navigate(`/admin/edit/${j.id}`)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '12px 14px',
                    borderBottom: '1px dashed var(--c-line3)',
                    borderLeft: isSel ? '3px solid var(--c-teal)' : '3px solid transparent',
                    background: isSel ? 'rgba(86,187,194,0.06)' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <CompanyLogo id={j.company} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="hand wf-truncate" style={{ fontWeight: 700, fontSize: 13 }}>{j.title?.pt || '—'}</div>
                    <div className="mute hand wf-truncate" style={{ fontSize: 11, marginTop: 2 }}>{COMPANY[j.company]?.name || j.company} · {j.posted === '0d' ? 'hoje' : j.posted}</div>
                  </div>
                  {j.hidden && <span className="wf-chip wf-chip-sm" style={{ background: 'var(--c-shade)', color: 'var(--c-mute)', flexShrink: 0 }}>oculta</span>}
                  {j.featured && <span className="wf-chip wf-chip-sm" style={{ flexShrink: 0 }}>★</span>}
                </button>
              )
            })}
            {queue.length === 0 && (
              <div className="mute hand" style={{ padding: 16, fontSize: 12 }}>nenhuma vaga com esse filtro</div>
            )}
          </div>
        </aside>

        {/* Editor */}
        <div style={{ overflowY: 'auto', padding: 28 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <CompanyLogo id={sel.company} size="lg" />
              <div>
                <div className="wf-label mute">
                  {sel.manual ? 'VAGA MANUAL' : `VAGA · puxada de ${company.source} · ${sel.posted === '0d' ? 'hoje' : 'há ' + sel.posted}`}
                </div>
                <h2 className="wf-h2" style={{ marginTop: 4 }}>{form.title_pt || '(sem título)'}</h2>
                <div className="mute hand" style={{ fontSize: 13, marginTop: 4 }}>
                  {company.name} · {form.loc} · {form.mode}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="wf-btn wf-btn-ghost wf-btn-sm" disabled={saving} onClick={() => persist({ hidden: !form.hidden })}>
                  {form.hidden ? 'mostrar' : 'esconder'}
                </button>
                <button className="wf-btn wf-btn-ghost wf-btn-sm" disabled={saving} onClick={() => persist({ featured: !form.featured })}>
                  {form.featured ? '★ destacada' : '★ destacar'}
                </button>
                <button className="wf-btn wf-btn-primary wf-btn-sm" disabled={saving} onClick={() => persist({ status: 'publicada' })}>
                  {saving ? '…' : 'publicar'}
                </button>
              </div>
              <span className="mute hand" style={{ fontSize: 11 }}>{savedLabel}</span>
            </div>
          </div>

          {/* Title PT-BR RAW vs EDITADO */}
          <div className="wf-label mute" style={{ marginBottom: 8 }}>TÍTULO (PT-BR)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div className="wf-box-paper" style={{ padding: 12 }}>
              <div className="wf-label mute" style={{ fontSize: 10, marginBottom: 4 }}>RAW · {company.source}</div>
              <div className="hand" style={{ fontSize: 14 }}>{sel.rawTitle || '—'}</div>
            </div>
            <div className="wf-box" style={{ padding: 12, borderColor: 'var(--c-teal)', borderWidth: 2 }}>
              <div className="wf-label" style={{ fontSize: 10, marginBottom: 4, color: 'var(--c-teal)' }}>EDITADO</div>
              <input
                value={form.title_pt}
                onChange={e => set('title_pt', e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--wf-hand)', fontSize: 14, color: 'var(--c-ink)' }}
              />
            </div>
          </div>

          {/* Title EN */}
          <div className="wf-label mute" style={{ marginBottom: 8 }}>TÍTULO (EN)</div>
          <input
            type="text"
            className="wf-input-el"
            value={form.title_en}
            onChange={e => set('title_en', e.target.value)}
            style={{ width: '100%', marginBottom: 18 }}
          />

          {/* 4-col metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
            <div>
              <div className="wf-label mute" style={{ marginBottom: 6 }}>ÁREA</div>
              <input type="text" className="wf-input-el" style={{ width: '100%', height: 36 }} value={form.area} onChange={e => set('area', e.target.value)} />
            </div>
            <div>
              <div className="wf-label mute" style={{ marginBottom: 6 }}>SENIORIDADE</div>
              <div style={{ position: 'relative' }}>
                <select className="wf-select-el" style={{ width: '100%' }} value={form.level} onChange={e => set('level', e.target.value)}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 11, opacity: 0.5 }}>▾</span>
              </div>
            </div>
            <div>
              <div className="wf-label mute" style={{ marginBottom: 6 }}>LOCALIZAÇÃO</div>
              <input type="text" className="wf-input-el" style={{ width: '100%', height: 36 }} value={form.loc} onChange={e => set('loc', e.target.value)} />
            </div>
            <div>
              <div className="wf-label mute" style={{ marginBottom: 6 }}>MODELO</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {MODES.map(m => (
                  <button
                    key={m}
                    onClick={() => set('mode', m)}
                    className={`wf-chip wf-chip-sm${form.mode === m ? ' wf-chip-on' : ''}`}
                    style={{ flex: 1, cursor: 'pointer', justifyContent: 'center', border: form.mode === m ? 'none' : undefined }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="wf-label mute" style={{ marginBottom: 6 }}>DESCRIÇÃO</div>
          <textarea
            className="wf-textarea"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={5}
            style={{ marginBottom: 18, width: '100%' }}
            placeholder="Descrição da vaga…"
          />

          {/* Link */}
          <div className="wf-label mute" style={{ marginBottom: 6 }}>LINK DE CANDIDATURA</div>
          {sel.manual ? (
            <>
              <input
                type="url"
                className="wf-input-el"
                value={form.url}
                onChange={e => set('url', e.target.value)}
                placeholder="https://…"
                style={{ width: '100%', marginBottom: 4, borderColor: isHttpUrlOrEmpty(form.url) ? undefined : 'var(--c-danger, #E05145)' }}
              />
              {!isHttpUrlOrEmpty(form.url) && (
                <div className="hand" style={{ fontSize: 11, marginBottom: 4, color: '#E05145' }}>use uma URL http(s) válida</div>
              )}
            </>
          ) : (
            <div className="wf-input" style={{ marginBottom: 4 }}>
              <span className="mute" style={{ opacity: 0.6 }}>↗</span>
              <a href={sel.url} target="_blank" rel="noreferrer" className="hand" style={{ fontSize: 13, color: 'var(--c-ink)', textDecoration: 'none' }}>{sel.url}</a>
            </div>
          )}
          <div className="mute hand" style={{ fontSize: 11, marginBottom: 24 }}>candidatos serão redirecionados em nova aba</div>

          {/* Save bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="wf-btn wf-btn-primary" disabled={saving} onClick={() => persist()}>
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
            <span className="mute hand" style={{ fontSize: 12 }}>{savedLabel}</span>
          </div>
        </div>

        {/* Right meta panel */}
        <aside style={{
          borderLeft: '1.5px solid var(--c-line)',
          padding: 20, background: 'var(--c-paper)',
          overflowY: 'auto',
        }}>
          <div className="wf-label mute" style={{ marginBottom: 8 }}>STATUS</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => set('status', s)}
                className={`wf-chip wf-chip-sm${form.status === s ? ' wf-chip-on' : ''}`}
                style={{ cursor: 'pointer', flex: 1, justifyContent: 'center', border: form.status === s ? 'none' : undefined }}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="wf-label mute" style={{ marginBottom: 8 }}>SINAIS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {[
              { key: 'featured',     label: '★ Em destaque (homepage)' },
              { key: 'bilingual',    label: 'Bilíngue (mostrar EN)' },
              { key: 'confidential', label: 'Vaga sigilosa (ocultar empresa)' },
              { key: 'hidden',       label: 'Ocultar do board público' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" className="wf-check" checked={form[key]} onChange={() => set(key, !form[key])} />
                <span className="hand" style={{ fontSize: 13 }}>{label}</span>
              </label>
            ))}
          </div>

          <div className="wf-divider-thin" />

          <div className="wf-label mute" style={{ marginBottom: 8, marginTop: 16 }}>ORIGEM</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['fonte', sel.manual ? 'manual' : company.source],
              ['id', sel.id],
              ['external', sel.externalId || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="mute hand" style={{ fontSize: 13 }}>{label}</span>
                <span className="hand wf-truncate" style={{ fontWeight: 700, fontSize: 12, maxWidth: 150 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Ações de origem: reverter (sincronizada) ou excluir (manual) */}
          {(sel.manual || sel.edited) && (
            <>
              <div className="wf-divider-thin" style={{ marginTop: 16 }} />
              <div style={{ marginTop: 16 }}>
                {sel.manual ? (
                  <button
                    type="button"
                    className="wf-btn wf-btn-ghost wf-btn-sm"
                    disabled={saving}
                    onClick={handleDeleteManual}
                    style={{ width: '100%', color: '#E05145', borderColor: 'rgba(224,81,69,0.4)' }}
                  >
                    Excluir vaga manual
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wf-btn wf-btn-ghost wf-btn-sm"
                    disabled={saving}
                    onClick={handleResetToSync}
                    style={{ width: '100%' }}
                  >
                    ↺ Reverter para o sync
                  </button>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }} className="toast-enter">
          <div className="wf-box hand" style={{ padding: '12px 18px', background: 'var(--c-ink)', color: '#fff', fontWeight: 700 }}>
            <span style={{ color: 'var(--c-teal)', marginRight: 10 }}>✓</span>{toast}
          </div>
        </div>
      )}
    </div>
  )
}
