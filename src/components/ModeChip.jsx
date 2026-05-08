import { useLang } from '../context/LangContext.jsx'

export default function ModeChip({ mode, sm }) {
  const { t } = useLang()
  const label = t.modes[mode] || mode
  const cls = `wf-chip${sm ? ' wf-chip-sm' : ''}`
  return <span className={cls}>{label}</span>
}
