
import {
  BookOpen,
  Mic,
  Trophy,
  ArrowRight,
  ClipboardList,
} from 'lucide-react'
import { Link } from 'react-router'

const courses = [
  { title: 'Database Management Systems', code: 'DBMS', progress: 75 },
  { title: 'Python Programming', code: 'PYTHON', progress: 60 },
  { title: 'Operating Systems', code: 'OS', progress: 40 },
]

export default function StudentDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <p className="mt-2 text-muted">
          Track your learning progress and prepare for upcoming vivas.
        </p>
        <p className="mt-1 text-xs text-muted">Showing demo data</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Enrolled Courses', value: '3', icon: BookOpen },
          { label: 'Completed Vivas', value: '8', icon: Mic },
          { label: 'Average Score', value: '85%', icon: Trophy },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-6">
            <Icon className="mb-4 text-primary" size={25} />
            <h3 className="text-3xl font-bold">{value}</h3>
            <p className="mt-2 text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-soft p-3">
            <Mic className="text-primary" size={26} />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Voice Viva</h2>
            <p className="text-sm text-muted">DBMS Lab — Sample assessment</p>
          </div>
        </div>

        <p className="mb-5 text-sm text-muted">
          Practice answering questions through your microphone with
          AI-powered evaluation.
        </p>

        <Link
          to="/student/vivas"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-on-primary hover:bg-primary-hover"
        >
          Explore Vivas <ArrowRight size={18} />
        </Link>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">My Courses</h2>
          <Link to="/student/courses" className="text-sm text-primary">
            View All
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {courses.map((course) => (
            <div key={course.code} className="rounded-xl border border-border p-5">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardList className="text-primary" size={22} />
                <span className="text-xs text-muted">{course.code}</span>
              </div>

              <h3 className="mb-5 min-h-12 font-semibold">{course.title}</h3>

              <div className="mb-2 flex justify-between text-xs text-muted">
                <span>Progress</span>
                <span>{course.progress}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${course.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
