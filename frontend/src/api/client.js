/**
 * api/client.js
 * All communication with the FastAPI backend.
 */
import { getAuthToken } from '../lib/supabase.js'

const BASE = import.meta.env.VITE_API_URL || 'https://euremlytics-2.onrender.com'

async function request(path, options = {}) {
  // Attach auth token if user is signed in
  const token = await getAuthToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res
}

export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await request('/upload/', { method: 'POST', body: form })
  return res.json()
}

export async function cleanData(sessionId, configOverrides = {}) {
  const params = new URLSearchParams({ session_id: sessionId })
  Object.entries(configOverrides).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.append(k, v)
  })
  const res = await request(`/clean/?${params}`, { method: 'POST' })
  return res.json()
}

export const csvDownloadUrl  = (sid) => `${BASE}/report/csv?session_id=${sid}`
export const pdfDownloadUrl  = (sid) => `${BASE}/report/pdf?session_id=${sid}`
export const reportHtmlUrl   = (sid) => `${BASE}/report/html?session_id=${sid}`
