
import { getAuthToken } from '../lib/supabase.js'

const BASE = import.meta.env.VITE_API_URL || 'https://euremlytics-2.onrender.com'

async function request(path, options = {}) {
  const token = await getAuthToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers })
  } catch (networkErr) {
   
    throw new Error(
      'Could not reach the server. This usually means your session expired — please re-upload your file.'
    )
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {}

    // 404 on /clean/ = session expired (server restarted)
    if (res.status === 404 && path.includes('/clean/')) {
      throw new Error('Session expired — please re-upload your file to start a new session.')
    }
    // 403 = row limit / subscription needed
    if (res.status === 403) {
      throw new Error(detail)
    }

    throw new Error(detail)
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


