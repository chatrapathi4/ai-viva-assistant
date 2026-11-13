
import { useEffect, useState } from 'react'
import { Mic, Moon, Sun } from 'lucide-react'

export default function App() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-4">
        <div className="flex items-center gap-3">
          <Mic className="text-primary" size={28} />
          <h1 className="text-xl font-bold">VivaAI</h1>
        </div>

        <button
          onClick={() => setDark(!dark)}
          className="rounded-lg border border-border p-3 hover:bg-soft"
          aria-label="Toggle theme"
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className="flex min-h-[80vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex w-fit rounded-2xl bg-soft p-4">
            <Mic size={40} className="text-primary" />
          </div>

          <h2 className="text-3xl font-bold">
            AI Viva Assistant
          </h2>

          <p className="mt-3 text-muted">
            Your AI-powered voice viva platform
          </p>

          <button className="mt-6 rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary hover:bg-primary-hover">
            Get Started
          </button>
        </div>
      </main>
    </div>
  )
}
