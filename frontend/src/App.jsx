import { useState, useCallback, useRef, useEffect } from 'react'
import { uploadFile, cleanData, csvDownloadUrl, pdfDownloadUrl, reportHtmlUrl } from './api/client.js'

// Trigger download via hidden iframe — works cross-origin
function triggerDownload(url) {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  setTimeout(() => document.body.removeChild(iframe), 5000)
}
import { supabase } from './lib/supabase.js'
import AuthScreen from './AuthScreen.jsx'
import PaywallScreen from './PaywallScreen.jsx'
import UserDashboard from './UserDashboard.jsx'

// ─────────────────────────────────────────────────────────────
// Global styles — Precision Instrument aesthetic
// Geist Display + JetBrains Mono
// ─────────────────────────────────────────────────────────────
const G = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=JetBrains+Mono:wght@300;400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }

:root {
  --bg:        #f5f5f3;
  --bg2:       #efefec;
  --surface:   #ffffff;
  --surface2:  #fafaf8;
  --border:    rgba(0,0,0,0.08);
  --border2:   rgba(0,0,0,0.14);
  --text:      #0f0f0e;
  --text2:     #555550;
  --text3:     #8c8c86;
  --accent:    #1a6bff;
  --accent2:   #0052e0;
  --accent-bg: #f0f5ff;
  --green:     #00875a;
  --green-bg:  #f0faf5;
  --green2:    #00a36b;
  --warn:      #b45309;
  --warn-bg:   #fefce8;
  --red:       #c0392b;
  --red-bg:    #fff5f5;
  --purple:    #6d28d9;
  --sans:      'DM Sans', sans-serif;
  --mono:      'JetBrains Mono', monospace;
  --r:         6px;
  --r2:        10px;
  --r3:        14px;
  --sh:        0 1px 2px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04);
  --sh2:       0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
  --sh3:       0 8px 32px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.05);
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 10px; }

/* ── ANIMATIONS ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes shimmer {
  from { background-position: -200% center; }
  to   { background-position: 200% center; }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.8); }
}
@keyframes scanline {
  from { transform: translateY(-100%); }
  to   { transform: translateY(400%); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes countUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.anim-fade-up { animation: fadeUp 0.5s ease both; }
.anim-fade-in { animation: fadeIn 0.4s ease both; }

/* ── TOPBAR ── */
.topbar {
  height: 52px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 1.75rem;
  gap: 1.25rem;
  position: sticky;
  top: 0;
  z-index: 200;
}
.topbar-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}
.logo-mark {
  width: 36px; height: 26px;
  background: var(--text);
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-size: 0.55rem; font-weight: 700;
  color: #fff; letter-spacing: 0.5px;
  flex-shrink: 0;
}
.logo-text {
  font-family: var(--sans);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.01em;
}
.logo-text span { color: var(--text3); font-weight: 400; }

.topbar-divider { width: 1px; height: 20px; background: var(--border2); }

.step-track {
  display: flex;
  align-items: center;
  gap: 0;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.75rem;
  border-radius: 99px;
  font-size: 0.73rem;
  font-weight: 500;
  color: var(--text3);
  transition: all 0.25s;
  cursor: default;
  white-space: nowrap;
}
.step-item.done   { color: var(--green); }
.step-item.active { color: var(--accent); background: var(--accent-bg); }
.step-num {
  width: 17px; height: 17px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.58rem; font-weight: 700;
  font-family: var(--mono);
  flex-shrink: 0;
}
.step-item.done .step-num {
  background: var(--green);
  border-color: var(--green);
  color: #fff;
}
.step-arrow { color: var(--border2); font-size: 0.7rem; padding: 0 0.1rem; }

.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 0.75rem; }
.topbar-badge {
  font-family: var(--mono);
  font-size: 0.62rem;
  font-weight: 500;
  color: var(--text3);
  background: var(--bg2);
  border: 1px solid var(--border2);
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  letter-spacing: 0.02em;
}
.topbar-user { display: flex; align-items: center; gap: 0.5rem; }
.topbar-account-btn {
  display: flex; align-items: center; gap: 0.5rem;
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: 99px; padding: 0.22rem 0.65rem 0.22rem 0.3rem;
  cursor: pointer; transition: all 0.15s; font-family: var(--sans);
}
.topbar-account-btn:hover {
  background: var(--surface); border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(26,107,255,0.1);
}
.topbar-avatar {
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--text); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.58rem; font-weight: 700; font-family: var(--mono);
  flex-shrink: 0;
}
.topbar-email {
  font-family: var(--mono); font-size: 0.62rem; color: var(--text2);
  max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: 500;
}
.topbar-signout {
  font-size: 0.68rem; font-weight: 500; color: var(--text3);
  background: none; border: 1px solid var(--border2); border-radius: 4px;
  padding: 0.2rem 0.55rem; cursor: pointer; font-family: var(--sans);
  transition: all 0.15s;
}
.topbar-signout:hover { color: var(--red); border-color: rgba(192,57,43,0.3); }
.topbar-signin {
  font-size: 0.72rem; font-weight: 600; color: var(--accent);
  background: var(--accent-bg); border: 1px solid rgba(26,107,255,0.2);
  border-radius: 4px; padding: 0.25rem 0.65rem; cursor: pointer;
  font-family: var(--sans); transition: all 0.15s;
}
.topbar-signin:hover { background: var(--accent); color: #fff; }

/* ── BUTTONS ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 1.1rem;
  height: 34px;
  border-radius: var(--r);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
  font-family: var(--sans);
  text-decoration: none;
  white-space: nowrap;
  letter-spacing: -0.01em;
  line-height: 1;
}
.btn-lg { height: 42px; padding: 0 1.5rem; font-size: 0.85rem; }
.btn-sm { height: 28px; padding: 0 0.85rem; font-size: 0.72rem; }

.btn-primary {
  background: var(--text);
  color: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}
.btn-primary:hover { background: #2a2a28; transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,0.15); }
.btn-primary:active { transform: translateY(0); }
.btn-primary:disabled { background: var(--text3); cursor: not-allowed; transform: none; box-shadow: none; }

.btn-blue {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 1px 2px rgba(26,107,255,0.25);
}
.btn-blue:hover { background: var(--accent2); transform: translateY(-1px); box-shadow: 0 3px 8px rgba(26,107,255,0.3); }

.btn-ghost {
  background: transparent;
  color: var(--text2);
  border: 1px solid var(--border2);
}
.btn-ghost:hover { background: var(--surface); color: var(--text); border-color: var(--border2); }

.btn-green-solid {
  background: var(--green);
  color: #fff;
  box-shadow: 0 1px 2px rgba(0,135,90,0.2);
}
.btn-green-solid:hover { background: #006e48; }

.btn-group { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }

/* ── PAGE ── */
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 2.5rem 1.75rem;
  width: 100%;
}

/* ── UPLOAD SCREEN ── */
.upload-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5rem;
  align-items: start;
  padding-top: 1.5rem;
}
@media (max-width: 700px) { .upload-layout { grid-template-columns: 1fr; } }

.upload-hero-text { padding-top: 2rem; }
.upload-eyebrow {
  font-family: var(--mono);
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.upload-eyebrow::before {
  content: '';
  display: block;
  width: 20px; height: 1px;
  background: var(--accent);
}
.upload-h1 {
  font-size: 2.6rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.04em;
  color: var(--text);
  margin-bottom: 1.25rem;
}
.upload-h1 em {
  font-style: normal;
  color: var(--text3);
}
.upload-sub {
  font-size: 0.9rem;
  color: var(--text2);
  line-height: 1.65;
  max-width: 340px;
  margin-bottom: 2rem;
}
.upload-features {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.upload-feature {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  font-size: 0.78rem;
  color: var(--text2);
}
.feature-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--green2);
  flex-shrink: 0;
}

/* Dropzone */
.upload-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r3);
  padding: 1.75rem;
  box-shadow: var(--sh2);
  animation: fadeUp 0.5s ease both;
}
.dropzone {
  border: 1.5px dashed var(--border2);
  border-radius: var(--r2);
  padding: 2.75rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg);
  position: relative;
  overflow: hidden;
}
.dropzone::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--accent-bg) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.2s;
}
.dropzone:hover::before, .dropzone.drag::before { opacity: 1; }
.dropzone:hover, .dropzone.drag {
  border-color: var(--accent);
  border-style: solid;
}
.dropzone input { display: none; }
.dz-icon {
  width: 44px; height: 44px;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r2);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem;
  margin: 0 auto 1rem;
  position: relative;
  box-shadow: var(--sh);
  transition: transform 0.2s;
}
.dropzone:hover .dz-icon { transform: translateY(-2px); }
.dz-title { font-size: 0.88rem; font-weight: 600; margin-bottom: 0.3rem; }
.dz-sub { font-size: 0.73rem; color: var(--text3); }

.file-chip {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background: var(--green-bg);
  border: 1px solid rgba(0,135,90,0.2);
  border-radius: var(--r);
  padding: 0.7rem 1rem;
  margin-top: 1rem;
  animation: fadeIn 0.3s ease;
}
.file-chip-icon { font-size: 1.1rem; }
.file-chip-name { font-size: 0.82rem; font-weight: 600; flex: 1; }
.file-chip-size { font-family: var(--mono); font-size: 0.68rem; color: var(--text3); }
.file-chip-remove {
  width: 20px; height: 20px;
  border-radius: 50%;
  background: transparent;
  border: none; cursor: pointer;
  color: var(--text3); font-size: 0.8rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.file-chip-remove:hover { background: rgba(0,0,0,0.08); color: var(--red); }

.upload-actions { margin-top: 1.25rem; display: flex; justify-content: flex-end; gap: 0.75rem; align-items: center; }
.upload-hint { font-size: 0.72rem; color: var(--text3); }

/* ── ERROR BOX ── */
.error-box {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  background: var(--red-bg);
  border: 1px solid rgba(192,57,43,0.2);
  border-radius: var(--r);
  padding: 0.75rem 1rem;
  margin-top: 1rem;
  font-size: 0.78rem;
  color: var(--red);
  animation: fadeIn 0.2s ease;
}

/* ── CLEAN SCREEN ── */
.clean-layout {
  max-width: 600px;
  margin: 0 auto;
  padding-top: 3rem;
  text-align: center;
}
.clean-file-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r);
  padding: 0.45rem 0.9rem;
  font-size: 0.78rem;
  margin-bottom: 2rem;
  box-shadow: var(--sh);
}
.clean-file-tag .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green2); animation: pulse-dot 1.5s ease infinite; }
.clean-h2 {
  font-size: 1.9rem;
  font-weight: 700;
  letter-spacing: -0.04em;
  margin-bottom: 0.5rem;
}
.clean-sub { color: var(--text2); font-size: 0.88rem; margin-bottom: 1.5rem; }

