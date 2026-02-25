import { reportHtmlUrl } from '../api/client.js'

export default function ReportViewer({ sessionId }) {
  const url = reportHtmlUrl(sessionId)

  return (
    <div style={S.wrap}>
      <div style={S.bar}>
        <span style={S.barTitle}>Full Quality Report</span>
        <a href={url} target="_blank" rel="noreferrer" style={S.openBtn}>
          Open in new tab ↗
        </a>
      </div>
      <iframe
        src={url}
        style={S.frame}
        title="Data Quality Report"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%' },
  bar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.75rem 1.5rem',
    background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
  },
  barTitle: { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' },
  openBtn: {
    fontSize: '0.78rem', color: 'var(--accent)', textDecoration: 'none',
    fontWeight: 500,
    padding: '0.3rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'var(--bg2)',
  },
  frame: {
    flex: 1, border: 'none', width: '100%',
    height: 'calc(100vh - 52px - 48px)',
  },
}