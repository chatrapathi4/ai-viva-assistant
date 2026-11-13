import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_API_URL

export async function resultsRequest(path, options = {}) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Please sign in again')

  const response = await fetch(`${BASE}/api/results${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.detail || 'Request failed')
  return result
}
