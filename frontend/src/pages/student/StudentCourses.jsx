
import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function StudentCourses() {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const { data, error } = await supabase
          .from('enrollments')
          .select('course_id, courses(id, title, code, description)')
          .eq('student_id', user.id)

        if (error) throw error
        if (active) setCourses(data ?? [])
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [user.id])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Courses</h1>
        <p className="mt-2 text-muted">
          View the courses you're registered for.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted">Loading courses...</p>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <BookOpen className="mx-auto mb-4 text-primary" size={40} />
          <h2 className="text-xl font-semibold">
            No enrolled courses
          </h2>
          <p className="mt-2 text-muted">
            Your faculty will assign your courses.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map(({ course_id, courses: course }) => (
            <div
              key={course_id}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <BookOpen className="mb-4 text-primary" size={28} />
              <p className="text-xs font-medium text-primary">
                {course?.code}
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                {course?.title}
              </h3>
              <p className="mt-3 text-sm text-muted">
                {course?.description || 'No description available.'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
