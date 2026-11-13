
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  BookOpen,
  Mic,
  CalendarClock,
  ArrowRight,
  GraduationCap,
  Award,
  RefreshCw,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function StudentDashboard() {
  const { user, profile } = useAuth()

  const [courses, setCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    const [courseResult, vivaResult] = await Promise.all([
      supabase
        .from('enrollments')
        .select(`
          course_id,
          courses (
            id,
            code,
            title,
            description
          )
        `)
        .eq('student_id', user.id),

      supabase
        .from('assessment_assignments')
        .select(`
          id,
          assessment_id,
          assessments (
            id,
            title,
            starts_at,
            ends_at,
            duration_minutes,
            status
          )
        `)
        .eq('student_id', user.id),
    ])

    if (courseResult.error) throw courseResult.error
    if (vivaResult.error) throw vivaResult.error

    setCourses(courseResult.data ?? [])
    setAssignments(vivaResult.data ?? [])
  }, [user.id])

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        await loadDashboard()
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    initialize()

    return () => {
      active = false
    }
  }, [loadDashboard])

  async function refresh() {
    setRefreshing(true)
    setError('')

    try {
      await loadDashboard()
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  const now = Date.now()

  const validAssignments = assignments.filter(
    item => item.assessments
  )

  const available = validAssignments.filter(item => {
    const a = item.assessments

    return (
      a.status === 'scheduled' &&
      new Date(a.starts_at).getTime() <= now &&
      new Date(a.ends_at).getTime() > now
    )
  })

  const upcoming = validAssignments
    .filter(item => {
      const a = item.assessments

      return (
        a.status === 'scheduled' &&
        new Date(a.starts_at).getTime() > now
      )
    })
    .sort(
      (a, b) =>
        new Date(a.assessments.starts_at) -
        new Date(b.assessments.starts_at)
    )

  const cards = [
    {
      label: 'Enrolled Courses',
      value: courses.length,
      icon: BookOpen,
    },
    {
      label: 'Assigned Vivas',
      value: validAssignments.length,
      icon: Mic,
    },
    {
      label: 'Available Now',
      value: available.length,
      icon: GraduationCap,
    },
    {
      label: 'Upcoming Vivas',
      value: upcoming.length,
      icon: CalendarClock,
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome, {profile?.full_name || 'Student'}
          </h1>

          <p className="mt-2 text-muted">
            Track your courses and upcoming voice assessments.
          </p>
        </div>

        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 hover:bg-soft disabled:opacity-50"
        >
          <RefreshCw
            size={18}
            className={refreshing ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted">Loading dashboard...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-border bg-surface p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-soft">
                  <Icon className="text-primary" size={24} />
                </div>

                <h2 className="text-3xl font-bold">{value}</h2>
                <p className="mt-2 text-sm text-muted">{label}</p>
              </div>
            ))}
          </div>

          {available.length > 0 && (
            <section className="rounded-2xl border border-primary/30 bg-surface p-6">
              <div className="mb-4 flex items-center gap-3">
                <Mic className="text-primary" size={26} />
                <h2 className="text-xl font-semibold">
                  Available Voice Vivas
                </h2>
              </div>

              <div className="space-y-4">
                {available.map(item => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
                  >
                    <div>
                      <h3 className="font-semibold">
                        {item.assessments.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        Closes: {new Date(
                          item.assessments.ends_at
                        ).toLocaleString()}
                      </p>
                    </div>

                    <Link
                      to={`/student/vivas/${item.id}`}
                      className="rounded-xl bg-primary px-5 py-3 font-medium text-on-primary hover:bg-primary-hover"
                    >
                      Open Viva
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  My Courses
                </h2>
                <Link
                  to="/student/courses"
                  className="flex items-center gap-1 text-sm text-primary"
                >
                  View All <ArrowRight size={16} />
                </Link>
              </div>

              {courses.length === 0 ? (
                <p className="py-8 text-center text-muted">
                  No courses enrolled yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {courses.slice(0, 5).map(item => (
                    <div
                      key={item.course_id}
                      className="rounded-xl border border-border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen
                          className="shrink-0 text-primary"
                          size={23}
                        />
                        <div>
                          <h3 className="font-medium">
                            {item.courses?.title}
                          </h3>
                          <p className="mt-1 text-xs text-muted">
                            {item.courses?.code}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Upcoming Vivas
                </h2>
                <Link
                  to="/student/vivas"
                  className="flex items-center gap-1 text-sm text-primary"
                >
                  View All <ArrowRight size={16} />
                </Link>
              </div>

              {upcoming.length === 0 ? (
                <p className="py-8 text-center text-muted">
                  No upcoming vivas scheduled.
                </p>
              ) : (
                <div className="space-y-3">
                  {upcoming.slice(0, 5).map(item => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <CalendarClock
                          className="shrink-0 text-primary"
                          size={23}
                        />

                        <div>
                          <h3 className="font-medium">
                            {item.assessments.title}
                          </h3>
                          <p className="mt-1 text-xs text-muted">
                            {new Date(
                              item.assessments.starts_at
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <Link
            to="/student/results"
            className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5 hover:bg-soft"
          >
            <div className="flex items-center gap-3">
              <Award className="text-primary" size={24} />
              <div>
                <h3 className="font-semibold">My Results</h3>
                <p className="mt-1 text-sm text-muted">
                  View published marks and faculty feedback.
                </p>
              </div>
            </div>
            <ArrowRight className="text-muted" size={19} />
          </Link>
        </>
      )}
    </div>
  )
}
