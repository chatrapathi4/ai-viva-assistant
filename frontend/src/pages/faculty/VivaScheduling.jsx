
import { useEffect, useState } from 'react'
import { CalendarClock, Users, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const inputClass =
  'w-full rounded-xl border border-border bg-background p-3 text-foreground outline-none focus:border-primary'

export default function VivaScheduling() {
  const { user } = useAuth()

  const [banks, setBanks] = useState([])
  const [batches, setBatches] = useState([])
  const [assessments, setAssessments] = useState([])
  const [counts, setCounts] = useState({})
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    question_bank_id: '',
    batch_id: '',
    title: '',
    starts_at: '',
    ends_at: '',
    duration_minutes: 15,
  })

  async function loadData() {
    const [bankResult, batchResult, assessmentResult] =
      await Promise.all([
        supabase
          .from('question_banks')
          .select('id, course_id, topic, difficulty, question_count, marks_per_question, courses(title, code)')
          .eq('faculty_id', user.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false }),

        supabase
          .from('batches')
          .select('id, course_id, name, sections(name)')
          .order('name'),

        supabase
          .from('assessments')
          .select('id, title, starts_at, ends_at, duration_minutes, status, batches(name)')
          .eq('faculty_id', user.id)
          .order('starts_at', { ascending: false }),
      ])

    if (bankResult.error) throw bankResult.error
    if (batchResult.error) throw batchResult.error
    if (assessmentResult.error) throw assessmentResult.error

    const bankRows = bankResult.data ?? []
    const batchRows = batchResult.data ?? []

    setBanks(bankRows)
    setBatches(batchRows)
    setAssessments(assessmentResult.data ?? [])

    if (batchRows.length) {
      const { data, error: countError } = await supabase
        .from('batch_members')
        .select('batch_id')
        .in('batch_id', batchRows.map(b => b.id))

      if (countError) throw countError

      const totals = {}
      for (const row of data ?? []) {
        totals[row.batch_id] = (totals[row.batch_id] ?? 0) + 1
      }
      setCounts(totals)
    } else {
      setCounts({})
    }
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      try {
        await loadData()
      } catch (err) {
        if (mounted) setError(err.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initialize()
    return () => { mounted = false }
  }, [user.id])

  const selectedBank = banks.find(
    b => b.id === form.question_bank_id
  )

  const eligibleBatches = batches.filter(
    b => b.course_id === selectedBank?.course_id
  )

  function update(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value,
      ...(field === 'question_bank_id'
        ? { batch_id: '' }
        : {}),
    }))
  }

  async function handleSchedule(e) {
    e.preventDefault()
    setError('')
    setMessage('')

    const start = new Date(form.starts_at)
    const end = new Date(form.ends_at)

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start <= new Date() ||
      end <= start
    ) {
      setError('Choose a valid future start and end time.')
      return
    }

    if (!form.batch_id) {
      setError('Select a batch.')
      return
    }

    if (!window.confirm(
      'Schedule this viva and assign question sets to all current batch members?'
    )) return

    setBusy(true)

    try {
      const { error } = await supabase.rpc('schedule_viva', {
        p_question_bank_id: form.question_bank_id,
        p_batch_id: form.batch_id,
        p_title: form.title.trim(),
        p_starts_at: start.toISOString(),
        p_ends_at: end.toISOString(),
        p_duration_minutes: Number(form.duration_minutes),
      })

      if (error) throw error

      await loadData()

      setForm({
        question_bank_id: '',
        batch_id: '',
        title: '',
        starts_at: '',
        ends_at: '',
        duration_minutes: 15,
      })

      setMessage('Viva scheduled and students assigned successfully.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-muted">Loading scheduling data...</p>
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <CalendarClock className="text-primary" />
          Schedule Voice Viva
        </h1>
        <p className="mt-2 text-muted">
          Assign approved AI question sets to student batches.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {message && (
        <p role="status" className="rounded-xl bg-soft p-4 text-sm text-primary">
          {message}
        </p>
      )}

      <form
        onSubmit={handleSchedule}
        className="space-y-5 rounded-2xl border border-border bg-surface p-6"
      >
        <h2 className="text-xl font-semibold">New Assessment</h2>

        <label className="block space-y-2 text-sm">
          <span>Approved Question Bank</span>
          <select
            required
            className={inputClass}
            value={form.question_bank_id}
            onChange={e => update('question_bank_id', e.target.value)}
          >
            <option value="">Select question bank</option>
            {banks.map(bank => (
              <option key={bank.id} value={bank.id}>
                {bank.courses?.code} — {bank.topic}
              </option>
            ))}
          </select>
        </label>

        {selectedBank && (
          <div className="rounded-xl bg-soft p-4 text-sm">
            <p className="font-medium text-primary">
              {selectedBank.courses?.title}
            </p>
            <p className="mt-1 text-muted">
              {selectedBank.question_count} questions per set ·{' '}
              {selectedBank.marks_per_question} marks each ·{' '}
              {selectedBank.difficulty}
            </p>
          </div>
        )}

        <label className="block space-y-2 text-sm">
          <span>Student Batch</span>
          <select
            required
            disabled={!selectedBank}
            className={inputClass}
            value={form.batch_id}
            onChange={e => update('batch_id', e.target.value)}
          >
            <option value="">Select batch</option>
            {eligibleBatches.map(batch => (
              <option key={batch.id} value={batch.id}>
                {batch.name} — Section {batch.sections?.name}
                {' '}({counts[batch.id] ?? 0} students)
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2 text-sm">
          <span>Viva Title</span>
          <input
            required
            minLength={3}
            maxLength={150}
            className={inputClass}
            placeholder="Example: DBMS Lab Viva 1"
            value={form.title}
            onChange={e => update('title', e.target.value)}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span>Start Date & Time</span>
            <input
              required
              type="datetime-local"
              className={inputClass}
              value={form.starts_at}
              onChange={e => update('starts_at', e.target.value)}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span>End Date & Time</span>
            <input
              required
              type="datetime-local"
              className={inputClass}
              value={form.ends_at}
              onChange={e => update('ends_at', e.target.value)}
            />
          </label>
        </div>

        <label className="block space-y-2 text-sm">
          <span>Time Allowed Per Student (minutes)</span>
          <input
            type="number"
            required
            min={5}
            max={120}
            className={inputClass}
            value={form.duration_minutes}
            onChange={e =>
              update('duration_minutes', Number(e.target.value))
            }
          />
        </label>

        <button
          type="submit"
          disabled={busy || !selectedBank || !form.batch_id}
          className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
        >
          <CheckCircle2 size={19} />
          {busy ? 'Scheduling...' : 'Publish Schedule'}
        </button>
      </form>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Scheduled Assessments</h2>

        {assessments.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-muted">
            No assessments scheduled yet.
          </p>
        ) : (
          assessments.map(a => (
            <div
              key={a.id}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    <Users className="mr-1 inline" size={15} />
                    {a.batches?.name}
                  </p>
                </div>
                <span className="rounded-full bg-soft px-3 py-1 text-xs capitalize text-primary">
                  {a.status}
                </span>
              </div>

              <p className="mt-3 text-sm text-muted">
                {new Date(a.starts_at).toLocaleString()}
                {' — '}
                {new Date(a.ends_at).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted">
                {a.duration_minutes} minutes per student
              </p>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
