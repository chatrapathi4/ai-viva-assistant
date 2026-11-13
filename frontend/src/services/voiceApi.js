// frontend/src/services/voiceApi.js
import { supabase } from '../lib/supabase'

const BASE = import.meta.env.VITE_API_URL

async function send(path, payload) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Please sign in again.')

  const response = await fetch(`${BASE}/api/voice/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json()
  if (!response.ok) throw new Error(result.detail || 'Request failed')
  return result
}

export const startViva = (assignment_id) => send('start', { assignment_id })
export const saveAnswer = (attempt_id, question_number, answer) =>
  send('answer', { attempt_id, question_number, answer })
export const finishViva = (attempt_id) => send('finish', { attempt_id })
