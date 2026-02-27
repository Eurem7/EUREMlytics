import { useState } from 'react'

const PAYWALL_CSS = `
  .paywall-page {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .paywall-card {
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: var(--r3);
    box-shadow: var(--sh3);
    width: 100%;
    max-width: 440px;
    overflow: hidden;
    animation: fadeUp 0.4s ease both;
  }

  .paywall-head {
    padding: 2rem 2rem 1.5rem;
    text-align: center;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }
  .paywall-icon {
    width: 48px; height: 48px;
    background: var(--text);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem;
    margin: 0 auto 1.25rem;
  }
  .paywall-title {
    font-size: 1.3rem; font-weight: 700;
    letter-spacing: -0.03em; margin-bottom: 0.4rem;
  }
  .paywall-subtitle {
    font-size: 0.78rem; color: var(--text3); line-height: 1.5;
  }

  .paywall-body { padding: 1.75rem 2rem 2rem; }

  .paywall-price {
    text-align: center; margin-bottom: 1.5rem;
  }
  .paywall-amount {
    font-size: 2.8rem; font-weight: 700;
    letter-spacing: -0.04em; font-family: var(--mono);
    line-height: 1;
  }
  .paywall-period {
    font-size: 0.75rem; color: var(--text3);
    margin-top: 0.3rem;
  }

  .paywall-features {
    display: flex; flex-direction: column; gap: 0.6rem;
    margin-bottom: 1.75rem;
    background: var(--bg);
    border: 1px solid var(--border2);
    border-radius: var(--r);
    padding: 1rem 1.25rem;
  }
  .paywall-feature {
    display: flex; align-items: center; gap: 0.65rem;
    font-size: 0.78rem; color: var(--text2);
  }
  .paywall-feature-icon {
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--green-bg); border: 1px solid rgba(0,135,90,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.6rem; color: var(--green); flex-shrink: 0;
    font-weight: 700;
  }

  .paywall-cta {
    width: 100%; height: 44px; border-radius: var(--r);
    background: var(--text); color: #fff;
    font-size: 0.88rem; font-weight: 700;
    border: none; cursor: pointer; font-family: var(--sans);
    transition: all 0.15s; letter-spacing: -0.01em;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  }
  .paywall-cta:hover { background: #2a2a28; transform: translateY(-1px); box-shadow: var(--sh2); }
  .paywall-cta:disabled { background: var(--text3); cursor: not-allowed; transform: none; box-shadow: none; }

  .paywall-back {
    display: block; text-align: center; margin-top: 1rem;
    font-size: 0.72rem; color: var(--text3); background: none;
    border: none; cursor: pointer; font-family: var(--sans);
    padding: 0; transition: color 0.15s; width: 100%;
  }
  .paywall-back:hover { color: var(--text); }

  .paywall-error {
    display: flex; align-items: flex-start; gap: 0.5rem;
    background: var(--red-bg); border: 1px solid rgba(192,57,43,0.2);
    border-radius: var(--r); padding: 0.65rem 0.85rem;
    font-size: 0.75rem; color: var(--red); margin-bottom: 0.75rem;
  }
  .paywall-secure {
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
    font-size: 0.65rem; color: var(--text3); margin-top: 0.85rem;
    font-family: var(--mono);
  }
`

const API_BASE = import.meta.env.VITE_API_URL || 'https://euremlytics-2.onrender.com'

export default function PaywallScreen({ user, onBack, onSubscribed }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleUpgrade = async () => {
    setLoading(true); setError('')
    try {
      // Get auth token
      const { supabase } = await import('./lib/supabase.js')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(`${API_BASE}/payments/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Payment initialization failed')

      // Redirect to Paystack checkout
      window.location.href = data.authorization_url

    } catch(e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <>
      <style>{PAYWALL_CSS}</style>
      <div className="paywall-page">
        <div className="paywall-card">
          <div className="paywall-head">
            <div className="paywall-icon">⚡</div>
            <div className="paywall-title">Upgrade to Pro</div>
            <div className="paywall-subtitle">
              Your file exceeds the 500-row free limit.<br/>
              Upgrade to clean datasets of any size.
            </div>
          </div>

          <div className="paywall-body">
            <div className="paywall-price">
              <div className="paywall-amount">₦10,000</div>
              <div className="paywall-period">per month · cancel anytime</div>
            </div>

            <div className="paywall-features">
              {[
                'Unlimited rows per file',
                'All 8 cleaning stages',
                'PDF + CSV exports',
                'Full audit trail',
                'Priority processing',
              ].map(f => (
                <div className="paywall-feature" key={f}>
                  <div className="paywall-feature-icon">✓</div>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="paywall-error">
                <span>⚠</span><span>{error}</span>
              </div>
            )}

            <button className="paywall-cta" onClick={handleUpgrade} disabled={loading}>
              {loading ? 'Redirecting to Paystack…' : 'Pay ₦10,000 / month →'}
            </button>

            <button className="paywall-back" onClick={onBack}>
              ← Go back
            </button>

            <div className="paywall-secure">
              🔒 Secured by Paystack · Nigerian payment provider
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
