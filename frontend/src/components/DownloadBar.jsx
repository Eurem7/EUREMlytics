import { csvDownloadUrl, pdfDownloadUrl } from '../api/client.js'

export default function DownloadBar({ sessionId, filename }) {
  const base = filename?.replace(/\.[^.]+$/, '') ?? 'cleaned'

  return (
    <div style={S.bar}>
      <span style={S.label}>Download</span>
      <div style={S.buttons}>
        <a
          href={csvDownloadUrl(sessionId)}
          download={`${base}_cleaned.csv`}
          style={S.btnPrimary}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Clean CSV
        </a>
        <a
          href={pdfDownloadUrl(sessionId)}
          download={`${base}_report.pdf`}
          style={S.btnOutline}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          PDF Report
        </a>
      </div>
    </div>
  )
}

const S = {
  bar: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '0.6rem 2rem',
    background: 'var(--bg2)', borderTop: '1px solid var(--border)',
    position: 'sticky', bottom: 0, zIndex: 40,
  },
  label: { fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500 },
  buttons: { display: 'flex', gap: '0.5rem' },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.4rem 1rem', borderRadius: 'var(--radius)',
    background: 'var(--accent)', color: '#fff',
    fontSize: '0.78rem', fontWeight: 600,
    textDecoration: 'none', border: 'none', cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.4rem 1rem', borderRadius: 'var(--radius)',
    background: 'var(--bg2)', color: 'var(--text)',
    fontSize: '0.78rem', fontWeight: 600,
    textDecoration: 'none', border: '1px solid var(--border2)', cursor: 'pointer',
    transition: 'all 0.15s',
  },
}