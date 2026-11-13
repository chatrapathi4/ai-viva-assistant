
import { NavLink } from 'react-router'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ClipboardList,
  BarChart3,
  Mic,
  GraduationCap,
  X,
  CalendarClock,
} from 'lucide-react'

const facultyLinks = [
  { name: 'Dashboard', path: '/faculty', icon: LayoutDashboard },
  { name: 'Courses', path: '/faculty/courses', icon: BookOpen },
  { name: 'Students & Batches', path: '/faculty/students', icon: Users },
  { name: 'Assessments', path: '/faculty/assessments', icon: ClipboardList },
    { name: 'Viva Scheduling', path: '/faculty/schedule', icon: CalendarClock },
  { name: 'Results', path: '/faculty/results', icon: BarChart3 },
]

const studentLinks = [
  { name: 'Dashboard', path: '/student', icon: LayoutDashboard },
  { name: 'My Courses', path: '/student/courses', icon: BookOpen },
  { name: 'My Vivas', path: '/student/vivas', icon: Mic },
  { name: 'Practice Quizzes', path: '/student/quizzes', icon: ClipboardList },
  { name: 'My Progress', path: '/student/progress', icon: BarChart3 },
]

export default function Sidebar({ role, open, onClose }) {
  const links = role === 'faculty' ? facultyLinks : studentLinks

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-20 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2">
              <GraduationCap className="text-on-primary" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">VivaAI</h1>
              <p className="text-xs capitalize text-muted">{role} Portal</p>
            </div>
          </div>

          <button onClick={onClose} className="lg:hidden" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 p-4">
          {links.map(({ name, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-soft text-primary'
                    : 'text-muted hover:bg-soft hover:text-foreground'
                }`
              }
            >
              <Icon size={19} />
              {name}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-5">
          <p className="text-xs text-muted">
            AI-powered voice assessments
          </p>
        </div>
      </aside>
    </>
  )
}
