
import { useEffect, useState } from 'react'
import { CalendarClock, Clock3, Mic, BookOpen } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

function getStatus(assessment) {
  if (assessment.status === 'cancelled') return 'Cancelled'

  const now = Date.now()
  const start = new Date(assessment.starts_at).getTime()
  const end = new Date(assessment.ends_at).getTime()

  if (now < start) return 'Upcoming'
  if (now >= end) return 'Closed'
  return 'Available'
}

export default function StudentVivas() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [, setNow] = useState(Date.now())

  useEffect(() => {
    let active = true

    async function load() {
      const { data, error } = await supabase
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
            status,
            batches(name)
          )
        `)
        .eq('student_id', user.id)

      if (!active) return

      if (error) setError(error.message)
      else setAssignments(data ?? [])

      setLoading(false)
    }

    load()

    const interval = setInterval(() => {
      setNow(Date.now())
    }, 30000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [user.id])

  const sorted = [...assignments].sort(
    (a, b) =>
      new Date(b.assessments?.starts_at ?? 0) -
      new Date(a.assessments?.starts_at ?? 0)
  )

  return (
    <div className="space-y-7">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <Mic className="text-primary" />
          My Voice Vivas
        </h1>
        <p className="mt-2 text-muted">
          View your upcoming, available and closed viva assessments.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-muted">Loading your vivas...</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <BookOpen className="mx-auto mb-4 text-primary" size={40} />
          <h2 className="text-xl font-semibold">No Assigned Vivas</h2>
          <p className="mt-2 text-muted">
            Your faculty has not scheduled any viva for you yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {sorted.map(item => {
            const viva = item.assessments
            if (!viva) return null

            const status = getStatus(viva)

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border bg-surface p-6"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <h2 className="text-xl font-semibold">
                    {viva.title}
                  </h2>
                  <span className="rounded-full bg-soft px-3 py-1 text-xs font-medium text-primary">
                    {status}
                  </span>
                </div>

                <div className="space-y-3 text-sm text-muted">
                  <p className="flex items-center gap-2">
                    <BookOpen size={17} />
                    {viva.batches?.name}
                  </p>

                  <p className="flex items-center gap-2">
                    <CalendarClock size={17} />
                    {new Date(viva.starts_at).toLocaleString()}
                  </p>

                  <p className="flex items-center gap-2">
                    <Clock3 size={17} />
                    {viva.duration_minutes} minutes
                  </p>
                </div>

                <button
                  disabled
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary opacity-60"
                >
                  <Mic size={19} />
                  {status === 'Upcoming'
                    ? 'Not Started Yet'
                    : status === 'Available'
                      ? 'Voice Viva — Coming in Step 7B'
                      : 'Viva Unavailable'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
