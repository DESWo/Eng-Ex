import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  loadProfile,
  leaveProfile as doLeave,
  switchProfile as doSwitch,
  type Profile,
} from '@/lib/profile'

interface ProfileValue {
  profile: Profile | null
  /** Start using a named profile on this device. */
  switchProfile: (name: string) => void
  /** Go back to the guest slot. */
  leaveProfile: () => void
}

const ProfileContext = createContext<ProfileValue | null>(null)

/**
 * Holds which local profile is in use. Changing it re-points storage, and App
 * remounts its routes on this value so every hook re-reads the right work.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())

  const switchProfile = useCallback((name: string) => setProfile(doSwitch(name)), [])
  const leaveProfile = useCallback(() => {
    doLeave()
    setProfile(null)
  }, [])

  const value = useMemo(
    () => ({ profile, switchProfile, leaveProfile }),
    [profile, switchProfile, leaveProfile],
  )
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile must be used inside a ProfileProvider')
  return value
}
