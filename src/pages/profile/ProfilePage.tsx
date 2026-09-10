import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import {
  User,
  Building2,
  Lock,
  Clock,
  Camera,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  parsePhoneNumber,
} from 'react-phone-number-input'

import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import { formatDateTime } from '../../lib/utils'
import { supabase } from '../../lib/supabase'

import {
  PageHeader,
  Card,
  Button,
  Input,
  Textarea,
  InternationalPhoneField,
  replaceCountryCallingCode,
  cleanPhone,
  validateInternationalPhone,
  getCountryFromPhone,
  type Country,
} from '../../components/ui'

type Tab =
  | 'personal'
  | 'company'
  | 'security'

type PersonalForm = {
  name: string
  phone: string
  whatsapp: string
}

type CompanyForm = {
  company_name: string
  registration_number: string
  phone: string
  email: string
  website: string
  address: string
}

type AdminProfile = {
  name?: string
  full_name?: string
  email?: string
  phone?: string
  whatsapp?: string
  avatar_url?: string | null
  last_login?: string | null
  last_login_at?: string | null
}

type ProfileUploadResponse = {
  success?: boolean
  message?: string
  error?: string
  avatarUrl?: string | null
  avatar_url?: string | null
  objectKey?: string | null
  profile?: {
    avatarUrl?: string | null
    avatar_url?: string | null
  }
}

type ProfileUrlResponse = {
  success?: boolean
  error?: string
  url?: string | null
  avatarUrl?: string | null
  objectKey?: string | null
  expiresIn?: number
}

const MAX_AVATAR_SIZE = 5 * 1024 * 1024

const ALLOWED_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const normalize = (
  value: string | null | undefined,
): string => {
  return value?.trim() || ''
}

const isValidEmail = (
  value: string,
): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  )
}

function getErrorMessage(
  err: unknown,
  fallback: string,
): string {
  if (
    err instanceof Error &&
    err.message
  ) {
    return err.message
  }

  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err
  ) {
    const message = (
      err as {
        message?: unknown
      }
    ).message

    if (
      typeof message === 'string' &&
      message
    ) {
      return message
    }
  }

  return fallback
}

