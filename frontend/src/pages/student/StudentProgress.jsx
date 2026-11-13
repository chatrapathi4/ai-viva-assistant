
import { useCallback, useEffect, useState } from 'react'
import {
  Award,
  BookOpen,
  CheckCircle2,
  Trophy,
  RefreshCw,
  ChartNoAxesColumnIncreasing,
  ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'

const emptyProgress = {
  enrolled_courses: 0,
  completed_vivas: 0,
  average_score: null,
  best_score: null,
  course_performance: [],
  recent_results: [],
}

export default function StudentProgress() {
  const [progress, setProgress] = useState(emptyProgress)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadProgress = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      'get_student_progress'
    )

    if (error) throw error

    setProgress(data ?? emptyProgress)
  }, [])

  useEffect(() => {
    let active = true

    async function initialize() {
      try {
        await loadProgress()
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    initialize()
    return () => { active = false }
  }, [loadProgress])

  async function refresh() {
    setRefreshing(true)
    setError('')

    try {
      await loadProgress()
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }

  const formatPercentage = value =>
    value == null ? '—' : `${Number(value).toFixed(1)}%`

  const cards = [
    {
      label: 'Enrolled Courses',
      value: progress.enrolled_courses,
      icon: BookOpen,
    },
    {
      label: 'Completed Vivas',
      value: progress.completed_vivas,
      icon: CheckCircle2,
    },
    {
      label: 'Average Score',
      value: formatPercentage(progress.average_score),
      icon: Award,
    },
    {
      label: 'Best Score',
      value: formatPercentage(progress.best_score),
      icon: Trophy,
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <ChartNoAxesColumnIncreasing
              className="text-primary"
              size={30}
            />
            My Learning Progress
          </h1>
          <p className="mt-2 text-muted">
            Track your performance across published viva results.
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
        <p className="text-muted">Loading progress...</p>
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

          <section className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="mb-2 text-xl font-semibold">
              Course-wise Performance
            </h2>
            <p className="mb-6 text-sm text-muted">
              Average marks percentage from published vivas.
            </p>

            {progress.course_performance.length === 0 ? (
              <div className="py-10 text-center">
                <Award
                  className="mx-auto mb-4 text-primary"
                  size={38}
                />
                <h3 className="font-semibold">
                  No performance data yet
                </h3>
                <p className="mt-2 text-sm text-muted">
                  Complete a viva and wait for faculty to
                  publish your result.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {progress.course_performance.map(course => (
                  <div key={course.course_id} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">
                          {course.course_title}
                        </h3>
                        <p className="mt-1 text-xs text-muted">
                          {course.course_code} ·{' '}
                          {course.viva_count} graded vivas
                        </p>
                      </div>

                      <span className="text-lg font-bold text-primary">
                        {formatPercentage(course.average_percentage)}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${
                            Math.min(
                              100,
                              Math.max(
                                0,
                                Number(course.average_percentage) || 0
                              )
                            )
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                Recent Viva Results
              </h2>

              <Link
                to="/student/results"
                className="flex items-center gap-2 text-sm font-medium text-primary"
              >
                All Results <ArrowRight size={16} />
              </Link>
            </div>

            {progress.recent_results.length === 0 ? (
              <p className="py-8 text-center text-muted">
                No published results available.
              </p>
            ) : (
              <div className="space-y-3">
                {progress.recent_results.map(result => (
                  <div
                    key={result.attempt_id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4"
                  >
                    <div>
                      <h3 className="font-semibold">
                        {result.assessment_title}
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        {result.course_title}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {new Date(
                          result.published_at
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold text-primary">
                        {formatPercentage(result.percentage)}
                      </p>
                      <p className="text-xs text-muted">
                        {result.obtained} / {result.maximum} marks
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
