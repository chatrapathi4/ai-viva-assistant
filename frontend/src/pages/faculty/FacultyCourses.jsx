
import { useEffect, useState } from 'react'
import { BookOpen, Plus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function FacultyCourses() {
  const { user } = useAuth()

  const [courses, setCourses] = useState([])
  const [departments, setDepartments] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    code: '',
    description: '',
    department_id: '',
  })

  async function fetchCourses() {
    const { data, error } = await supabase
      .from('courses')
      .select('*, departments(name, code)')
      .eq('faculty_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    setCourses(data ?? [])
  }

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [courseResult, departmentResult] = await Promise.all([
          supabase
            .from('courses')
            .select('*, departments(name, code)')
            .eq('faculty_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('departments')
            .select('*')
            .order('name'),
        ])

        if (courseResult.error) throw courseResult.error
        if (departmentResult.error) throw departmentResult.error

        if (active) {
          setCourses(courseResult.data ?? [])
          setDepartments(departmentResult.data ?? [])
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

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const { error } = await supabase
        .from('courses')
        .insert({
          title: form.title.trim(),
          code: form.code.trim().toUpperCase(),
          description: form.description.trim(),
          department_id: Number(form.department_id),
          faculty_id: user.id,
        })

      if (error) throw error

      await fetchCourses()

      setForm({
        title: '',
        code: '',
        description: '',
        department_id: '',
      })
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Courses</h1>
          <p className="mt-2 text-muted">
            Create and manage your academic courses.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-on-primary hover:bg-primary-hover"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Close' : 'Create Course'}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-2xl border border-border bg-surface p-6"
        >
          <h2 className="text-xl font-semibold">New Course</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <input
              required
              placeholder="Course name"
              value={form.title}
              onChange={(e) => setForm({
                ...form, title: e.target.value,
              })}
              className="rounded-xl border border-border bg-background p-3 outline-none focus:border-primary"
            />

            <input
              required
              placeholder="Course code, e.g. DBMS101"
              value={form.code}
              onChange={(e) => setForm({
                ...form, code: e.target.value,
              })}
              className="rounded-xl border border-border bg-background p-3 outline-none focus:border-primary"
            />
          </div>

          <select
            required
            value={form.department_id}
            onChange={(e) => setForm({
              ...form, department_id: e.target.value,
            })}
            className="w-full rounded-xl border border-border bg-background p-3"
          >
            <option value="">Select Department</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>

          <textarea
            placeholder="Course description"
            value={form.description}
            onChange={(e) => setForm({
              ...form, description: e.target.value,
            })}
            rows={3}
            className="w-full rounded-xl border border-border bg-background p-3 outline-none focus:border-primary"
          />

          <button
            disabled={saving}
            type="submit"
            className="rounded-xl bg-primary px-6 py-3 font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Save Course'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-muted">Loading courses...</p>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <BookOpen className="mx-auto mb-4 text-primary" size={40} />
          <h2 className="text-xl font-semibold">No courses yet</h2>
          <p className="mt-2 text-muted">
            Create your first course to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-soft">
                <BookOpen className="text-primary" size={25} />
              </div>

              <p className="mb-2 text-xs font-medium text-primary">
                {course.code}
              </p>

              <h3 className="text-xl font-semibold">
                {course.title}
              </h3>

              <p className="mt-2 text-sm text-muted">
                {course.departments?.name}
              </p>

              <p className="mt-4 text-sm text-muted">
                {course.description || 'No description added.'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
