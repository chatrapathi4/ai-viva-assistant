// frontend/src/pages/student/VoiceViva.jsx
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Mic, MicOff, Volume2, Square, Save, ArrowRight } from 'lucide-react'
import { startViva, saveAnswer, finishViva } from '../../services/voiceApi'

const inputClass = 'w-full rounded-xl border border-border bg-background p-3 text-foreground outline-none focus:border-primary'

export default function VoiceViva() {
  const { assignmentId } = useParams()
  const [session, setSession] = useState(null)
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [finished, setFinished] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [dirty, setDirty] = useState(false)
  const recognitionRef = useRef(null)
  useEffect(() => {
    let live = true
    startViva(assignmentId).then(result => {
      if (!live) return
      setSession(result)
      setAnswers(Object.fromEntries(result.answers.map(a => [a.number, a.answer])))
    }).catch(err => { if (live) setError(err.message) })
    return () => {
      live = false
      recognitionRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [assignmentId])

  useEffect(() => {
    if (!session) return
    const tick = () => setRemaining(Math.max(0, Math.ceil(
      (new Date(session.deadline).getTime() - Date.now()) / 1000
    )))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session])

  function speak() {
    if (!session || remaining <= 0) return
    recognitionRef.current?.abort()
    window.speechSynthesis.cancel()
    const question = session.questions[index]
    const utterance = new SpeechSynthesisUtterance(question.question)
    utterance.lang = 'en-IN'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  function startListening() {
    if (!session || remaining <= 0 || busy) return
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setError('Speech recognition is unavailable. Use desktop Chrome or type your answer.')
      return
    }
    window.speechSynthesis.cancel()
    recognitionRef.current?.abort()
    const recognition = new Recognition()
    recognition.lang = 'en-IN'
    recognition.continuous = false
    recognition.interimResults = false
    const n = session.questions[index].number
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(item => item[0].transcript).join(' ').trim()
      setAnswers(previous => ({
        ...previous,
        [n]: [previous[n] || '', transcript].filter(Boolean).join(' ').slice(0, 4000),
      }))
      setDirty(true)
    }
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setError(`Microphone: ${event.error}`)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
      setError('')
    } catch (e) { setError(e.message) }
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  async function saveCurrent() {
    if (!session || remaining <= 0) return false
    setBusy(true)
    setError('')
    try {
      const n = session.questions[index].number
      await saveAnswer(session.attempt_id, n, answers[n] || '')
      setDirty(false)
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally { setBusy(false) }
  }

  async function next() {
    recognitionRef.current?.stop()
    window.speechSynthesis.cancel()
    if (!(await saveCurrent())) return
    setIndex(i => Math.min(i + 1, session.questions.length - 1))
  }

  async function finish() {
    recognitionRef.current?.stop()
    window.speechSynthesis.cancel()
    if (remaining > 0 && !(await saveCurrent())) return
    if (!window.confirm('Submit your viva? You cannot reopen it.')) return
    setBusy(true)
    try {
      await finishViva(session.attempt_id)
      setFinished(true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  if (finished) return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <h1 className="text-2xl font-bold">Viva submitted</h1>
      <p className="mt-3 text-muted">Your faculty will release results after evaluation.</p>
      <Link className="mt-6 inline-block text-primary" to="/student/vivas">Back to My Vivas</Link>
    </div>
  )

  if (!session) return (
    <div className="rounded-xl border border-border bg-surface p-6">
      {error || 'Preparing your viva...'}
      {error && <p className="mt-3 text-muted">Return to My Vivas if this attempt is unavailable.</p>}
    </div>
  )

  const question = session.questions[index]
  const expired = remaining <= 0
  const answer = answers[question.number] || ''

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">{session.title}</h1>
          <p className="text-sm text-muted">Question {index + 1} of {session.questions.length}</p></div>
        <div className="rounded-xl bg-soft px-4 py-2 font-semibold text-primary" aria-live="polite">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-red-600 dark:text-red-400">{error}</p>}
      {expired && <p role="alert" className="text-red-600">Time has expired. Saved answers are retained; submit to close the attempt.</p>}
      <div className="rounded-2xl border border-border bg-surface p-6 space-y-5">
        <h2 className="text-xl font-semibold">{question.question}</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={speak} disabled={expired} className="flex items-center gap-2 rounded-xl border border-border px-4 py-3"><Volume2 size={19}/> Read aloud</button>
          <button type="button" onClick={listening ? stopListening : startListening} disabled={expired || busy}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary disabled:opacity-50">
            {listening ? <MicOff size={19}/> : <Mic size={19}/>}{listening ? 'Stop recording' : 'Speak answer'}
          </button>
          <button type="button" onClick={() => { recognitionRef.current?.abort(); window.speechSynthesis.cancel() }} className="flex items-center gap-2 rounded-xl border border-border px-4 py-3"><Square size={17}/> Stop audio</button>
        </div>
        <label className="block space-y-2"><span className="font-medium">Your transcript (editable)</span>
          <textarea className={inputClass} rows={6} maxLength={4000} value={answer} disabled={expired}
            onChange={e => { setAnswers(a => ({ ...a, [question.number]: e.target.value })); setDirty(true) }}
            placeholder="Speak or type your answer..." /></label>
        <p className="text-xs text-muted">Speech recognition may send audio to your browser provider. Only the text transcript is saved in VivaAI.</p>
        {dirty && <p className="text-sm text-muted">Unsaved answer changes</p>}
        <div className="flex flex-wrap gap-3">
          <button onClick={saveCurrent} disabled={busy || expired || listening} className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 disabled:opacity-50"><Save size={17}/> Save answer</button>
          {index < session.questions.length - 1 && <button onClick={next} disabled={busy || expired || listening} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-on-primary disabled:opacity-50">Save & next <ArrowRight size={18}/></button>}
          <button onClick={finish} disabled={busy || listening} className="rounded-xl border border-border px-4 py-3 font-semibold disabled:opacity-50">Submit viva</button>
        </div>
      </div>
    </div>
  )
}
