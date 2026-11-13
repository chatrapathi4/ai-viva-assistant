
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Users,
  BookOpen,
  ClipboardList,
  ChartNoAxesColumn,
  ArrowRight,
  Plus,
  RefreshCw,
  CalendarClock,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function FacultyDashboard() {
  const { user, profile } = useAuth()

  const [stats, setStats] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    const [statsResult, assessmentResult] = await Promise.all([
      supabase.rpc('get_faculty_dashboard_stats'),

      supabase
        .from('assessments')
        .select('id, title, starts_at, ends_at, status')
        .eq('faculty_id', user.id)
        .order('starts_at', { ascending: false })
        .limit(5),
    ])

    if (statsResult.error) throw statsResult.error
    if (assessmentResult.error) throw assessmentResult.error

    setStats(statsResult.data)
    setAssessments(assessmentResult.data ?? [])
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

  const cards = [
    {
      title: 'Enrolled Students',
      value: stats?.total_students,
      icon: Users,
    },
    {
      title: 'Active Courses',
      value: stats?.total_courses,
      icon: BookOpen,
    },
    {
      title: 'Scheduled Vivas',
      value: stats?.scheduled_vivas,
      icon: CalendarClock,
    },
    {
      title: 'Submitted Attempts',
      value: stats?.submitted_attempts,
      icon: ChartNoAxesColumn,
    },
  ]

  function getStatus(a) {
    if (a.status === 'cancelled') return 'Cancelled'

    const now = Date.now()

    if (now < new Date(a.starts_at).getTime()) return 'Upcoming'
    if (now >= new Date(a.ends_at).getTime()) return 'Closed'

    return 'In Progress'
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome, {profile?.full_name || 'Faculty'}
          </h1>

          <p className="mt-2 text-muted">
            Here's an overview of your courses and viva assessments.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
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

          <Link
            to="/faculty/assessments"
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-on-primary hover:bg-primary-hover"
          >
            <Plus size={18} />
            Create Questions
          </Link>
        </div>
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
            {cards.map(({ title, value, icon: Icon }) => (
              <div
                key={title}
                className="rounded-2xl border border-border bg-surface p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-soft">
                  <Icon className="text-primary" size={24} />
                </div>

                <h3 className="text-3xl font-bold">
                  {value ?? '—'}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  {title}
                </p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                Recent Viva Assessments
              </h2>

              <Link
                to="/faculty/schedule"
                className="flex items-center gap-2 text-sm font-medium text-primary"
              >
                View Scheduling <ArrowRight size={16} />
              </Link>
            </div>

            {assessments.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardList
                  className="mx-auto mb-4 text-primary"
                  size={38}
                />
                <p className="font-semibold">
                  No scheduled assessments yet
                </p>
                <p className="mt-2 text-sm text-muted">
                  Create and approve a question bank to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assessments.map(a => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                  >
                    <div>
                      <h3 className="font-semibold">{a.title}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {new Date(a.starts_at).toLocaleString()}
                      </p>
                    </div>

                    <span className="rounded-full bg-soft px-3 py-1 text-xs font-medium text-primary">
                      {getStatus(a)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                name: 'Manage Courses',
                path: '/faculty/courses',
                icon: BookOpen,
              },
              {
                name: 'Manage Batches',
                path: '/faculty/students',
                icon: Users,
              },
              {
                name: 'Review Results',
                path: '/faculty/results',
                icon: ClipboardList,
              },
            ].map(({ name, path, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-soft"
              >
                <div className="flex items-center gap-3">
                  <Icon className="text-primary" size={22} />
                  <span className="font-medium">{name}</span>
                </div>
                <ArrowRight size={18} className="text-muted" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
