import { useState } from 'react'

const QUALITY_COLORS = {
  good: { color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
  warn: { color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  bad:  { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
}

function badge(score) {
  if (score >= 0.85) return 'good'
  if (score >= 0.60) return 'warn'
  return 'bad'
}

function ScoreBar({ score }) {
  const tier = badge(score)
  const { color } = QUALITY_COLORS[tier]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(score * 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '0.7rem', color: 'var(--text2)', minWidth: 32, textAlign: 'right' }}>
        {score}
      </span>
    </div>
  )
}

function StatCard({ value, label, sub, color }) {
  return (
    <div style={S.card}>
      <div style={{ ...S.cardValue, color: color ?? 'var(--accent)' }}>{value}</div>
      <div style={S.cardLabel}>{label}</div>
      {sub && <div style={S.cardSub}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ upload, result, sessionId, onReset }) {
  const [tab, setTab] = useState('quality')  // quality | audit

  const { original_shape, cleaned_shape, rows_removed, columns_dropped,
          column_quality_summary, audit_log, eda_report } = result

  const nGood = column_quality_summary.filter(c => badge(c.quality_score) === 'good').length
  const nWarn = column_quality_summary.filter(c => badge(c.quality_score) === 'warn').length
  const nBad  = column_quality_summary.filter(c => badge(c.quality_score) === 'bad').length

  // Action type counts for audit log summary
  const actionCounts = audit_log.reduce((acc, e) => {
    acc[e.action] = (acc[e.action] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={S.page}>

      {/* ── Topbar ── */}
      <div style={S.topbar}>
        <span style={S.logo}>DataQuality</span>
        <div style={S.topRight}>
          <span style={S.filename}>📄 {upload.filename}</span>
          <button style={S.resetBtn} onClick={onReset}>Upload new file</button>
        </div>
      </div>

      <div style={S.content}>

        {/* ── Overview cards ── */}
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Overview</h2>
          <div style={S.cards}>
            <StatCard
              value={cleaned_shape[0].toLocaleString()}
              label="Clean rows"
              sub={`from ${original_shape[0].toLocaleString()} input`}
            />
            <StatCard
              value={cleaned_shape[1]}
              label="Columns"
              sub={columns_dropped > 0 ? `${columns_dropped} dropped` : 'all kept'}
            />
            <StatCard
              value={nGood}
              label="High quality"
              sub="score ≥ 0.85"
              color="var(--green)"
            />
            <StatCard
              value={nWarn}
              label="Needs review"
              sub="score 0.60–0.84"
              color="var(--warn)"
            />
            <StatCard
              value={nBad}
              label="Low quality"
              sub="score < 0.60"
              color="var(--red)"
            />
            <StatCard
              value={rows_removed.toLocaleString()}
              label="Rows removed"
              sub="dupes + outlier rows"
              color={rows_removed > 0 ? 'var(--warn)' : 'var(--text2)'}
            />
          </div>
        </section>

        {/* ── Tabs ── */}
        <section style={S.section}>
          <div style={S.tabs}>
            {['quality', 'audit'].map(t => (
              <button
                key={t}
                style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}
                onClick={() => setTab(t)}
              >
                {t === 'quality' ? 'Column Quality' : 'Audit Log'}
                <span style={{ ...S.tabCount, ...(tab === t ? S.tabCountActive : {}) }}>
                  {t === 'quality' ? column_quality_summary.length : audit_log.length}
                </span>
              </button>
            ))}
          </div>

          {/* Column quality table */}
          {tab === 'quality' && (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Column', 'Type', 'Quality Score', 'Missing', 'Status', 'Notes'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...column_quality_summary]
                    .sort((a, b) => b.quality_score - a.quality_score)
                    .map(col => {
                      const tier = badge(col.quality_score)
                      const { color, bg, border } = QUALITY_COLORS[tier]
                      return (
                        <tr key={col.column} style={S.tr}>
                          <td style={{ ...S.td, fontWeight: 600 }}>{col.column}</td>
                          <td style={S.td}>
                            <span style={S.typeBadge}>{col.type}</span>
                          </td>
                          <td style={{ ...S.td, minWidth: 140 }}>
                            <ScoreBar score={col.quality_score} />
                          </td>
                          <td style={{ ...S.td, fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>
                            {col.missing_pct != null ? `${col.missing_pct}%` : '—'}
                          </td>
                          <td style={S.td}>
                            <span style={{ ...S.badge, color, background: bg, border: `1px solid ${border}` }}>
                              {col.dropped ? 'DROPPED' : tier.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ ...S.td, color: 'var(--text2)', fontSize: '0.75rem' }}>
                            {col.dropped
                              ? col.drop_reason?.replace(/_/g, ' ')
                              : col.imputation_method
                              ? `imputed via ${col.imputation_method}`
                              : col.high_cardinality_warning
                              ? '⚠ high cardinality'
                              : '—'}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* Audit log */}
          {tab === 'audit' && (
            <div>
              {/* Action summary pills */}
              <div style={S.auditSummary}>
                {Object.entries(actionCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([action, count]) => (
                    <span key={action} style={S.auditPill}>
                      <span style={S.auditPillAction}>{action.replace(/_/g, ' ')}</span>
                      <span style={S.auditPillCount}>×{count}</span>
                    </span>
                  ))}
              </div>

              {/* Full log */}
              <div style={S.auditLog}>
                {audit_log.map((entry, i) => {
                  const { action, column, timestamp, ...rest } = entry
                  const time = timestamp ? timestamp.slice(11, 19) : ''
                  return (
                    <div key={i} style={S.auditEntry}>
                      <span style={S.auditTime}>{time}</span>
                      <span style={{ ...S.auditAction, ...actionStyle(action) }}>
                        {action.replace(/_/g, ' ')}
                      </span>
                      {column && <span style={S.auditCol}>{column}</span>}
                      <span style={S.auditDetail}>
                        {Object.entries(rest).map(([k, v]) => (
                          <span key={k} style={S.auditKv}>
                            <span style={S.auditKey}>{k}:</span>
                            <span style={S.auditVal}>{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                          </span>
                        ))}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function actionStyle(action) {
  if (action.includes('drop') || action.includes('remov'))
    return { color: '#dc2626' }
  if (action.includes('impute') || action.includes('fill'))
    return { color: '#d97706' }
  if (action.includes('outlier'))
    return { color: '#7c3aed' }
  if (action.includes('pipeline') || action.includes('complete') || action.includes('started'))
    return { color: '#059669' }
  return { color: '#2563eb' }
}

// ── Styles ────────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  topbar: {
    position: 'sticky', top: 0, zIndex: 50,
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid var(--border)',
    padding: '0 2rem',
    height: 52,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  logo: {
    fontFamily: 'var(--mono)', fontWeight: 600, fontSize: '0.9rem',
    color: 'var(--accent)', letterSpacing: '-0.01em',
  },
  topRight: { display: 'flex', alignItems: 'center', gap: '1rem' },
  filename: { fontSize: '0.8rem', color: 'var(--text2)', fontWeight: 500 },
  resetBtn: {
    background: 'transparent', border: '1px solid var(--border2)',
    borderRadius: 'var(--radius)', padding: '0.35rem 0.85rem',
    fontSize: '0.78rem', color: 'var(--text2)', cursor: 'pointer',
    fontFamily: 'var(--sans)',
    transition: 'all 0.15s',
  },
  content: { maxWidth: 1100, margin: '0 auto', padding: '2rem 2rem' },
  section: { marginBottom: '2rem' },
  sectionTitle: {
    fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--muted)',
    marginBottom: '0.85rem',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '1px', background: 'var(--border)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    overflow: 'hidden', boxShadow: 'var(--shadow)',
  },
  card: { background: 'var(--bg2)', padding: '1.25rem 1.5rem' },
  cardValue: { fontSize: '1.75rem', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' },
  cardLabel: { fontSize: '0.72rem', color: 'var(--text2)', marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 },
  cardSub: { fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.2rem' },
  tabs: { display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem' },
  tab: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.6rem 1rem', background: 'transparent',
    border: 'none', borderBottom: '2px solid transparent',
    marginBottom: '-1px', cursor: 'pointer',
    fontSize: '0.85rem', fontWeight: 500, color: 'var(--text2)',
    fontFamily: 'var(--sans)', transition: 'all 0.15s',
  },
  tabActive: { color: 'var(--accent)', borderBottomColor: 'var(--accent)' },
  tabCount: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: '999px', padding: '0.05rem 0.45rem',
    fontSize: '0.68rem', fontFamily: 'var(--mono)', color: 'var(--muted)',
  },
  tabCountActive: { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: '#bfdbfe' },
  tableWrap: {
    overflow: 'auto', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
  th: {
    background: '#f9fafb', padding: '0.65rem 1rem', textAlign: 'left',
    fontSize: '0.68rem', fontWeight: 600, color: 'var(--text2)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    position: 'sticky', top: 0,
  },
  tr: { borderBottom: '1px solid var(--border)', transition: 'background 0.1s' },
  td: { padding: '0.6rem 1rem', verticalAlign: 'middle', color: 'var(--text)' },
  typeBadge: {
    background: '#f3f4f6', border: '1px solid var(--border)',
    borderRadius: 4, padding: '0.1rem 0.45rem',
    fontSize: '0.68rem', fontFamily: 'var(--mono)', color: 'var(--text2)',
  },
  badge: {
    display: 'inline-block', padding: '0.15rem 0.55rem',
    borderRadius: 4, fontSize: '0.65rem', fontWeight: 700,
    letterSpacing: '0.05em', fontFamily: 'var(--mono)',
  },
  auditSummary: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' },
  auditPill: {
    display: 'inline-flex', gap: '0.35rem', alignItems: 'center',
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.72rem',
  },
  auditPillAction: { color: 'var(--text)', fontWeight: 500 },
  auditPillCount: { color: 'var(--muted)', fontFamily: 'var(--mono)' },
  auditLog: {
    border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    overflow: 'hidden', maxHeight: 400, overflowY: 'auto',
    boxShadow: 'var(--shadow)',
  },
  auditEntry: {
    display: 'grid',
    gridTemplateColumns: '64px 180px 120px 1fr',
    borderBottom: '1px solid var(--border)',
    fontSize: '0.72rem', fontFamily: 'var(--mono)',
    background: 'var(--bg2)',
    transition: 'background 0.1s',
  },
  auditTime: { padding: '0.5rem 0.75rem', color: 'var(--muted)', borderRight: '1px solid var(--border)' },
  auditAction: { padding: '0.5rem 0.75rem', fontWeight: 600, borderRight: '1px solid var(--border)' },
  auditCol: { padding: '0.5rem 0.75rem', color: 'var(--accent)', borderRight: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  auditDetail: { padding: '0.5rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' },
  auditKv: { display: 'inline-flex', gap: '0.25rem' },
  auditKey: { color: 'var(--muted)' },
  auditVal: { color: 'var(--text2)' },
}