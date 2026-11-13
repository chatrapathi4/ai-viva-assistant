
import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL

export async function generateAIQuestions(payload) {
  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session) {
    throw new Error('Please sign in again.')
  }

  const response = await fetch(
    `${API_URL}/api/questions/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify(payload),
    }
  )

  const result = await response.json()

  if (!response.ok) {
    throw new Error(
      typeof result.detail === 'string'
        ? result.detail
        : 'Unable to generate questions.'
    )
  }

  return result
}
