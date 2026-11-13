import { useEffect, useState } from 'react'
import { BookOpen, Sparkles, CheckCircle2, RotateCcw, LoaderCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generatePractice, getPractice, listPractice, submitPractice } from '../../services/practiceApi'

const input = 'w-full rounded-xl border border-border bg-background p-3 text-foreground outline-none focus:border-primary'

export default function PracticeQuizzes() {
  const [courses, setCourses] = useState([])
  const [history, setHistory] = useState([])
  const [form, setForm] = useState({ course_id: '', topic: '', difficulty: 'medium', question_count: 5 })
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function refreshHistory() {
    setHistory(await listPractice())
  }

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) return
        const { data, error: queryError } = await supabase
          .from('enrollments')
          .select('course_id,courses(title,code)')
          .eq('student_id', userData.user.id)
        if (queryError) throw queryError
        const past = await listPractice()
        if (active) {
          setCourses(data ?? [])
          setHistory(past)
          setForm(f => ({ ...f, course_id: data?.[0]?.course_id ?? '' }))
        }
      } catch (e) {
        if (active) setError(e.message)
      }
    }
    load()
    return () => { active = false }
  }, [])

  async function createQuiz(event) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const q = await generatePractice({ ...form, question_count: Number(form.question_count) })
      setQuiz(q)
      setAnswers(Array(q.questions.length).fill(null))
      await refreshHistory()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function openQuiz(id) {
    setBusy(true); setError('')
    try {
      const q = await getPractice(id)
      setQuiz(q)
      setAnswers(q.answers ?? Array(q.questions.length).fill(null))
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function submitQuiz() {
    if (!quiz || quiz.status !== 'in_progress') return
    if (!window.confirm('Submit this practice quiz? You cannot change answers afterwards.')) return
    setBusy(true); setError('')
    try {
      const result = await submitPractice(quiz.id, answers)
      setQuiz(result)
      await refreshHistory()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const finished = quiz?.status === 'completed'

  return (
    <div className="space-y-7">
      <header>
        <h1 className="flex items-center gap-3 text-3xl font-bold"><Sparkles className="text-primary"/> AI Practice Quizzes</h1>
        <p className="mt-2 text-muted">Practice course topics and get instant feedback. These scores do not affect faculty viva marks.</p>
      </header>
      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-600 dark:text-red-400">{error}</div>}
      <form onSubmit={createQuiz} className="space-y-4 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-xl font-semibold">Generate a new quiz</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">Course
            <select required className={input} value={form.course_id} onChange={e => setForm({...form,course_id:e.target.value})}>
              <option value="">Select enrolled course</option>
              {courses.map(c => <option key={c.course_id} value={c.course_id}>{c.courses?.title} ({c.courses?.code})</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm">Topic
            <input required minLength={3} maxLength={150} className={input} placeholder="e.g. SQL Joins" value={form.topic} onChange={e => setForm({...form,topic:e.target.value})}/>
          </label>
          <label className="space-y-2 text-sm">Difficulty
            <select className={input} value={form.difficulty} onChange={e => setForm({...form,difficulty:e.target.value})}>
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">Questions (1–10)
            <input className={input} type="number" min="1" max="10" required value={form.question_count} onChange={e => setForm({...form,question_count:Number(e.target.value)})}/>
          </label>
        </div>
        <button disabled={busy || !form.course_id} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary disabled:opacity-50">
          {busy ? <LoaderCircle className="animate-spin" size={18}/> : <Sparkles size={18}/>} Generate Quiz
        </button>
      </form>

      {quiz && <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{quiz.topic}</h2><p className="text-sm capitalize text-muted">{quiz.difficulty} • {quiz.questions.length} questions</p></div>
          {finished && <span className="rounded-full bg-soft px-4 py-2 font-semibold text-primary">Score: {quiz.correct_count} / {quiz.questions.length} ({Math.round(quiz.correct_count / quiz.questions.length * 100)}%)</span>}
        </div>
        {quiz.questions.map((q, i) => {
          const selected = answers[i]
          return <article key={i} className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="mb-4 font-semibold">{i+1}. {q.question}</h3>
            <div className="space-y-2">
              {q.options.map((option,j) => <label key={j} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${selected===j ? 'border-primary bg-soft' : 'border-border'} ${finished ? 'cursor-default' : ''}`}>
                <input disabled={finished} type="radio" name={`question-${i}`} checked={selected===j} onChange={()=>setAnswers(a=>a.map((v,k)=>k===i?j:v))} className="mt-1 accent-emerald-700"/>
                <span className="text-sm">{String.fromCharCode(65+j)}. {option}</span>
              </label>)}
            </div>
            {finished && <div className="mt-4 space-y-2 rounded-xl bg-soft p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-primary"><CheckCircle2 size={17}/> Correct answer: {String.fromCharCode(65+q.correct_index)} — {q.options[q.correct_index]}</div>
              <p>{q.explanation}</p>
            </div>}
          </article>
        })}
        {!finished && <button disabled={busy} onClick={submitQuiz} className="rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary disabled:opacity-50">{busy ? 'Submitting...' : 'Submit Quiz'}</button>}
      </section>}

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><BookOpen className="text-primary"/> Recent Practice</h2>
        {!history.length && <p className="text-muted">No practice attempts yet.</p>}
        <div className="space-y-3">
          {history.map(h => <button type="button" key={h.id} onClick={()=>openQuiz(h.id)} disabled={busy} className="flex w-full items-center justify-between rounded-xl border border-border p-4 text-left hover:bg-soft disabled:opacity-50">
            <div><p className="font-semibold">{h.topic}</p><p className="text-xs text-muted">{new Date(h.created_at).toLocaleString()} • {h.difficulty}</p></div>
            <span className="flex items-center gap-2 text-sm text-primary">{h.status === 'completed' ? `${h.correct_count}/${h.question_count}` : 'Resume'} <RotateCcw size={16}/></span>
          </button>)}
        </div>
      </section>
    </div>
  )
}
