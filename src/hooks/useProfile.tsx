import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { loadProfile, signIn as doSignIn, signOut as doSignOut, type Profile } from '@/lib/profile'

interface ProfileValue {
  profile: Profile | null
  signIn: (email: string) => void
  signOut: () => void
}

const ProfileContext = createContext<ProfileValue | null>(null)

/**
 * Holds who is signed in. Changing profile also re-points storage, and the app
 * remounts its routes on the value below so every hook re-reads the right
 * person's saved work.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())

  const signIn = useCallback((email: string) => setProfile(doSignIn(email)), [])
  const signOut = useCallback(() => {
    doSignOut()
    setProfile(null)
  }, [])

  const value = useMemo(() => ({ profile, signIn, signOut }), [profile, signIn, signOut])
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile must be used inside a ProfileProvider')
  return value
}