/* ── Config panel ── */
.config-toggle {
  display: inline-flex; align-items: center; gap: 0.5rem;
  font-size: 0.75rem; font-weight: 500; color: var(--text2);
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: var(--r); cursor: pointer; padding: 0.45rem 0.9rem;
  font-family: var(--sans); margin-bottom: 1.25rem;
  transition: all 0.15s; box-shadow: var(--sh);
}
.config-toggle:hover { border-color: var(--accent); color: var(--accent); }
.config-toggle-arrow { font-size: 0.65rem; transition: transform 0.2s; display: inline-block; }
.config-toggle-arrow.open { transform: rotate(90deg); }

.config-panel {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r2);
  overflow: hidden;
  margin-bottom: 1.5rem;
  box-shadow: var(--sh2);
  text-align: left;
  animation: fadeUp 0.2s ease both;
  width: 100%;
  max-width: 520px;
}
.config-panel-header {
  padding: 0.75rem 1.25rem;
  background: var(--bg);
  border-bottom: 1px solid var(--border2);
  display: flex; align-items: center; justify-content: space-between;
}
.config-panel-title {
  font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--text3);
}
.config-reset {
  font-size: 0.68rem; color: var(--text3); background: none;
  border: 1px solid var(--border2); border-radius: 4px;
  cursor: pointer; font-family: var(--sans); padding: 0.2rem 0.55rem;
  transition: all 0.15s;
}
.config-reset:hover { color: var(--red); border-color: rgba(192,57,43,0.3); }

.config-body { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0; }
.config-group { padding: 0.85rem 0; border-bottom: 1px solid var(--border); }
.config-group:first-child { padding-top: 0; }
.config-group:last-child { border-bottom: none; padding-bottom: 0; }
.config-group-label {
  font-size: 0.58rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--text3); margin-bottom: 0.75rem;
  display: flex; align-items: center; gap: 0.6rem;
}
.config-group-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

.config-row {
  display: grid; grid-template-columns: 148px 1fr;
  align-items: center; gap: 0.75rem; margin-bottom: 0.6rem;
}
.config-row:last-child { margin-bottom: 0; }
.config-field-label { font-size: 0.72rem; font-weight: 500; color: var(--text2); text-align: right; }
.config-field-sub { font-size: 0.62rem; color: var(--text3); display: block; margin-top: 0.1rem; }

.config-select {
  appearance: none; -webkit-appearance: none;
  background: var(--bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238c8c86'/%3E%3C/svg%3E") no-repeat right 0.75rem center;
  border: 1px solid var(--border2); border-radius: var(--r);
  padding: 0.45rem 2.25rem 0.45rem 0.75rem;
  font-size: 0.76rem; font-family: var(--sans); color: var(--text);
  cursor: pointer; width: 100%; transition: border-color 0.15s;
}
.config-select:focus { outline: none; border-color: var(--accent); }
.config-select:hover { border-color: var(--border2); background-color: var(--surface); }

.config-slider-wrap { display: flex; align-items: center; gap: 0.65rem; }
.config-slider {
  flex: 1; -webkit-appearance: none; appearance: none;
  height: 3px; background: var(--bg2); border-radius: 2px; outline: none; cursor: pointer;
}
.config-slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 15px; height: 15px;
  border-radius: 50%; background: var(--text); cursor: pointer;
  border: 2px solid var(--surface); box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  transition: background 0.15s;
}
.config-slider:hover::-webkit-slider-thumb { background: var(--accent); }
.config-slider-val {
  font-family: var(--mono); font-size: 0.72rem; color: var(--text);
  min-width: 36px; text-align: right; font-weight: 500;
}

/* Progress card */
.progress-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r3);
  padding: 2rem;
  box-shadow: var(--sh2);
  text-align: left;
  margin-bottom: 1.5rem;
}
.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}
.progress-label-text { font-size: 0.78rem; font-weight: 600; }
.progress-pct {
  font-family: var(--mono);
  font-size: 0.72rem;
  color: var(--text3);
}
.pbar-track {
  height: 3px;
  background: var(--bg2);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}
.pbar-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--text);
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.pbar-fill.done { background: var(--green); }

.steps-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
.step-cell {
  padding: 0.55rem 0.5rem;
  border-radius: var(--r);
  border: 1px solid var(--border);
  background: var(--bg);
  text-align: center;
  transition: all 0.3s;
}
.step-cell.s-done {
  background: var(--green-bg);
  border-color: rgba(0,135,90,0.2);
}
.step-cell.s-active {
  background: var(--surface);
  border-color: var(--border2);
  box-shadow: var(--sh);
}
.step-cell-num {
  font-family: var(--mono);
  font-size: 0.6rem;
  color: var(--text3);
  margin-bottom: 0.25rem;
}
.step-cell.s-done .step-cell-num { color: var(--green); }
.step-cell.s-active .step-cell-num { color: var(--accent); }
.step-cell-name {
  font-size: 0.62rem;
  font-weight: 500;
  color: var(--text3);
}
.step-cell.s-done .step-cell-name { color: var(--green); }
.step-cell.s-active .step-cell-name { color: var(--text); }

/* ── DASHBOARD ── */
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}
.dash-title-wrap {}
.dash-eyebrow {
  font-family: var(--mono);
  font-size: 0.62rem;
  font-weight: 500;
  color: var(--green2);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.dash-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--green2); }
.dash-title {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.035em;
  margin-bottom: 0.35rem;
}
.dash-meta {
  font-size: 0.75rem;
  color: var(--text3);
  font-family: var(--mono);
}

/* Stat strip */
.stat-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border2);
  border: 1px solid var(--border2);
  border-radius: var(--r2);
  overflow: hidden;
  margin-bottom: 1.5rem;
}
.stat-cell {
  background: var(--surface);
  padding: 1.25rem 1.4rem;
  transition: background 0.15s;
}
.stat-cell:hover { background: var(--surface2); }
.stat-val {
  font-family: var(--mono);
  font-size: 1.85rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.03em;
  margin-bottom: 0.35rem;
  animation: countUp 0.4s ease both;
}
.stat-val.c-blue   { color: var(--accent); }
.stat-val.c-green  { color: var(--green); }
.stat-val.c-warn   { color: var(--warn); }
.stat-val.c-red    { color: var(--red); }
.stat-val.c-purple { color: var(--purple); }
.stat-lbl {
  font-size: 0.67rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--text3);
}
.stat-sub {
  font-size: 0.65rem;
  color: var(--text3);
  font-family: var(--mono);
  margin-top: 0.2rem;
}

/* Second row stats */
.stat-strip-2 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border2);
  border: 1px solid var(--border2);
  border-radius: var(--r2);
  overflow: hidden;
  margin-bottom: 2rem;
}


/* ── Dashboard tabs ── */
.dash-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border2);
  margin-bottom: 2rem;
}
.dash-tab {
  padding: 0.6rem 1.1rem;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text3);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-family: var(--sans);
  transition: all 0.15s;
  margin-bottom: -1px;
  white-space: nowrap;
}
.dash-tab:hover { color: var(--text); }
.dash-tab.active {
  color: var(--text);
  border-bottom-color: var(--text);
  font-weight: 600;
}

/* ── Preview table ── */
.preview-wrap {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}
@media (max-width: 780px) { .preview-wrap { grid-template-columns: 1fr; } }
.preview-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r2);
  overflow: hidden;
  box-shadow: var(--sh);
}
.preview-card-head {
  padding: 0.6rem 1rem;
  background: var(--bg);
  border-bottom: 1px solid var(--border2);
  display: flex; align-items: center; gap: 0.5rem;
}
.preview-card-title {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--text3);
}
.preview-card-badge {
  font-family: var(--mono); font-size: 0.6rem;
  padding: 0.1rem 0.45rem; border-radius: 3px;
  font-weight: 600;
}
.preview-card-badge.raw   { background: var(--warn-bg); color: var(--warn); border: 1px solid rgba(180,83,9,0.15); }
.preview-card-badge.clean { background: var(--green-bg); color: var(--green); border: 1px solid rgba(0,135,90,0.15); }
.preview-tbl-wrap { overflow-x: auto; max-height: 340px; overflow-y: auto; }
.preview-tbl { width: 100%; border-collapse: collapse; font-size: 0.7rem; }
.preview-tbl th {
  background: var(--bg2); color: var(--text3); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.58rem;
  padding: 0.5rem 0.75rem; text-align: left;
  border-bottom: 1px solid var(--border2);
  position: sticky; top: 0; white-space: nowrap;
}
.preview-tbl td {
  padding: 0.45rem 0.75rem; border-bottom: 1px solid var(--border);
  font-family: var(--mono); color: var(--text2); white-space: nowrap;
  max-width: 160px; overflow: hidden; text-overflow: ellipsis;
}
.preview-tbl tr:last-child td { border-bottom: none; }
.preview-tbl tr:hover td { background: var(--surface2); }
.preview-tbl td.null-val { color: var(--text3); font-style: italic; }

/* ── SECTION ── */
.section { margin-bottom: 2.25rem; }
.section-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.section-hed {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text3);
  white-space: nowrap;
}
.section-rule { flex: 1; height: 1px; background: var(--border); }
.section-count {
  font-family: var(--mono);
  font-size: 0.65rem;
  color: var(--text3);
  white-space: nowrap;
}

/* ── TABLE ── */
.tbl-wrap {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r2);
  overflow: hidden;
  overflow-x: auto;
  box-shadow: var(--sh);
}
table { width: 100%; border-collapse: collapse; }
th {
  background: var(--bg);
  color: var(--text3);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.62rem;
  padding: 0.6rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border2);
  white-space: nowrap;
  font-family: var(--sans);
}
td {
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.78rem;
  vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
tr { transition: background 0.1s; }
tr:hover td { background: var(--surface2); }
.td-mono { font-family: var(--mono); font-size: 0.72rem; font-weight: 500; }
.td-dim  { color: var(--text3); font-size: 0.72rem; font-family: var(--mono); }

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.55rem;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  font-family: var(--mono);
  text-transform: uppercase;
}
.bg-good   { background: var(--green-bg);  color: var(--green);  border: 1px solid rgba(0,135,90,0.15); }
.bg-warn   { background: var(--warn-bg);   color: var(--warn);   border: 1px solid rgba(180,83,9,0.15); }
.bg-bad    { background: var(--red-bg);    color: var(--red);    border: 1px solid rgba(192,57,43,0.15); }
.bg-blue   { background: var(--accent-bg); color: var(--accent); border: 1px solid rgba(26,107,255,0.15); }
.bg-grey   { background: var(--bg2); color: var(--text3); border: 1px solid var(--border2); }

