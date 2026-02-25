import { useState, useRef, useCallback } from 'react'
import { uploadFile, cleanData } from '../api/client.js'

const ACCEPTED = '.csv,.xlsx,.xls'

export default function Uploader({ onComplete }) {
  const [state, setState] = useState('idle')  // idle | dragging | uploading | cleaning | error
  const [error, setError]  = useState(null)
  const [progress, setProgress] = useState('')
  const inputRef = useRef()

  const process = useCallback(async (file) => {
    setError(null)

    // Basic client-side validation
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError(`Unsupported file type ".${ext}". Please upload a CSV or Excel file.`)
      setState('idle')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds 50 MB limit.')
      setState('idle')
      return
    }

    try {
      // Step 1 — upload
      setState('uploading')
      setProgress('Uploading file...')
      const upload = await uploadFile(file)

      // Step 2 — clean
      setState('cleaning')
      setProgress(`Processing ${upload.rows.toLocaleString()} rows × ${upload.columns} columns...`)
      const result = await cleanData(upload.session_id)

      setState('idle')
      onComplete({ upload, result })
    } catch (err) {
      setState('error')
      setError(err.message)
    }
  }, [onComplete])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setState('idle')
    const file = e.dataTransfer.files[0]
    if (file) process(file)
  }, [process])

  const onInputChange = (e) => {
    const file = e.target.files[0]
    if (file) process(file)
    e.target.value = ''
  }

  const busy = state === 'uploading' || state === 'cleaning'

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.logo}>DataQuality</span>
        <span style={S.logoSub}>by your company</span>
      </div>

      {/* Hero */}
      <div style={S.hero}>
        <h1 style={S.heroTitle}>Clean your data in seconds</h1>
        <p style={S.heroSub}>
          Upload a messy CSV or Excel file. Get a clean dataset, quality scores,
          and a full audit report — no code required.
        </p>
      </div>

      {/* Drop zone */}
      <div
        style={{
          ...S.dropzone,
          ...(state === 'dragging' ? S.dropzoneDrag : {}),
          ...(busy ? S.dropzoneBusy : {}),
        }}
        onDragOver={(e) => { e.preventDefault(); if (!busy) setState('dragging') }}
        onDragLeave={() => { if (!busy) setState('idle') }}
        onDrop={busy ? undefined : onDrop}
        onClick={() => !busy && inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          style={{ display: 'none' }}
          onChange={onInputChange}
        />

        {busy ? (
          <div style={S.spinnerWrap}>
            <div style={S.spinner} />
            <p style={S.progressText}>{progress}</p>
            <p style={S.progressSub}>This may take a moment for large files</p>
          </div>
        ) : (
          <div style={S.dropContent}>
            <div style={S.uploadIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p style={S.dropTitle}>Drop your file here</p>
            <p style={S.dropSub}>or <span style={S.browse}>browse to upload</span></p>
            <p style={S.dropHint}>CSV, XLSX up to 50 MB</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={S.errorBox}>
          <span style={S.errorIcon}>⚠</span>
          {error}
        </div>
      )}

      {/* Feature pills */}
      <div style={S.pills}>
        {['Duplicate removal', 'Type inference', 'Smart imputation', 'Outlier detection',
          'Category harmonisation', 'Quality scoring', 'Audit log', 'Instant report'].map(f => (
          <span key={f} style={S.pill}>{f}</span>
        ))}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3rem 1.5rem',
    background: 'var(--bg)',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
    marginBottom: '3rem',
    alignSelf: 'flex-start',
    paddingLeft: '0.5rem',
  },
  logo: {
    fontFamily: 'var(--mono)',
    fontWeight: 600,
    fontSize: '1rem',
    color: 'var(--accent)',
    letterSpacing: '-0.01em',
  },
  logoSub: {
    fontSize: '0.75rem',
    color: 'var(--muted)',
  },
  hero: {
    textAlign: 'center',
    maxWidth: '560px',
    marginBottom: '2.5rem',
  },
  heroTitle: {
    fontSize: '2rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.03em',
    lineHeight: 1.2,
    marginBottom: '0.75rem',
  },
  heroSub: {
    fontSize: '1rem',
    color: 'var(--text2)',
    lineHeight: 1.6,
    fontWeight: 400,
  },
  dropzone: {
    width: '100%',
    maxWidth: '520px',
    border: '2px dashed var(--border2)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg2)',
    padding: '3rem 2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginBottom: '1rem',
  },
  dropzoneDrag: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-bg)',
  },
  dropzoneBusy: {
    cursor: 'default',
    borderColor: 'var(--border)',
  },
  dropContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
  },
  uploadIcon: {
    color: 'var(--muted)',
    marginBottom: '0.5rem',
  },
  dropTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text)',
  },
  dropSub: {
    fontSize: '0.85rem',
    color: 'var(--text2)',
  },
  browse: {
    color: 'var(--accent)',
    fontWeight: 500,
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  dropHint: {
    fontSize: '0.75rem',
    color: 'var(--muted)',
    marginTop: '0.25rem',
  },
  spinnerWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  progressText: {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'var(--text)',
  },
  progressSub: {
    fontSize: '0.78rem',
    color: 'var(--muted)',
  },
  errorBox: {
    maxWidth: '520px',
    width: '100%',
    background: 'var(--red-bg)',
    border: '1px solid #fca5a5',
    borderRadius: 'var(--radius)',
    padding: '0.75rem 1rem',
    color: 'var(--red)',
    fontSize: '0.85rem',
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  errorIcon: { fontSize: '1rem', flexShrink: 0 },
  pills: {
    marginTop: '2.5rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    justifyContent: 'center',
    maxWidth: '560px',
  },
  pill: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '999px',
    padding: '0.3rem 0.85rem',
    fontSize: '0.75rem',
    color: 'var(--text2)',
    fontWeight: 500,
  },
}

// Inject spinner keyframe
const style = document.createElement('style')
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
document.head.appendChild(style)