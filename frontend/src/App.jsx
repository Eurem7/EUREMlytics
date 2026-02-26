import { useState, useCallback, useRef, useEffect } from 'react'
import { uploadFile, cleanData, csvDownloadUrl, pdfDownloadUrl, reportHtmlUrl } from './api/client.js'

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
.clean-sub { color: var(--text2); font-size: 0.88rem; margin-bottom: 2.5rem; }

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
@media (max-width: 680px) {
  .stat-strip, .stat-strip-2 { grid-template-columns: repeat(2,1fr); }
  .steps-grid { grid-template-columns: repeat(4,1fr); }
  .dash-header { flex-direction: column; }
  .audit-row, .audit-head { grid-template-columns: 1fr; }
  .audit-cell, .audit-hcell { border-right: none; border-bottom: 1px solid var(--border); }
  .audit-cell:last-child, .audit-hcell:last-child { border-bottom: none; }
  .report-body { padding: 0.75rem; }
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
function Topbar({ step, sessionId }) {
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
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────
function UploadScreen({ onUploaded }) {
  const [file, setFile]       = useState(null)
  const [drag, setDrag]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
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

  const submit = async () => {
    if (!file) return
    setLoading(true); setError('')
    try { onUploaded(await uploadFile(file)) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="page">
      <div className="upload-layout">
        {/* Left — hero text */}
        <div className="upload-hero-text anim-fade-up">
          <div className="upload-eyebrow">Data Cleaning Engine</div>
          <h1 className="upload-h1">
            Raw in.<br/><em>Clean out.</em>
          </h1>
          <p className="upload-sub">
            Upload any CSV or Excel file. Oxdemi normalises, imputes, deduplicates, and scores every column — instantly.
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
          <div
            className={`dropzone${drag?' drag':''}`}
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={e => { pick(e.target.files[0]); e.target.value = '' }} />
            <div className="dz-icon">
              {file ? '📄' : '📂'}
            </div>
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
            <button className="btn btn-primary btn-lg" onClick={submit} disabled={!file || loading}>
              {loading ? 'Uploading…' : 'Upload & Continue →'}
            </button>
          </div>
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
                <div className="config-grid">

                  {/* Outlier action */}
                  <div className="config-field">
                    <label className="config-label">
                      Outlier Action <span>what to do with outliers</span>
                    </label>
                    <select className="config-select" value={cfg.outlier_action} onChange={e => set('outlier_action', e.target.value)}>
                      <option value="none">None — detect only, log to audit</option>
                      <option value="flag">Flag — add _is_outlier columns</option>
                      <option value="cap">Cap — winsorise to IQR bounds</option>
                      <option value="remove">Remove — drop outlier rows</option>
                    </select>
                  </div>

                  {/* Outlier method */}
                  <div className="config-field">
                    <label className="config-label">
                      Outlier Detection <span>algorithm</span>
                    </label>
                    <select className="config-select" value={cfg.outlier_method} onChange={e => set('outlier_method', e.target.value)}>
                      <option value="iqr">IQR — interquartile range</option>
                      <option value="zscore">Z-Score — standard deviations</option>
                    </select>
                  </div>

                  {/* IQR multiplier */}
                  {cfg.outlier_method === 'iqr' && (
                    <div className="config-field">
                      <label className="config-label">
                        IQR Multiplier <span>lower = stricter</span>
                      </label>
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

                  {/* Z-score threshold */}
                  {cfg.outlier_method === 'zscore' && (
                    <div className="config-field">
                      <label className="config-label">
                        Z-Score Threshold <span>lower = stricter</span>
                      </label>
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

                  <div className="config-divider" />

                  {/* Numeric imputation */}
                  <div className="config-field">
                    <label className="config-label">
                      Numeric Missing <span>fill strategy</span>
                    </label>
                    <select className="config-select" value={cfg.impute_numeric_strategy} onChange={e => set('impute_numeric_strategy', e.target.value)}>
                      <option value="median">Median</option>
                      <option value="mean">Mean</option>
                      <option value="zero">Zero</option>
                    </select>
                  </div>

                  {/* Categorical imputation */}
                  <div className="config-field">
                    <label className="config-label">
                      Categorical Missing <span>fill strategy</span>
                    </label>
                    <select className="config-select" value={cfg.impute_categorical_strategy} onChange={e => set('impute_categorical_strategy', e.target.value)}>
                      <option value="mode">Mode (most frequent)</option>
                      <option value="none">Leave as missing</option>
                    </select>
                  </div>

                  {/* Missing drop threshold */}
                  <div className="config-field">
                    <label className="config-label">
                      Drop Column Threshold <span>% missing before drop</span>
                    </label>
                    <div className="config-slider-wrap">
                      <input type="range" className="config-slider"
                        min="0.3" max="1" step="0.05"
                        value={cfg.missing_drop_threshold}
                        onChange={e => set('missing_drop_threshold', parseFloat(e.target.value))}
                      />
                      <span className="config-slider-val">{Math.round(cfg.missing_drop_threshold * 100)}%</span>
                    </div>
                  </div>

                  <div className="config-footer">
                    <button className="config-reset" onClick={reset}>↺ Reset to defaults</button>
                    <span className="config-hint">defaults are recommended for most datasets</span>
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
function Dashboard({ result, sessionId, onViewReport }) {
  const quality    = result.column_quality_summary || []
  const audit      = result.audit_log || []
  const cleanShape = result.cleaned_shape || [0,0]
  const origShape  = result.original_shape || [0,0]

  const dropped    = quality.filter(q => q.dropped).length
  const nGood      = quality.filter(q => !q.dropped && q.quality_score >= 0.85).length
  const nWarn      = quality.filter(q => !q.dropped && q.quality_score >= 0.60 && q.quality_score < 0.85).length
  const nBad       = quality.filter(q => !q.dropped && q.quality_score < 0.60).length
  const avgScore   = quality.length ? (quality.reduce((s,q) => s + q.quality_score, 0) / quality.length).toFixed(2) : 0

  const typeBreakdown = quality.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1; return acc
  }, {})

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
          <a className="btn btn-ghost btn-sm" href={csvDownloadUrl(sessionId)} download>↓ CSV</a>
          <a className="btn btn-ghost btn-sm" href={pdfDownloadUrl(sessionId)} download>↓ PDF</a>
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

      {/* Audit log */}
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────
function ReportScreen({ sessionId, onBack }) {
  return (
    <div style={{display:'flex', flexDirection:'column', height:'calc(100vh - 52px)'}}>
      <div className="report-topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Dashboard</button>
        <span className="report-label">Full Quality Report</span>
        <div style={{marginLeft:'auto', display:'flex', gap:'0.5rem'}}>
          <a className="btn btn-ghost btn-sm" href={csvDownloadUrl(sessionId)} download>↓ CSV</a>
          <a className="btn btn-green-solid btn-sm" href={pdfDownloadUrl(sessionId)} download>↓ PDF</a>
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
// Root
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]         = useState('upload')
  const [uploadData, setUploadData] = useState(null)
  const [result, setResult]         = useState(null)

  const stepIndex = { upload:0, clean:1, dashboard:2, report:2 }[screen] ?? 0

  return (
    <>
      <style>{G}</style>
      <Topbar step={stepIndex} sessionId={uploadData?.session_id} />

      {screen === 'upload' && (
        <UploadScreen onUploaded={d => { setUploadData(d); setScreen('clean') }} />
      )}
      {screen === 'clean' && uploadData && (
        <CleanScreen uploadData={uploadData} onCleaned={r => { setResult(r); setScreen('dashboard') }} />
      )}
      {screen === 'dashboard' && result && (
        <Dashboard
          result={result}
          sessionId={uploadData.session_id}
          onViewReport={() => setScreen('report')}
        />
      )}
      {screen === 'report' && (
        <ReportScreen sessionId={uploadData.session_id} onBack={() => setScreen('dashboard')} />
      )}
    </>
  )
}