/* Score bar */
.sbar-wrap { display: flex; align-items: center; gap: 0.6rem; }
.sbar      { flex: 1; height: 4px; background: var(--bg2); border-radius: 2px; overflow: hidden; min-width: 48px; }
.sbar-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
.sbar-fill.good { background: var(--green); }
.sbar-fill.warn { background: var(--warn); }
.sbar-fill.bad  { background: var(--red); }
.sbar-num { font-family: var(--mono); font-size: 0.65rem; color: var(--text3); min-width: 28px; text-align: right; }

/* ── AUDIT LOG ── */
.audit-wrap {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r2);
  overflow: hidden;
  max-height: 380px;
  overflow-y: auto;
  box-shadow: var(--sh);
}
.audit-head {
  display: grid;
  grid-template-columns: 64px 200px 1fr;
  background: var(--bg);
  border-bottom: 1px solid var(--border2);
}
.audit-hcell {
  padding: 0.5rem 0.85rem;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text3);
  border-right: 1px solid var(--border);
}
.audit-hcell:last-child { border-right: none; }
.audit-row {
  display: grid;
  grid-template-columns: 64px 200px 1fr;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.audit-row:last-child { border-bottom: none; }
.audit-row:hover { background: var(--surface2); }
.audit-cell {
  padding: 0.5rem 0.85rem;
  display: flex;
  align-items: center;
  border-right: 1px solid var(--border);
  font-size: 0.72rem;
  font-family: var(--mono);
}
.audit-cell:last-child { border-right: none; }
.a-ts { color: var(--text3); font-size: 0.62rem; }
.a-action { font-weight: 600; font-size: 0.68rem; gap: 0.5rem; }
.a-action.drop     { color: var(--red); }
.a-action.impute   { color: var(--warn); }
.a-action.outlier  { color: var(--purple); }
.a-action.pipeline { color: var(--green); }
.a-action.id       { color: var(--accent); }
.a-col { color: var(--text3); font-size: 0.62rem; margin-left: 0.4rem; }
.a-detail { color: var(--text2); flex-wrap: wrap; gap: 0.6rem; display: flex; font-size: 0.67rem; }
.a-kv { display: inline-flex; gap: 0.25rem; }
.a-k  { color: var(--text3); }
.a-v  { color: var(--text); }

/* ── REPORT SCREEN ── */
.report-topbar {
  height: 48px;
  background: var(--surface);
  border-bottom: 1px solid var(--border2);
  display: flex;
  align-items: center;
  padding: 0 1.75rem;
  gap: 1rem;
}
.report-label { font-size: 0.75rem; color: var(--text3); }
.report-body { padding: 1.25rem 1.75rem; }
.report-frame {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r2);
  overflow: hidden;
  box-shadow: var(--sh2);
}
.report-frame iframe {
  width: 100%;
  height: calc(100vh - 160px);
  border: none;
  display: block;
}

/* ── RESPONSIVE ── */
/* ── MOBILE: 680px and below ── */

/* ── Feedback widget ── */
.feedback-fab {
  position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 500;
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--text); color: #fff;
  border: none; cursor: pointer; font-size: 1.1rem;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  transition: all 0.2s;
}
.feedback-fab:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 8px 24px rgba(0,0,0,0.22); }

