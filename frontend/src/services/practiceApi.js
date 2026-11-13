import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_API_URL

async function request(path, options = {}) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Please sign in again.')
  const res = await fetch(`${BASE}/api/practice${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || 'Practice request failed')
  return body
}

export const generatePractice = data =>
  request('/generate', { method: 'POST', body: JSON.stringify(data) })
export const getPractice = id => request(`/${id}`)
export const listPractice = () => request('/history')
export const submitPractice = (id, answers) =>
  request(`/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) })
