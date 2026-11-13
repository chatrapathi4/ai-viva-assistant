import { useEffect, useState } from 'react'
import { ClipboardCheck, Sparkles, RefreshCw } from 'lucide-react'
import { resultsRequest } from '../../services/resultsApi'

const input = 'w-full rounded-xl border border-border bg-background p-3 text-foreground'

export default function FacultyResults() {
  const [queue, setQueue] = useState([])
  const [selected, setSelected] = useState(null)
  const [grades, setGrades] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadQueue() {
    setQueue(await resultsRequest('/queue'))
  }

  async function openAttempt(id) {
    setError('')
    setMessage('')
    const d = await resultsRequest(`/${id}`)
    setSelected(d)
    setGrades(Object.fromEntries(d.grades.map(g => [g.question_number, {
      final_marks: Number(g.final_marks),
      feedback: g.faculty_feedback || '',
    }])))
  }

  useEffect(() => {
    let active = true
    resultsRequest('/queue').then(data => {
      if (active) setQueue(data)
    }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [])

  async function action(fn) {
    setBusy(true)
    setError('')
    setMessage('')
    try { await fn() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const gradeFor = n => selected?.grades.find(g => g.question_number === n)

  return (
    <div className="space-y-7">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold"><ClipboardCheck className="text-primary"/> Viva Results</h1>
        <p className="mt-2 text-muted">AI suggests marks; faculty reviews every question before publishing.</p>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-500/10 p-4 text-red-600 dark:text-red-400">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-soft p-4 text-primary">{message}</p>}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Student Attempts</h2>
          <button onClick={() => action(loadQueue)} disabled={busy} className="flex items-center gap-2 text-primary"><RefreshCw size={17}/> Refresh</button>
        </div>
        {queue.length === 0 ? <p className="text-muted">No attempts yet.</p> : (
          <div className="space-y-2">{queue.map(a => (
            <button key={a.attempt_id} onClick={() => action(() => openAttempt(a.attempt_id))}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-left hover:bg-soft">
              <div><p className="font-semibold">{a.student_name || 'Student'}</p><p className="text-sm text-muted">{a.assessment_title}</p></div>
              <div className="text-right text-xs text-muted"><p>{a.attempt_status}</p><p>{a.result_status.replaceAll('_', ' ')}</p></div>
            </button>
          ))}</div>
        )}
      </section>
      {selected && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-semibold">{selected.student_name} — {selected.assessment_title}</h2>
              <p className="text-sm text-muted">Attempt: {selected.attempt_status} · Result: {selected.result_status}</p></div>
            <button disabled={busy || selected.attempt_status !== 'submitted' || selected.result_status === 'published'}
              onClick={() => action(async () => {
                if (selected.grades.length && !window.confirm('Regenerate AI grades and discard existing faculty reviews?')) return
                await resultsRequest(`/${selected.attempt_id}/evaluate`, {method: 'POST'})
                await openAttempt(selected.attempt_id)
                await loadQueue()
                setMessage('AI evaluation saved. Review all questions.')
              })}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary disabled:opacity-50">
              <Sparkles size={18}/> Evaluate with AI
            </button>
          </div>
          {selected.questions.map(q => {
            const g = gradeFor(q.number)
            const edit = grades[q.number] || {final_marks: Number(g?.final_marks || 0), feedback: ''}
            return <div className="space-y-3 rounded-2xl border border-border bg-surface p-6" key={q.number}>
              <h3 className="font-semibold">Question {q.number} · {q.max_marks} marks</h3>
              <p>{q.question}</p>
              <div><p className="text-xs font-semibold text-muted">Student transcript</p><p className="mt-1 rounded-lg bg-background p-3 text-sm">{q.answer || '(No answer submitted)'}</p></div>
              <div><p className="text-xs font-semibold text-muted">Reference answer</p><p className="mt-1 text-sm">{q.reference_answer}</p></div>
              <p className="text-sm text-muted">Rubric: {q.grading_rubric}</p>
              {g && <div className="rounded-lg bg-soft p-3 text-sm"><p>AI: {g.ai_marks}/{g.max_marks} · Faculty: {g.final_marks}/{g.max_marks} {g.reviewed ? '(Reviewed)' : '(Needs review)'}</p><p className="mt-1">{g.ai_feedback}</p></div>}
              {g && selected.result_status !== 'published' && (
                <div className="space-y-3">
                  <label className="block text-sm">Final marks
                    <input type="number" step="0.5" min="0" max={q.max_marks} className={input} value={edit.final_marks}
                      onChange={e => setGrades(p => ({...p, [q.number]: {...edit, final_marks: e.target.value}}))}/>
                  </label>
                  <label className="block text-sm">Faculty feedback
                    <textarea className={input} maxLength={2000} rows={2} value={edit.feedback}
                      onChange={e => setGrades(p => ({...p, [q.number]: {...edit, feedback: e.target.value}}))}/>
                  </label>
                  <button disabled={busy} onClick={() => action(async () => {
                    await resultsRequest(`/${selected.attempt_id}/grades/${q.number}`, {
                      method: 'PATCH', body: JSON.stringify({final_marks: Number(edit.final_marks), feedback: edit.feedback})
                    })
                    await openAttempt(selected.attempt_id)
                    setMessage(`Question ${q.number} reviewed.`)
                  })} className="rounded-xl border border-border px-4 py-2 hover:bg-soft">Save & Mark Reviewed</button>
                </div>
              )}
            </div>
          })}
          {selected.grades.length > 0 && selected.result_status !== 'published' && (
            <button disabled={busy || selected.grades.some(g => !g.reviewed)} onClick={() => action(async () => {
              if (!window.confirm('Publish final marks and feedback to the student?')) return
              const result = await resultsRequest(`/${selected.attempt_id}/publish`, {method:'POST'})
              await openAttempt(selected.attempt_id)
              await loadQueue()
              setMessage(`Published: ${result.score}/${result.max_marks}`)
            })} className="rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary disabled:opacity-50">Publish Reviewed Result</button>
          )}
        </section>
      )}
    </div>
  )
}
