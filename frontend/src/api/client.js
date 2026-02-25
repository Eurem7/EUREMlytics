const BASE = import.meta.env.VITE_API_URL || 'https://euremlytics-2.onrender.com'

export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload/`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function cleanData(sessionId, configOverrides = {}) {
  const params = new URLSearchParams({ session_id: sessionId, ...configOverrides })
  const res = await fetch(`${BASE}/clean/?${params}`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const csvDownloadUrl  = (sid) => `${BASE}/report/csv?session_id=${sid}`
export const pdfDownloadUrl  = (sid) => `${BASE}/report/pdf?session_id=${sid}`
export const reportHtmlUrl   = (sid) => `${BASE}/report/html?session_id=${sid}`

