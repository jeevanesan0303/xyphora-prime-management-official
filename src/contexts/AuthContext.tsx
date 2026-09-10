import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type {
  Session,
  User,
} from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'

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

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  )

interface AuthProviderProps {
  children: ReactNode
}

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

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<UserProfile | null>(null)

  const [session, setSession] =
    useState<Session | null>(null)

  const [loading, setLoading] =
    useState(true)

  /*
   * ------------------------------------------------------------
   * LOAD PROFILE
   * ------------------------------------------------------------
   *
   * Loads the application's profile row using
   * the authenticated Supabase user ID.
   */
  const loadProfile = async (
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
  }

  /*
   * ------------------------------------------------------------
   * REFRESH PROFILE
   * ------------------------------------------------------------
   */
  const refreshProfile = async (): Promise<void> => {
    try {
      const {
        data: {
          user: authUser,
        },
        error,
      } = await supabase.auth.getUser()

      if (error) {
        throw error
      }

      if (!authUser) {
        setUser(null)
        return
      }

      const profile =
        await loadProfile(authUser)

      setUser(profile)
    } catch (error) {
      console.error(
        'Failed to refresh profile:',
        error
      )

      setUser(null)
    }
  }

  /*
   * ------------------------------------------------------------
   * UPDATE PROFILE
   * ------------------------------------------------------------
   *
   * This is used by ProfilePage.
   *
   * Database:
   *   profiles.full_name
   *   profiles.phone
   *   profiles.whatsapp
   *   profiles.avatar_url
   *
   * Auth metadata is also synchronized so the
   * authenticated Supabase user remains consistent.
   */
  const updateProfile = async (
    updates: ProfileUpdates
  ): Promise<{
    error: Error | null
  }> => {
    try {
      const {
        data: {
          user: authUser,
        },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) {
        throw userError
      }

      if (!authUser) {
        throw new Error(
          'Your session has expired. Please sign in again.'
        )
      }

      /*
       * Build a clean database payload.
       *
       * Only include properties that were actually
       * supplied by the caller.
       */
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

      /*
       * Only perform a database update if
       * there is actually something to update.
       */
      if (
        Object.keys(
          profileUpdates
        ).length > 0
      ) {
        const {
          error: profileError,
        } = await supabase
          .from('profiles')
          .update(
            profileUpdates
          )
          .eq(
            'id',
            authUser.id
          )

        if (profileError) {
          throw profileError
        }
      }

      /*
       * Synchronize useful profile information
       * with Supabase Auth metadata.
       */
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
          await supabase.auth.updateUser(
            {
              data: metadataUpdates,
            }
          )

        if (authUpdateError) {
          throw authUpdateError
        }
      }

      /*
       * Reload the actual profile from the database
       * so local application state is guaranteed to
       * match the stored record.
       */
      const updatedProfile =
        await loadProfile(
          authUser
        )

      if (updatedProfile) {
        setUser(
          updatedProfile
        )
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
  }

  /*
   * ------------------------------------------------------------
   * INITIALIZE AUTH
   * ------------------------------------------------------------
   */
  useEffect(() => {
    let mounted = true

    const initializeAuth =
      async () => {
        try {
          const {
            data: {
              session:
                currentSession,
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

          setSession(
            currentSession
          )

          if (
            currentSession?.user
          ) {
            const profile =
              await loadProfile(
                currentSession.user
              )

            if (!mounted) {
              return
            }

            setUser(profile)
          } else {
            setUser(null)
          }
        } catch (error) {
          console.error(
            'Failed to initialize authentication:',
            error
          )

          if (mounted) {
            setSession(null)
            setUser(null)
          }
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      }

    void initializeAuth()

    /*
     * Supabase auth events can fire while the
     * application is rendering. Defer the profile
     * request so we do not perform another Supabase
     * operation directly inside the auth callback.
     */
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

          setSession(
            currentSession
          )

          if (!currentSession) {
            setUser(null)
            setLoading(false)
            return
          }

          window.setTimeout(
            () => {
              if (!mounted) {
                return
              }

              void loadProfile(
                currentSession.user
              ).then(
                (profile) => {
                  if (!mounted) {
                    return
                  }

                  setUser(profile)
                  setLoading(false)
                }
              )
            },
            0
          )
        }
      )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  /*
   * ------------------------------------------------------------
   * SIGN IN
   * ------------------------------------------------------------
   */
  const signIn = async (
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

    try {
      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email: cleanEmail,
            password,
          }
        )

      if (error) {
        return {
          error: new Error(
            error.message
          ),
        }
      }

      if (!data.user) {
        return {
          error: new Error(
            'Authentication failed. No user was returned.'
          ),
        }
      }

      const profile =
        await loadProfile(
          data.user
        )

      if (!profile) {
        await supabase.auth.signOut()

        return {
          error: new Error(
            'Your account profile could not be found.'
          ),
        }
      }

      if (
        profile.status !==
        'Active'
      ) {
        await supabase.auth.signOut()

        return {
          error: new Error(
            'Your account is currently inactive.'
          ),
        }
      }

      const loginTime =
        new Date().toISOString()

      /*
       * Update last login timestamp.
       */
      const {
        error:
          lastLoginError,
      } =
        await supabase
          .from('profiles')
          .update({
            last_login_at:
              loginTime,
          })
          .eq(
            'id',
            data.user.id
          )

      if (lastLoginError) {
        console.error(
          'Failed to update last login time:',
          lastLoginError
        )

        /*
         * This should not prevent an otherwise
         * successful authentication.
         */
      }

      const updatedProfile: UserProfile =
        {
          ...profile,
          last_login_at:
            loginTime,
        }

      setSession(
        data.session
      )

      setUser(
        updatedProfile
      )

      return {
        error: null,
      }
    } catch (error) {
      return {
        error: getAuthError(
          error,
          'Unable to sign in.'
        ),
      }
    }
  }

  /*
   * ------------------------------------------------------------
   * SIGN OUT
   * ------------------------------------------------------------
   */
  const signOut = async (): Promise<{
    error: Error | null
  }> => {
    try {
      const {
        error,
      } =
        await supabase.auth.signOut()

      if (error) {
        return {
          error: new Error(
            error.message
          ),
        }
      }

      setUser(null)
      setSession(null)

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
    }
  }

  /*
   * Keep logout as an alias for compatibility
   * with existing pages/components.
   */
  const logout = signOut

  /*
   * ------------------------------------------------------------
   * ADMIN OBJECT
   * ------------------------------------------------------------
   */
  const admin: AuthAdmin | null =
    user
      ? {
          id: user.id,

          name:
            user.full_name ||
            user.email.split(
              '@'
            )[0],

          email: user.email,

          role: user.role,

          last_login:
            user.last_login_at,

          last_login_at:
            user.last_login_at,
        }
      : null

  const isAuthenticated =
    !loading &&
    !!session &&
    !!user

  const isLoading = loading

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

export function useAuth() {
  const context =
    useContext(
      AuthContext
    )

  if (!context) {
    throw new Error(
      'useAuth must be used inside an AuthProvider'
    )
  }

  return context
}