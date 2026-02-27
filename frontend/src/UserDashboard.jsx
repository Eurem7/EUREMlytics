import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'

const API = import.meta.env.VITE_API_URL || 'https://euremlytics-2.onrender.com'

const DASH_CSS = `
  .udash-page {
    min-height: calc(100vh - 52px);
    background: var(--bg);
    padding: 2.5rem 1.75rem;
    max-width: 760px;
    margin: 0 auto;
    animation: fadeUp 0.3s ease both;
  }

  .udash-head {
    margin-bottom: 2rem;
  }
  .udash-eyebrow {
    font-family: var(--mono); font-size: 0.62rem; font-weight: 600;
    color: var(--accent); text-transform: uppercase; letter-spacing: 0.12em;
    margin-bottom: 0.6rem;
  }
  .udash-title {
    font-size: 1.6rem; font-weight: 700; letter-spacing: -0.03em;
    margin-bottom: 0.35rem;
  }
  .udash-sub { font-size: 0.8rem; color: var(--text3); }

  /* Subscription card */
  .sub-card {
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: var(--r2);
    box-shadow: var(--sh);
    padding: 1.5rem;
    margin-bottom: 1.25rem;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 1rem;
  }
  .sub-card-left { display: flex; align-items: center; gap: 1rem; }
  .sub-icon {
    width: 44px; height: 44px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2rem; flex-shrink: 0;
  }
  .sub-icon.free { background: var(--bg2); }
  .sub-icon.active { background: var(--green-bg); }
  .sub-plan { font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; }
  .sub-detail { font-size: 0.72rem; color: var(--text3); margin-top: 0.2rem; }
  .sub-badge {
    font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; padding: 0.25rem 0.65rem; border-radius: 99px;
    font-family: var(--mono);
  }
  .sub-badge.active { background: var(--green-bg); color: var(--green); border: 1px solid rgba(0,135,90,0.2); }
  .sub-badge.free   { background: var(--bg2); color: var(--text3); border: 1px solid var(--border2); }

  /* Stat row */
  .udash-stats {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;
    margin-bottom: 1.25rem;
  }
  @media (max-width: 680px) { .udash-stats { grid-template-columns: repeat(2, 1fr); } }
  .udash-stat {
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: var(--r2); padding: 1.1rem 1.25rem;
    box-shadow: var(--sh);
  }
  .udash-stat-val {
    font-size: 1.6rem; font-weight: 700; letter-spacing: -0.03em;
    font-family: var(--mono); color: var(--accent);
  }
  .udash-stat-lbl {
    font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--text3); margin-top: 0.25rem;
  }

  /* Account section */
  .udash-section {
    background: var(--surface); border: 1px solid var(--border2);
    border-radius: var(--r2); box-shadow: var(--sh);
    overflow: hidden; margin-bottom: 1.25rem;
  }
  .udash-section-head {
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--text3);
  }
  .udash-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.9rem 1.25rem; border-bottom: 1px solid var(--border);
    gap: 1rem;
  }
  .udash-row:last-child { border-bottom: none; }
  .udash-row-label { font-size: 0.78rem; font-weight: 500; color: var(--text2); }
  .udash-row-value { font-size: 0.78rem; color: var(--text3); font-family: var(--mono); }

  /* Upgrade / manage buttons */
  .udash-upgrade {
    height: 38px; padding: 0 1.25rem; border-radius: var(--r);
    background: var(--text); color: #fff; font-size: 0.78rem;
    font-weight: 600; border: none; cursor: pointer; font-family: var(--sans);
    transition: all 0.15s; white-space: nowrap;
  }
  .udash-upgrade:hover { background: #2a2a28; transform: translateY(-1px); }
  .udash-upgrade:disabled { background: var(--text3); cursor: not-allowed; transform: none; }

  .udash-danger {
    height: 34px; padding: 0 1rem; border-radius: var(--r);
    background: none; color: var(--red); font-size: 0.72rem;
    font-weight: 500; border: 1px solid rgba(192,57,43,0.25);
    cursor: pointer; font-family: var(--sans); transition: all 0.15s;
  }
  .udash-danger:hover { background: var(--red-bg); }

  .udash-back {
    font-size: 0.72rem; color: var(--text3); background: none;
    border: none; cursor: pointer; font-family: var(--sans);
    padding: 0; margin-bottom: 1.5rem; transition: color 0.15s;
    display: flex; align-items: center; gap: 0.35rem;
  }
  .udash-back:hover { color: var(--text); }

  .udash-loading {
    display: flex; align-items: center; justify-content: center;
    height: 200px; color: var(--text3); font-size: 0.8rem;
  }
`

