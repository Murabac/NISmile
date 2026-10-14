import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { StaffRole } from './database.types.ts'
import { supabase } from './supabase.ts'

type Branch = {
  id: string
  name: string
  address: string | null
}

type Profile = {
  user_id: string
  role: StaffRole
  name: string
}

type AuthValue = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  branches: Branch[]
  branchId: string | 'all'
  setBranchId: (id: string | 'all') => void
  refreshBranches: () => Promise<void>
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (name: string, email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [branchId, setBranchIdState] = useState<string | 'all'>('all')

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        setProfile(null)
        setBranches([])
        setLoading(false)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null

  async function loadBranches() {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, address')
      .eq('active', true)
      .order('name')
    if (error) throw error
    setBranches(data ?? [])
  }

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setBranches([])
      return
    }

    let cancelled = false
    const id = userId
    setLoading(true)

    async function loadStaff() {
      const [profileResult, branchResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, role, name')
          .eq('user_id', id)
          .single(),
        supabase.from('branches').select('id, name, address').eq('active', true).order('name'),
      ])
      if (cancelled) return
      setProfile(profileResult.data ?? null)
      setBranches(branchResult.data ?? [])
      setLoading(false)
    }

    void loadStaff()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (!profile) return

    // With one branch, always use it — never leave owners on "All branches".
    if (branches.length === 1) {
      setBranchIdState(branches[0].id)
      return
    }

    if (profile.role !== 'owner') {
      setBranchIdState((current) =>
        current !== 'all' && branches.some((branch) => branch.id === current)
          ? current
          : (branches[0]?.id ?? ''),
      )
      return
    }
    setBranchIdState((current) => {
      if (current === 'all') return current
      return branches.some((branch) => branch.id === current) ? current : 'all'
    })
  }, [profile, branches])

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      session,
      profile,
      branches,
      branchId,
      setBranchId: (id) => {
        if (id === 'all' && profile?.role !== 'owner') return
        if (id === 'all' && branches.length <= 1) return
        setBranchIdState(id)
      },
      refreshBranches: async () => {
        await loadBranches()
      },
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error?.message ?? null
      },
      signUp: async (name, email, password) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        })
        if (error) return error.message
        if (!data.session) return 'Check your email to confirm the account, then sign in.'
        return null
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [loading, session, profile, branches, branchId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
