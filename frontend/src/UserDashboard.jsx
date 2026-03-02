import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'

const API = import.meta.env.VITE_API_URL || 'https://euremlytics-2.onrender.com'

const DASH_CSS = `
  .udash-page { min-height:calc(100vh - 52px); background:var(--bg); padding:2.5rem 1.75rem; max-width:780px; margin:0 auto; animation:fadeUp 0.3s ease both; }
  .udash-head { margin-bottom:2rem; }
  .udash-eyebrow { font-family:var(--mono); font-size:0.62rem; font-weight:600; color:var(--accent); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:0.6rem; }
  .udash-title { font-size:1.6rem; font-weight:700; letter-spacing:-0.03em; margin-bottom:0.35rem; }
  .udash-sub { font-size:0.8rem; color:var(--text3); }
  .udash-tabs { display:flex; gap:0; border-bottom:1px solid var(--border); margin-bottom:1.5rem; }
  .udash-tab { padding:0.6rem 1rem; font-size:0.72rem; font-weight:600; font-family:var(--mono); text-transform:uppercase; letter-spacing:0.08em; color:var(--text3); background:none; border:none; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.15s; }
  .udash-tab.active { color:var(--text); border-bottom-color:var(--text); }
  .sub-card { background:var(--surface); border:1px solid var(--border2); border-radius:var(--r2); box-shadow:var(--sh); padding:1.5rem; margin-bottom:1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; }
  .sub-card.team-card { border-color:rgba(99,102,241,0.3); background:rgba(99,102,241,0.03); }
  .sub-card-left { display:flex; align-items:center; gap:1rem; }
  .sub-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0; }
  .sub-icon.free { background:var(--bg2); } .sub-icon.pro { background:var(--green-bg); } .sub-icon.team { background:rgba(99,102,241,0.12); }
  .sub-plan { font-size:1rem; font-weight:700; letter-spacing:-0.02em; }
  .sub-detail { font-size:0.72rem; color:var(--text3); margin-top:0.2rem; }
  .sub-badge { font-size:0.62rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:0.25rem 0.65rem; border-radius:99px; font-family:var(--mono); }
  .sub-badge.active { background:var(--green-bg); color:var(--green); border:1px solid rgba(0,135,90,0.2); }
  .sub-badge.team   { background:rgba(99,102,241,0.12); color:#6366f1; border:1px solid rgba(99,102,241,0.25); }
  .sub-badge.free   { background:var(--bg2); color:var(--text3); border:1px solid var(--border2); }
  .plan-picker { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1.25rem; }
  @media(max-width:520px){ .plan-picker { grid-template-columns:1fr; } }
  .plan-card { border:1.5px solid var(--border2); border-radius:var(--r2); padding:1.25rem; cursor:pointer; transition:all 0.15s; background:var(--surface); position:relative; }
  .plan-card:hover { border-color:var(--text3); } .plan-card.selected { border-color:var(--text); background:var(--bg2); }
  .plan-card-name { font-weight:700; font-size:0.9rem; margin-bottom:0.25rem; }
  .plan-card-price { font-family:var(--mono); font-size:1.2rem; font-weight:700; color:var(--accent); }
  .plan-card-desc { font-size:0.7rem; color:var(--text3); margin-top:0.5rem; line-height:1.5; }
  .plan-card-badge { position:absolute; top:0.75rem; right:0.75rem; font-size:0.55rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:0.2rem 0.5rem; border-radius:99px; background:rgba(99,102,241,0.12); color:#6366f1; }
  .udash-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:1.25rem; }
  @media(max-width:580px){ .udash-stats { grid-template-columns:repeat(2,1fr); } }
  .udash-stat { background:var(--surface); border:1px solid var(--border2); border-radius:var(--r2); padding:1.1rem 1.25rem; box-shadow:var(--sh); }
  .udash-stat-val { font-size:1.6rem; font-weight:700; letter-spacing:-0.03em; font-family:var(--mono); color:var(--accent); }
  .udash-stat-lbl { font-size:0.62rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--text3); margin-top:0.25rem; }
  .udash-section { background:var(--surface); border:1px solid var(--border2); border-radius:var(--r2); box-shadow:var(--sh); overflow:hidden; margin-bottom:1.25rem; }
  .udash-section-head { padding:0.85rem 1.25rem; border-bottom:1px solid var(--border); font-size:0.65rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:var(--text3); display:flex; align-items:center; justify-content:space-between; }
  .udash-row { display:flex; align-items:center; justify-content:space-between; padding:0.9rem 1.25rem; border-bottom:1px solid var(--border); gap:1rem; }
  .udash-row:last-child { border-bottom:none; }
  .udash-row-label { font-size:0.78rem; font-weight:500; color:var(--text2); }
  .udash-row-value { font-size:0.78rem; color:var(--text3); font-family:var(--mono); }
  .member-row { display:flex; align-items:center; justify-content:space-between; padding:0.8rem 1.25rem; border-bottom:1px solid var(--border); gap:1rem; }
  .member-row:last-child { border-bottom:none; }
  .member-avatar { width:30px; height:30px; border-radius:50%; background:var(--bg2); display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; color:var(--text2); flex-shrink:0; }
  .member-email { font-size:0.78rem; color:var(--text2); }
  .member-role { font-size:0.6rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:0.15rem 0.5rem; border-radius:99px; }
  .member-role.owner   { background:var(--bg2); color:var(--text3); }
  .member-role.member  { background:rgba(99,102,241,0.1); color:#6366f1; }
  .member-role.pending { background:rgba(245,158,11,0.1); color:#f59e0b; }
  .history-row { display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1.25rem; border-bottom:1px solid var(--border); gap:1rem; }
  .history-row:last-child { border-bottom:none; } .history-row:hover { background:var(--bg); }
  .history-filename { font-size:0.78rem; font-weight:600; color:var(--text2); }
  .history-meta { font-size:0.65rem; color:var(--text3); margin-top:0.2rem; font-family:var(--mono); }
  .history-score { font-family:var(--mono); font-size:0.8rem; font-weight:700; padding:0.2rem 0.6rem; border-radius:6px; }
  .score-hi { background:var(--green-bg); color:var(--green); }
  .score-mid { background:rgba(245,158,11,0.1); color:#f59e0b; }
  .score-lo { background:var(--red-bg); color:var(--red); }
  .invite-row { display:flex; gap:0.5rem; padding:1rem 1.25rem; border-bottom:1px solid var(--border); }
  .invite-input { flex:1; height:36px; border:1px solid var(--border2); border-radius:var(--r); padding:0 0.75rem; font-size:0.78rem; font-family:var(--sans); background:var(--bg); color:var(--text); outline:none; transition:border 0.15s; }
  .invite-input:focus { border-color:var(--text3); }
  .invite-input::placeholder { color:var(--text3); }
  .udash-upgrade { height:38px; padding:0 1.25rem; border-radius:var(--r); background:var(--text); color:#fff; font-size:0.78rem; font-weight:600; border:none; cursor:pointer; font-family:var(--sans); transition:all 0.15s; white-space:nowrap; }
  .udash-upgrade:hover { background:#2a2a28; transform:translateY(-1px); } .udash-upgrade:disabled { background:var(--text3); cursor:not-allowed; transform:none; }
  .udash-btn-sm { height:32px; padding:0 0.9rem; border-radius:var(--r); background:var(--text); color:#fff; font-size:0.72rem; font-weight:600; border:none; cursor:pointer; font-family:var(--sans); transition:all 0.15s; white-space:nowrap; }
  .udash-btn-sm:hover { background:#2a2a28; } .udash-btn-sm:disabled { background:var(--text3); cursor:not-allowed; }
  .udash-danger { height:34px; padding:0 1rem; border-radius:var(--r); background:none; color:var(--red); font-size:0.72rem; font-weight:500; border:1px solid rgba(192,57,43,0.25); cursor:pointer; font-family:var(--sans); transition:all 0.15s; }
  .udash-danger:hover { background:var(--red-bg); }
  .udash-back { font-size:0.72rem; color:var(--text3); background:none; border:none; cursor:pointer; font-family:var(--sans); padding:0; margin-bottom:1.5rem; transition:color 0.15s; display:flex; align-items:center; gap:0.35rem; }
  .udash-back:hover { color:var(--text); }
  .udash-loading { display:flex; align-items:center; justify-content:center; height:200px; color:var(--text3); font-size:0.8rem; }
  .udash-empty { padding:2rem 1.25rem; text-align:center; color:var(--text3); font-size:0.78rem; }
  .udash-error { font-size:0.72rem; color:var(--red); padding:0.5rem 1.25rem; }
  .udash-success { font-size:0.72rem; color:var(--green); padding:0.5rem 1.25rem; }
`