export default function ProfilePage() {
  const {
    admin,
    user,
    refreshProfile,
  } = useAuth()

  const { settings } = useData()

  const {
    success,
    error,
  } = useToast()

  const [
    tab,
    setTab,
  ] = useState<Tab>('personal')

  /* =========================================================
     PERSONAL FORM
  ========================================================= */

  const [
    personalForm,
    setPersonalForm,
  ] = useState<PersonalForm>({
    name: '',
    phone: '',
    whatsapp: '',
  })

  const [
    personalPhoneCountry,
    setPersonalPhoneCountry,
  ] = useState<Country>('LK')

  const [
    personalWhatsappCountry,
    setPersonalWhatsappCountry,
  ] = useState<Country>('LK')

  /* =========================================================
     COMPANY FORM
  ========================================================= */

  const [
    companyForm,
    setCompanyForm,
  ] = useState<CompanyForm>({
    company_name: '',
    registration_number: '',
    phone: '',
    email: '',
    website: '',
    address: '',
  })

  /* =========================================================
     SECURITY
  ========================================================= */

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState('')

  const [
    newPassword,
    setNewPassword,
  ] = useState('')

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('')

  /* =========================================================
     LOADING STATES
  ========================================================= */

  const [
    savingPersonal,
    setSavingPersonal,
  ] = useState(false)

  const [
    savingCompany,
    setSavingCompany,
  ] = useState(false)

  const [
    changingPassword,
    setChangingPassword,
  ] = useState(false)

  const [
    profileLoading,
    setProfileLoading,
  ] = useState(true)

  /* =========================================================
     AVATAR STATE
  ========================================================= */

  const [
    avatarUrl,
    setAvatarUrl,
  ] = useState<string | null>(null)

  const [
    avatarLoading,
    setAvatarLoading,
  ] = useState(false)

  const [
    selectedAvatar,
    setSelectedAvatar,
  ] = useState<File | null>(null)

  const [
    previewUrl,
    setPreviewUrl,
  ] = useState<string | null>(null)

  const [
    uploadingAvatar,
    setUploadingAvatar,
  ] = useState(false)

  const [
    removingAvatar,
    setRemovingAvatar,
  ] = useState(false)

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    )

  /* =========================================================
     ADMIN DISPLAY DATA
  ========================================================= */

  const adminRecord =
    admin as AdminProfile | null

  const displayName =
    normalize(
      adminRecord?.name,
    ) ||
    normalize(
      adminRecord?.full_name,
    ) ||
    normalize(
      user?.full_name,
    ) ||
    'Administrator'

  const displayEmail =
    normalize(
      adminRecord?.email,
    ) ||
    normalize(
      user?.email,
    )

  const initials = useMemo(() => {
    const parts =
      displayName
        .trim()
        .split(/\s+/)
        .filter(Boolean)

    if (
      parts.length === 0
    ) {
      return 'A'
    }

    return parts
      .map(
        (part) =>
          part.charAt(0),
      )
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [displayName])

  /* =========================================================
     LOAD PERSONAL PROFILE
  ========================================================= */

  useEffect(() => {
    let mounted = true

    const loadPersonalProfile =
      async () => {
        try {
          setProfileLoading(true)

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
              'Your session has expired. Please sign in again.',
            )
          }

          const {
            data: profile,
            error: profileError,
          } =
            await supabase
              .from('profiles')
              .select(
                'full_name, phone, avatar_url',
              )
              .eq(
                'id',
                authUser.id,
              )
              .maybeSingle()

          if (profileError) {
            throw profileError
          }

          if (!mounted) {
            return
          }

          const metadata =
            authUser.user_metadata ??
            {}

          const metadataPhone =
            typeof metadata.phone ===
            'string'
              ? metadata.phone
              : ''

          const metadataWhatsapp =
            typeof metadata.whatsapp ===
            'string'
              ? metadata.whatsapp
              : ''

          const profileName =
            normalize(
              profile?.full_name,
            ) ||
            normalize(
              typeof metadata.full_name ===
                'string'
                ? metadata.full_name
                : '',
            ) ||
            normalize(
              typeof metadata.name ===
                'string'
                ? metadata.name
                : '',
            ) ||
            displayName

          const phone =
            normalize(
              profile?.phone,
            ) ||
            normalize(
              metadataPhone,
            )

          const whatsapp =
            normalize(
              metadataWhatsapp,
            )

          const phoneCountry =
            getCountryFromPhone(
              phone,
              'LK',
            )

          const whatsappCountry =
            getCountryFromPhone(
              whatsapp,
              phoneCountry,
            )

          setPersonalPhoneCountry(
            phoneCountry,
          )

          setPersonalWhatsappCountry(
            whatsappCountry,
          )

          setPersonalForm({
            name: profileName,
            phone,
            whatsapp,
          })

          /*
           * profiles.avatar_url contains
           * the private R2 object key.
           *
           * We never use that key directly
           * as an <img src>.
           */
          if (
            profile?.avatar_url
          ) {
            setAvatarUrl(
              profile.avatar_url,
            )
          } else {
            setAvatarUrl(null)
          }
        } catch (err) {
          console.error(
            'Failed to load personal profile:',
            err,
          )

          if (mounted) {
            error(
              getErrorMessage(
                err,
                'Unable to load profile information.',
              ),
            )
          }
        } finally {
          if (mounted) {
            setProfileLoading(false)
          }
        }
      }

    void loadPersonalProfile()

    return () => {
      mounted = false
    }
  }, [displayName, error])

  /* =========================================================
     LOAD SIGNED PROFILE IMAGE
  ========================================================= */

  const loadProfileAvatar =
    useCallback(
      async () => {
        if (!user?.id) {
          setAvatarUrl(null)
          return
        }

        /*
         * Read the current profile directly
         * so this remains accurate after
         * upload/remove.
         */
        const {
          data: profile,
          error:
            profileError,
        } =
          await supabase
            .from('profiles')
            .select('avatar_url')
            .eq(
              'id',
              user.id,
            )
            .maybeSingle()

        if (profileError) {
          console.error(
            'Failed to read profile avatar reference:',
            profileError,
          )

          setAvatarUrl(null)
          return
        }

        if (
          !profile?.avatar_url
        ) {
          setAvatarUrl(null)
          return
        }

        setAvatarLoading(true)

        try {
          const {
            data:
              sessionData,
            error:
              sessionError,
          } =
            await supabase.auth.getSession()

          if (sessionError) {
            throw sessionError
          }

          const accessToken =
            sessionData.session
              ?.access_token

          if (!accessToken) {
            throw new Error(
              'Authentication session is unavailable.',
            )
          }

          /*
           * r2-profile-url reads the
           * avatar_url object key and
           * generates a private signed URL.
           */
          const {
            data,
            error:
              functionError,
          } =
            await supabase.functions.invoke(
              'r2-profile-url',
              {
                body: {},
                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },
              },
            )

          if (functionError) {
            throw new Error(
              functionError.message ||
                'Unable to load profile image.',
            )
          }

          const response =
            data as ProfileUrlResponse

          if (
            response?.success ===
            false
          ) {
            throw new Error(
              response.error ||
                'Unable to load profile image.',
            )
          }

          const signedUrl =
            response?.url ||
            response?.avatarUrl ||
            null

          setAvatarUrl(
            signedUrl,
          )
        } catch (err) {
          console.error(
            'Failed to load profile avatar:',
            err,
          )

          /*
           * Don't show a broken image.
           * Fall back to initials.
           */
          setAvatarUrl(null)
        } finally {
          setAvatarLoading(false)
        }
      },
      [user?.id],
    )

  useEffect(() => {
    void loadProfileAvatar()
  }, [loadProfileAvatar])

  /* =========================================================
     LOAD COMPANY INFORMATION
  ========================================================= */

  useEffect(() => {
    if (!settings) {
      return
    }

    setCompanyForm({
      company_name:
        normalize(
          settings.company_name,
        ),

      registration_number:
        normalize(
          settings.registration_number,
        ),

      phone:
        normalize(
          settings.phone,
        ),

      email:
        normalize(
          settings.email,
        ),

      website:
        normalize(
          settings.website,
        ),

      address:
        normalize(
          settings.address,
        ),
    })
  }, [settings])

  /* =========================================================
     CLEANUP LOCAL PREVIEW
  ========================================================= */

  useEffect(() => {
    return () => {
      if (
        previewUrl?.startsWith(
          'blob:',
        )
      ) {
        URL.revokeObjectURL(
          previewUrl,
        )
      }
    }
  }, [previewUrl])

  /* =========================================================
     GET ACCESS TOKEN
  ========================================================= */

  const getAccessToken =
    async (): Promise<string> => {
      const {
        data,
        error:
          sessionError,
      } =
        await supabase.auth.getSession()

      if (
        sessionError ||
        !data.session
          ?.access_token
      ) {
        throw new Error(
          'Your session has expired. Please sign in again.',
        )
      }

      return data.session
        .access_token
    }

  /* =========================================================
     SELECT AVATAR
  ========================================================= */

  const handleAvatarSelected =
    (
      file: File | null,
    ) => {
      if (!file) {
        return
      }

      if (
        !ALLOWED_AVATAR_TYPES.has(
          file.type,
        )
      ) {
        error(
          'Unsupported image format. Please use JPG, PNG or WebP.',
        )
        return
      }

      if (
        file.size <= 0
      ) {
        error(
          'The selected image is empty.',
        )
        return
      }

      if (
        file.size >
        MAX_AVATAR_SIZE
      ) {
        error(
          'Profile photo must be 5 MB or smaller.',
        )
        return
      }

      if (
        previewUrl?.startsWith(
          'blob:',
        )
      ) {
        URL.revokeObjectURL(
          previewUrl,
        )
      }

      const localPreview =
        URL.createObjectURL(
          file,
        )

      setSelectedAvatar(
        file,
      )

      setPreviewUrl(
        localPreview,
      )
    }

  /* =========================================================
     FILE INPUT
  ========================================================= */

  const handleFileInputChange =
    (
      event: ChangeEvent<HTMLInputElement>,
    ) => {
      const file =
        event.target.files?.[0] ||
        null

      handleAvatarSelected(
        file,
      )

      /*
       * Allows selecting the same
       * file again later.
       */
      event.target.value = ''
    }

  /* =========================================================
     CANCEL AVATAR SELECTION
  ========================================================= */

  const cancelAvatarSelection =
    () => {
      if (
        previewUrl?.startsWith(
          'blob:',
        )
      ) {
        URL.revokeObjectURL(
          previewUrl,
        )
      }

      setSelectedAvatar(
        null,
      )

      setPreviewUrl(
        null,
      )
    }

  /* =========================================================
     UPLOAD AVATAR TO CLOUDFLARE R2
  ========================================================= */

  const uploadAvatarToR2 =
    async (
      file: File,
    ): Promise<string | null> => {
      const accessToken =
        await getAccessToken()

      const formData =
        new FormData()

      formData.append(
        'file',
        file,
      )

      /*
       * Existing production Edge Function:
       * r2-profile-upload
       */
      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions.invoke(
          'r2-profile-upload',
          {
            body:
              formData,

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        )

      if (functionError) {
        throw new Error(
          functionError.message ||
            'Unable to upload profile photo.',
        )
      }

      const response =
        data as ProfileUploadResponse

      if (
        !response ||
        response.success ===
        false
      ) {
        throw new Error(
          response?.error ||
            'Profile photo upload failed.',
        )
      }

      /*
       * The function returns the R2
       * object key.
       *
       * We then request a signed URL
       * for displaying the image.
       */
      return (
        response.avatarUrl ||
        response.avatar_url ||
        response.profile
          ?.avatarUrl ||
        response.profile
          ?.avatar_url ||
        null
      )
    }

  /* =========================================================
     SAVE PERSONAL PROFILE
  ========================================================= */

  const handleSavePersonal =
    async () => {
      const name =
        normalize(
          personalForm.name,
        )

      const phone =
        cleanPhone(
          personalForm.phone,
        )

      const whatsapp =
        cleanPhone(
          personalForm.whatsapp,
        )

      if (!name) {
        error(
          'Please enter your full name.',
        )
        return
      }

      /*
       * profiles.phone is NOT NULL
       * in the current database.
       */
      if (!phone) {
        error(
          'Please enter your phone number.',
        )
        return
      }

      if (
        !validateInternationalPhone(
          phone,
        )
      ) {
        error(
          'Please enter a valid international phone number.',
        )
        return
      }

      if (
        whatsapp &&
        !validateInternationalPhone(
          whatsapp,
        )
      ) {
        error(
          'Please enter a valid international WhatsApp number.',
        )
        return
      }

      if (!user?.id) {
        error(
          'Your session has expired. Please sign in again.',
        )
        return
      }

      setSavingPersonal(true)

      try {
        /*
         * -----------------------------------------------------
         * 1. Upload selected avatar
         * -----------------------------------------------------
         */
        if (
          selectedAvatar
        ) {
          setUploadingAvatar(
            true,
          )

          try {
            await uploadAvatarToR2(
              selectedAvatar,
            )

            if (
              previewUrl?.startsWith(
                'blob:',
              )
            ) {
              URL.revokeObjectURL(
                previewUrl,
              )
            }

            setSelectedAvatar(
              null,
            )

            setPreviewUrl(
              null,
            )

            /*
             * The R2 function updates
             * profiles.avatar_url itself.
             *
             * Get a fresh signed URL.
             */
            await loadProfileAvatar()
          } finally {
            setUploadingAvatar(
              false,
            )
          }
        }

        /*
         * -----------------------------------------------------
         * 2. Update profiles table
         * -----------------------------------------------------
         */
        const {
          error:
            profileUpdateError,
        } =
          await supabase
            .from('profiles')
            .update({
              full_name:
                name,
              phone,
            })
            .eq(
              'id',
              user.id,
            )

        if (
          profileUpdateError
        ) {
          throw profileUpdateError
        }

        /*
         * -----------------------------------------------------
         * 3. Update Supabase Auth metadata
         * -----------------------------------------------------
         *
         * WhatsApp remains in Auth metadata
         * because the profiles table does not
         * contain a whatsapp column.
         */
        const {
          error:
            metadataUpdateError,
        } =
          await supabase.auth.updateUser({
            data: {
              full_name:
                name,
              name,
              phone,
              whatsapp,
            },
          })

        if (
          metadataUpdateError
        ) {
          throw metadataUpdateError
        }

        /*
         * Refresh AuthContext.
         */
        await refreshProfile()

        setPersonalForm({
          name,
          phone,
          whatsapp,
        })

        success(
          'Personal profile updated successfully.',
        )
      } catch (err) {
        console.error(
          'Failed to update personal profile:',
          err,
        )

        error(
          getErrorMessage(
            err,
            'Failed to update personal profile.',
          ),
        )
      } finally {
        setSavingPersonal(
          false,
        )

        setUploadingAvatar(
          false,
        )
      }
    }

  /* =========================================================
     REMOVE AVATAR
  ========================================================= */

  const handleRemoveAvatar =
    async () => {
      if (!user?.id) {
        error(
          'Your session has expired. Please sign in again.',
        )
        return
      }

      if (
        !avatarUrl &&
        !selectedAvatar
      ) {
        error(
          'There is no profile photo to remove.',
        )
        return
      }

      setRemovingAvatar(
        true,
      )

      try {
        /*
         * If the user selected a new image
         * but hasn't saved it yet, simply
         * cancel the local preview.
         */
        if (
          selectedAvatar
        ) {
          if (
            previewUrl?.startsWith(
              'blob:',
            )
          ) {
            URL.revokeObjectURL(
              previewUrl,
            )
          }

          setSelectedAvatar(
            null,
          )

          setPreviewUrl(
            null,
          )

          success(
            'Selected profile photo removed.',
          )

          return
        }

        const accessToken =
          await getAccessToken()

        /*
         * Existing production Edge Function.
         *
         * r2-profile-upload handles:
         * - deleting the R2 object
         * - clearing profiles.avatar_url
         */
        const {
          data,
          error:
            functionError,
        } =
          await supabase.functions.invoke(
            'r2-profile-upload',
            {
              body:
                JSON.stringify({
                  action:
                    'delete',
                }),

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                'Content-Type':
                  'application/json',
              },
            },
          )

        if (functionError) {
          throw new Error(
            functionError.message ||
              'Unable to remove profile photo.',
          )
        }

        const response =
          data as ProfileUploadResponse

        if (
          response &&
          response.success ===
          false
        ) {
          throw new Error(
            response.error ||
              'Unable to remove profile photo.',
          )
        }

        /*
         * Keep the database state
         * deterministic.
         */
        const {
          error:
            clearAvatarError,
        } =
          await supabase
            .from('profiles')
            .update({
              avatar_url:
                null,
            })
            .eq(
              'id',
              user.id,
            )

        if (
          clearAvatarError
        ) {
          throw clearAvatarError
        }

        setAvatarUrl(
          null,
        )

        setSelectedAvatar(
          null,
        )

        setPreviewUrl(
          null,
        )

        await refreshProfile()

        success(
          'Profile photo removed successfully.',
        )
      } catch (err) {
        console.error(
          'Failed to remove profile photo:',
          err,
        )

        error(
          getErrorMessage(
            err,
            'Unable to remove profile photo.',
          ),
        )
      } finally {
        setRemovingAvatar(
          false,
        )
      }
    }

  /* =========================================================
     PHONE COUNTRY CHANGE
  ========================================================= */

  const handlePersonalPhoneCountryChange =
    (
      newCountry: Country,
    ) => {
      const oldPhoneCountry =
        personalPhoneCountry

      const oldWhatsappCountry =
        personalWhatsappCountry

      setPersonalPhoneCountry(
        newCountry,
      )

      /*
       * Keep WhatsApp country aligned
       * when changing the primary phone
       * country.
       */
      setPersonalWhatsappCountry(
        newCountry,
      )

      const nextPhone =
        replaceCountryCallingCode(
          personalForm.phone,
          oldPhoneCountry,
          newCountry,
        )

      const nextWhatsapp =
        replaceCountryCallingCode(
          personalForm.whatsapp,
          oldWhatsappCountry,
          newCountry,
        )

      setPersonalForm(
        (previous) => ({
          ...previous,
          phone:
            nextPhone,
          whatsapp:
            nextWhatsapp,
        }),
      )
    }

  /* =========================================================
     PHONE CHANGE
  ========================================================= */

  const handlePersonalPhoneChange =
    (
      nextPhone: string,
    ) => {
      let nextWhatsapp =
        personalForm.whatsapp

      let detectedCountry:
        | Country
        | undefined

      try {
        const parsed =
          parsePhoneNumber(
            nextPhone,
          )

        if (
          parsed?.country &&
          parsed.country !==
            personalPhoneCountry
        ) {
          detectedCountry =
            parsed.country
        }
      } catch {
        /*
         * Incomplete phone numbers
         * are expected while typing.
         */
      }

      if (
        detectedCountry
      ) {
        const oldWhatsappCountry =
          personalWhatsappCountry

        setPersonalPhoneCountry(
          detectedCountry,
        )

        setPersonalWhatsappCountry(
          detectedCountry,
        )

        nextWhatsapp =
          replaceCountryCallingCode(
            personalForm.whatsapp,
            oldWhatsappCountry,
            detectedCountry,
          )
      }

      setPersonalForm(
        (previous) => ({
          ...previous,
          phone:
            nextPhone,
          whatsapp:
            nextWhatsapp,
        }),
      )
    }

  /* =========================================================
     WHATSAPP COUNTRY CHANGE
  ========================================================= */

  const handlePersonalWhatsappCountryChange =
    (
      newCountry: Country,
    ) => {
      const oldCountry =
        personalWhatsappCountry

      setPersonalWhatsappCountry(
        newCountry,
      )

      const nextWhatsapp =
        replaceCountryCallingCode(
          personalForm.whatsapp,
          oldCountry,
          newCountry,
        )

      setPersonalForm(
        (previous) => ({
          ...previous,
          whatsapp:
            nextWhatsapp,
        }),
      )
    }

  /* =========================================================
     WHATSAPP CHANGE
  ========================================================= */

  const handlePersonalWhatsappChange =
    (
      nextWhatsapp: string,
    ) => {
      try {
        const parsed =
          parsePhoneNumber(
            nextWhatsapp,
          )

        if (
          parsed?.country &&
          parsed.country !==
            personalWhatsappCountry
        ) {
          setPersonalWhatsappCountry(
            parsed.country,
          )
        }
      } catch {
        /*
         * Incomplete number while typing.
         */
      }

      setPersonalForm(
        (previous) => ({
          ...previous,
          whatsapp:
            nextWhatsapp,
        }),
      )
    }

  /* =========================================================
     COPY PHONE TO WHATSAPP
  ========================================================= */

  const copyPersonalPhoneToWhatsapp =
    () => {
      setPersonalWhatsappCountry(
        personalPhoneCountry,
      )

      setPersonalForm(
        (previous) => ({
          ...previous,
          whatsapp:
            previous.phone,
        }),
      )
    }

  /* =========================================================
     SAVE COMPANY
  ========================================================= */

  const handleSaveCompany =
    async () => {
      const companyName =
        normalize(
          companyForm.company_name,
        )

      const registrationNumber =
        normalize(
          companyForm.registration_number,
        )

      const phone =
        normalize(
          companyForm.phone,
        )

      const email =
        normalize(
          companyForm.email,
        )

      const website =
        normalize(
          companyForm.website,
        )

      const address =
        normalize(
          companyForm.address,
        )

      if (!companyName) {
        error(
          'Please enter the company name.',
        )
        return
      }

      if (
        email &&
        !isValidEmail(email)
      ) {
        error(
          'Please enter a valid company email address.',
        )
        return
      }

      setSavingCompany(true)

      try {
        const {
          data:
            existingSettings,
          error:
            settingsFetchError,
        } =
          await supabase
            .from(
              'company_settings',
            )
            .select('id')
            .limit(1)
            .maybeSingle()

        if (
          settingsFetchError
        ) {
          throw settingsFetchError
        }

        if (
          !existingSettings?.id
        ) {
          throw new Error(
            'Company settings record was not found.',
          )
        }

        const {
          error:
            settingsUpdateError,
        } =
          await supabase
            .from(
              'company_settings',
            )
            .update({
              company_name:
                companyName,

              registration_number:
                registrationNumber,

              phone,

              email,

              website,

              address,
            })
            .eq(
              'id',
              existingSettings.id,
            )

        if (
          settingsUpdateError
        ) {
          throw settingsUpdateError
        }

        setCompanyForm({
          company_name:
            companyName,

          registration_number:
            registrationNumber,

          phone,

          email,

          website,

          address,
        })

        success(
          'Company information updated successfully.',
        )
      } catch (err) {
        console.error(
          'Failed to update company information:',
          err,
        )

        error(
          getErrorMessage(
            err,
            'Failed to update company information.',
          ),
        )
      } finally {
        setSavingCompany(
          false,
        )
      }
    }

  /* =========================================================
     CHANGE PASSWORD
  ========================================================= */

  const handleChangePassword =
    async () => {
      if (!currentPassword) {
        error(
          'Please enter your current password.',
        )
        return
      }

      if (!newPassword) {
        error(
          'Please enter a new password.',
        )
        return
      }

      if (
        newPassword.length < 8
      ) {
        error(
          'The new password must contain at least 8 characters.',
        )
        return
      }

      if (
        newPassword ===
        currentPassword
      ) {
        error(
          'The new password must be different from your current password.',
        )
        return
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        error(
          'New password and confirmation password do not match.',
        )
        return
      }

      setChangingPassword(
        true,
      )

      try {
        const {
          data: {
            user:
              authUser,
          },
          error:
            userError,
        } =
          await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (
          !authUser ||
          !authUser.email
        ) {
          throw new Error(
            'Unable to identify the current authenticated user.',
          )
        }

        /*
         * Verify current password.
         */
        const {
          error:
            reauthenticationError,
        } =
          await supabase.auth.signInWithPassword(
            {
              email:
                authUser.email,

              password:
                currentPassword,
            },
          )

        if (
          reauthenticationError
        ) {
          throw new Error(
            'Current password is incorrect.',
          )
        }

        /*
         * Update Supabase Auth password.
         */
        const {
          error:
            passwordUpdateError,
        } =
          await supabase.auth.updateUser({
            password:
              newPassword,
          })

        if (
          passwordUpdateError
        ) {
          throw passwordUpdateError
        }

        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')

        success(
          'Password changed successfully.',
        )
      } catch (err) {
        console.error(
          'Failed to change password:',
          err,
        )

        error(
          getErrorMessage(
            err,
            'Failed to change password.',
          ),
        )
      } finally {
        setChangingPassword(
          false,
        )
      }
    }

  /* =========================================================
     TABS
  ========================================================= */

  const tabs = [
    {
      key: 'personal' as Tab,
      label: 'Personal Info',
      icon: User,
    },
    {
      key: 'company' as Tab,
      label: 'Company Info',
      icon: Building2,
    },
    {
      key: 'security' as Tab,
      label: 'Security',
      icon: Lock,
    },
  ]

  /* =========================================================
     AVATAR DISPLAY
  ========================================================= */

  const displayedAvatar =
    previewUrl ||
    avatarUrl

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Administrator Profile"
        subtitle="Manage your personal and company information"
      />

      {/* =======================================================
          TABS
      ======================================================= */}

      <div className="flex gap-1 border-b border-xp-border mb-5">
        {tabs.map((item) => {
          const Icon =
            item.icon

          return (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                setTab(
                  item.key,
                )
              }
              className={`
                flex
                items-center
                gap-2
                px-4
                py-2.5
                text-sm
                font-medium
                border-b-2
                transition-colors
                ${
                  tab === item.key
                    ? 'border-xp-purple text-xp-purple'
                    : 'border-transparent text-xp-muted hover:text-[#111]'
                }
              `}
            >
              <Icon size={13} />
              {item.label}
            </button>
          )
        })}
      </div>

      {/* =======================================================
          PERSONAL
      ======================================================= */}

      {tab === 'personal' && (
        <Card className="p-6 space-y-5">
          {/* ---------------------------------------------------
              PROFILE HEADER
          --------------------------------------------------- */}

          <div className="flex items-center gap-5 pb-5 border-b border-xp-light-gray">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-xp-purple flex items-center justify-center text-2xl font-bold text-white ring-4 ring-xp-light-purple">
                {displayedAvatar ? (
                  <img
                    src={
                      displayedAvatar
                    }
                    alt={`${displayName} profile`}
                    className="w-full h-full object-cover"
                    onError={() => {
                      /*
                       * Signed URLs can expire.
                       * If the image becomes invalid,
                       * request a fresh signed URL.
                       */
                      if (
                        !previewUrl
                      ) {
                        void loadProfileAvatar()
                      }
                    }}
                  />
                ) : (
                  initials
                )}
              </div>

              {avatarLoading && (
                <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={
                  profileLoading ||
                  savingPersonal ||
                  uploadingAvatar ||
                  removingAvatar
                }
                className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-[#111] text-white flex items-center justify-center border-2 border-white shadow-md hover:bg-xp-purple transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Change profile photo"
              >
                <Camera size={14} />
              </button>

              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  handleFileInputChange
                }
                className="hidden"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#111] text-lg">
                {displayName}
              </p>

              <p className="text-sm text-xp-muted truncate">
                {displayEmail ||
                  'Authenticated administrator'}
              </p>

              <p className="text-xs text-xp-dark-muted mt-0.5">
                Administrator
              </p>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  disabled={
                    profileLoading ||
                    savingPersonal ||
                    uploadingAvatar ||
                    removingAvatar
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-xp-light-purple text-xp-purple text-xs font-semibold hover:bg-xp-purple hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload size={12} />
                  {selectedAvatar
                    ? 'Change Photo'
                    : 'Upload Photo'}
                </button>

                {(selectedAvatar ||
                  avatarUrl) && (
                  <button
                    type="button"
                    onClick={
                      handleRemoveAvatar
                    }
                    disabled={
                      savingPersonal ||
                      uploadingAvatar ||
                      removingAvatar
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2
                      size={12}
                    />
                    {removingAvatar
                      ? 'Removing...'
                      : selectedAvatar
                        ? 'Cancel'
                        : 'Remove Photo'}
                  </button>
                )}
              </div>

              <p className="text-[11px] text-xp-dark-muted mt-2">
                JPG, PNG or WebP · Maximum 5 MB
              </p>
            </div>
          </div>

          {/* ---------------------------------------------------
              SELECTED PHOTO ACTIONS
          --------------------------------------------------- */}

          {selectedAvatar && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-xp-light-purple bg-xp-off-white px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Camera
                  size={14}
                  className="text-xp-purple shrink-0"
                />

                <p className="text-xs text-xp-muted truncate">
                  New profile photo selected.
                  Click Save Changes to upload it.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  cancelAvatarSelection
                }
                disabled={
                  savingPersonal ||
                  uploadingAvatar
                }
                className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xp-muted hover:text-[#111] hover:bg-white transition-colors"
                title="Cancel selected photo"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {profileLoading ? (
            <div className="py-5 text-sm text-xp-muted">
              Loading profile information...
            </div>
          ) : (
            <>
              {/* -------------------------------------------------
                  PERSONAL FIELDS
              ------------------------------------------------- */}

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Full Name"
                  value={
                    personalForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setPersonalForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        name:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  disabled={
                    savingPersonal ||
                    uploadingAvatar
                  }
                />

                <Input
                  label="Email"
                  type="email"
                  value={
                    displayEmail
                  }
                  disabled
                />

                <InternationalPhoneField
                  label="Phone"
                  country={
                    personalPhoneCountry
                  }
                  value={
                    personalForm.phone
                  }
                  onChange={
                    handlePersonalPhoneChange
                  }
                  onCountryChange={
                    handlePersonalPhoneCountryChange
                  }
                  disabled={
                    savingPersonal
                  }
                />

                <InternationalPhoneField
                  label="WhatsApp"
                  country={
                    personalWhatsappCountry
                  }
                  value={
                    personalForm.whatsapp
                  }
                  onChange={
                    handlePersonalWhatsappChange
                  }
                  onCountryChange={
                    handlePersonalWhatsappCountryChange
                  }
                  disabled={
                    savingPersonal
                  }
                  action={
                    personalForm.phone ? (
                      <button
                        type="button"
                        onClick={
                          copyPersonalPhoneToWhatsapp
                        }
                        disabled={
                          savingPersonal
                        }
                        className="text-[11px] font-normal text-xp-purple hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        (same as phone)
                      </button>
                    ) : null
                  }
                />
              </div>

              {/* -------------------------------------------------
                  SAVE
              ------------------------------------------------- */}

              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={
                    handleSavePersonal
                  }
                  loading={
                    savingPersonal
                  }
                >
                  {uploadingAvatar
                    ? 'Uploading Photo...'
                    : 'Save Changes'}
                </Button>

                {selectedAvatar && (
                  <span className="text-xs text-xp-muted">
                    Photo will be uploaded to Cloudflare R2.
                  </span>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      {/* =======================================================
          COMPANY
      ======================================================= */}

      {tab === 'company' && (
        <Card className="p-6 space-y-4">
          <p className="text-xs font-bold text-xp-muted uppercase tracking-widest">
            Company Information
          </p>

          {!settings ? (
            <div className="py-5 text-sm text-xp-muted">
              Loading company information...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Input
                    label="Company Name"
                    value={
                      companyForm.company_name
                    }
                    onChange={(
                      event,
                    ) =>
                      setCompanyForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          company_name:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    disabled={
                      savingCompany
                    }
                  />
                </div>

                <Input
                  label="Registration Number"
                  value={
                    companyForm.registration_number
                  }
                  onChange={(
                    event,
                  ) =>
                    setCompanyForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        registration_number:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  disabled={
                    savingCompany
                  }
                />

                <Input
                  label="Phone"
                  value={
                    companyForm.phone
                  }
                  onChange={(
                    event,
                  ) =>
                    setCompanyForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        phone:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  disabled={
                    savingCompany
                  }
                />

                <Input
                  label="Email"
                  type="email"
                  value={
                    companyForm.email
                  }
                  onChange={(
                    event,
                  ) =>
                    setCompanyForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        email:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  disabled={
                    savingCompany
                  }
                />

                <div className="col-span-2">
                  <Input
                    label="Website"
                    value={
                      companyForm.website
                    }
                    onChange={(
                      event,
                    ) =>
                      setCompanyForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          website:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    disabled={
                      savingCompany
                    }
                  />
                </div>
              </div>

              <Textarea
                label="Address"
                value={
                  companyForm.address
                }
                onChange={(
                  event,
                ) =>
                  setCompanyForm(
                    (
                      current,
                    ) => ({
                      ...current,
                      address:
                        event
                          .target
                          .value,
                    }),
                  )
                }
                disabled={
                  savingCompany
                }
              />

              <Button
                variant="primary"
                size="sm"
                onClick={
                  handleSaveCompany
                }
                loading={
                  savingCompany
                }
              >
                Save Changes
              </Button>
            </>
          )}
        </Card>
      )}

      {/* =======================================================
          SECURITY
      ======================================================= */}

      {tab === 'security' && (
        <div className="space-y-4">
          <Card className="p-6 space-y-4">
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-2">
              Change Password
            </p>

            <Input
              label="Current Password"
              type="password"
              value={
                currentPassword
              }
              onChange={(
                event,
              ) =>
                setCurrentPassword(
                  event.target.value,
                )
              }
              placeholder="Enter current password"
              disabled={
                changingPassword
              }
            />

            <Input
              label="New Password"
              type="password"
              value={
                newPassword
              }
              onChange={(
                event,
              ) =>
                setNewPassword(
                  event.target.value,
                )
              }
              placeholder="Minimum 8 characters"
              disabled={
                changingPassword
              }
            />

            <Input
              label="Confirm New Password"
              type="password"
              value={
                confirmPassword
              }
              onChange={(
                event,
              ) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              placeholder="Repeat new password"
              disabled={
                changingPassword
              }
            />

            <p className="text-xs text-xp-muted">
              Your password must contain at
              least 8 characters and should be
              different from your current
              password.
            </p>

            <Button
              variant="primary"
              size="sm"
              onClick={
                handleChangePassword
              }
              loading={
                changingPassword
              }
            >
              Update Password
            </Button>
          </Card>

          <Card className="p-6">
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-3">
              Session Information
            </p>

            <div className="flex items-center gap-3 p-3 bg-xp-off-white rounded-lg border border-xp-border">
              <Clock
                size={14}
                className="text-xp-purple"
              />

              <div>
                <p className="text-sm font-medium text-[#111]">
                  Last Login
                </p>

                <p className="text-xs text-xp-muted">
                  {adminRecord?.last_login ||
                  adminRecord?.last_login_at
                    ? formatDateTime(
                        adminRecord.last_login ||
                          adminRecord.last_login_at ||
                          '',
                      )
                    : 'Current session'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}