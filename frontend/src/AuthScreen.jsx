import { useState } from 'react'
import { supabase } from './lib/supabase.js'

// ─────────────────────────────────────────────────────────────
// Auth Screen styles
// ─────────────────────────────────────────────────────────────
const AUTH_CSS = `
  .auth-page {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .auth-card {
    background: var(--surface);
    border: 1px solid var(--border2);
    border-radius: var(--r3);
    box-shadow: var(--sh3);
    width: 100%;
    max-width: 400px;
    overflow: hidden;
    animation: fadeUp 0.4s ease both;
  }

  .auth-card-head {
    padding: 2rem 2rem 1.5rem;
    border-bottom: 1px solid var(--border);
    text-align: center;
  }
  .auth-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1.5rem;
    text-decoration: none;
  }
  .auth-logo-mark {
    width: 36px; height: 26px;
    background: var(--text);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--mono); font-size: 0.55rem; font-weight: 700;
    color: #fff; letter-spacing: 0.5px;
  }
  .auth-logo-text {
    font-size: 0.95rem; font-weight: 700; color: var(--text);
    letter-spacing: -0.02em;
  }
  .auth-title {
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    margin-bottom: 0.35rem;
  }
  .auth-subtitle {
    font-size: 0.78rem;
    color: var(--text3);
    line-height: 1.5;
  }
  .auth-free-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--green-bg);
    border: 1px solid rgba(0,135,90,0.2);
    border-radius: 99px;
    padding: 0.25rem 0.75rem;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--green);
    margin-top: 0.75rem;
    font-family: var(--mono);
  }

  .auth-card-body { padding: 1.5rem 2rem 2rem; }

  /* OAuth buttons */
  .oauth-group { display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.25rem; }
  .oauth-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.65rem;
    height: 40px; border-radius: var(--r); border: 1px solid var(--border2);
    background: var(--surface); font-size: 0.8rem; font-weight: 500;
    cursor: pointer; font-family: var(--sans); color: var(--text);
    transition: all 0.15s; width: 100%;
  }
  .oauth-btn:hover { background: var(--surface2); border-color: var(--border2); transform: translateY(-1px); box-shadow: var(--sh); }
  .oauth-btn:active { transform: translateY(0); }
  .oauth-btn svg { width: 18px; height: 18px; flex-shrink: 0; }

  /* Divider */
  .auth-divider {
    display: flex; align-items: center; gap: 0.75rem;
    margin-bottom: 1.25rem;
  }
  .auth-divider-line { flex: 1; height: 1px; background: var(--border2); }
  .auth-divider-text { font-size: 0.68rem; color: var(--text3); white-space: nowrap; }

  /* Form */
  .auth-form { display: flex; flex-direction: column; gap: 0.85rem; }
  .auth-field { display: flex; flex-direction: column; gap: 0.4rem; }
  .auth-label { font-size: 0.72rem; font-weight: 600; color: var(--text2); }
  .auth-input {
    height: 38px; border: 1px solid var(--border2); border-radius: var(--r);
    padding: 0 0.85rem; font-size: 0.82rem; font-family: var(--sans);
    color: var(--text); background: var(--bg); width: 100%;
    transition: border-color 0.15s; outline: none;
  }
  .auth-input:focus { border-color: var(--accent); background: var(--surface); }
  .auth-input::placeholder { color: var(--text3); }

  .auth-submit {
    height: 40px; border-radius: var(--r); border: none;
    background: var(--text); color: #fff; font-size: 0.82rem;
    font-weight: 600; cursor: pointer; font-family: var(--sans);
    transition: all 0.15s; margin-top: 0.25rem; width: 100%;
    letter-spacing: -0.01em;
  }
  .auth-submit:hover { background: #2a2a28; transform: translateY(-1px); box-shadow: var(--sh2); }
  .auth-submit:disabled { background: var(--text3); cursor: not-allowed; transform: none; box-shadow: none; }

  .auth-switch {
    text-align: center; margin-top: 1.25rem;
    font-size: 0.75rem; color: var(--text3);
  }
  .auth-switch button {
    background: none; border: none; cursor: pointer;
    color: var(--accent); font-weight: 600; font-size: 0.75rem;
    font-family: var(--sans); padding: 0; margin-left: 0.25rem;
    transition: color 0.15s;
  }
  .auth-switch button:hover { color: var(--accent2); }

  .auth-error {
    display: flex; align-items: flex-start; gap: 0.5rem;
    background: var(--red-bg); border: 1px solid rgba(192,57,43,0.2);
    border-radius: var(--r); padding: 0.65rem 0.85rem;
    font-size: 0.75rem; color: var(--red); margin-bottom: 0.75rem;
    animation: fadeIn 0.2s ease;
  }
  .auth-success {
    display: flex; align-items: flex-start; gap: 0.5rem;
    background: var(--green-bg); border: 1px solid rgba(0,135,90,0.2);
    border-radius: var(--r); padding: 0.65rem 0.85rem;
    font-size: 0.75rem; color: var(--green); margin-bottom: 0.75rem;
    animation: fadeIn 0.2s ease;
  }

  .auth-forgot {
    text-align: right; margin-top: -0.4rem;
  }
  .auth-forgot button {
    background: none; border: none; cursor: pointer;
    color: var(--text3); font-size: 0.68rem; font-family: var(--sans);
    padding: 0; transition: color 0.15s;
  }
  .auth-forgot button:hover { color: var(--accent); }

  .auth-terms {
    font-size: 0.65rem; color: var(--text3); text-align: center;
    margin-top: 1rem; line-height: 1.5;
  }

  /* Row limit banner */
  .row-limit-banner {
    background: var(--warn-bg);
    border: 1px solid rgba(180,83,9,0.2);
    border-radius: var(--r);
    padding: 0.75rem 1rem;
    margin-bottom: 1.5rem;
    display: flex; align-items: flex-start; gap: 0.65rem;
    font-size: 0.78rem; color: var(--warn);
    animation: fadeIn 0.3s ease;
  }
  .row-limit-banner-icon { font-size: 1rem; flex-shrink: 0; margin-top: 0.05rem; }
  .row-limit-banner-text { line-height: 1.5; }
  .row-limit-banner-text strong { font-weight: 700; }
`

