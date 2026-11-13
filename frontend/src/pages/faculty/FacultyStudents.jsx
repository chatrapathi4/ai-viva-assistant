
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  UserPlus,
  Users,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function FacultyStudents() {
  const { user } = useAuth()

  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState('')
  const [sections, setSections] = useState([])
  const [sectionId, setSectionId] = useState('')
  const [students, setStudents] = useState([])
  const [batches, setBatches] = useState([])
  const [members, setMembers] = useState([])

  const [email, setEmail] = useState('')
  const [batchName, setBatchName] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedCourse = courses.find(c => c.id === courseId)

  const loadCourses = useCallback(async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, code, department_id')
      .eq('faculty_id', user.id)
      .order('title')

    if (error) throw error

    setCourses(data ?? [])
    setCourseId(current =>
      data?.some(c => c.id === current)
        ? current
        : data?.[0]?.id ?? ''
    )
  }, [user.id])

  const loadCourseData = useCallback(async (id) => {
    if (!id) {
      setStudents([])
      setBatches([])
      setMembers([])
      return
    }

    const [rosterResult, batchResult] = await Promise.all([
      supabase.rpc('get_course_students', {
        p_course_id: id,
      }),
      supabase
        .from('batches')
        .select('id, course_id, section_id, name')
        .eq('course_id', id)
        .order('name'),
    ])

    if (rosterResult.error) throw rosterResult.error
    if (batchResult.error) throw batchResult.error

    const batchRows = batchResult.data ?? []
    setStudents(rosterResult.data ?? [])
    setBatches(batchRows)

    if (batchRows.length === 0) {
      setMembers([])
      return
    }

    const { data, error } = await supabase
      .from('batch_members')
      .select('batch_id, student_id')
      .in('batch_id', batchRows.map(b => b.id))

    if (error) throw error
    setMembers(data ?? [])
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      try {
        await loadCourses()
        if (active) setError('')
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [loadCourses])

  useEffect(() => {
    let active = true

    async function loadSections() {
      if (!selectedCourse) {
        setSections([])
        setSectionId('')
        return
      }

      const { data, error } = await supabase
        .from('sections')
        .select('id, name')
        .eq('department_id', selectedCourse.department_id)
        .order('name')

      if (!active) return

      if (error) {
        setError(error.message)
        return
      }

      setSections(data ?? [])
      setSectionId(current =>
        data?.some(s => String(s.id) === String(current))
          ? current
          : String(data?.[0]?.id ?? '')
      )
    }

    loadSections()
    return () => { active = false }
  }, [selectedCourse?.department_id])

  useEffect(() => {
    let active = true

    setStudents([])
    setBatches([])
    setMembers([])

    async function load() {
      if (!courseId) return

      setLoading(true)
      try {
        await loadCourseData(courseId)
        if (active) setError('')
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [courseId, loadCourseData])

  async function runAction(action, successMessage) {
    setBusy(true)
    setError('')
    setMessage('')

    try {
      await action()
      await loadCourseData(courseId)
      setMessage(successMessage)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function enrollStudent(e) {
    e.preventDefault()

    await runAction(async () => {
      const { error } = await supabase.rpc(
        'enroll_student_by_email',
        {
          p_course_id: courseId,
          p_email: email.trim(),
        }
      )

      if (error) throw error
      setEmail('')
    }, 'Student enrollment completed.')
  }

  async function createBatch(e) {
    e.preventDefault()

    await runAction(async () => {
      const { error } = await supabase.rpc(
        'create_course_batch',
        {
          p_course_id: courseId,
          p_section_id: Number(sectionId),
          p_name: batchName.trim(),
        }
      )

      if (error) throw error
      setBatchName('')
    }, 'Batch created successfully.')
  }

  async function addMember(batchId, studentId) {
    await runAction(async () => {
      const { error } = await supabase.rpc(
        'add_student_to_batch',
        {
          p_batch_id: batchId,
          p_student_id: studentId,
        }
      )

      if (error) throw error
    }, 'Student added to batch.')
  }

  async function removeMember(batchId, studentId) {
    await runAction(async () => {
      const { error } = await supabase.rpc(
        'remove_student_from_batch',
        {
          p_batch_id: batchId,
          p_student_id: studentId,
        }
      )

      if (error) throw error
    }, 'Student removed from batch.')
  }

  const visibleStudents = useMemo(
    () => students.filter(
      s => String(s.section_id) === String(sectionId)
    ),
    [students, sectionId]
  )

  const visibleBatches = batches.filter(
    b => String(b.section_id) === String(sectionId)
  )

  const inputClass =
    'w-full rounded-xl border border-border bg-background p-3 text-foreground outline-none focus:border-primary'

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-3xl font-bold">Students & Batches</h1>
        <p className="mt-2 text-muted">
          Enroll students and organize them for voice vivas.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {message && (
        <div role="status" className="rounded-xl bg-soft p-4 text-sm text-primary">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold">
          <BookOpen className="text-primary" size={21} />
          Select Course & Section
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-muted">
              Course
            </label>
            <select
              className={inputClass}
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
            >
              {courses.length === 0 && (
                <option value="">No courses available</option>
              )}
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-muted">
              Section
            </label>
            <select
              className={inputClass}
              value={sectionId}
              onChange={e => setSectionId(e.target.value)}
            >
              {sections.map(s => (
                <option key={s.id} value={s.id}>
                  Section {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {courseId && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Enrolled in Course', value: students.length, icon: Users },
              { label: 'Students in Section', value: visibleStudents.length, icon: UserPlus },
              { label: 'Batches in Section', value: visibleBatches.length, icon: Layers },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-surface p-5">
                <Icon size={24} className="mb-3 text-primary" />
                <h3 className="text-3xl font-bold">{value}</h3>
                <p className="mt-1 text-sm text-muted">{label}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="mb-2 text-xl font-semibold">Enroll Student</h2>
            <p className="mb-4 text-sm text-muted">
              Enter the registered email of a student in this course's department.
            </p>

            <form onSubmit={enrollStudent} className="flex flex-col gap-3 sm:flex-row">
              <input
                className={inputClass}
                type="email"
                required
                placeholder="student@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <button
                disabled={busy || !sectionId}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-on-primary disabled:opacity-50"
              >
                <UserPlus size={18} /> Enroll
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="mb-4 text-xl font-semibold">
              Enrolled Students — Selected Section
            </h2>

            {loading ? (
              <p className="text-muted">Loading...</p>
            ) : visibleStudents.length === 0 ? (
              <p className="text-muted">No enrolled students in this section.</p>
            ) : (
              <div className="space-y-2">
                {visibleStudents.map(s => (
                  <div
                    key={s.student_id}
                    className="flex items-center justify-between rounded-xl border border-border p-4"
                  >
                    <p className="font-medium">
                      {s.full_name || 'Unnamed Student'}
                    </p>
                    <span className="text-xs text-muted">
                      Enrolled
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Layers className="text-primary" />
              Create Batch
            </h2>

            <form onSubmit={createBatch} className="flex flex-col gap-3 sm:flex-row">
              <input
                className={inputClass}
                required
                maxLength={80}
                placeholder="Example: Batch 1"
                value={batchName}
                onChange={e => setBatchName(e.target.value)}
              />
              <button
                disabled={busy || !sectionId}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-on-primary disabled:opacity-50"
              >
                <Plus size={18} /> Create Batch
              </button>
            </form>
          </section>

          <section>
            <h2 className="mb-5 text-xl font-semibold">Manage Batches</h2>

            {visibleBatches.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface p-6 text-muted">
                No batches created for this section yet.
              </p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {visibleBatches.map(batch => {
                  const batchStudentIds = new Set(
                    members
                      .filter(m => m.batch_id === batch.id)
                      .map(m => m.student_id)
                  )

                  return (
                    <div
                      key={batch.id}
                      className="rounded-2xl border border-border bg-surface p-6"
                    >
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-lg font-semibold">
                          {batch.name}
                        </h3>
                        <span className="rounded-full bg-soft px-3 py-1 text-xs text-primary">
                          {batchStudentIds.size} students
                        </span>
                      </div>

                      <div className="mb-5 space-y-2">
                        {visibleStudents
                          .filter(s => batchStudentIds.has(s.student_id))
                          .map(s => (
                            <div
                              key={s.student_id}
                              className="flex items-center justify-between rounded-lg border border-border p-3"
                            >
                              <span className="text-sm">
                                {s.full_name || 'Unnamed Student'}
                              </span>

                              <button
                                disabled={busy}
                                onClick={() => removeMember(batch.id, s.student_id)}
                                aria-label={`Remove ${s.full_name} from ${batch.name}`}
                                className="rounded-lg p-2 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          ))}
                      </div>

                      <label className="mb-2 block text-sm text-muted">
                        Add enrolled student
                      </label>

                      <select
                        className={inputClass}
                        disabled={busy}
                        value=""
                        onChange={e => {
                          if (e.target.value) {
                            addMember(batch.id, e.target.value)
                          }
                        }}
                      >
                        <option value="">Select a student</option>
                        {visibleStudents
                          .filter(s => !batchStudentIds.has(s.student_id))
                          .map(s => (
                            <option key={s.student_id} value={s.student_id}>
                              {s.full_name || 'Unnamed Student'}
                            </option>
                          ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
