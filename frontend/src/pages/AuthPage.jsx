
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  AudioLines,
  ArrowRight,
  ArrowLeft,
  Mail,
  LockKeyhole,
  UserRound,
  Eye,
  EyeOff,
  LoaderCircle,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

import { supabase } from '../lib/supabase'

const inputClass =
  'w-full rounded-xl border border-white/15 bg-white/[0.045] px-12 py-3.5 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400 focus:bg-white/[0.07] focus:ring-2 focus:ring-emerald-400/10'

// Adjust these only if your existing routes are different.
const FACULTY_HOME = '/faculty'
const STUDENT_HOME = '/student'

export default function AuthPage() {
  const navigate = useNavigate()

  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isLogin = mode === 'login'
  const isRegister = mode === 'register'
  const isReset = mode === 'reset'

  function changeMode(nextMode) {
    setMode(nextMode)
    setError('')
    setMessage('')
    setPassword('')
    setShowPassword(false)
  }

  async function redirectUser(user) {
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError

    navigate(
      data.role === 'faculty'
        ? FACULTY_HOME
        : STUDENT_HOME,
      { replace: true }
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) return

    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (isReset) {
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
              redirectTo: `${window.location.origin}/reset-password`,
            }
          )

        if (resetError) throw resetError

        setMessage(
          'If an account exists for this email, you will receive a password reset link.'
        )
        return
      }

      if (isRegister) {
        if (!name.trim()) {
          throw new Error('Please enter your full name.')
        }

        if (password.length < 6) {
          throw new Error(
            'Password must contain at least 6 characters.'
          )
        }

        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: name.trim(),
              },
            },
          })

        if (signUpError) throw signUpError

        if (data.session && data.user) {
          await redirectUser(data.user)
        } else {
          setMessage(
            'Registration submitted. Check your email for a confirmation link if email verification is enabled.'
          )
          setMode('login')
          setPassword('')
        }

        return
      }

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

      if (loginError) throw loginError

      if (!data.user) {
        throw new Error('Unable to verify your account.')
      }

      await redirectUser(data.user)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#061711] text-white lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-full lg:grid-cols-[54%_46%]">

        {/* LEFT: HERO IMAGE */}
        <div className="relative hidden overflow-hidden lg:block">
          <img
            src="/images/vivaai-auth-hero.jpg"
            alt="University student participating in a viva examination with faculty"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />

          {/* Image overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#061711]/60 via-transparent to-[#061711]/85" />

          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#061711]/20" />

          {/* Top branding */}
          <div className="absolute left-10 top-9 z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/15 backdrop-blur-lg">
              <AudioLines
                className="text-emerald-300"
                size={25}
              />
            </div>

            <div>
              <div className="text-2xl font-extrabold tracking-tight">
                Viva<span className="text-emerald-400">AI</span>
              </div>

              <p className="text-xs text-white/70">
                AI-Powered Viva Assessment
              </p>
            </div>
          </div>

          <div className="absolute right-10 top-9 z-10 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200 backdrop-blur-md">
            <Sparkles size={14} />
            The smarter way to prepare and assess
          </div>

          {/* Bottom hero content */}
          <div className="absolute bottom-0 left-0 right-0 z-10 p-10 xl:p-14">
            <p className="mt-5 max-w-md text-sm leading-7 text-white/80 xl:text-base">
              Practice with AI-powered viva sessions,
              receive meaningful feedback, and make
              every assessment a learning opportunity.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-sm backdrop-blur-md">
                <GraduationCap
                  size={18}
                  className="text-emerald-300"
                />
                Smart Viva Practice
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-sm backdrop-blur-md">
                <ShieldCheck
                  size={18}
                  className="text-emerald-300"
                />
                AI-Powered Feedback
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: AUTH PANEL */}
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061711] px-6 py-12 sm:px-10 lg:min-h-0">

          {/* Decorative gradients */}
          <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-emerald-500/[0.07] blur-3xl" />

          <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-500/[0.06] blur-3xl" />

          <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-bl-full border-b border-l border-emerald-400/10" />

          <div className="relative z-10 w-full max-w-[420px]">

            {/* Mobile branding */}
            <div className="mb-10 flex items-center gap-3 lg:mb-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10">
                <AudioLines
                  size={27}
                  className="text-emerald-400"
                />
              </div>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">
                  Viva<span className="text-emerald-400">AI</span>
                </h1>

                <p className="text-xs tracking-wide text-white/50">
                  AI-Powered Viva Assessment
                </p>
              </div>
            </div>

            {/* Form heading */}
            <div className="mb-8">
              <div className="mb-4 h-1 w-12 rounded-full bg-emerald-400" />

              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {isLogin
                  ? 'Welcome back'
                  : isRegister
                    ? 'Create your account'
                    : 'Reset password'}
                <span className="text-emerald-400">.</span>
              </h2>

              <p className="mt-3 text-sm leading-6 text-white/55">
                {isLogin
                  ? 'Sign in to continue your learning journey.'
                  : isRegister
                    ? 'Join VivaAI and get started with smarter viva preparation.'
                    : 'Enter your registered email to receive a password reset link.'}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300"
              >
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />
                <span>{error}</span>
              </div>
            )}

            {/* Success */}
            {message && (
              <div
                role="status"
                className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200"
              >
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0"
                />
                <span>{message}</span>
              </div>
            )}

            {/* Auth form */}
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Name: signup only */}
              {isRegister && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="mb-2 block text-sm font-medium text-white/85"
                  >
                    Full Name
                  </label>

                  <div className="relative">
                    <UserRound
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
                    />

                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      required
                      minLength={2}
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-2 block text-sm font-medium text-white/85"
                >
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
                  />

                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Password */}
              {!isReset && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label
                      htmlFor="auth-password"
                      className="text-sm font-medium text-white/85"
                    >
                      Password
                    </label>

                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => changeMode('reset')}
                        className="text-xs font-medium text-emerald-300 transition hover:text-emerald-200"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <LockKeyhole
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
                    />

                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={
                        isRegister
                          ? 'new-password'
                          : 'current-password'
                      }
                      minLength={6}
                      required
                      value={password}
                      onChange={e =>
                        setPassword(e.target.value)
                      }
                      placeholder="Enter your password"
                      className={`${inputClass} pr-12`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(prev => !prev)
                      }
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 transition hover:text-emerald-300"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>

                  {isRegister && (
                    <p className="mt-2 text-xs text-white/40">
                      Use at least 6 characters.
                    </p>
                  )}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#55DFB4] to-[#38B58A] px-5 py-4 text-sm font-bold text-[#05251A] shadow-lg shadow-emerald-500/10 transition hover:from-[#6BE8C1] hover:to-[#4FC99D] hover:shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle
                      size={19}
                      className="animate-spin"
                    />
                    Please wait...
                  </>
                ) : (
                  <>
                    {isLogin
                      ? 'Login'
                      : isRegister
                        ? 'Create Account'
                        : 'Send Reset Link'}

                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </>
                )}
              </button>
            </form>

            {/* Switch mode */}
            <div className="mt-7 text-center text-sm text-white/50">
              {isLogin ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => changeMode('register')}
                    className="font-semibold text-emerald-300 hover:text-emerald-200"
                  >
                    Create one
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => changeMode('login')}
                  className="inline-flex items-center gap-2 font-semibold text-emerald-300 hover:text-emerald-200"
                >
                  <ArrowLeft size={16} />
                  Back to Login
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="mt-12 border-t border-white/10 pt-6">
              <p className="text-center text-xs leading-6 text-white/35">
                Built for smarter learning and fairer assessment.
                <br />
                © {new Date().getFullYear()} VivaAI
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
