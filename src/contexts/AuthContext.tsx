
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'

import type {
  Session,
  User,
} from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'

/* ============================================================
   TYPES
============================================================ */

export type UserRole =
  | 'admin'
  | 'manager'
  | 'accountant'
  | 'employee'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  phone: string
  whatsapp: string
  avatar_url: string | null
  role: UserRole
  status: 'Active' | 'Inactive'
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface AuthAdmin {
  id: string
  name: string
  email: string
  role: string
  last_login?: string | null
  last_login_at?: string | null
}

export interface ProfileUpdates {
  full_name?: string
  phone?: string | null
  whatsapp?: string | null
  avatar_url?: string | null
}

interface AuthContextType {
  user: UserProfile | null
  admin: AuthAdmin | null
  session: Session | null

  loading: boolean
  isLoading: boolean
  isAuthenticated: boolean

  signIn: (
    email: string,
    password: string
  ) => Promise<{
    error: Error | null
  }>

  signOut: () => Promise<{
    error: Error | null
  }>

  logout: () => Promise<{
    error: Error | null
  }>

  refreshProfile: () => Promise<void>

  updateProfile: (
    updates: ProfileUpdates
  ) => Promise<{
    error: Error | null
  }>
}

interface AuthProviderProps {
  children: ReactNode
}

interface SessionTracking {
  userId: string
  startedAt: number
  lastActivityAt: number
}

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  )

/* ============================================================
   SESSION SECURITY CONFIGURATION
============================================================ */

// Logout after 15 minutes without user activity.
const INACTIVITY_TIMEOUT =
  15 * 60 * 1000

// Maximum login duration: 4 hours.
const MAX_SESSION_DURATION =
  4 * 60 * 60 * 1000

// Check session validity every 10 seconds.
const SESSION_CHECK_INTERVAL = 10 * 1000

// Limit how frequently activity writes to storage.
const ACTIVITY_WRITE_INTERVAL = 5 * 1000

const SESSION_STORAGE_KEY =
  'xyphora_prime_auth_tracking_v1'

/* ============================================================
   HELPERS
============================================================ */

function normalize(
  value: string | null | undefined
): string {
  return value?.trim() || ''
}

function getAuthError(
  error: unknown,
  fallback: string
): Error {
  if (error instanceof Error) {
    return error
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    const message = (
      error as {
        message?: unknown
      }
    ).message

    if (
      typeof message === 'string' &&
      message.trim()
    ) {
      return new Error(message)
    }
  }

  return new Error(fallback)
}

/* ============================================================
   SESSION STORAGE HELPERS
============================================================ */

function readSessionTracking():
  SessionTracking | null {
  try {
    const raw = localStorage.getItem(
      SESSION_STORAGE_KEY
    )

    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)

    if (
      typeof parsed !== 'object' ||
      parsed === null
    ) {
      return null
    }

    const record =
      parsed as Partial<SessionTracking>

    if (
      typeof record.userId !== 'string' ||
      typeof record.startedAt !== 'number' ||
      typeof record.lastActivityAt !== 'number' ||
      !Number.isFinite(record.startedAt) ||
      !Number.isFinite(record.lastActivityAt)
    ) {
      return null
    }

    return {
      userId: record.userId,
      startedAt: record.startedAt,
      lastActivityAt: record.lastActivityAt,
    }
  } catch {
    return null
  }
}

function saveSessionTracking(
  tracking: SessionTracking
): void {
  try {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(tracking)
    )
  } catch (error) {
    console.error(
      'Unable to save session tracking:',
      error
    )
  }
}

function clearSessionTracking(): void {
  try {
    localStorage.removeItem(
      SESSION_STORAGE_KEY
    )
  } catch (error) {
    console.error(
      'Unable to clear session tracking:',
      error
    )
  }
}

