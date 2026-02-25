/**
 * api/client.js
 * All communication with the FastAPI backend.
 * Vite proxy rewrites /api/* → http://127.0.0.1:8000/*
 */

const BASE = import.meta.env.VITE_API_URL || '/api'
```

And add a `.env` file inside `frontend/`:
```
VITE_API_URL=https://euremlytics-2.onrender.com/

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res
}

/** Upload a File object. Returns { session_id, rows, columns, filename, ... } */
export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await request('/upload/', { method: 'POST', body: form })
  return res.json()
}

/** Run the cleaning pipeline. Returns CleaningResponse JSON. */
export async function cleanData(sessionId, configOverrides = {}) {
  const params = new URLSearchParams({ session_id: sessionId, ...configOverrides })
  const res = await request(`/clean/?${params}`, { method: 'POST' })
  return res.json()
}

/** CSV download URL — use as href or window.location */
export function csvDownloadUrl(sessionId) {
  return `${BASE}/report/csv?session_id=${sessionId}`
}

/** PDF download URL */
export function pdfDownloadUrl(sessionId) {
  return `${BASE}/report/pdf?session_id=${sessionId}`
}

/** HTML report URL — open in iframe or new tab */
export function reportHtmlUrl(sessionId) {
  return `${BASE}/report/html?session_id=${sessionId}`

}
