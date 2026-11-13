
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { Menu, Moon, Sun, Bell, LogOut } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

export default function DashboardLayout() {
  const { dark, setDark } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { signOut, profile } = useAuth()
    const navigate = useNavigate()

    async function handleLogout() {
    try {
        await signOut()
        navigate('/login', { replace: true })
    } catch (error) {
        alert(error.message)
    }
    }

  const role = location.pathname.startsWith('/faculty')
    ? 'faculty'
    : 'student'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        role={role}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border bg-surface px-4 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>

            <div>
              <h2 className="text-lg font-semibold capitalize">
                {role} Portal
              </h2>
              <p className="text-xs text-muted">
                AI Viva Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
                 {profile?.full_name}
            </span>

            <button
              onClick={() => setDark(!dark)}
              className="rounded-lg p-2 hover:bg-soft"
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button
              className="rounded-lg p-2 hover:bg-soft"
              aria-label="Notifications"
              disabled
            >
              <Bell size={20} />
            </button>
            <button
                onClick={handleLogout}
                className="rounded-lg p-2 hover:bg-soft"
                aria-label="Sign out"
                title="Sign out"
                >
                <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