.feedback-modal {
  position: fixed; inset: 0; z-index: 600;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
  display: flex; align-items: flex-end; justify-content: flex-end;
  padding: 1.5rem; animation: fadeIn 0.2s ease;
}
.feedback-card {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: var(--r3); box-shadow: 0 24px 64px rgba(0,0,0,0.2);
  width: 100%; max-width: 360px;
  animation: fadeUp 0.25s ease;
}
.feedback-head {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.feedback-title { font-size: 0.85rem; font-weight: 700; }
.feedback-close {
  width: 26px; height: 26px; border-radius: 6px;
  background: var(--bg2); border: 1px solid var(--border2);
  cursor: pointer; font-size: 0.8rem; color: var(--text3);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.feedback-close:hover { color: var(--text); }
.feedback-body { padding: 1.1rem 1.25rem 1.25rem; }
.feedback-label {
  font-size: 0.7rem; font-weight: 600; color: var(--text2);
  margin-bottom: 0.5rem; display: block;
}
.feedback-types {
  display: flex; gap: 0.5rem; margin-bottom: 0.85rem; flex-wrap: wrap;
}
.feedback-type {
  font-size: 0.68rem; padding: 0.25rem 0.65rem; border-radius: 99px;
  border: 1px solid var(--border2); background: var(--bg);
  cursor: pointer; font-family: var(--sans); color: var(--text2);
  transition: all 0.15s;
}
.feedback-type:hover { border-color: var(--accent); color: var(--accent); }
.feedback-type.selected { background: var(--accent); color: #fff; border-color: var(--accent); }
.feedback-textarea {
  width: 100%; min-height: 90px; border: 1px solid var(--border2);
  border-radius: var(--r); padding: 0.65rem 0.75rem;
  font-size: 0.78rem; font-family: var(--sans); color: var(--text);
  background: var(--bg); resize: vertical; outline: none;
  transition: border-color 0.15s; margin-bottom: 0.85rem;
  box-sizing: border-box;
}
.feedback-textarea:focus { border-color: var(--accent); background: var(--surface); }
.feedback-textarea::placeholder { color: var(--text3); }
.feedback-submit {
  width: 100%; height: 36px; border-radius: var(--r);
  background: var(--text); color: #fff; font-size: 0.78rem;
  font-weight: 600; border: none; cursor: pointer; font-family: var(--sans);
  transition: all 0.15s;
}
.feedback-submit:hover { background: #2a2a28; }
.feedback-submit:disabled { background: var(--text3); cursor: not-allowed; }
.feedback-success {
  text-align: center; padding: 1.5rem;
  font-size: 0.8rem; color: var(--green);
}
.feedback-success-icon { font-size: 2rem; margin-bottom: 0.5rem; }

/* ── Post-clean feedback gate ── */
.pf-overlay {
  position: fixed; inset: 0; z-index: 700;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem; animation: fadeIn 0.25s ease;
}
.pf-card {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: var(--r3); box-shadow: 0 24px 64px rgba(0,0,0,0.2);
  width: 100%; max-width: 420px;
  animation: fadeUp 0.3s ease;
}
.pf-head {
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}
.pf-icon { font-size: 2rem; margin-bottom: 0.75rem; }
.pf-title { font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.35rem; }
.pf-sub { font-size: 0.75rem; color: var(--text3); line-height: 1.5; }
.pf-body { padding: 0 1.5rem 1.5rem; }
.pf-types {
  display: flex; gap: 0.5rem; margin-bottom: 0.85rem; flex-wrap: wrap;
}
.pf-type {
  font-size: 0.68rem; padding: 0.25rem 0.65rem; border-radius: 99px;
  border: 1px solid var(--border2); background: var(--bg);
  cursor: pointer; font-family: var(--sans); color: var(--text2);
  transition: all 0.15s;
}
.pf-type:hover { border-color: var(--accent); color: var(--accent); }
.pf-type.selected { background: var(--accent); color: #fff; border-color: var(--accent); }
.pf-label { font-size: 0.7rem; font-weight: 600; color: var(--text2); margin-bottom: 0.5rem; display: block; }
.pf-textarea {
  width: 100%; min-height: 80px; border: 1px solid var(--border2);
  border-radius: var(--r); padding: 0.65rem 0.75rem;
  font-size: 0.78rem; font-family: var(--sans); color: var(--text);
  background: var(--bg); resize: none; outline: none;
  transition: border-color 0.15s; margin-bottom: 1rem;
  box-sizing: border-box;
}
.pf-textarea:focus { border-color: var(--accent); background: var(--surface); }
.pf-textarea::placeholder { color: var(--text3); }
.pf-submit {
  width: 100%; height: 40px; border-radius: var(--r);
  background: var(--text); color: #fff; font-size: 0.82rem;
  font-weight: 700; border: none; cursor: pointer; font-family: var(--sans);
  transition: all 0.15s; letter-spacing: -0.01em;
}
.pf-submit:hover { background: #2a2a28; transform: translateY(-1px); }
.pf-submit:disabled { background: var(--text3); cursor: not-allowed; transform: none; }
.pf-note { font-size: 0.62rem; color: var(--text3); text-align: center; margin-top: 0.65rem; }

@media (max-width: 680px) {

  /* Topbar — hide step track and email, keep logo + sign in/out */
  .topbar { padding: 0 1rem; gap: 0.75rem; }
  .topbar-divider { display: none; }
  .step-track { display: none; }
  .topbar-email { display: none; }
  .topbar-badge { display: none; }

  /* Page padding */
  .page { padding: 1.5rem 1rem; }

  /* Upload screen */
  .upload-layout { grid-template-columns: 1fr; gap: 1.5rem; padding-top: 1rem; }
  .upload-right { display: none; }
  .upload-h1 { font-size: 1.9rem; }
  .upload-hero-text { padding-top: 0.5rem; }

  /* Clean screen */
  .clean-layout { padding: 1.5rem 0; }
  .clean-h2 { font-size: 1.4rem; }
  .config-panel { max-width: 100%; }
  .config-row { grid-template-columns: 1fr; gap: 0.35rem; }
  .config-field-label { text-align: left; }
  .steps-grid { grid-template-columns: repeat(4,1fr); }
  .step-cell-name { font-size: 0.55rem; }

  /* Dashboard */
  .dash-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .btn-group { width: 100%; }
  .btn-group .btn { flex: 1; justify-content: center; }
  .stat-strip, .stat-strip-2 { grid-template-columns: repeat(2,1fr); }
  .dash-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .dash-tab { white-space: nowrap; padding: 0.55rem 0.85rem; font-size: 0.72rem; }
  .section-head { flex-wrap: wrap; }
  .tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .preview-wrap { grid-template-columns: 1fr; }

  /* Audit log */
  .audit-row, .audit-head { grid-template-columns: 1fr; }
  .audit-cell, .audit-hcell { border-right: none; border-bottom: 1px solid var(--border); }
  .audit-cell:last-child, .audit-hcell:last-child { border-bottom: none; }

  /* Report iframe */
  .report-body { padding: 0.5rem; }
  .report-topbar { padding: 0 1rem; gap: 0.5rem; }
  .report-label { display: none; }

  /* Footer */
  .app-footer { flex-direction: column; align-items: flex-start; padding: 1rem; gap: 0.65rem; }

  /* Auth card */
  .auth-card { border-radius: var(--r2); }
  .auth-card-head { padding: 1.5rem 1.25rem 1.25rem; }
  .auth-card-body { padding: 1.25rem; }

  /* Modal */
  .modal-card { max-height: 90vh; border-radius: var(--r2); }
  .modal-body { padding: 1rem; }

  /* About modal — bottom sheet on mobile */
  .about-overlay { padding: 0; align-items: flex-end; }
  .about-card {
    max-width: 100%; border-radius: var(--r3) var(--r3) 0 0;
    max-height: 92vh; overflow-y: auto;
  }
  .about-hero { padding: 1.75rem 1.25rem 1.25rem; }
  .about-hero-title { font-size: 1.35rem; }
  .about-hero-sub { font-size: 0.74rem; }
  .about-logo-mark { width: 40px; height: 30px; margin-bottom: 1rem; }
  .about-section { padding: 1.1rem 1.25rem; }
  .about-stages { grid-template-columns: repeat(2,1fr); gap: 0.5rem; }
  .about-stage { padding: 0.65rem; }
  .about-stat { padding: 0.75rem 0.5rem; }
  .about-stat-val { font-size: 1.1rem; }
  .about-principles { gap: 0.5rem; }
  .about-principle-icon { width: 24px; height: 24px; font-size: 0.7rem; }
  .about-footer-strip { padding: 0.85rem 1.25rem; flex-direction: column; align-items: flex-start; gap: 0.35rem; }
  .about-close-btn { top: 1rem; right: 1rem; }
}


/* ── About Modal ── */
.about-overlay {
  position: fixed; inset: 0; z-index: 800;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem; animation: fadeIn 0.2s ease;
  overflow-y: auto;
}
.about-card {
  background: var(--surface); border: 1px solid var(--border2);
  border-radius: var(--r3); box-shadow: 0 32px 80px rgba(0,0,0,0.25);
  width: 100%; max-width: 680px;
  animation: fadeUp 0.3s ease;
  overflow: hidden;
  my-margin: auto;
}
.about-hero {
  background: var(--text);
  padding: 2.5rem 2rem 2rem;
  position: relative; overflow: hidden;
}
.about-hero-grid {
  position: absolute; inset: 0; opacity: 0.04;
  background-image: repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px),
    repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px);
}
.about-logo-mark {
  width: 48px; height: 36px; background: #fff; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-size: 0.65rem; font-weight: 700;
  color: var(--text); letter-spacing: 0.5px; margin-bottom: 1.25rem;
}
.about-hero-title {
  font-size: 2rem; font-weight: 700; letter-spacing: -0.04em;
  color: #fff; line-height: 1.1; margin-bottom: 0.5rem;
}
.about-hero-title em { font-style: normal; color: rgba(255,255,255,0.45); }
.about-hero-sub {
  font-size: 0.82rem; color: rgba(255,255,255,0.6);
  line-height: 1.6; max-width: 480px;
}
.about-close-btn {
  position: absolute; top: 1.25rem; right: 1.25rem;
  width: 30px; height: 30px; border-radius: 6px;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
  cursor: pointer; font-size: 0.85rem; color: rgba(255,255,255,0.7);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.about-close-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }

.about-body { padding: 0; }

.about-section {
  padding: 1.75rem 2rem;
  border-bottom: 1px solid var(--border);
}
.about-section:last-child { border-bottom: none; }
.about-section-label {
  font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.12em; color: var(--accent); font-family: var(--mono);
  margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;
}
.about-section-label::after {
  content: ''; flex: 1; height: 1px; background: var(--border2);
}
.about-p {
  font-size: 0.8rem; color: var(--text2); line-height: 1.75;
  margin-bottom: 0.75rem;
}
.about-p:last-child { margin-bottom: 0; }
.about-p strong { color: var(--text); font-weight: 600; }

/* Pipeline stages */
.about-stages {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;
  margin-top: 0.5rem;
}
@media (max-width: 680px) { .about-stages { grid-template-columns: repeat(2,1fr); } }
.about-stage {
  background: var(--bg); border: 1px solid var(--border2);
  border-radius: var(--r); padding: 0.85rem;
}
.about-stage-num {
  font-family: var(--mono); font-size: 0.58rem; color: var(--accent);
  font-weight: 700; margin-bottom: 0.4rem;
}
.about-stage-name {
  font-size: 0.72rem; font-weight: 700; color: var(--text);
  margin-bottom: 0.25rem; letter-spacing: -0.01em;
}
.about-stage-desc {
  font-size: 0.65rem; color: var(--text3); line-height: 1.5;
}

/* Principles */
.about-principles { display: flex; flex-direction: column; gap: 0.65rem; margin-top: 0.25rem; }
.about-principle {
  display: flex; gap: 0.85rem; align-items: flex-start;
}
.about-principle-icon {
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--bg2); border: 1px solid var(--border2);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; flex-shrink: 0; margin-top: 0.1rem;
}
.about-principle-text { font-size: 0.78rem; color: var(--text2); line-height: 1.6; }
.about-principle-text strong { color: var(--text); display: block; margin-bottom: 0.1rem; }

/* Stats strip */
.about-stats {
  display: grid; grid-template-columns: repeat(3,1fr);
  border-top: 1px solid var(--border); border-left: 1px solid var(--border);
  margin-top: 0.75rem; border-radius: var(--r); overflow: hidden;
}
.about-stat {
  padding: 1rem; text-align: center;
  border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);
}
.about-stat-val {
  font-family: var(--mono); font-size: 1.4rem; font-weight: 700;
  color: var(--text); letter-spacing: -0.03em;
}
.about-stat-lbl { font-size: 0.62rem; color: var(--text3); margin-top: 0.2rem; }

/* Footer strip */
.about-footer-strip {
  padding: 1rem 2rem;
  background: var(--bg);
  border-top: 1px solid var(--border2);
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 0.5rem;
}
.about-footer-tag {
  font-family: var(--mono); font-size: 0.62rem; color: var(--text3);
}
.about-footer-tag strong { color: var(--text); }
.about-contact-link {
  font-size: 0.72rem; color: var(--accent);
  text-decoration: none; font-weight: 500;
  transition: opacity 0.15s;
}
.about-contact-link:hover { opacity: 0.7; }


/* ── Upload source tabs ── */
.upload-source-tabs {
  display: flex; gap: 0; margin-bottom: 1rem;
  border: 1px solid var(--border2); border-radius: var(--r); overflow: hidden;
}
.upload-source-tab {
  flex: 1; padding: 0.55rem 0.75rem; font-size: 0.72rem; font-weight: 600;
  background: var(--bg); border: none; cursor: pointer; font-family: var(--sans);
  color: var(--text3); transition: all 0.15s; display: flex; align-items: center;
  justify-content: center; gap: 0.4rem;
}
.upload-source-tab:first-child { border-right: 1px solid var(--border2); }
.upload-source-tab.active { background: var(--surface); color: var(--text); }
.upload-source-tab:hover:not(.active) { background: var(--bg2); color: var(--text2); }

/* Sheets input */
.sheets-input-wrap {
  display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem 0 0.25rem;
}
.sheets-input-label {
  font-size: 0.7rem; font-weight: 600; color: var(--text2);
}
.sheets-input {
  width: 100%; height: 40px; border: 1px solid var(--border2);
  border-radius: var(--r); padding: 0 0.85rem;
  font-size: 0.78rem; font-family: var(--mono); color: var(--text);
  background: var(--bg); outline: none; transition: border-color 0.15s;
  box-sizing: border-box;
}
.sheets-input:focus { border-color: var(--accent); background: var(--surface); }
.sheets-input::placeholder { color: var(--text3); font-family: var(--sans); }
.sheets-hint {
  font-size: 0.65rem; color: var(--text3); line-height: 1.5;
  padding: 0.6rem 0.75rem; background: var(--bg2);
  border: 1px solid var(--border); border-radius: var(--r);
  display: flex; gap: 0.5rem; align-items: flex-start;
}

/* ── Footer ── */
.app-footer {
  border-top: 1px solid var(--border2);
  padding: 1rem 2rem;
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 0.75rem;
  background: var(--surface);
}
.footer-brand { font-family: var(--mono); font-size: 0.65rem; color: var(--text3); }
.footer-brand strong { color: var(--text); }
.footer-links { display: flex; gap: 1.25rem; }
.footer-link {
  font-size: 0.68rem; color: var(--text3); background: none;
  border: none; cursor: pointer; font-family: var(--sans);
  padding: 0; transition: color 0.15s;
}
.footer-link:hover { color: var(--accent); }

/* ── Legal modal ── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem;
  animation: fadeIn 0.2s ease;
}
.modal-card {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r3);
  box-shadow: 0 24px 64px rgba(0,0,0,0.18);
  width: 100%; max-width: 640px;
  max-height: 80vh;
  display: flex; flex-direction: column;
  animation: fadeUp 0.25s ease;
}
.modal-head {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border2);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.modal-title { font-size: 0.9rem; font-weight: 700; letter-spacing: -0.02em; }
.modal-close {
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--bg2); border: 1px solid var(--border2);
  cursor: pointer; font-size: 0.9rem; color: var(--text3);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.modal-close:hover { background: var(--bg); color: var(--text); }
.modal-body {
  padding: 1.5rem; overflow-y: auto; flex: 1;
  font-size: 0.78rem; color: var(--text2); line-height: 1.7;
}
.modal-body h2 {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--text3); margin: 1.5rem 0 0.6rem;
}
.modal-body h2:first-child { margin-top: 0; }
.modal-body p { margin-bottom: 0.75rem; }
.modal-body ul { padding-left: 1.25rem; margin-bottom: 0.75rem; }
.modal-body ul li { margin-bottom: 0.35rem; }
.modal-body a { color: var(--accent); text-decoration: none; }
.modal-updated {
  font-size: 0.65rem; color: var(--text3);
  font-family: var(--mono); margin-top: 1.5rem;
  padding-top: 1rem; border-top: 1px solid var(--border);
}
`

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmtBytes = b => b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`
const scoreClass = s => s >= 0.85 ? 'good' : s >= 0.60 ? 'warn' : 'bad'
const badgeCls   = s => s >= 0.85 ? 'bg-good' : s >= 0.60 ? 'bg-warn' : 'bg-bad'
const actionCls  = a => {
  if (!a) return ''
  if (a.includes('drop') || a.includes('remov')) return 'drop'
  if (a.includes('impute') || a.includes('fill')) return 'impute'
  if (a.includes('outlier')) return 'outlier'
  if (a.includes('pipeline') || a.includes('complete') || a.includes('started')) return 'pipeline'
  if (a.includes('id_column')) return 'id'
  return ''
}
const STEPS = ['Headers','Strings','Units','Harmonise','Dupes','Types','Outliers','EDA']

// ─────────────────────────────────────────────────────────────
// Topbar
// ─────────────────────────────────────────────────────────────
function Topbar({ step, sessionId, user, onSignIn, onSignOut, onAccount }) {
  const STEPS_NAV = ['Upload','Clean','Results']
  return (
    <div className="topbar">
      <div className="topbar-logo">
        <div className="logo-mark">OXD</div>
        <span className="logo-text">Oxdemi<span>.io</span></span>
      </div>
      <div className="topbar-divider" />
      <div className="step-track">
        {STEPS_NAV.map((s, i) => (
          <span key={s} style={{display:'flex', alignItems:'center'}}>
            <span className={`step-item${step===i?' active':step>i?' done':''}`}>
              <span className="step-num">{step > i ? '✓' : i+1}</span>
              {s}
            </span>
            {i < STEPS_NAV.length-1 && <span className="step-arrow">›</span>}
          </span>
        ))}
      </div>
      <div className="topbar-right">
        {sessionId && <span className="topbar-badge">sess: {sessionId.slice(0,8)}…</span>}
        {user ? (
          <div className="topbar-user">
            <button className="topbar-account-btn" onClick={onAccount} title="My account">
              <div className="topbar-avatar">{(user.email||'?')[0].toUpperCase()}</div>
              <span className="topbar-email">{user.email}</span>
              <span style={{fontSize:'0.6rem', color:'var(--text3)', marginLeft:'0.1rem'}}>▾</span>
            </button>
            <button className="topbar-signout" onClick={onSignOut}>Sign out</button>
          </div>
        ) : (
          <button className="topbar-signin" onClick={onSignIn}>Sign in</button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'https://euremlytics-2.onrender.com'

function UploadScreen({ onUploaded }) {
  const [source, setSource]   = useState('file') // 'file' | 'sheets'
  const [file, setFile]       = useState(null)
  const [drag, setDrag]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [sheetsUrl, setSheetsUrl] = useState('')
  const inputRef = useRef()

  const pick = f => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv','xlsx','xls'].includes(ext)) { setError('Only CSV and Excel files are supported.'); return }
    setError(''); setFile(f)
  }

  const onDrop = useCallback(e => {
    e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0])
  }, [])

  const submitFile = async () => {
    if (!file) return
    setLoading(true); setError('')
    try { onUploaded(await uploadFile(file)) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const submitSheets = async () => {
    if (!sheetsUrl.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/upload/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetsUrl.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to import sheet')
      onUploaded(data)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="page">
      <div className="upload-layout">
        {/* Left — hero text */}
        <div className="upload-hero-text anim-fade-up">
          <div className="upload-eyebrow">Data Cleaning Engine</div>
          <h1 className="upload-h1">
            Make Your Business Data<br/><em>Reliable in Minutes.</em>
          </h1>
          <p className="upload-sub">
            Oxdemi automatically cleans, validates, scores, and audits your datasets — so you can trust your reports again.
          </p>
          <div className="upload-features">
            {[
              'Type inference across 4 data types',
              'K/M/B currency & unit expansion',
              'Duplicate & outlier detection',
              'Full column quality scoring',
              'Audit trail of every action',
            ].map(f => (
              <div key={f} className="upload-feature">
                <div className="feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Right — upload card */}
        <div className="upload-card" style={{animationDelay:'0.1s'}}>

          {/* Source tabs */}
          <div className="upload-source-tabs">
            <button
              className={`upload-source-tab${source==='file'?' active':''}`}
              onClick={() => { setSource('file'); setError('') }}
            >
              📂 Upload File
            </button>
            <button
              className={`upload-source-tab${source==='sheets'?' active':''}`}
              onClick={() => { setSource('sheets'); setError('') }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
                <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58"/>
                <path d="M7 8h10M7 12h10M7 16h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Google Sheets
            </button>
          </div>

          {source === 'file' ? (
            <>
              <div
                className={`dropzone${drag?' drag':''}`}
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={e => { pick(e.target.files[0]); e.target.value = '' }} />
                <div className="dz-icon">{file ? '📄' : '📂'}</div>
                <div className="dz-title">{file ? file.name : 'Drop your file here'}</div>
                <div className="dz-sub">{file ? fmtBytes(file.size) : 'CSV, XLSX, XLS · max 50 MB'}</div>
              </div>

              {file && (
                <div className="file-chip">
                  <span className="file-chip-icon">✓</span>
                  <span className="file-chip-name">{file.name}</span>
                  <span className="file-chip-size">{fmtBytes(file.size)}</span>
                  <button className="file-chip-remove" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = '' }}>✕</button>
                </div>
              )}

              {error && <div className="error-box"><span>⚠</span><span>{error}</span></div>}

              <div className="upload-actions">
                {!file && <span className="upload-hint">No file selected</span>}
                <button className="btn btn-primary btn-lg" onClick={submitFile} disabled={!file || loading}>
                  {loading ? 'Uploading…' : 'Upload & Continue →'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="sheets-input-wrap">
                <label className="sheets-input-label">Google Sheets URL</label>
                <input
                  className="sheets-input"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetsUrl}
                  onChange={e => { setSheetsUrl(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && submitSheets()}
                  autoFocus
                />
                <div className="sheets-hint">
                  <span>ℹ</span>
                  <span>The sheet must be set to <strong>Anyone with the link can view</strong>. In Google Sheets: Share → Change → Anyone with the link.</span>
                </div>
              </div>

              {error && <div className="error-box"><span>⚠</span><span>{error}</span></div>}

              <div className="upload-actions">
                {!sheetsUrl.trim() && <span className="upload-hint">Paste a sheet URL above</span>}
                <button className="btn btn-primary btn-lg" onClick={submitSheets} disabled={!sheetsUrl.trim() || loading}>
                  {loading ? 'Importing sheet…' : 'Import & Continue →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Clean
// ─────────────────────────────────────────────────────────────
function CleanScreen({ uploadData, onCleaned }) {
  const [loading, setLoading]   = useState(false)
  const [pct, setPct]           = useState(0)
  const [stepIdx, setStepIdx]   = useState(-1)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')
  const [showConfig, setShowConfig] = useState(false)

  // Config state — mirrors CleaningConfig defaults
  const DEFAULTS = {
    outlier_action:              'none',
    outlier_method:              'iqr',
    outlier_iqr_multiplier:      1.5,
    impute_numeric_strategy:     'median',
    impute_categorical_strategy: 'mode',
    missing_drop_threshold:      0.60,
  }
  const [cfg, setCfg] = useState({ ...DEFAULTS })
  const set = (k, v) => setCfg(prev => ({ ...prev, [k]: v }))
  const reset = () => setCfg({ ...DEFAULTS })

  const run = async () => {
    setLoading(true); setError('')
    let i = 0
    const iv = setInterval(() => {
      setStepIdx(i)
      setPct(Math.round(((i+1)/STEPS.length)*100))
      i++; if (i >= STEPS.length) clearInterval(iv)
    }, 320)
    try {
      const result = await cleanData(uploadData.session_id, cfg)
      clearInterval(iv); setStepIdx(STEPS.length); setPct(100); setDone(true)
      setTimeout(() => onCleaned(result), 600)
    } catch(e) { clearInterval(iv); setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="page">
      <div className="clean-layout anim-fade-up">
        <div className="clean-file-tag">
          <div className="dot" />
          <span style={{fontFamily:'var(--mono)', fontSize:'0.72rem'}}>{uploadData.filename}</span>
          <span style={{color:'var(--text3)', fontSize:'0.68rem', marginLeft:'0.25rem'}}>
            · {uploadData.rows.toLocaleString()} rows · {uploadData.columns} cols
          </span>
        </div>

        <h2 className="clean-h2">
          {done ? 'Pipeline complete.' : loading ? 'Cleaning…' : 'Ready to clean.'}
        </h2>
        <p className="clean-sub">
          {done
            ? 'Redirecting to your results…'
            : loading
            ? 'Running 8-stage cleaning pipeline…'
            : 'Configure options below, then run the pipeline.'}
        </p>

        {!loading && !done && pct === 0 && (
          <>
            {/* Config toggle */}
            <button className="config-toggle" onClick={() => setShowConfig(v => !v)}>
              <span className={`config-toggle-arrow${showConfig ? ' open' : ''}`}>›</span>
              {showConfig ? 'Hide' : 'Show'} pipeline options
            </button>

            {/* Config panel */}
            {showConfig && (
              <div className="config-panel">
                <div className="config-panel-header">
                  <span className="config-panel-title">Pipeline Options</span>
                  <button className="config-reset" onClick={reset}>↺ Reset defaults</button>
                </div>
                <div className="config-body">

                  {/* Outlier group */}
                  <div className="config-group">
                    <div className="config-group-label">Outlier Handling</div>

                    <div className="config-row">
                      <div className="config-field-label">
                        Action
                        <span className="config-field-sub">what to do with outliers</span>
                      </div>
                      <select className="config-select" value={cfg.outlier_action} onChange={e => set('outlier_action', e.target.value)}>
                        <option value="none">None — log only</option>
                        <option value="flag">Flag — add _is_outlier column</option>
                        <option value="cap">Cap — winsorise to bounds</option>
                        <option value="remove">Remove — drop outlier rows</option>
                      </select>
                    </div>

                    <div className="config-row">
                      <div className="config-field-label">
                        Detection
                        <span className="config-field-sub">algorithm</span>
                      </div>
                      <select className="config-select" value={cfg.outlier_method} onChange={e => set('outlier_method', e.target.value)}>
                        <option value="iqr">IQR — interquartile range</option>
                        <option value="zscore">Z-Score — std deviations</option>
                      </select>
                    </div>

                    {cfg.outlier_method === 'iqr' && (
                      <div className="config-row">
                        <div className="config-field-label">
                          IQR Multiplier
                          <span className="config-field-sub">lower = stricter</span>
                        </div>
                        <div className="config-slider-wrap">
                          <input type="range" className="config-slider"
                            min="0.5" max="4" step="0.5"
                            value={cfg.outlier_iqr_multiplier}
                            onChange={e => set('outlier_iqr_multiplier', parseFloat(e.target.value))}
                          />
                          <span className="config-slider-val">{cfg.outlier_iqr_multiplier}</span>
                        </div>
                      </div>
                    )}

                    {cfg.outlier_method === 'zscore' && (
                      <div className="config-row">
                        <div className="config-field-label">
                          Z Threshold
                          <span className="config-field-sub">lower = stricter</span>
                        </div>
                        <div className="config-slider-wrap">
                          <input type="range" className="config-slider"
                            min="1" max="5" step="0.5"
                            value={cfg.outlier_zscore_threshold || 3}
                            onChange={e => set('outlier_zscore_threshold', parseFloat(e.target.value))}
                          />
                          <span className="config-slider-val">{cfg.outlier_zscore_threshold || 3}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Missing values group */}
                  <div className="config-group">
                    <div className="config-group-label">Missing Values</div>

                    <div className="config-row">
                      <div className="config-field-label">
                        Numeric fill
                        <span className="config-field-sub">imputation strategy</span>
                      </div>
                      <select className="config-select" value={cfg.impute_numeric_strategy} onChange={e => set('impute_numeric_strategy', e.target.value)}>
                        <option value="median">Median</option>
                        <option value="mean">Mean</option>
                        <option value="zero">Zero</option>
                      </select>
                    </div>

                    <div className="config-row">
                      <div className="config-field-label">
                        Categorical fill
                        <span className="config-field-sub">imputation strategy</span>
                      </div>
                      <select className="config-select" value={cfg.impute_categorical_strategy} onChange={e => set('impute_categorical_strategy', e.target.value)}>
                        <option value="mode">Mode — most frequent</option>
                        <option value="none">Leave as missing</option>
                      </select>
                    </div>

                    <div className="config-row">
                      <div className="config-field-label">
                        Drop threshold
                        <span className="config-field-sub">% missing before drop</span>
                      </div>
                      <div className="config-slider-wrap">
                        <input type="range" className="config-slider"
                          min="0.3" max="1" step="0.05"
                          value={cfg.missing_drop_threshold}
                          onChange={e => set('missing_drop_threshold', parseFloat(e.target.value))}
                        />
                        <span className="config-slider-val">{Math.round(cfg.missing_drop_threshold * 100)}%</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            <button className="btn btn-primary btn-lg" onClick={run}>
              Run Pipeline →
            </button>
          </>
        )}

        {(loading || pct > 0) && (
          <div className="progress-card">
            <div className="progress-header">
              <span className="progress-label-text">
                {done ? '✓ Complete' : `Step ${Math.min(stepIdx+1, STEPS.length)} of ${STEPS.length}`}
              </span>
              <span className="progress-pct">{pct}%</span>
            </div>
            <div className="pbar-track">
              <div className={`pbar-fill${done?' done':''}`} style={{width:`${pct}%`}} />
            </div>
            <div className="steps-grid">
              {STEPS.map((s,i) => (
                <div key={s} className={`step-cell${i<stepIdx?' s-done':i===stepIdx?' s-active':''}`}>
                  <div className="step-cell-num">{i < stepIdx ? '✓' : `0${i+1}`.slice(-2)}</div>
                  <div className="step-cell-name">{s}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div className="error-box"><span>⚠</span><span>{error}</span></div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────
function Dashboard({ result, sessionId, onViewReport, user, feedbackDone, onNeedFeedback }) {
  const [tab, setTab] = useState('overview')
  const [showFeedback, setShowFeedback] = useState(false)

  const quality    = result.column_quality_summary || []
  const audit      = result.audit_log || []
  const cleanShape = result.cleaned_shape || [0,0]
  const origShape  = result.original_shape || [0,0]
  const rawRows    = result.raw_dataframe || []
  const cleanRows  = (result.cleaned_dataframe || []).slice(0, 10)

  const dropped    = quality.filter(q => q.dropped).length
  const nGood      = quality.filter(q => !q.dropped && q.quality_score >= 0.85).length
  const nWarn      = quality.filter(q => !q.dropped && q.quality_score >= 0.60 && q.quality_score < 0.85).length
  const nBad       = quality.filter(q => !q.dropped && q.quality_score < 0.60).length
  const avgScore   = quality.length ? (quality.reduce((s,q) => s + q.quality_score, 0) / quality.length).toFixed(2) : 0

  // Columns for each preview table
  const rawCols   = rawRows.length   ? Object.keys(rawRows[0])   : []
  const cleanCols = cleanRows.length ? Object.keys(cleanRows[0]) : []

  return (
    <div className="page anim-fade-up">

      <div className="dash-header">
        <div className="dash-title-wrap">
          <div className="dash-eyebrow">
            <div className="dash-eyebrow-dot" />
            Pipeline complete
          </div>
          <div className="dash-title">Clean Results</div>
          <div className="dash-meta">
            {origShape[0].toLocaleString()} → {cleanShape[0].toLocaleString()} rows ·
            {' '}{origShape[1]} → {cleanShape[1]} columns ·
            {' '}{audit.length} actions
          </div>
        </div>
        <div className="btn-group">
          <button className="btn btn-ghost btn-sm" onClick={() => feedbackDone ? triggerDownload(csvDownloadUrl(sessionId)) : onNeedFeedback()}>↓ CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => feedbackDone ? triggerDownload(pdfDownloadUrl(sessionId)) : onNeedFeedback()}>↓ PDF</button>
          <button className="btn btn-primary" onClick={onViewReport}>View Report →</button>
        </div>
      </div>

      {/* Top stat row */}
      <div className="stat-strip">
        <div className="stat-cell">
          <div className="stat-val c-blue">{cleanShape[0].toLocaleString()}</div>
          <div className="stat-lbl">Clean Rows</div>
          <div className="stat-sub">from {origShape[0].toLocaleString()}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-val c-green">{nGood}</div>
          <div className="stat-lbl">High Quality</div>
          <div className="stat-sub">score ≥ 0.85</div>
        </div>
        <div className="stat-cell">
          <div className="stat-val c-warn">{nWarn}</div>
          <div className="stat-lbl">Needs Review</div>
          <div className="stat-sub">score 0.60–0.85</div>
        </div>
        <div className="stat-cell">
          <div className="stat-val c-red">{nBad + dropped}</div>
          <div className="stat-lbl">Low / Dropped</div>
          <div className="stat-sub">{dropped} dropped</div>
        </div>
      </div>

      {/* Second stat row */}
      <div className="stat-strip-2">
        <div className="stat-cell">
          <div className="stat-val">{result.rows_removed || 0}</div>
          <div className="stat-lbl">Rows Removed</div>
          <div className="stat-sub">duplicates</div>
        </div>
        <div className="stat-cell">
          <div className="stat-val">{result.columns_dropped || 0}</div>
          <div className="stat-lbl">Cols Dropped</div>
          <div className="stat-sub">excessive missing</div>
        </div>
        <div className="stat-cell">
          <div className="stat-val c-purple">{avgScore}</div>
          <div className="stat-lbl">Avg Quality</div>
          <div className="stat-sub">across all columns</div>
        </div>
        <div className="stat-cell">
          <div className="stat-val">{audit.length}</div>
          <div className="stat-lbl">Actions Taken</div>
          <div className="stat-sub">full audit trail</div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="dash-tabs">
        <button className={`dash-tab${tab==='overview'?' active':''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`dash-tab${tab==='preview'?' active':''}`} onClick={() => setTab('preview')}>Data Preview</button>
        <button className={`dash-tab${tab==='audit'?' active':''}`} onClick={() => setTab('audit')}>Audit Log</button>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && <>

      {/* Column quality table */}
      <div className="section">
        <div className="section-head">
          <span className="section-hed">Column Quality</span>
          <span className="section-rule" />
          <span className="section-count">{quality.length} columns</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th style={{minWidth:140}}>Quality Score</th>
                <th>Missing</th>
                <th>Unique</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...quality].sort((a,b) => {
                if (a.dropped !== b.dropped) return a.dropped ? 1 : -1
                return b.quality_score - a.quality_score
              }).map((col, i) => {
                const cls = scoreClass(col.quality_score)
                return (
                  <tr key={col.column} style={{animationDelay:`${i*0.02}s`}}>
                    <td className="td-mono">{col.column}</td>
                    <td><span className="badge bg-grey">{col.type}</span></td>
                    <td>
                      <div className="sbar-wrap">
                        <div className="sbar">
                          <div className={`sbar-fill ${cls}`} style={{width:`${Math.round(col.quality_score*100)}%`}} />
                        </div>
                        <span className="sbar-num">{col.quality_score}</span>
                      </div>
                    </td>
                    <td className="td-dim">{col.missing_pct != null ? `${col.missing_pct}%` : '—'}</td>
                    <td className="td-dim">{col.unique_values != null ? col.unique_values.toLocaleString() : '—'}</td>
                    <td>
                      {col.dropped
                        ? <span className="badge bg-bad">Dropped</span>
                        : col.high_cardinality_warning
                        ? <span className="badge bg-warn">High Card.</span>
                        : <span className={`badge ${badgeCls(col.quality_score)}`}>
                            {cls === 'good' ? 'Good' : cls === 'warn' ? 'Review' : 'Poor'}
                          </span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      </> /* end overview tab */ }

      {/* ── PREVIEW TAB ── */}
      {tab === 'preview' && (
        <div className="section">
          <div className="section-head">
            <span className="section-hed">Data Preview</span>
            <span className="section-rule" />
            <span className="section-count">first 10 rows · {rawCols.length} → {cleanCols.length} columns</span>
          </div>
          <div className="preview-wrap">

            {/* Raw */}
            <div className="preview-card">
              <div className="preview-card-head">
                <span className="preview-card-title">Before Cleaning</span>
                <span className="preview-card-badge raw">Raw</span>
              </div>
              <div className="preview-tbl-wrap">
                <table className="preview-tbl">
                  <thead>
                    <tr>{rawCols.map(c => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rawRows.map((row, i) => (
                      <tr key={i}>
                        {rawCols.map(c => (
                          <td key={c} className={row[c] == null || row[c] === '' ? 'null-val' : ''}>
                            {row[c] == null || row[c] === '' ? 'null' : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cleaned */}
            <div className="preview-card">
              <div className="preview-card-head">
                <span className="preview-card-title">After Cleaning</span>
                <span className="preview-card-badge clean">Clean</span>
              </div>
              <div className="preview-tbl-wrap">
                <table className="preview-tbl">
                  <thead>
                    <tr>{cleanCols.map(c => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {cleanRows.map((row, i) => (
                      <tr key={i}>
                        {cleanCols.map(c => (
                          <td key={c} className={row[c] == null || row[c] === '' ? 'null-val' : ''}>
                            {row[c] == null || row[c] === '' ? 'null' : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── AUDIT TAB ── */}
      {tab === 'audit' && (
        <div className="section">
          <div className="section-head">
            <span className="section-hed">Audit Log</span>
            <span className="section-rule" />
            <span className="section-count">{audit.length} entries</span>
          </div>
          <div className="audit-wrap">
            <div className="audit-head">
              <div className="audit-hcell">Time</div>
              <div className="audit-hcell">Action · Column</div>
              <div className="audit-hcell">Detail</div>
            </div>
            {audit.map((entry, i) => {
              const action = entry.action || ''
              const col    = entry.column || ''
              const ts     = (entry.timestamp || '').slice(11,19)
              const extras = Object.entries(entry).filter(([k]) =>
                !['action','column','timestamp'].includes(k)
              )
              return (
                <div className="audit-row" key={i}>
                  <div className="audit-cell a-ts">{ts || '—'}</div>
                  <div className="audit-cell">
                    <span className={`a-action ${actionCls(action)}`}>{action.replace(/_/g,' ')}</span>
                    {col && <span className="a-col">{col}</span>}
                  </div>
                  <div className="audit-cell a-detail">
                    {extras.map(([k,v]) => (
                      <span className="a-kv" key={k}>
                        <span className="a-k">{k}:</span>
                        <span className="a-v">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────
function ReportScreen({ sessionId, onBack, user, feedbackDone, onNeedFeedback }) {
  return (
    <div style={{display:'flex', flexDirection:'column', height:'calc(100vh - 52px)'}}>
      <div className="report-topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Dashboard</button>
        <span className="report-label">Full Quality Report</span>
        <div style={{marginLeft:'auto', display:'flex', gap:'0.5rem'}}>
          <button className="btn btn-ghost btn-sm" onClick={() => feedbackDone ? triggerDownload(csvDownloadUrl(sessionId)) : onNeedFeedback()}>↓ CSV</button>
          <button className="btn btn-green-solid btn-sm" onClick={() => feedbackDone ? triggerDownload(pdfDownloadUrl(sessionId)) : onNeedFeedback()}>↓ PDF</button>
        </div>
      </div>
      <div className="report-body">
        <div className="report-frame">
          <iframe src={reportHtmlUrl(sessionId)} title="Quality Report" />
        </div>
      </div>
    </div>
  )
}



// ─────────────────────────────────────────────────────────────
// Post-clean feedback gate
// ─────────────────────────────────────────────────────────────
function PostCleanFeedback({ user, onDone }) {
  const [type, setType]       = useState('general')
  const [text, setText]       = useState('')
  const [sending, setSending] = useState(false)

  const TYPES = [
    { id: 'general',  label: '💬 General' },
    { id: 'bug',      label: '🐛 Bug' },
    { id: 'idea',     label: '💡 Idea' },
    { id: 'praise',   label: '⭐ Praise' },
  ]

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      await fetch('https://euremlytics-2.onrender.com/feedback/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message: text, email: user?.email || null })
      })
    } catch(e) { /* silent fail — don't block user */ }
    finally { setSending(false); onDone() }
  }

  return (
    <div className="pf-overlay">
      <div className="pf-card">
        <div className="pf-head">
          <div className="pf-icon">✨</div>
          <div className="pf-title">Your data is clean!</div>
          <div className="pf-sub">Quick question before you download — what do you think of Oxdemi so far?</div>
        </div>
        <div className="pf-body">
          <label className="pf-label">Type</label>
          <div className="pf-types">
            {TYPES.map(t => (
              <button key={t.id} className={`pf-type${type===t.id?' selected':''}`} onClick={() => setType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <label className="pf-label">Message <span style={{color:'var(--red)'}}>*</span></label>
          <textarea
            className="pf-textarea"
            placeholder="Tell us what you think, what broke, or what you'd love to see…"
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
          />
          <button className="pf-submit" onClick={handleSubmit} disabled={sending || !text.trim()}>
            {sending ? 'Sending…' : 'Submit & Download →'}
          </button>
          <div className="pf-note">Takes 10 seconds · Helps us improve Oxdemi</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Feedback Widget
// ─────────────────────────────────────────────────────────────
function FeedbackWidget({ user }) {
  const [open, setOpen]       = useState(false)
  const [type, setType]       = useState('bug')
  const [text, setText]       = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  const TYPES = ['bug', 'idea', 'praise', 'other']

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      const res = await fetch('https://euremlytics-2.onrender.com/feedback/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:    type,
          message: text,
          email:   user?.email || null,
        })
      })
      if (!res.ok) throw new Error('Failed to send')
      setSent(true)
      setTimeout(() => { setSent(false); setText(''); setType('bug'); setOpen(false) }, 2500)
    } catch(e) {
      alert('Could not send feedback. Please try again.')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <button className="feedback-fab" onClick={() => setOpen(true)} title="Send feedback">
        💬
      </button>
      {open && (
        <div className="feedback-modal" onClick={() => setOpen(false)}>
          <div className="feedback-card" onClick={e => e.stopPropagation()}>
            <div className="feedback-head">
              <span className="feedback-title">Send feedback</span>
              <button className="feedback-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="feedback-body">
              {sent ? (
                <div className="feedback-success">
                  <div className="feedback-success-icon">✓</div>
                  Thanks for your feedback!
                </div>
              ) : (
                <>
                  <label className="feedback-label">Type</label>
                  <div className="feedback-types">
                    {TYPES.map(t => (
                      <button
                        key={t} className={`feedback-type${type===t?' selected':''}`}
                        onClick={() => setType(t)}
                      >
                        {t === 'bug' ? '🐛 Bug' : t === 'idea' ? '💡 Idea' : t === 'praise' ? '⭐ Praise' : '💬 Other'}
                      </button>
                    ))}
                  </div>
                  <label className="feedback-label">Message</label>
                  <textarea
                    className="feedback-textarea"
                    placeholder="Tell us what's on your mind…"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    autoFocus
                  />
                  <button
                    className="feedback-submit"
                    onClick={handleSubmit}
                    disabled={sending || !text.trim()}
                  >
                    {sending ? 'Sending…' : 'Send feedback →'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}


// ─────────────────────────────────────────────────────────────
// About Modal
// ─────────────────────────────────────────────────────────────
function AboutModal({ onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const STAGES = [
    { num: '01', name: 'Type Inference',    desc: 'Detects numeric, date, boolean, and text types across every column' },
    { num: '02', name: 'Normalisation',     desc: 'Standardises formats, strips whitespace, fixes casing and encoding' },
    { num: '03', name: 'Unit Expansion',    desc: 'Expands K/M/B shorthand in currency and numeric fields' },
    { num: '04', name: 'Missing Values',    desc: 'Imputes or drops based on configurable thresholds and strategies' },
    { num: '05', name: 'Deduplication',     desc: 'Detects and removes exact and near-duplicate rows' },
    { num: '06', name: 'Outlier Handling',  desc: 'IQR and Z-score methods — flag, cap, or remove outliers' },
    { num: '07', name: 'Quality Scoring',   desc: 'Scores every column 0–1 across completeness, consistency, validity' },
    { num: '08', name: 'Audit Trail',       desc: 'Every action logged with before/after counts and reasoning' },
  ]

  const PRINCIPLES = [
    { icon: '🔒', title: 'Your data stays yours',       desc: 'Files are processed entirely in memory. Nothing is stored, logged, or retained after your session ends. We have no access to your data.' },
    { icon: '⚡', title: 'Speed over ceremony',         desc: 'No configuration required. Upload a file and get a clean dataset in seconds. Experts can tune the pipeline; beginners get great results out of the box.' },
    { icon: '📋', title: 'Full transparency',           desc: 'Every change Oxdemi makes is recorded in a human-readable audit trail. You always know exactly what was changed and why.' },
    { icon: '🇳🇬', title: 'Built for African business data', desc: 'Naira formatting, K/M/B currency shorthand, Nigerian date formats, and mixed-language datasets are all handled natively.' },
  ]

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-card" onClick={e => e.stopPropagation()}>

        {/* Hero */}
        <div className="about-hero">
          <div className="about-hero-grid" />
          <button className="about-close-btn" onClick={onClose}>✕</button>
          <div className="about-logo-mark">OXD</div>
          <div className="about-hero-title">
            Make Your Business Data<br/><em>Reliable in Minutes.</em>
          </div>
          <div className="about-hero-sub">
            Oxdemi is an automated data cleaning engine for businesses and analysts who need to trust their data — without spending hours fixing spreadsheets by hand.
          </div>
        </div>

        <div className="about-body">

          {/* What is Oxdemi */}
          <div className="about-section">
            <div className="about-section-label">What is Oxdemi</div>
            <p className="about-p">
              Most business data is messy. Spreadsheets exported from accounting software, CRMs, and field surveys arrive with <strong>inconsistent formatting</strong>, <strong>missing values</strong>, <strong>duplicate rows</strong>, and <strong>hidden errors</strong> that quietly corrupt reports and dashboards.
            </p>
            <p className="about-p">
              Oxdemi is a <strong>one-click data cleaning engine</strong>. Upload your CSV or Excel file and our 8-stage pipeline automatically detects issues, fixes what can be fixed, flags what needs attention, and delivers a clean dataset with a full quality report — in seconds.
            </p>
            <p className="about-p">
              No code. No manual work. No data science degree required.
            </p>

            <div className="about-stats">
              {[
                { val: '8', lbl: 'Pipeline stages' },
                { val: '0', lbl: 'Lines of code needed' },
                { val: '∞', lbl: 'File types supported' },
              ].map(s => (
                <div className="about-stat" key={s.lbl}>
                  <div className="about-stat-val">{s.val}</div>
                  <div className="about-stat-lbl">{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>

          {/* The Pipeline */}
          <div className="about-section">
            <div className="about-section-label">The 8-Stage Pipeline</div>
            <p className="about-p">Every file runs through all 8 stages automatically. You can tune each stage in the Config panel before running.</p>
            <div className="about-stages">
              {STAGES.map(s => (
                <div className="about-stage" key={s.num}>
                  <div className="about-stage-num">{s.num}</div>
                  <div className="about-stage-name">{s.name}</div>
                  <div className="about-stage-desc">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Who it's for */}
          <div className="about-section">
            <div className="about-section-label">Who It's For</div>
            <p className="about-p">
              <strong>Finance teams</strong> tired of manually cleaning exports from QuickBooks, Sage, or bank statements before building reports. <strong>Operations managers</strong> dealing with messy inventory or logistics data. <strong>Marketers</strong> working with CRM exports full of duplicates and formatting inconsistencies. <strong>Consultants and analysts</strong> who receive client data in unpredictable shapes.
            </p>
            <p className="about-p">
              If you work with spreadsheets and you've ever spent more than 20 minutes cleaning a file — Oxdemi is for you.
            </p>
          </div>

          {/* Principles */}
          <div className="about-section">
            <div className="about-section-label">Our Principles</div>
            <div className="about-principles">
              {PRINCIPLES.map(p => (
                <div className="about-principle" key={p.title}>
                  <div className="about-principle-icon">{p.icon}</div>
                  <div className="about-principle-text">
                    <strong>{p.title}</strong>
                    {p.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What's next */}
          <div className="about-section">
            <div className="about-section-label">What's Coming</div>
            <p className="about-p">
              Oxdemi is actively being developed. On the roadmap: <strong>direct Google Sheets integration</strong>, <strong>scheduled cleaning jobs</strong>, <strong>team workspaces</strong>, <strong>API access</strong> for developers who want to embed cleaning into their own pipelines, and <strong>custom rule sets</strong> for domain-specific cleaning logic.
            </p>
            <p className="about-p">
              Have a feature request or a dataset that broke? Hit the feedback button — we read every message.
            </p>
          </div>

        </div>

        {/* Footer strip */}
        <div className="about-footer-strip">
          <span className="about-footer-tag">
            <strong>Oxdemi.io</strong> · Built in Nigeria 🇳🇬 · Raw in. Clean out.
          </span>
          <a className="about-contact-link" href="mailto:hello@oxdemi.io">hello@oxdemi.io</a>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Legal content
// ─────────────────────────────────────────────────────────────
const PRIVACY_CONTENT = (
  <>
    <h2>Introduction</h2>
    <p>Oxdemi.io ("we", "us", "our") is a data cleaning service operated in Nigeria. This Privacy Policy explains how we collect, use, and protect your information in accordance with the Nigeria Data Protection Regulation (NDPR) 2019.</p>
    <h2>Data We Collect</h2>
    <ul>
      <li><strong>Account data:</strong> Your email address and authentication provider when you create an account.</li>
      <li><strong>Payment data:</strong> Processed by Paystack. We do not store card numbers or sensitive payment details.</li>
      <li><strong>Usage data:</strong> Number of files processed, row counts, and subscription status.</li>
    </ul>
    <h2>Data We Do NOT Collect</h2>
    <p>Your uploaded CSV and Excel files are processed entirely in memory and are <strong>never stored, logged, or retained</strong>. Once your session ends (within 1 hour), all file data is permanently discarded.</p>
    <h2>How We Use Your Data</h2>
    <ul>
      <li>To provide and improve the Oxdemi service</li>
      <li>To manage your account and subscription</li>
      <li>To send important service updates (no marketing without consent)</li>
      <li>To enforce free tier row limits</li>
    </ul>
    <h2>Data Storage & Security</h2>
    <p>Account data is stored securely on Supabase (hosted on AWS). We use HTTPS/TLS encryption for all data in transit. We do not sell your data to third parties.</p>
    <h2>Third-Party Services</h2>
    <ul>
      <li><strong>Supabase</strong> — authentication and account storage</li>
      <li><strong>Paystack</strong> — payment processing</li>
      <li><strong>Render</strong> — backend server hosting</li>
      <li><strong>Vercel</strong> — frontend hosting</li>
    </ul>
    <h2>Your Rights (NDPR)</h2>
    <p>Under the NDPR, you have the right to access, correct, or delete your personal data. Contact us at <a href="mailto:hello@oxdemi.io">hello@oxdemi.io</a>.</p>
    <h2>Cookies</h2>
    <p>We use only essential session cookies required for authentication. We do not use advertising or tracking cookies.</p>
    <h2>Contact</h2>
    <p>For privacy enquiries: <a href="mailto:hello@oxdemi.io">hello@oxdemi.io</a></p>
    <div className="modal-updated">Last updated: February 2026 · Governed by Nigerian law (NDPR 2019)</div>
  </>
)

const TERMS_CONTENT = (
  <>
    <h2>Acceptance of Terms</h2>
    <p>By using Oxdemi.io you agree to these Terms of Service. If you do not agree, please do not use the service.</p>
    <h2>The Service</h2>
    <p>Oxdemi provides an automated data cleaning service. You upload CSV or Excel files; our engine normalises, imputes, deduplicates, and scores your data, then returns a cleaned file and quality report.</p>
    <h2>Free Tier</h2>
    <p>Free accounts may process files up to <strong>500 rows</strong>. Files exceeding this limit require a paid subscription.</p>
    <h2>Paid Tier</h2>
    <p>Paid subscribers may process unlimited rows. Payments are processed by Paystack and billed as described on the pricing page. Subscriptions auto-renew unless cancelled.</p>
    <h2>Your Data</h2>
    <p>You retain full ownership of all data you upload. We process files in memory and do not store or use your data beyond providing the cleaning service. See our Privacy Policy for full details.</p>
    <h2>Acceptable Use</h2>
    <ul>
      <li>Do not upload files containing illegal content</li>
      <li>Do not attempt to reverse-engineer or abuse the service</li>
      <li>Do not process data you do not have rights to</li>
      <li>Do not resell or redistribute the service without permission</li>
    </ul>
    <h2>Limitation of Liability</h2>
    <p>Oxdemi is provided "as is". We are not liable for data loss, inaccuracies in cleaned output, or business decisions made based on our reports. Always verify cleaned data before production use.</p>
    <h2>Governing Law</h2>
    <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
    <h2>Contact</h2>
    <p>For any queries: <a href="mailto:hello@oxdemi.io">hello@oxdemi.io</a></p>
    <div className="modal-updated">Last updated: February 2026 · Oxdemi.io, Nigeria</div>
  </>
)

function LegalModal({ type, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">
            {type === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
          </span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {type === 'privacy' ? PRIVACY_CONTENT : TERMS_CONTENT}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────
function AppFooter({ onPrivacy, onTerms, onAbout }) {
  return (
    <footer className="app-footer">
      <span className="footer-brand">
        <strong>Oxdemi.io</strong> · Raw in. Clean out. · © {new Date().getFullYear()}
      </span>
      <div className="footer-links">
        <button className="footer-link" onClick={onAbout}>About</button>
        <button className="footer-link" onClick={onPrivacy}>Privacy Policy</button>
        <button className="footer-link" onClick={onTerms}>Terms of Service</button>
        <a className="footer-link" href="mailto:hello@oxdemi.io">Contact</a>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────
const FREE_ROW_LIMIT = 999999

export default function App() {
  const [screen, setScreen]         = useState('upload')
  const [uploadData, setUploadData] = useState(null)
  const [result, setResult]         = useState(null)
  const [user, setUser]             = useState(null)
  const [authReason, setAuthReason] = useState(null)
  const [authChecked, setAuthChecked]   = useState(false)
  const [legalModal, setLegalModal]     = useState(null)
  const [showAbout, setShowAbout]         = useState(false)
  const [subscription, setSubscription] = useState('free')
  const [subChecked, setSubChecked]     = useState(false)
  const [prevScreen, setPrevScreen]     = useState('upload')
  const [feedbackDone, setFeedbackDone]   = useState(false)
  const [showFeedbackGate, setShowFeedbackGate] = useState(false)

  const fetchSubscription = async (token) => {
    try {
      const res = await fetch(
        'https://euremlytics-2.onrender.com/payments/subscription',
        { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }
      )
      if (res.ok) {
        const data = await res.json()
        setSubscription(data.status || 'free')
      } else {
        setSubscription('free')
      }
    } catch(e) {
      setSubscription('free')
    } finally {
      setSubChecked(true)
    }
  }

  // Verify payment when Paystack redirects back
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'verify') {
      const ref = params.get('trxref') || params.get('reference')
      if (ref) {
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname)
        // Verify with backend
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (!session) return
          try {
            const res = await fetch(
              `${import.meta.env.VITE_API_URL || 'https://euremlytics-2.onrender.com'}/payments/verify?reference=${ref}`,
              { headers: { 'Authorization': `Bearer ${session.access_token}` } }
            )
            const data = await res.json()
            if (data.status === 'active') setSubscription('active')
          } catch(e) { console.error('Payment verification failed', e) }
        })
      }
    }
  }, [])

  // Listen for auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      setAuthChecked(true)
      if (session?.access_token) fetchSubscription(session.access_token)
      else setSubChecked(true)
    })
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.access_token) fetchSubscription(session.access_token)
      else { setSubscription('free'); setSubChecked(true) }
      if (session?.user && screen === 'auth') setScreen('upload')
    })
    return () => authSub.unsubscribe()
  }, [])

  const handleUploaded = (data) => {
    // Not signed in → auth wall
    if (!user && data.rows > FREE_ROW_LIMIT) {
      setUploadData(data)
      setAuthReason('row_limit')
      setScreen('auth')
      return
    }
    // Signed in but free tier → paywall
    if (user && subscription !== 'active' && data.rows > FREE_ROW_LIMIT) {
      setUploadData(data)
      setScreen('paywall')
      return
    }
    setUploadData(data)
    setScreen('clean')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setScreen('upload')
    setUploadData(null)
    setResult(null)
  }

  const handleAuth = (authUser) => {
    setUser(authUser)
    // After sign in, if we hit row limit, continue to clean
    if (authReason === 'row_limit' && uploadData) {
      setAuthReason(null)
      setScreen('clean')
    } else {
      setScreen('upload')
    }
  }

  if (!authChecked) return null // wait for session check

  const stepIndex = { upload:0, clean:1, dashboard:2, report:2 }[screen] ?? 0

  return (
    <>
      <style>{G}</style>

      {screen === 'auth' ? (
        <>
          <AuthScreen
            onAuth={handleAuth}
            reason={authReason}
            onPrivacy={() => setLegalModal('privacy')}
            onTerms={() => setLegalModal('terms')}
          />
          {legalModal && (
            <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
          )}
        </>
      ) : (
        <>
          <Topbar
            step={stepIndex}
            sessionId={uploadData?.session_id}
            user={user}
            onSignIn={() => { setAuthReason('signin'); setScreen('auth') }}
            onSignOut={handleSignOut}
            onAccount={() => { setPrevScreen(screen); setScreen('account') }}
          />

          {screen === 'upload' && (
            <UploadScreen onUploaded={handleUploaded} />
          )}
          {screen === 'paywall' && (
            <PaywallScreen
              user={user}
              onBack={() => setScreen('upload')}
              onSubscribed={() => { setSubscription('active'); setScreen('clean') }}
            />
          )}
          {screen === 'account' && (
            <UserDashboard
              user={user}
              onBack={() => setScreen(prevScreen)}
              onUpgrade={() => setScreen('paywall')}
            />
          )}
          {screen === 'clean' && uploadData && (
            <CleanScreen uploadData={uploadData} onCleaned={r => { setResult(r); setScreen('dashboard') }} />
          )}
          {screen === 'dashboard' && result && (
            <Dashboard
              result={result}
              sessionId={uploadData.session_id}
              onViewReport={() => setScreen('report')}
              user={user}
              feedbackDone={feedbackDone}
              onNeedFeedback={() => setShowFeedbackGate(true)}
            />
          )}
          {screen === 'report' && (
            <ReportScreen sessionId={uploadData.session_id} onBack={() => setScreen('dashboard')} user={user} feedbackDone={feedbackDone} onNeedFeedback={() => setShowFeedbackGate(true)} />
          )}

          <AppFooter
            onPrivacy={() => setLegalModal('privacy')}
            onTerms={() => setLegalModal('terms')}
            onAbout={() => setShowAbout(true)}
          />

          {legalModal && (
            <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />
          )}

          {showAbout && (
            <AboutModal onClose={() => setShowAbout(false)} />
          )}

          {showFeedbackGate && !feedbackDone && (
            <PostCleanFeedback user={user} onDone={() => { setFeedbackDone(true); setShowFeedbackGate(false) }} />
          )}

          <FeedbackWidget user={user} />
        </>
      )}
    </>
  )
}