function getSessionStart(
  currentSession: Session
): number {
  const lastSignIn =
    currentSession.user.last_sign_in_at

  if (lastSignIn) {
    const parsed = Date.parse(lastSignIn)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  // Fallback if Supabase does not provide a
  // last-sign-in timestamp.
  return Date.now()
}

function initializeSessionTracking(
  currentSession: Session
): SessionTracking {
  const existing = readSessionTracking()

  if (
    existing &&
    existing.userId === currentSession.user.id
  ) {
    return existing
  }

  // Do not treat a page reload as a new login.
  // Use Supabase's most recent sign-in timestamp.
  const startedAt =
    getSessionStart(currentSession)

  const tracking: SessionTracking = {
    userId: currentSession.user.id,
    startedAt,
    lastActivityAt: startedAt,
  }

  saveSessionTracking(tracking)

  return tracking
}

function getSessionExpiryReason(
  tracking: SessionTracking
): 'inactive' | 'maximum' | null {
  const now = Date.now()

  if (
    tracking.startedAt > now ||
    tracking.lastActivityAt > now
  ) {
    return 'maximum'
  }

  if (
    now - tracking.startedAt >=
    MAX_SESSION_DURATION
  ) {
    return 'maximum'
  }

  if (
    now - tracking.lastActivityAt >=
    INACTIVITY_TIMEOUT
  ) {
    return 'inactive'
  }

  return null
}

/* ============================================================
   AUTH PROVIDER
============================================================ */

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<UserProfile | null>(null)

  const [session, setSession] =
    useState<Session | null>(null)

  const [loading, setLoading] =
    useState(true)

  const sessionRef =
    useRef<Session | null>(null)

  const signingOutRef =
    useRef(false)

  const lastActivityWriteRef =
    useRef(0)

  const authRequestRef =
    useRef(0)

  /* ==========================================================
     CLEAR LOCAL AUTHENTICATION STATE
  ========================================================== */

  const clearAuthState =
    useCallback(() => {
      authRequestRef.current += 1
      sessionRef.current = null
      setSession(null)
      setUser(null)
      setLoading(false)
    }, [])

  /* ==========================================================
     LOAD USER PROFILE
  ========================================================== */

  const loadProfile =
    useCallback(
      async (
        authUser: User
      ): Promise<UserProfile | null> => {
        const {
          data,
          error,
        } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle()

        if (error) {
          console.error(
            'Failed to load user profile:',
            error
          )

          return null
        }

        if (!data) {
          return null
        }

        return data as UserProfile
      },
      []
    )

  /* ==========================================================
     SIGN OUT
  ========================================================== */

  const signOut =
    useCallback(
      async (): Promise<{
        error: Error | null
      }> => {
        if (signingOutRef.current) {
          return {
            error: null,
          }
        }

        signingOutRef.current = true

        // Immediately remove protected application state.
        clearAuthState()
        clearSessionTracking()

        try {
          const {
            error,
          } = await supabase.auth.signOut()

          if (error) {
            return {
              error: new Error(error.message),
            }
          }

          return {
            error: null,
          }
        } catch (error) {
          return {
            error: getAuthError(
              error,
              'Unable to sign out.'
            ),
          }
        } finally {
          signingOutRef.current = false
        }
      },
      [clearAuthState]
    )

  // Keep the existing logout API for compatibility.
  const logout = signOut

  /* ==========================================================
     AUTOMATIC SESSION EXPIRATION
  ========================================================== */

  const expireSession =
    useCallback(
      async (
        reason: 'inactive' | 'maximum'
      ): Promise<void> => {
        if (signingOutRef.current) {
          return
        }

        console.info(
          reason === 'inactive'
            ? 'Session expired due to inactivity.'
            : 'Maximum session duration reached.'
        )

        const result = await signOut()

        if (result.error) {
          console.error(
            'Automatic logout failed:',
            result.error
          )
        }
      },
      [signOut]
    )

  /* ==========================================================
     VALIDATE CURRENT SESSION
  ========================================================== */

  const validateSession =
    useCallback(
      (
        currentSession: Session | null
      ): boolean => {
        if (!currentSession) {
          return false
        }

        if (signingOutRef.current) {
          return false
        }

        const tracking =
          initializeSessionTracking(
            currentSession
          )

        const expiryReason =
          getSessionExpiryReason(tracking)

        if (expiryReason) {
          void expireSession(expiryReason)

          return false
        }

        return true
      },
      [expireSession]
    )

  /* ==========================================================
     RECORD USER ACTIVITY
  ========================================================== */

  const recordActivity =
    useCallback(() => {
      const currentSession =
        sessionRef.current

      if (
        !currentSession ||
        signingOutRef.current
      ) {
        return
      }

      // Validate before extending inactivity time.
      // An expired session must never be revived
      // by clicking or moving the mouse.
      if (!validateSession(currentSession)) {
        return
      }

      const now = Date.now()

      if (
        now - lastActivityWriteRef.current <
        ACTIVITY_WRITE_INTERVAL
      ) {
        return
      }

      const tracking =
        readSessionTracking()

      if (
        !tracking ||
        tracking.userId !==
          currentSession.user.id
      ) {
        return
      }

      const updated: SessionTracking = {
        ...tracking,
        lastActivityAt: now,
      }

      saveSessionTracking(updated)

      lastActivityWriteRef.current = now
    }, [validateSession])

  /* ==========================================================
     SYNC AUTHENTICATION SESSION
  ========================================================== */

  const syncAuthSession =
    useCallback(
      async (
        currentSession: Session | null
      ): Promise<void> => {
        const requestId =
          ++authRequestRef.current

        if (!currentSession) {
          clearAuthState()
          return
        }

        if (
          !validateSession(currentSession)
        ) {
          return
        }

        sessionRef.current =
          currentSession

        setSession(currentSession)

        try {
          const profile =
            await loadProfile(
              currentSession.user
            )

          // Ignore results from outdated async requests.
          if (
            requestId !==
            authRequestRef.current
          ) {
            return
          }

          if (
            !validateSession(currentSession)
          ) {
            return
          }

          if (
            !profile ||
            profile.status !== 'Active'
          ) {
            console.warn(
              'Authentication rejected: missing or inactive profile.'
            )

            await signOut()
            return
          }

          setUser(profile)
        } catch (error) {
          console.error(
            'Failed to synchronize authentication:',
            error
          )

          if (
            requestId ===
            authRequestRef.current
          ) {
            clearAuthState()
          }
        } finally {
          if (
            requestId ===
            authRequestRef.current
          ) {
            setLoading(false)
          }
        }
      },
      [
        clearAuthState,
        loadProfile,
        signOut,
        validateSession,
      ]
    )

  /* ==========================================================
     INITIALIZE AUTHENTICATION
  ========================================================== */

  useEffect(() => {
    let mounted = true

    const initializeAuth =
      async () => {
        try {
          const {
            data: {
              session: currentSession,
            },
            error,
          } =
            await supabase.auth.getSession()

          if (error) {
            throw error
          }

          if (!mounted) {
            return
          }

          await syncAuthSession(
            currentSession
          )
        } catch (error) {
          console.error(
            'Failed to initialize authentication:',
            error
          )

          if (mounted) {
            clearAuthState()
          }
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      }

    void initializeAuth()

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (_event, currentSession) => {
          if (!mounted) {
            return
          }

          // Do not perform additional Supabase
          // requests synchronously inside this callback.
          window.setTimeout(() => {
            if (!mounted) {
              return
            }

            void syncAuthSession(
              currentSession
            )
          }, 0)
        }
      )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [
    clearAuthState,
    syncAuthSession,
  ])

  /* ==========================================================
     INACTIVITY AND SESSION MONITORING
  ========================================================== */

  useEffect(() => {
    const checkSession = () => {
      const currentSession =
        sessionRef.current

      if (!currentSession) {
        return
      }

      validateSession(currentSession)
    }

    const activityEvents = [
      'pointerdown',
      'keydown',
      'touchstart',
      'scroll',
    ] as const

    activityEvents.forEach((eventName) => {
      window.addEventListener(
        eventName,
        recordActivity,
        { passive: true }
      )
    })

    const handleVisibilityChange = () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        checkSession()
      }
    }

    const handleFocus = () => {
      checkSession()
    }

    const handleStorageChange = (
      event: StorageEvent
    ) => {
      if (
        event.key !==
        SESSION_STORAGE_KEY
      ) {
        return
      }

      const currentSession =
        sessionRef.current

      if (!currentSession) {
        return
      }

      if (!event.newValue) {
        // Another tab removed the tracking record.
        // The user has logged out elsewhere.
        void signOut()
        return
      }

      checkSession()
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )

    window.addEventListener(
      'focus',
      handleFocus
    )

    window.addEventListener(
      'storage',
      handleStorageChange
    )

    const interval =
      window.setInterval(
        checkSession,
        SESSION_CHECK_INTERVAL
      )

    // Validate immediately when monitoring starts.
    checkSession()

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          recordActivity
        )
      })

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )

      window.removeEventListener(
        'focus',
        handleFocus
      )

      window.removeEventListener(
        'storage',
        handleStorageChange
      )

      window.clearInterval(interval)
    }
  }, [
    recordActivity,
    signOut,
    validateSession,
  ])

  /* ==========================================================
     REFRESH PROFILE
  ========================================================== */

  const refreshProfile =
    useCallback(
      async (): Promise<void> => {
        try {
          const currentSession =
            sessionRef.current

          if (
            !currentSession ||
            !validateSession(currentSession)
          ) {
            setUser(null)
            return
          }

          const {
            data: {
              user: authUser,
            },
            error,
          } =
            await supabase.auth.getUser()

          if (error) {
            throw error
          }

          if (!authUser) {
            await signOut()
            return
          }

          const profile =
            await loadProfile(authUser)

          if (
            !validateSession(
              sessionRef.current
            )
          ) {
            return
          }

          if (
            !profile ||
            profile.status !== 'Active'
          ) {
            await signOut()
            return
          }

          setUser(profile)
        } catch (error) {
          console.error(
            'Failed to refresh profile:',
            error
          )

          setUser(null)
        }
      },
      [
        loadProfile,
        signOut,
        validateSession,
      ]
    )

  /* ==========================================================
     UPDATE PROFILE
  ========================================================== */

  const updateProfile =
    useCallback(
      async (
        updates: ProfileUpdates
      ): Promise<{
        error: Error | null
      }> => {
        try {
          const currentSession =
            sessionRef.current

          if (
            !currentSession ||
            !validateSession(currentSession)
          ) {
            throw new Error(
              'Your session has expired. Please sign in again.'
            )
          }

          const {
            data: {
              user: authUser,
            },
            error: userError,
          } =
            await supabase.auth.getUser()

          if (userError) {
            throw userError
          }

          if (!authUser) {
            throw new Error(
              'Your session has expired. Please sign in again.'
            )
          }

          const profileUpdates: {
            full_name?: string
            phone?: string | null
            whatsapp?: string | null
            avatar_url?: string | null
          } = {}

          if (
            updates.full_name !== undefined
          ) {
            const fullName =
              normalize(
                updates.full_name
              )

            if (!fullName) {
              throw new Error(
                'Full name cannot be empty.'
              )
            }

            profileUpdates.full_name =
              fullName
          }

          if (
            updates.phone !== undefined
          ) {
            profileUpdates.phone =
              normalize(
                updates.phone
              ) || null
          }

          if (
            updates.whatsapp !== undefined
          ) {
            profileUpdates.whatsapp =
              normalize(
                updates.whatsapp
              ) || null
          }

          if (
            updates.avatar_url !== undefined
          ) {
            profileUpdates.avatar_url =
              updates.avatar_url || null
          }

          if (
            Object.keys(
              profileUpdates
            ).length > 0
          ) {
            const {
              error: profileError,
            } = await supabase
              .from('profiles')
              .update(profileUpdates)
              .eq('id', authUser.id)

            if (profileError) {
              throw profileError
            }
          }

          // Keep Supabase Auth metadata synchronized.
          const metadataUpdates: {
            full_name?: string
            name?: string
            phone?: string
            whatsapp?: string
            avatar_url?: string | null
          } = {}

          if (
            updates.full_name !== undefined
          ) {
            const fullName =
              normalize(
                updates.full_name
              )

            metadataUpdates.full_name =
              fullName

            metadataUpdates.name =
              fullName
          }

          if (
            updates.phone !== undefined
          ) {
            metadataUpdates.phone =
              normalize(
                updates.phone
              )
          }

          if (
            updates.whatsapp !== undefined
          ) {
            metadataUpdates.whatsapp =
              normalize(
                updates.whatsapp
              )
          }

          if (
            updates.avatar_url !== undefined
          ) {
            metadataUpdates.avatar_url =
              updates.avatar_url
          }

          if (
            Object.keys(
              metadataUpdates
            ).length > 0
          ) {
            const {
              error: authUpdateError,
            } =
              await supabase.auth.updateUser({
                data: metadataUpdates,
              })

            if (authUpdateError) {
              throw authUpdateError
            }
          }

          const updatedProfile =
            await loadProfile(authUser)

          if (
            !validateSession(
              sessionRef.current
            )
          ) {
            throw new Error(
              'Your session has expired. Please sign in again.'
            )
          }

          if (
            updatedProfile &&
            updatedProfile.status === 'Active'
          ) {
            setUser(updatedProfile)
          }

          return {
            error: null,
          }
        } catch (error) {
          const normalizedError =
            getAuthError(
              error,
              'Failed to update profile.'
            )

          console.error(
            'Failed to update profile:',
            normalizedError
          )

          return {
            error: normalizedError,
          }
        }
      },
      [
        loadProfile,
        validateSession,
      ]
    )

  /* ==========================================================
     SIGN IN
  ========================================================== */

  const signIn =
    useCallback(
      async (
        email: string,
        password: string
      ): Promise<{
        error: Error | null
      }> => {
        const cleanEmail =
          normalize(email)

        if (!cleanEmail) {
          return {
            error: new Error(
              'Please enter your email address.'
            ),
          }
        }

        if (!password) {
          return {
            error: new Error(
              'Please enter your password.'
            ),
          }
        }

        setLoading(true)

        try {
          const {
            data,
            error,
          } =
            await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            })

          if (error) {
            setLoading(false)

            return {
              error: new Error(
                error.message
              ),
            }
          }

          if (
            !data.user ||
            !data.session
          ) {
            setLoading(false)

            return {
              error: new Error(
                'Authentication failed. No session was returned.'
              ),
            }
          }

          const profile =
            await loadProfile(
              data.user
            )

          if (!profile) {
            await signOut()

            return {
              error: new Error(
                'Your account profile could not be found.'
              ),
            }
          }

          if (
            profile.status !== 'Active'
          ) {
            await signOut()

            return {
              error: new Error(
                'Your account is currently inactive.'
              ),
            }
          }

          // New login: start a fresh 4-hour session.
          const now = Date.now()

          saveSessionTracking({
            userId: data.user.id,
            startedAt: now,
            lastActivityAt: now,
          })

          lastActivityWriteRef.current = now

          const loginTime =
            new Date(now).toISOString()

          // Update last login in profiles.
          const {
            error: lastLoginError,
          } = await supabase
            .from('profiles')
            .update({
              last_login_at: loginTime,
            })
            .eq('id', data.user.id)

          if (lastLoginError) {
            console.error(
              'Failed to update last login time:',
              lastLoginError
            )
          }

          const updatedProfile: UserProfile = {
            ...profile,
            last_login_at: loginTime,
          }

          sessionRef.current =
            data.session

          setSession(data.session)
          setUser(updatedProfile)
          setLoading(false)

          return {
            error: null,
          }
        } catch (error) {
          setLoading(false)

          return {
            error: getAuthError(
              error,
              'Unable to sign in.'
            ),
          }
        }
      },
      [
        loadProfile,
        signOut,
      ]
    )

  /* ==========================================================
     ADMIN OBJECT
  ========================================================== */

  const admin: AuthAdmin | null =
    user
      ? {
          id: user.id,
          name:
            user.full_name ||
            user.email.split('@')[0],
          email: user.email,
          role: user.role,
          last_login:
            user.last_login_at,
          last_login_at:
            user.last_login_at,
        }
      : null

  /* ==========================================================
     AUTHENTICATION STATUS
  ========================================================== */

  const isAuthenticated =
    !loading &&
    !!session &&
    !!user &&
    user.status === 'Active'

  const isLoading = loading

  /* ==========================================================
     PROVIDER
  ========================================================== */

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        session,
        loading,
        isLoading,
        isAuthenticated,
        signIn,
        signOut,
        logout,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/* ============================================================
   AUTH HOOK
============================================================ */

export function useAuth() {
  const context =
    useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used inside an AuthProvider'
    )
  }

  return context
}