export default function UserDashboard({ user, onBack, onUpgrade }) {
  const [tab, setTab]             = useState('account')
  const [sub, setSub]             = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [members, setMembers]     = useState([])
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting]   = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null)
  const [wsName, setWsName]       = useState('')
  const [creatingWs, setCreatingWs] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('pro')

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const authFetch = async (url, opts = {}) => {
    const token = await getToken()
    return fetch(url, { ...opts, headers: { ...(opts.headers||{}), 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } })
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [subRes, wsRes, histRes] = await Promise.all([
          authFetch(`${API}/payments/subscription`),
          authFetch(`${API}/workspace/mine`),
          authFetch(`${API}/report/my`),
        ])
        const subData  = await subRes.json()
        const wsData   = await wsRes.json()
        const histData = await histRes.json()
        setSub(subData)
        setWorkspace(wsData.workspace || null)
        setHistory(histData.reports || [])
        if (wsData.workspace) {
          const memRes  = await authFetch(`${API}/workspace/members`)
          const memData = await memRes.json()
          setMembers(memData.members || [])
        }
      } catch { setSub({ status: 'free' }) }
      finally  { setLoading(false) }
    }
    load()
  }, [])

  const handleSignOut = async () => { setSigningOut(true); await supabase.auth.signOut() }
  const handleUpgrade = () => onUpgrade(selectedPlan)

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg(null)
    try {
      const res  = await authFetch(`${API}/workspace/invite`, { method:'POST', body: JSON.stringify({ email: inviteEmail.trim() }) })
      const data = await res.json()
      if (!res.ok) { setInviteMsg({ type:'err', text: data.detail }); return }
      setInviteMsg({ type:'ok', text: `Invitation sent to ${inviteEmail.trim()}` })
      setInviteEmail('')
      const memRes  = await authFetch(`${API}/workspace/members`)
      const memData = await memRes.json()
      setMembers(memData.members || [])
    } catch { setInviteMsg({ type:'err', text:'Failed to send invitation.' }) }
    finally  { setInviting(false) }
  }

  const handleRemove = async (email) => {
    if (!confirm(`Remove ${email} from the workspace?`)) return
    try {
      await authFetch(`${API}/workspace/member/${encodeURIComponent(email)}`, { method:'DELETE' })
      setMembers(prev => prev.filter(m => m.email !== email))
    } catch { alert('Failed to remove member.') }
  }

  const handleCreateWorkspace = async () => {
    setCreatingWs(true)
    try {
      const res  = await authFetch(`${API}/workspace/create`, { method:'POST', body: JSON.stringify({ name: wsName || `${user?.email?.split('@')[0]}'s Workspace` }) })
      const data = await res.json()
      if (!res.ok) { alert(data.detail); return }
      setWorkspace(data)
      setMembers([{ email: user?.email, role:'owner', status:'active' }])
    } catch { alert('Failed to create workspace.') }
    finally  { setCreatingWs(false) }
  }

  const isActive = sub?.status === 'active'
  const plan     = sub?.plan || 'free'
  const isTeam   = isActive && plan === 'team'
  const isPro    = isActive && plan === 'pro'
  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('en-NG', { day:'numeric', month:'long', year:'numeric' })
    : null
  const isOwner = members.find(m => m.email === user?.email && m.role === 'owner')
  const scoreClass = s => s >= 0.85 ? 'score-hi' : s >= 0.65 ? 'score-mid' : 'score-lo'

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

        <div className="udash-tabs">
          {[['account','👤 Account'],['workspace','👥 Team'],['history','📁 History']].map(([t,label]) => (
            <button key={t} className={`udash-tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{label}</button>
          ))}
        </div>

        {loading ? <div className="udash-loading">Loading…</div> : (
          <>
            {/* ACCOUNT TAB */}
            {tab === 'account' && (
              <>
                <div className={`sub-card ${isTeam?'team-card':''}`}>
                  <div className="sub-card-left">
                    <div className={`sub-icon ${isTeam?'team':isPro?'pro':'free'}`}>
                      {isTeam ? '👥' : isPro ? '⚡' : '🔓'}
                    </div>
                    <div>
                      <div className="sub-plan">{isTeam?'Team Plan':isPro?'Pro Plan':'Free Plan'}</div>
                      <div className="sub-detail">{isActive ? (periodEnd ? `Renews ${periodEnd}` : 'Active') : 'Up to 500 rows per file'}</div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                    <span className={`sub-badge ${isTeam?'team':isActive?'active':'free'}`}>
                      {isTeam?'Team':isPro?'Pro':'Free'}
                    </span>
                    {!isActive && <button className="udash-upgrade" onClick={handleUpgrade}>Upgrade →</button>}
                  </div>
                </div>

                {!isActive && (
                  <div className="plan-picker">
                    {[
                      { id:'pro',  name:'Pro',  price:'₦10,000', desc:'Unlimited rows · PDF export · Email summary · 1 user' },
                      { id:'team', name:'Team', price:'₦20,000', desc:'Everything in Pro · 5 team members · Shared file history', badge:'Team' },
                    ].map(p => (
                      <div key={p.id} className={`plan-card ${selectedPlan===p.id?'selected':''}`} onClick={() => setSelectedPlan(p.id)}>
                        {p.badge && <div className="plan-card-badge">{p.badge}</div>}
                        <div className="plan-card-name">{p.name}</div>
                        <div className="plan-card-price">{p.price}<span style={{fontSize:'0.65rem',fontWeight:400,color:'var(--text3)'}}>/mo</span></div>
                        <div className="plan-card-desc">{p.desc}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="udash-stats">
                  <div className="udash-stat">
                    <div className="udash-stat-val">{isActive?'∞':'500'}</div>
                    <div className="udash-stat-lbl">Row limit</div>
                  </div>
                  <div className="udash-stat">
                    <div className="udash-stat-val">₦{isTeam?'20k':isPro?'10k':'0'}</div>
                    <div className="udash-stat-lbl">Monthly plan</div>
                  </div>
                  <div className="udash-stat">
                    <div className="udash-stat-val">{isTeam?'5':isActive?'1':'—'}</div>
                    <div className="udash-stat-lbl">Team seats</div>
                  </div>
                </div>

                <div className="udash-section">
                  <div className="udash-section-head">Account Details</div>
                  <div className="udash-row">
                    <span className="udash-row-label">Email</span>
                    <span className="udash-row-value">{user?.email}</span>
                  </div>
                  <div className="udash-row">
                    <span className="udash-row-label">Sign-in method</span>
                    <span className="udash-row-value">{user?.app_metadata?.provider || 'email'}</span>
                  </div>
                  <div className="udash-row">
                    <span className="udash-row-label">Member since</span>
                    <span className="udash-row-value">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-NG',{month:'long',year:'numeric'}) : '—'}
                    </span>
                  </div>
                </div>

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

            {/* WORKSPACE TAB */}
            {tab === 'workspace' && (
              <>
                {!isTeam ? (
                  <div className="udash-section">
                    <div className="udash-section-head">Team Workspace</div>
                    <div style={{padding:'1.5rem 1.25rem',textAlign:'center'}}>
                      <div style={{fontSize:'2rem',marginBottom:'0.75rem'}}>👥</div>
                      <div style={{fontWeight:700,marginBottom:'0.4rem'}}>Team plan required</div>
                      <div style={{fontSize:'0.75rem',color:'var(--text3)',marginBottom:'1.25rem',lineHeight:1.6}}>
                        Upgrade to Team to create a workspace,<br />invite up to 4 colleagues, and share file history.
                      </div>
                      <button className="udash-upgrade" onClick={() => { setSelectedPlan('team'); setTab('account') }}>
                        Upgrade to Team — ₦20,000/mo →
                      </button>
                    </div>
                  </div>
                ) : !workspace ? (
                  <div className="udash-section">
                    <div className="udash-section-head">Create Your Workspace</div>
                    <div style={{padding:'1.25rem'}}>
                      <div style={{fontSize:'0.75rem',color:'var(--text3)',marginBottom:'1rem',lineHeight:1.6}}>
                        Give your workspace a name — this is what your colleagues will see in their invitation.
                      </div>
                      <div style={{display:'flex',gap:'0.5rem'}}>
                        <input className="invite-input" placeholder={`${user?.email?.split('@')[0]}'s Workspace`} value={wsName} onChange={e => setWsName(e.target.value)} />
                        <button className="udash-btn-sm" onClick={handleCreateWorkspace} disabled={creatingWs}>
                          {creatingWs ? 'Creating…' : 'Create →'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="udash-section">
                      <div className="udash-section-head">
                        <span>{workspace.name}</span>
                        <span style={{fontFamily:'var(--mono)',fontSize:'0.6rem'}}>{members.filter(m=>m.status==='active').length}/5 members</span>
                      </div>

                      {isOwner && members.filter(m=>m.status==='active').length < 5 && (
                        <>
                          <div className="invite-row">
                            <input
                              className="invite-input" type="email" placeholder="colleague@company.com"
                              value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteMsg(null) }}
                              onKeyDown={e => e.key==='Enter' && handleInvite()}
                            />
                            <button className="udash-btn-sm" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                              {inviting ? '…' : 'Invite'}
                            </button>
                          </div>
                          {inviteMsg && <div className={inviteMsg.type==='ok'?'udash-success':'udash-error'}>{inviteMsg.text}</div>}
                        </>
                      )}

                      {members.length === 0
                        ? <div className="udash-empty">No members yet. Invite your first colleague above.</div>
                        : members.map(m => (
                          <div className="member-row" key={m.id || m.email}>
                            <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                              <div className="member-avatar">{m.email[0].toUpperCase()}</div>
                              <div>
                                <div className="member-email">{m.email}</div>
                                <div style={{fontSize:'0.62rem',color:'var(--text3)',marginTop:'0.1rem'}}>
                                  {m.status==='pending' ? 'Invitation pending' : m.joined_at ? `Joined ${new Date(m.joined_at).toLocaleDateString('en-NG',{month:'short',year:'numeric'})}` : ''}
                                </div>
                              </div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
                              <span className={`member-role ${m.status==='pending'?'pending':m.role}`}>
                                {m.status==='pending' ? 'Pending' : m.role}
                              </span>
                              {isOwner && m.role !== 'owner' && (
                                <button style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:'0.7rem',padding:'0.2rem'}} onClick={() => handleRemove(m.email)} title="Remove">✕</button>
                              )}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                    <div style={{fontSize:'0.68rem',color:'var(--text3)',textAlign:'center',marginTop:'-0.5rem'}}>
                      Invited colleagues receive an email with a join link. They'll need an Oxdemi account to accept.
                    </div>
                  </>
                )}
              </>
            )}

            {/* HISTORY TAB */}
            {tab === 'history' && (
              <div className="udash-section">
                <div className="udash-section-head">
                  <span>File History</span>
                  {isTeam && workspace && <span style={{fontFamily:'var(--mono)',fontSize:'0.6rem'}}>Shared · {workspace.name}</span>}
                </div>
                {history.length === 0
                  ? <div className="udash-empty">No files cleaned yet.<br /><span style={{fontSize:'0.68rem'}}>Each file you clean will appear here.</span></div>
                  : history.map(h => (
                    <div className="history-row" key={h.token}>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="history-filename" style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{h.filename}</div>
                        <div className="history-meta">
                          {h.rows?.toLocaleString()} rows · {h.columns} cols ·{' '}
                          {new Date(h.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:'0.5rem',flexShrink:0}}>
                        <span className={`history-score ${scoreClass(h.avg_score)}`}>
                          {Math.round(h.avg_score * 100)}%
                        </span>
                        <a
                          href={`${API}/report/shared/${h.token}/csv`}
                          download
                          title="Re-download cleaned CSV"
                          style={{display:'flex',alignItems:'center',justifyContent:'center',width:'26px',height:'26px',borderRadius:'6px',border:'1px solid var(--border2)',background:'var(--bg)',color:'var(--text3)',textDecoration:'none',fontSize:'0.7rem',transition:'all 0.15s'}}
                          onMouseOver={e=>{e.target.style.borderColor='var(--text3)';e.target.style.color='var(--text)'}}
                          onMouseOut={e=>{e.target.style.borderColor='var(--border2)';e.target.style.color='var(--text3)'}}
                        >↓</a>
                        <a
                          href={h.share_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View shareable report"
                          style={{display:'flex',alignItems:'center',justifyContent:'center',width:'26px',height:'26px',borderRadius:'6px',border:'1px solid var(--border2)',background:'var(--bg)',color:'var(--text3)',textDecoration:'none',fontSize:'0.7rem',transition:'all 0.15s'}}
                          onMouseOver={e=>{e.target.style.borderColor='var(--text3)';e.target.style.color='var(--text)'}}
                          onMouseOut={e=>{e.target.style.borderColor='var(--border2)';e.target.style.color='var(--text3)'}}
                        >↗</a>
                      </div>
                    </div>
                  ))
                }
                {!isActive && history.length >= 10 && (
                  <div style={{padding:'0.85rem 1.25rem',fontSize:'0.7rem',color:'var(--text3)',textAlign:'center'}}>
                    Upgrade to Pro to see your full history.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