// ─────────────────────────────────────────────────────────────
// Google SVG icon
// ─────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

// ─────────────────────────────────────────────────────────────
// GitHub SVG icon
// ─────────────────────────────────────────────────────────────
const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
)

// ─────────────────────────────────────────────────────────────
// AuthScreen component
// ─────────────────────────────────────────────────────────────
export default function AuthScreen({ onAuth, reason, onPrivacy, onTerms }) {
  const [mode, setMode]       = useState('signin')  // 'signin' | 'signup' | 'reset'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const REDIRECT = 'https://eure-mlytics.vercel.app'

  const handleOAuth = async (provider) => {
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: REDIRECT }
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setError(''); setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onAuth(data.user)
      }
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!email) { setError('Enter your email address first.'); return }
    setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${REDIRECT}/reset-password`
    })
    if (error) setError(error.message)
    else setSuccess('Password reset email sent. Check your inbox.')
    setLoading(false)
  }

  return (
    <>
      <style>{AUTH_CSS}</style>
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-head">
            <div className="auth-logo">
              <div className="auth-logo-mark">OXD</div>
              <span className="auth-logo-text">Oxdemi.io</span>
            </div>

            {reason === 'row_limit' && (
              <div className="row-limit-banner">
                <span className="row-limit-banner-icon">⚠</span>
                <div className="row-limit-banner-text">
                  <strong>Free limit reached.</strong> Your file exceeds 500 rows.
                  Sign in and upgrade to clean unlimited datasets.
                </div>
              </div>
            )}

            <div className="auth-title">
              {mode === 'signup' ? 'Create your account' :
               mode === 'reset'  ? 'Reset your password' :
               'Welcome back'}
            </div>
            <div className="auth-subtitle">
              {mode === 'signup'
                ? 'Start cleaning data with Oxdemi'
                : mode === 'reset'
                ? 'Enter your email and we\'ll send a reset link'
                : 'Sign in to your Oxdemi account'}
            </div>
            {mode === 'signup' && (
              <div className="auth-free-badge">
                ✓ Free up to 500 rows per file
              </div>
            )}
          </div>

          <div className="auth-card-body">
            {error   && <div className="auth-error">  <span>⚠</span><span>{error}</span></div>}
            {success && <div className="auth-success"><span>✓</span><span>{success}</span></div>}

            {/* OAuth — only on sign in / sign up */}
            {mode !== 'reset' && (
              <>
                <div className="oauth-group">
                  <button className="oauth-btn" onClick={() => handleOAuth('google')} disabled={loading}>
                    <GoogleIcon />
                    Continue with Google
                  </button>
                  <button className="oauth-btn" onClick={() => handleOAuth('github')} disabled={loading}>
                    <GitHubIcon />
                    Continue with GitHub
                  </button>
                </div>

                <div className="auth-divider">
                  <div className="auth-divider-line" />
                  <span className="auth-divider-text">or continue with email</span>
                  <div className="auth-divider-line" />
                </div>
              </>
            )}

            {/* Email form */}
            <div className="auth-form">
              <div className="auth-field">
                <label className="auth-label">Email address</label>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'reset' ? handleReset() : handleSubmit())}
                  autoFocus
                />
              </div>

              {mode !== 'reset' && (
                <div className="auth-field">
                  <label className="auth-label">Password</label>
                  <input
                    className="auth-input"
                    type="password"
                    placeholder={mode === 'signup' ? 'Min. 8 characters' : 'Your password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
              )}

              {mode === 'signin' && (
                <div className="auth-forgot">
                  <button onClick={() => { setMode('reset'); setError(''); setSuccess('') }}>
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                className="auth-submit"
                onClick={mode === 'reset' ? handleReset : handleSubmit}
                disabled={loading}
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'signup' ? 'Create account'
                  : mode === 'reset'  ? 'Send reset link'
                  : 'Sign in'}
              </button>
            </div>

            {/* Switch mode */}
            <div className="auth-switch">
              {mode === 'signin' && <>
                Don't have an account?
                <button onClick={() => { setMode('signup'); setError(''); setSuccess('') }}>Sign up free</button>
              </>}
              {mode === 'signup' && <>
                Already have an account?
                <button onClick={() => { setMode('signin'); setError(''); setSuccess('') }}>Sign in</button>
              </>}
              {mode === 'reset' && <>
                Remember your password?
                <button onClick={() => { setMode('signin'); setError(''); setSuccess('') }}>Back to sign in</button>
              </>}
            </div>

            {mode === 'signup' && (
              <div className="auth-terms">
                By creating an account you agree to our{' '}
                <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:'0.65rem',fontFamily:'var(--sans)',padding:0}} onClick={onTerms}>Terms of Service</button>
                {' '}and{' '}
                <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:'0.65rem',fontFamily:'var(--sans)',padding:0}} onClick={onPrivacy}>Privacy Policy</button>.
                Your data is processed in memory and never stored.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
