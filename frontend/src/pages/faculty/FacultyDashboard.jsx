
import {
  Users,
  BookOpen,
  ClipboardList,
  ChartNoAxesColumn,
  ArrowRight,
  Plus,
} from 'lucide-react'
import { Link } from 'react-router'

const stats = [
  { title: 'Total Students', value: '120', icon: Users },
  { title: 'Active Courses', value: '4', icon: BookOpen },
  { title: 'Scheduled Vivas', value: '6', icon: ClipboardList },
  { title: 'Average Score', value: '82%', icon: ChartNoAxesColumn },
]

const assessments = [
  { title: 'DBMS Lab Viva', course: 'Database Management Systems', date: 'Demo schedule', status: 'Scheduled' },
  { title: 'Python Functions', course: 'Python Programming', date: 'Demo schedule', status: 'Draft' },
  { title: 'Operating Systems Viva', course: 'Operating Systems', date: 'Demo schedule', status: 'Completed' },
]

export default function FacultyDashboard() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Faculty Dashboard</h1>
          <p className="mt-2 text-muted">
            Manage your courses, students and AI-powered assessments.
          </p>
          <p className="mt-1 text-xs text-muted">Showing demo data</p>
        </div>

        <Link
          to="/faculty/assessments"
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-medium text-on-primary hover:bg-primary-hover"
        >
          <Plus size={19} /> Create Viva
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ title, value, icon: Icon }) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-surface p-6"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-soft">
              <Icon className="text-primary" size={23} />
            </div>
            <h3 className="text-3xl font-bold">{value}</h3>
            <p className="mt-2 text-sm text-muted">{title}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Assessments</h2>
          <Link to="/faculty/assessments" className="flex items-center gap-1 text-sm text-primary">
            View All <ArrowRight size={16} />
          </Link>
        </div>

        <div className="space-y-4">
          {assessments.map((item) => (
            <div
              key={item.title}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
            >
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted">{item.course}</p>
                <p className="text-xs text-muted">{item.date}</p>
              </div>
              <span className="rounded-full bg-soft px-3 py-1 text-xs font-medium text-primary">
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
