import { useEffect, useState } from 'react'
import { Award } from 'lucide-react'
import { resultsRequest } from '../../services/resultsApi'

export default function StudentResults() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    resultsRequest('/mine').then(rows => {if (active) setResults(rows)})
      .catch(e => {if (active) setError(e.message)})
      .finally(() => {if (active) setLoading(false)})
    return () => {active = false}
  }, [])

  return <div className="space-y-7">
    <div><h1 className="flex items-center gap-3 text-3xl font-bold"><Award className="text-primary"/> My Results</h1>
      <p className="mt-2 text-muted">Only results released by your faculty are displayed here.</p></div>
    {error && <p role="alert" className="text-red-600 dark:text-red-400">{error}</p>}
    {loading ? <p className="text-muted">Loading...</p> : results.length === 0 ?
      <p className="rounded-2xl border border-border bg-surface p-8 text-muted">No published results yet.</p> :
      results.map((r,i) => <section key={i} className="space-y-4 rounded-2xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{r.title}</h2><p className="text-sm text-muted">Published {new Date(r.published_at).toLocaleString()}</p></div>
          <strong className="text-2xl text-primary">{r.score}/{r.max_marks}</strong>
        </div>
        <div className="space-y-3">{r.feedback?.map(g => <div key={g.question_number} className="rounded-xl border border-border p-4">
          <p className="font-medium">Question {g.question_number} — {g.marks}/{g.max_marks}</p>
          <p className="mt-2 text-sm text-muted">{g.feedback}</p>
        </div>)}</div>
      </section>)
    }
  </div>
}
