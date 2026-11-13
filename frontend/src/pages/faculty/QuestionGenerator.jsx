
import { useEffect, useState } from 'react'
import {
  Sparkles,
  Save,
  CheckCircle,
  BookOpen,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { generateAIQuestions } from '../../services/api'

const initialForm = {
  course_id: '',
  topic: '',
  difficulty: 'medium',
  question_count: 5,
  marks_per_question: 2,
}

const inputClass =
  'w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-primary'

function validateSets(sets, count) {
  if (
    !Array.isArray(sets) ||
    sets.length !== 3 ||
    sets.map(s => s.set_name).join(',') !== 'A,B,C'
  ) {
    return 'Exactly three sets (A, B and C) are required.'
  }

  const allQuestions = []

  for (const set of sets) {
    if (!Array.isArray(set.questions) ||
        set.questions.length !== Number(count)) {
      return `Set ${set.set_name} has an incorrect question count.`
    }

    for (const q of set.questions) {
      if (
        !q.question?.trim() ||
        !q.reference_answer?.trim() ||
        !q.grading_rubric?.trim() ||
        !Array.isArray(q.key_points) ||
        !q.key_points.length ||
        q.key_points.some(k => !k.trim())
      ) {
        return 'Every question needs an answer, key points and rubric.'
      }

      allQuestions.push(q.question.trim().toLowerCase())
    }
  }

  if (new Set(allQuestions).size !== allQuestions.length) {
    return 'Duplicate questions found across sets.'
  }

  return ''
}

export default function QuestionGenerator() {
  const { user } = useAuth()

  const [courses, setCourses] = useState([])
  const [banks, setBanks] = useState([])
  const [form, setForm] = useState(initialForm)
  const [sets, setSets] = useState([])
  const [activeSet, setActiveSet] = useState(0)
  const [bankId, setBankId] = useState(null)
  const [status, setStatus] = useState('draft')
  const [dirty, setDirty] = useState(false)

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadBanks() {
    const { data, error } = await supabase
      .from('question_banks')
      .select('id, topic, status, created_at, course_id')
      .eq('faculty_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    setBanks(data ?? [])
  }

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('id, code, title')
          .eq('faculty_id', user.id)
          .order('title')

        if (error) throw error

        if (active) {
          setCourses(data ?? [])
          setForm(f => ({
            ...f,
            course_id: data?.[0]?.id ?? '',
          }))
          await loadBanks()
        }
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [user.id])

  function clearMessages() {
    setError('')
    setMessage('')
  }

  function updateForm(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setDirty(true)
  }

  async function generate(e) {
    e.preventDefault()

    if (dirty && sets.length &&
        !window.confirm('Replace unsaved question changes?')) {
      return
    }

    setGenerating(true)
    clearMessages()

    try {
      const result = await generateAIQuestions({
        ...form,
        question_count: Number(form.question_count),
        marks_per_question: Number(form.marks_per_question),
      })

      const validation = validateSets(
        result.sets,
        form.question_count
      )

      if (validation) throw new Error(validation)

      setSets(result.sets)
      setActiveSet(0)
      setBankId(null)
      setStatus('draft')
      setDirty(true)
      setMessage('Three sets generated. Review before approving.')
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function editQuestion(index, field, value) {
    if (status === 'approved') return

    setSets(previous => previous.map((set, setIndex) => {
      if (setIndex !== activeSet) return set

      return {
        ...set,
        questions: set.questions.map((q, qIndex) =>
          qIndex === index ? { ...q, [field]: value } : q
        ),
      }
    }))

    setDirty(true)
  }

  function openBank(bank) {
    if (dirty && !window.confirm('Discard unsaved changes?')) {
      return
    }

    setBankId(bank.id)
    setForm({
      course_id: bank.course_id,
      topic: bank.topic,
      difficulty: bank.difficulty,
      question_count: bank.question_count,
      marks_per_question: bank.marks_per_question,
    })
    setSets(bank.sets)
    setStatus(bank.status)
    setActiveSet(0)
    setDirty(false)
    clearMessages()
  }

  async function loadBank(id) {
    if (!id) return

    if (dirty && !window.confirm('Discard unsaved changes?')) {
      return
    }

    setLoading(true)
    clearMessages()

    try {
      const { data, error } = await supabase
        .from('question_banks')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      openBank(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function save(approve = false) {
    clearMessages()

    if (!sets.length) {
      setError('Generate questions first.')
      return
    }

    if (status === 'approved') {
      setError('Approved question banks are locked.')
      return
    }

    const validation = validateSets(sets, form.question_count)
    if (validation) {
      setError(validation)
      return
    }

    if (approve && !bankId) {
      setError('Save the draft before approving.')
      return
    }

    if (approve && dirty) {
      setError('Save your latest edits before approving.')
      return
    }

    if (approve && !window.confirm(
      'Approve and lock all three question sets?'
    )) {
      return
    }

    setSaving(true)

    try {
      const payload = {
        course_id: form.course_id,
        faculty_id: user.id,
        topic: form.topic.trim(),
        difficulty: form.difficulty,
        question_count: Number(form.question_count),
        marks_per_question: Number(form.marks_per_question),
        sets,
        status: approve ? 'approved' : 'draft',
        updated_at: new Date().toISOString(),
      }

      let query

      if (bankId) {
        query = supabase
          .from('question_banks')
          .update(payload)
          .eq('id', bankId)
          .eq('status', 'draft')
      } else {
        query = supabase
          .from('question_banks')
          .insert(payload)
      }

      const { data, error } = await query
        .select('id, status')
        .single()

      if (error) throw error

      setBankId(data.id)
      setStatus(data.status)
      setDirty(false)

      await loadBanks()

      setMessage(
        approve
          ? 'Question bank approved and locked.'
          : 'Draft saved successfully.'
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const readOnly = status === 'approved'

  return (
    <div className="space-y-7">
      <div>
        <div className="flex items-center gap-3">
          <Sparkles className="text-primary" size={28} />
          <h1 className="text-3xl font-bold">
            AI Question Generator
          </h1>
        </div>
        <p className="mt-2 text-muted">
          Generate, review and approve voice viva questions.
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

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold">
          <BookOpen className="text-primary" size={22} />
          Generate Questions
        </h2>

        <form onSubmit={generate} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>Course</span>
              <select
                required
                disabled={readOnly}
                className={inputClass}
                value={form.course_id}
                onChange={e => updateForm('course_id', e.target.value)}
              >
                <option value="">Select course</option>
                {courses.map(c => (
                  <option value={c.id} key={c.id}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span>Topic</span>
              <input
                required
                minLength={3}
                maxLength={150}
                disabled={readOnly}
                className={inputClass}
                value={form.topic}
                placeholder="Example: SQL Joins"
                onChange={e => updateForm('topic', e.target.value)}
              />
            </label>

            <label className="space-y-2 text-sm">
              <span>Difficulty</span>
              <select
                disabled={readOnly}
                className={inputClass}
                value={form.difficulty}
                onChange={e => updateForm('difficulty', e.target.value)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span>Questions per set (1–10)</span>
              <input
                type="number"
                required
                min={1}
                max={10}
                disabled={readOnly}
                className={inputClass}
                value={form.question_count}
                onChange={e =>
                  updateForm('question_count', Number(e.target.value))
                }
              />
            </label>

            <label className="space-y-2 text-sm">
              <span>Marks per question (1–20)</span>
              <input
                type="number"
                required
                min={1}
                max={20}
                disabled={readOnly}
                className={inputClass}
                value={form.marks_per_question}
                onChange={e =>
                  updateForm('marks_per_question', Number(e.target.value))
                }
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={generating || readOnly || !form.course_id}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-on-primary disabled:opacity-50"
              >
                {generating
                  ? <LoaderCircle className="animate-spin" size={19} />
                  : <Sparkles size={19} />}
                {generating ? 'Generating...' : 'Generate 3 Sets'}
              </button>
            </div>
          </div>
        </form>
      </section>

      {sets.length > 0 && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">
              Review Question Sets
            </h2>

            <span className="rounded-full bg-soft px-4 py-2 text-sm font-medium text-primary">
              {readOnly ? 'Approved & Locked' : 'Draft'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {sets.map((set, index) => (
              <button
                key={set.set_name}
                onClick={() => setActiveSet(index)}
                className={`rounded-xl border p-3 font-semibold transition ${
                  activeSet === index
                    ? 'border-primary bg-soft text-primary'
                    : 'border-border bg-surface text-muted'
                }`}
              >
                Set {set.set_name}
              </button>
            ))}
          </div>

          <p className="text-sm text-muted">
            {form.question_count} questions per set ·{' '}
            {form.question_count * form.marks_per_question} total marks
          </p>

          {sets[activeSet]?.questions.map((q, index) => (
            <div
              key={`${activeSet}-${index}`}
              className="space-y-4 rounded-2xl border border-border bg-surface p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Question {index + 1}
                </h3>
                <span className="text-sm text-muted">
                  {form.marks_per_question} marks
                </span>
              </div>

              <label className="block space-y-2 text-sm">
                <span className="font-medium">Question</span>
                <textarea
                  rows={2}
                  readOnly={readOnly}
                  className={inputClass}
                  value={q.question}
                  onChange={e =>
                    editQuestion(index, 'question', e.target.value)
                  }
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium">Reference Answer</span>
                <textarea
                  rows={4}
                  readOnly={readOnly}
                  className={inputClass}
                  value={q.reference_answer}
                  onChange={e =>
                    editQuestion(index, 'reference_answer', e.target.value)
                  }
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium">
                  Key Points (one per line)
                </span>
                <textarea
                  rows={3}
                  readOnly={readOnly}
                  className={inputClass}
                  value={q.key_points.join('\n')}
                  onChange={e =>
                    editQuestion(
                      index,
                      'key_points',
                      e.target.value.split('\n')
                    )
                  }
                />
              </label>

              <label className="block space-y-2 text-sm">
                <span className="font-medium">Grading Rubric</span>
                <textarea
                  rows={3}
                  readOnly={readOnly}
                  className={inputClass}
                  value={q.grading_rubric}
                  onChange={e =>
                    editQuestion(index, 'grading_rubric', e.target.value)
                  }
                />
              </label>
            </div>
          ))}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => save(false)}
              disabled={saving || readOnly}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 font-medium disabled:opacity-50"
            >
              <Save size={18} /> Save Draft
            </button>

            <button
              onClick={() => save(true)}
              disabled={saving || readOnly || !bankId || dirty}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-on-primary disabled:opacity-50"
            >
              <CheckCircle size={18} /> Approve All Sets
            </button>
          </div>

          {dirty && (
            <p className="text-sm text-muted">
              You have unsaved changes. Save the draft before approving.
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold">
          <RotateCcw className="text-primary" size={21} />
          Saved Question Banks
        </h2>

        {loading ? (
          <p className="text-muted">Loading...</p>
        ) : banks.length === 0 ? (
          <p className="text-muted">
            No saved question banks yet.
          </p>
        ) : (
          <div className="space-y-3">
            {banks.map(bank => (
              <button
                key={bank.id}
                onClick={() => loadBank(bank.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-4 text-left hover:bg-soft"
              >
                <div>
                  <h3 className="font-semibold">{bank.topic}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {courses.find(c => c.id === bank.course_id)?.code}
                  </p>
                </div>

                <span className="rounded-full bg-soft px-3 py-1 text-xs font-medium capitalize text-primary">
                  {bank.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
