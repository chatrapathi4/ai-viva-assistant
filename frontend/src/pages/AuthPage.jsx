
import { useState } from 'react'
import { Navigate } from 'react-router'
import { GraduationCap, Moon, Sun } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function AuthPage() {
  const { user, profile } = useAuth()
  const { dark, setDark } = useTheme()

  const [register, setRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (user && profile) {
    return (
      <Navigate
        to={profile.role === 'faculty' ? '/faculty' : '/student'}
        replace
      />
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setMessage('')

    try {
      if (register) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
          },
        })

        if (error) throw error

        setMessage(
          data.session
            ? 'Account created successfully.'
            : 'Registration submitted. Check your email to confirm your account.'
        )
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
      }
    } catch (error) {
      setMessage(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-5 text-foreground">
      <button
        onClick={() => setDark(!dark)}
        aria-label="Toggle theme"
        className="absolute right-6 top-6 rounded-xl border border-border bg-surface p-3"
      >
        {dark ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="rounded-2xl bg-primary p-4">
            <GraduationCap size={32} className="text-on-primary" />
          </div>

          <h1 className="text-3xl font-bold">VivaAI</h1>
          <p className="text-center text-sm text-muted">
            AI-Powered Voice Viva & Interview Platform
          </p>
        </div>

        <h2 className="mb-5 text-xl font-semibold">
          {register ? 'Create Student Account' : 'Welcome Back'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {register && (
            <div>
              <label className="mb-2 block text-sm">Full Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
                placeholder="Enter your full name"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm">Email</label>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm">Password</label>
            <input
              required
              type="password"
              minLength={6}
              autoComplete={register ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
              placeholder="Enter your password"
            />
          </div>

          {message && (
            <p role="status" className="rounded-xl bg-soft p-3 text-sm text-foreground">
              {message}
            </p>
          )}

          <button
            disabled={busy}
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-50"
          >
            {busy
              ? 'Please wait...'
              : register
                ? 'Create Account'
                : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {register ? 'Already have an account?' : 'New student?'}{' '}
          <button
            className="font-semibold text-primary"
            onClick={() => {
              setRegister(!register)
              setMessage('')
            }}
          >
            {register ? 'Sign In' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  )
}
