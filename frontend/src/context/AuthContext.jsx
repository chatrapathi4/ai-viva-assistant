
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const loadedUserId = useRef(null)

  useEffect(() => {
    let active = true

    async function loadUser(authUser) {
      if (!active) return
      if (authUser && loadedUserId.current === authUser.id) {
            return
        }

        loadedUserId.current = authUser?.id ?? null

      setLoading(true)
      setError('')

      if (!authUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setUser(authUser)
      setProfile(null)

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role, department')
        .eq('id', authUser.id)
        .single()

      if (!active) return

      if (profileError) {
        setError(profileError.message)
      } else {
        setProfile(data)
      }

      setLoading(false)
    }

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setError(error.message)
      }
      loadUser(data?.user ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          loadUser(session?.user ?? null)
        }
      }
    )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, error, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
