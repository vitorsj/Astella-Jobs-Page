import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CompanyLogo from '../components/CompanyLogo.jsx'
import { JOBS, COMPANY } from '../data/jobs.js'

const QUEUE = JOBS.slice(0, 9)

export default function AdminEditor() {
  const navigate = useNavigate()
  const [selectedId,  setSelectedId]  = useState(JOBS[0]?.id)
  const [status,      setStatus]      = useState('rascunho')
  const [mode,        setMode]        = useState('Híbrido')
  const [signals,     setSignals]     = useState({ bilingual: true, newsletter: true, featured: false, confidential: false })
  const [titlePt,     setTitlePt]     = useState(JOBS[0]?.title.pt || '')
  const [titleEn,     setTitleEn]     = useState(JOBS[0]?.title.en || '')
  const [description, setDescription] = useState('Estamos buscando um(a) engenheiro(a) pleno para integrar nosso time. Você trabalhará com tecnologias modernas e colaborará com os times de design e produto.')

  const sel = JOBS.find(j => j.id === selectedId) || JOBS[0]
  const toggleSignal = key => setSignals(s => ({ ...s, [key]: !s[key] }))

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
        <div style={{ display: 'flex', gap: 6 }}>
          {['Vagas', 'Empresas', 'Fontes', 'Logs', 'Métricas'].map(tab => (
            <span key={tab} className="wf-chip wf-chip-sm" style={{ cursor: 'pointer' }}>{tab}</span>
          ))}
        </div>
      </div>

      {/* 3-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 280px', flex: 1, minHeight: 0 }}>
        {/* Queue rail */}
        <aside style={{ borderRight: '1.5px solid var(--c-line)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1.5px solid var(--c-line)', flexShrink: 0 }}>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: 14 }}>⌕</span>
              <input type="text" className="wf-input-el wf-input-sm" style={{ paddingLeft: 26, width: '100%', height: 30, fontSize: 12 }} placeholder="buscar vaga…" />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['Pendentes (4)', true], ['Publicadas', false], ['Erro', false]].map(([label, on]) => (
                <span key={label} className={`wf-chip wf-chip-sm${on ? ' wf-chip-on' : ''}`} style={{ cursor: 'pointer' }}>{label}</span>
              ))}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {QUEUE.map((j, i) => {
              const isSel = j.id === selectedId
              return (
                <button
                  key={j.id}
                  onClick={() => setSelectedId(j.id)}
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
                    <div className="hand wf-truncate" style={{ fontWeight: 700, fontSize: 13 }}>{j.title.pt}</div>
                    <div className="mute hand wf-truncate" style={{ fontSize: 11, marginTop: 2 }}>{COMPANY[j.company].name} · {j.posted}</div>
                  </div>
                  {i < 4 && (
                    <span className="wf-chip wf-chip-sm" style={{ background: '#FEE5DC', borderColor: '#F5A07A', color: '#C04A1A', flexShrink: 0 }}>novo</span>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Editor */}
        <div style={{ overflowY: 'auto', padding: 28 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <CompanyLogo id={sel.company} size="lg" />
              <div>
                <div className="wf-label mute">VAGA {sel.id} · puxada de {COMPANY[sel.company].source} · há {sel.posted}</div>
                <h2 className="wf-h2" style={{ marginTop: 4 }}>{sel.title.pt}</h2>
                <div className="mute hand" style={{ fontSize: 13, marginTop: 4 }}>
                  {COMPANY[sel.company].name} · {sel.loc} · {sel.mode}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="wf-btn wf-btn-ghost wf-btn-sm">esconder</button>
                <button className="wf-btn wf-btn-ghost wf-btn-sm">★ destacar</button>
                <button className="wf-btn wf-btn-primary wf-btn-sm" onClick={() => setStatus('publicada')}>publicar</button>
              </div>
              <span className="mute hand" style={{ fontSize: 11 }}>último salvo há 2 min</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 24, borderBottom: '1.5px solid var(--c-line)', marginBottom: 18 }}>
            {['Conteúdo', 'Metadados', 'Origem (raw)', 'Histórico'].map((tab, i) => (
              <span
                key={tab}
                className="hand"
                style={{
                  paddingBottom: 8, fontSize: 13, cursor: 'pointer',
                  fontWeight: i === 0 ? 700 : 400,
                  color: i === 0 ? 'var(--c-ink)' : 'var(--c-mute)',
                  borderBottom: i === 0 ? '2px solid var(--c-teal)' : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {tab}
              </span>
            ))}
          </div>

          {/* Title PT-BR RAW vs EDITADO */}
          <div className="wf-label mute" style={{ marginBottom: 8 }}>TÍTULO (PT-BR)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div className="wf-box-paper" style={{ padding: 12 }}>
              <div className="wf-label mute" style={{ fontSize: 10, marginBottom: 4 }}>RAW · {COMPANY[sel.company].source}</div>
              <div className="hand" style={{ fontSize: 14 }}>{sel.title.pt}</div>
            </div>
            <div className="wf-box" style={{ padding: 12, borderColor: 'var(--c-teal)', borderWidth: 2 }}>
              <div className="wf-label" style={{ fontSize: 10, marginBottom: 4, color: 'var(--c-teal)' }}>EDITADO</div>
              <input
                value={titlePt}
                onChange={e => setTitlePt(e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--wf-hand)', fontSize: 14, color: 'var(--c-ink)' }}
              />
            </div>
          </div>

          {/* Title EN */}
          <div className="wf-label mute" style={{ marginBottom: 8 }}>TÍTULO (EN) · auto-traduzido</div>
          <input
            type="text"
            className="wf-input-el"
            value={titleEn}
            onChange={e => setTitleEn(e.target.value)}
            style={{ width: '100%', marginBottom: 18 }}
          />

          {/* 4-col metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 18 }}>
            <div>
              <div className="wf-label mute" style={{ marginBottom: 6 }}>ÁREA</div>
              <div style={{ position: 'relative' }}>
                <select className="wf-select-el" style={{ width: '100%' }}>
                  <option>Engenharia</option><option>Produto</option><option>Design</option>
                </select>
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 11, opacity: 0.5 }}>▾</span>
              </div>
            </div>
            <div>
              <div className="wf-label mute" style={{ marginBottom: 6 }}>SENIORIDADE</div>
              <div style={{ position: 'relative' }}>
                <select className="wf-select-el" style={{ width: '100%' }}>
                  <option>Pleno</option><option>Júnior</option><option>Sênior</option><option>Liderança</option>
                </select>
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 11, opacity: 0.5 }}>▾</span>
              </div>
            </div>
            <div>
              <div className="wf-label mute" style={{ marginBottom: 6 }}>LOCALIZAÇÃO</div>
              <input type="text" className="wf-input-el" style={{ width: '100%', height: 36 }} defaultValue="São Paulo, BR" />
            </div>
            <div>
              <div className="wf-label mute" style={{ marginBottom: 6 }}>MODELO</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['Remoto', 'Híbrido', 'Presencial'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`wf-chip wf-chip-sm${mode === m ? ' wf-chip-on' : ''}`}
                    style={{ flex: 1, cursor: 'pointer', justifyContent: 'center', border: mode === m ? 'none' : undefined }}
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
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={5}
            style={{ marginBottom: 6 }}
          />
          <div className="mute hand" style={{ fontSize: 11, display: 'flex', gap: 14, marginBottom: 18 }}>
            <span style={{ cursor: 'pointer' }}>↩ desfazer</span>
            <span style={{ cursor: 'pointer' }}>✎ markdown</span>
            <span style={{ cursor: 'pointer' }}>↻ re-importar do ATS</span>
          </div>

          {/* Link */}
          <div className="wf-label mute" style={{ marginBottom: 6 }}>LINK DE CANDIDATURA</div>
          <div className="wf-input" style={{ marginBottom: 4 }}>
            <span className="mute" style={{ opacity: 0.6 }}>↗</span>
            <span className="hand" style={{ fontSize: 13 }}>{sel.url}</span>
          </div>
          <div className="mute hand" style={{ fontSize: 11 }}>candidatos serão redirecionados em nova aba</div>
        </div>

        {/* Right meta panel */}
        <aside style={{
          borderLeft: '1.5px solid var(--c-line)',
          padding: 20, background: 'var(--c-paper)',
          overflowY: 'auto',
        }}>
          <div className="wf-label mute" style={{ marginBottom: 8 }}>STATUS</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {['rascunho', 'publicada', 'arquivada'].map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`wf-chip wf-chip-sm${status === s ? ' wf-chip-on' : ''}`}
                style={{ cursor: 'pointer', flex: 1, justifyContent: 'center', border: status === s ? 'none' : undefined }}
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
              { key: 'newsletter',   label: 'Notificar newsletter' },
              { key: 'confidential', label: 'Vaga sigilosa (ocultar empresa)' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" className="wf-check" checked={signals[key]} onChange={() => toggleSignal(key)} />
                <span className="hand" style={{ fontSize: 13 }}>{label}</span>
              </label>
            ))}
          </div>

          <div className="wf-divider-thin" />

          <div className="wf-label mute" style={{ marginBottom: 8 }}>MÉTRICAS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {[['visualizações', '342'], ['cliques', '48'], ['CTR', '14%']].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="mute hand" style={{ fontSize: 13 }}>{label}</span>
                <span className="hand" style={{ fontWeight: 700, fontSize: 13 }}>{val}</span>
              </div>
            ))}
          </div>

          <div className="wf-divider-thin" />

          <div className="wf-label mute" style={{ marginBottom: 8 }}>HISTÓRICO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['há 2min', 'você editou título'],
              [`há ${sel.posted}`, `sync de ${COMPANY[sel.company].source}`],
              [`há ${sel.posted}`, 'criada'],
            ].map(([when, action], i) => (
              <div key={i} className="hand" style={{ fontSize: 12 }}>
                <span className="mute">{when}</span> · {action}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