export default function UserDashboard({ user, onBack, onUpgrade }) {
  const [sub, setSub]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const fetchSub = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        const res = await fetch(`${API}/payments/subscription`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
        const data = await res.json()
        setSub(data)
      } catch {
        setSub({ status: 'free' })
      } finally {
        setLoading(false)
      }
    }
    fetchSub()
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
  }

  const isActive    = sub?.status === 'active'
  const periodEnd   = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('en-NG', { day:'numeric', month:'long', year:'numeric' })
    : null

  return (
    <>
      <style>{DASH_CSS}</style>
      <div className="udash-page">
        <button className="udash-back" onClick={onBack}>← Back to app</button>

        <div className="udash-head">
          <div className="udash-eyebrow">Account</div>
          <div className="udash-title">Your Dashboard</div>
          <div className="udash-sub">{user?.email}</div>
        </div>

        {loading ? (
          <div className="udash-loading">Loading account details…</div>
        ) : (
          <>
            {/* Subscription status card */}
            <div className="sub-card">
              <div className="sub-card-left">
                <div className={`sub-icon ${isActive ? 'active' : 'free'}`}>
                  {isActive ? '⚡' : '🔓'}
                </div>
                <div>
                  <div className="sub-plan">{isActive ? 'Pro Plan' : 'Free Plan'}</div>
                  <div className="sub-detail">
                    {isActive
                      ? periodEnd ? `Renews ${periodEnd}` : 'Active subscription'
                      : 'Up to 500 rows per file'}
                  </div>
                </div>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                <span className={`sub-badge ${isActive ? 'active' : 'free'}`}>
                  {isActive ? 'Active' : 'Free'}
                </span>
                {!isActive && (
                  <button className="udash-upgrade" onClick={onUpgrade}>
                    Upgrade to Pro →
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="udash-stats">
              <div className="udash-stat">
                <div className="udash-stat-val">{isActive ? '∞' : '500'}</div>
                <div className="udash-stat-lbl">Row limit</div>
              </div>
              <div className="udash-stat">
                <div className="udash-stat-val">₦{isActive ? '10k' : '0'}</div>
                <div className="udash-stat-lbl">Monthly plan</div>
              </div>
              <div className="udash-stat">
                <div className="udash-stat-val">{isActive ? '✓' : '—'}</div>
                <div className="udash-stat-lbl">PDF exports</div>
              </div>
            </div>

            {/* Account details */}
            <div className="udash-section">
              <div className="udash-section-head">Account Details</div>
              <div className="udash-row">
                <span className="udash-row-label">Email</span>
                <span className="udash-row-value">{user?.email}</span>
              </div>
              <div className="udash-row">
                <span className="udash-row-label">Account type</span>
                <span className="udash-row-value">{user?.app_metadata?.provider || 'email'}</span>
              </div>
              <div className="udash-row">
                <span className="udash-row-label">Member since</span>
                <span className="udash-row-value">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-NG', { month:'long', year:'numeric' })
                    : '—'}
                </span>
              </div>
            </div>

            {/* Danger zone */}
            <div className="udash-section">
              <div className="udash-section-head">Session</div>
              <div className="udash-row">
                <span className="udash-row-label">Sign out of your account</span>
                <button className="udash-danger" onClick={handleSignOut} disabled={signingOut}>
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
