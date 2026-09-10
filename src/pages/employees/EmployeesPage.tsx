import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Eye,
  Edit2,
  Trash2,
  UserRound,
  Camera,
  Upload,
  X,
} from 'lucide-react'
import { parsePhoneNumber } from 'react-phone-number-input'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import {
  formatDate,
  exportCSVSimple,
} from '../../lib/utils'
import { generateReportPDF } from '../../lib/pdf'
import { supabase } from '../../lib/supabase'

import {
  PageHeader,
  Button,
  Badge,
  SearchInput,
  Card,
  Table,
  TableRow,
  Td,
  EmptyState,
  Modal,
  Input,
  Textarea,
  Select,
  ExportDropdown,
  InternationalPhoneField,
  replaceCountryCallingCode,
  cleanPhone,
  validateInternationalPhone,
  getCountryFromPhone,
  type Country,
} from '../../components/ui'

import type {
  Employee,
  EmployeeStatus,
} from '../../types'

const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  'Active',
  'Inactive',
]

type EmployeeForm = Omit<
  Employee,
  'id' | 'employee_id' | 'created_at'
>

const createEmptyForm = (): EmployeeForm => ({
  full_name: '',
  role: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  joining_date: new Date()
    .toISOString()
    .slice(0, 10),
  status: 'Active',
  avatar_url: null,
  bank_information: '',
  notes: '',
})

const normalize = (
  value: string | null | undefined,
): string => {
  return value?.trim() || ''
}

const isValidDateString = (
  value: string,
): boolean => {
  if (!value) {
    return false
  }

  const date = new Date(
    `${value}T00:00:00`,
  )

  return !Number.isNaN(
    date.getTime(),
  )
}

const isValidEmail = (
  email: string,
): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  )
}

const getInitials = (
  fullName: string,
): string => {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return 'U'
  }

  return parts
    .map(
      (part) =>
        part.charAt(0),
    )
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/* =========================================================
   EMPLOYEE IMAGE VALIDATION
   ========================================================= */

const MAX_IMAGE_SIZE =
  5 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

const validateEmployeeImage = (
  file: File,
): string | null => {
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type,
    )
  ) {
    return 'Please select a JPG, PNG, or WEBP image.'
  }

  if (
    file.size > MAX_IMAGE_SIZE
  ) {
    return 'Employee photo must be smaller than 5 MB.'
  }

  return null
}

/* =========================================================
   PRIVATE R2 EMPLOYEE AVATAR
   ========================================================= */

function EmployeeAvatar({
  employeeId,
  avatarKey,
  initials,
  size,
  alt,
}: {
  employeeId?: string
  avatarKey?: string | null
  initials: string
  size: 'sm' | 'lg'
  alt: string
}) {
  const [signedUrl, setSignedUrl] =
    useState<string | null>(null)

  const [loading, setLoading] =
    useState(false)

  const [failed, setFailed] =
    useState(false)

  useEffect(() => {
    let cancelled = false

    const loadSignedUrl =
      async () => {
        setSignedUrl(null)
        setFailed(false)

        if (
          !employeeId ||
          !avatarKey
        ) {
          setLoading(false)
          return
        }

        /*
         * Support an already complete URL
         * if one exists.
         */
        if (
          avatarKey.startsWith(
            'http://',
          ) ||
          avatarKey.startsWith(
            'https://',
          )
        ) {
          setSignedUrl(
            avatarKey,
          )
          setLoading(false)
          return
        }

        setLoading(true)

        try {
          const {
            data,
            error:
              functionError,
          } =
            await supabase.functions.invoke(
              'r2-employee-url',
              {
                body: {
                  employee_id:
                    employeeId,
                },
              },
            )

          if (functionError) {
            throw functionError
          }

          if (
            !data?.success ||
            !data?.url
          ) {
            throw new Error(
              data?.error ||
                'Unable to generate employee image URL.',
            )
          }

          if (!cancelled) {
            setSignedUrl(
              data.url,
            )
          }
        } catch (err) {
          console.error(
            'Failed to load employee avatar:',
            err,
          )

          if (!cancelled) {
            setFailed(true)
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      }

    void loadSignedUrl()

    return () => {
      cancelled = true
    }
  }, [
    employeeId,
    avatarKey,
  ])

  const sizeClasses =
    size === 'lg'
      ? 'w-24 h-24 text-3xl'
      : 'w-8 h-8 text-[11px]'

  if (
    signedUrl &&
    !failed
  ) {
    return (
      <div
        className={`${sizeClasses} rounded-full overflow-hidden border border-xp-border bg-xp-light-purple shrink-0 relative`}
      >
        <img
          src={signedUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => {
            setFailed(true)
          }}
        />

        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-xp-purple/30 border-t-xp-purple rounded-full animate-spin" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-xp-light-purple border border-xp-border flex items-center justify-center font-bold text-xp-purple shrink-0 relative`}
    >
      {initials}

      {loading && (
        <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center">
          <div className="w-3.5 h-3.5 border-2 border-xp-purple/30 border-t-xp-purple rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

/* =========================================================
   EMPLOYEES PAGE
   ========================================================= */

export default function EmployeesPage() {
  const {
    employees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    settings,
    refreshData,
  } = useData()

  const {
    success,
    error,
  } = useToast()

  const navigate =
    useNavigate()

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null,
    )

  const [search, setSearch] =
    useState('')

  const [showModal, setShowModal] =
    useState(false)

  const [editing, setEditing] =
    useState<Employee | null>(
      null,
    )

  const [form, setForm] =
    useState<EmployeeForm>(
      createEmptyForm(),
    )

  const [phoneCountry, setPhoneCountry] =
    useState<Country>('LK')

  const [
    whatsappCountry,
    setWhatsappCountry,
  ] = useState<Country>('LK')

  const [deleteId, setDeleteId] =
    useState<string | null>(
      null,
    )

  const [saving, setSaving] =
    useState(false)

  const [deleting, setDeleting] =
    useState(false)

  /* =======================================================
     IMAGE STATE
  ======================================================== */

  const [
    selectedImage,
    setSelectedImage,
  ] = useState<File | null>(null)

  const [
    imagePreview,
    setImagePreview,
  ] = useState<string | null>(
    null,
  )

  const [
    existingAvatarUrl,
    setExistingAvatarUrl,
  ] = useState<string | null>(
    null,
  )

  const [
    removeExistingImage,
    setRemoveExistingImage,
  ] = useState(false)

  const [
    uploadingImage,
    setUploadingImage,
  ] = useState(false)

  /* =======================================================
     CLEANUP IMAGE PREVIEW
  ======================================================== */

  useEffect(() => {
    return () => {
      if (
        imagePreview &&
        imagePreview.startsWith(
          'blob:',
        )
      ) {
        URL.revokeObjectURL(
          imagePreview,
        )
      }
    }
  }, [imagePreview])

  /* =======================================================
     FILTER EMPLOYEES
  ======================================================== */

  const filtered = useMemo(() => {
    const query =
      normalize(search).toLowerCase()

    if (!query) {
      return employees
    }

    return employees.filter(
      (employee) => {
        const searchableValues = [
          employee.employee_id,
          employee.full_name,
          employee.role,
          employee.email,
          employee.phone,
          employee.whatsapp,
          employee.address,
          employee.status,
        ]

        return searchableValues.some(
          (value) =>
            normalize(value)
              .toLowerCase()
              .includes(query),
        )
      },
    )
  }, [
    employees,
    search,
  ])

  /* =======================================================
     RESET IMAGE STATE
  ======================================================== */

  const resetImageState =
    () => {
      if (
        imagePreview &&
        imagePreview.startsWith(
          'blob:',
        )
      ) {
        URL.revokeObjectURL(
          imagePreview,
        )
      }

      setSelectedImage(null)
      setImagePreview(null)
      setExistingAvatarUrl(null)
      setRemoveExistingImage(
        false,
      )

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          ''
      }
    }

  /* =======================================================
     RESET FORM
  ======================================================== */

  const resetForm = () => {
    resetImageState()

    setForm(
      createEmptyForm(),
    )

    setPhoneCountry('LK')
    setWhatsappCountry('LK')
    setEditing(null)
  }

  /* =======================================================
     OPEN NEW
  ======================================================== */

  const openNew = () => {
    resetForm()
    setShowModal(true)
  }

  /* =======================================================
     OPEN EDIT
  ======================================================== */

  const openEdit = (
    employee: Employee,
  ) => {
    setEditing(employee)

    const pCountry =
      getCountryFromPhone(
        employee.phone,
        'LK',
      )

    const wCountry =
      getCountryFromPhone(
        employee.whatsapp,
        pCountry,
      )

    setPhoneCountry(
      pCountry,
    )

    setWhatsappCountry(
      wCountry,
    )

    setForm({
      full_name:
        employee.full_name ||
        '',
      role:
        employee.role || '',
      phone:
        employee.phone || '',
      whatsapp:
        employee.whatsapp ||
        '',
      email:
        employee.email || '',
      address:
        employee.address ||
        '',
      joining_date:
        employee.joining_date ||
        '',
      status:
        employee.status ||
        'Active',

      /*
       * IMPORTANT:
       * avatar_url is now part of
       * Employee.
       */
      avatar_url:
        employee.avatar_url ||
        null,

      bank_information:
        employee.bank_information ||
        '',
      notes:
        employee.notes || '',
    })

    setExistingAvatarUrl(
      employee.avatar_url ||
        null,
    )

    setSelectedImage(null)
    setImagePreview(null)
    setRemoveExistingImage(
      false,
    )

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        ''
    }

    setShowModal(true)
  }

  /* =======================================================
     CLOSE MODAL
  ======================================================== */

  const closeModal = () => {
    if (
      saving ||
      uploadingImage
    ) {
      return
    }

    setShowModal(false)
    resetForm()
  }

  /* =======================================================
     FORM UPDATER
  ======================================================== */

  const updateForm = <
    K extends keyof EmployeeForm,
  >(
    key: K,
    value: EmployeeForm[K],
  ) => {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    )
  }

  /* =======================================================
     IMAGE SELECT
  ======================================================== */

  const handleImageSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    const validationError =
      validateEmployeeImage(
        file,
      )

    if (validationError) {
      error(
        validationError,
      )

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          ''
      }

      return
    }

    if (
      imagePreview &&
      imagePreview.startsWith(
        'blob:',
      )
    ) {
      URL.revokeObjectURL(
        imagePreview,
      )
    }

    const previewUrl =
      URL.createObjectURL(
        file,
      )

    setSelectedImage(file)
    setImagePreview(
      previewUrl,
    )

    /*
     * A newly selected image
     * replaces the existing image.
     */
    setRemoveExistingImage(
      false,
    )
  }

  /* =======================================================
     REMOVE IMAGE
  ======================================================== */

  const handleRemoveImage =
    () => {
      if (
        imagePreview &&
        imagePreview.startsWith(
          'blob:',
        )
      ) {
        URL.revokeObjectURL(
          imagePreview,
        )
      }

      setSelectedImage(null)
      setImagePreview(null)

      if (
        editing &&
        existingAvatarUrl
      ) {
        setRemoveExistingImage(
          true,
        )
      }

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          ''
      }
    }

  /* =======================================================
     PHONE COUNTRY
  ======================================================== */

  const handlePhoneCountryChange =
    (
      newCountry: Country,
    ) => {
      const oldCountry =
        phoneCountry

      setPhoneCountry(
        newCountry,
      )

      const nextPhone =
        replaceCountryCallingCode(
          form.phone,
          oldCountry,
          newCountry,
        )

      setForm(
        (previous) => ({
          ...previous,
          phone: nextPhone,
        }),
      )
    }

  /* =======================================================
     PHONE CHANGE
  ======================================================== */

  const handlePhoneChange = (
    nextPhone: string,
  ) => {
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
          phoneCountry
      ) {
        detectedCountry =
          parsed.country
      }
    } catch {
      /*
       * Incomplete phone numbers are
       * allowed while typing.
       */
    }

    if (detectedCountry) {
      setPhoneCountry(
        detectedCountry,
      )
    }

    setForm(
      (previous) => ({
        ...previous,
        phone: nextPhone,
      }),
    )
  }

  /* =======================================================
     WHATSAPP COUNTRY
  ======================================================== */

  const handleWhatsappCountryChange =
    (
      newCountry: Country,
    ) => {
      const oldCountry =
        whatsappCountry

      setWhatsappCountry(
        newCountry,
      )

      const nextWhatsapp =
        replaceCountryCallingCode(
          form.whatsapp,
          oldCountry,
          newCountry,
        )

      setForm(
        (previous) => ({
          ...previous,
          whatsapp:
            nextWhatsapp,
        }),
      )
    }

  /* =======================================================
     WHATSAPP CHANGE
  ======================================================== */

  const handleWhatsappChange = (
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
          whatsappCountry
      ) {
        setWhatsappCountry(
          parsed.country,
        )
      }
    } catch {
      /*
       * Incomplete values are allowed
       * while typing.
       */
    }

    updateForm(
      'whatsapp',
      nextWhatsapp,
    )
  }

  /* =======================================================
     COPY PHONE TO WHATSAPP
  ======================================================== */

  const copyPhoneToWhatsapp =
    () => {
      if (!form.phone) {
        return
      }

      setWhatsappCountry(
        phoneCountry,
      )

      setForm(
        (previous) => ({
          ...previous,
          whatsapp:
            previous.phone,
        }),
      )
    }

  /* =======================================================
     R2 EMPLOYEE IMAGE UPLOAD
  ======================================================== */

  const uploadEmployeeImage =
    async (
      employeeId: string,
      file: File,
    ) => {
      setUploadingImage(
        true,
      )

      try {
        const {
          data: sessionData,
          error: sessionError,
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
            'Your session has expired. Please sign in again.',
          )
        }

        const formData =
          new FormData()

        formData.append(
          'employee_id',
          employeeId,
        )

        formData.append(
          'file',
          file,
        )

        const {
          data,
          error:
            functionError,
        } =
          await supabase.functions.invoke(
            'r2-employee-upload',
            {
              body: formData,
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            },
          )

        if (functionError) {
          throw functionError
        }

        if (
          !data?.success
        ) {
          throw new Error(
            data?.error ||
              'Employee photo upload failed.',
          )
        }

        return data
      } finally {
        setUploadingImage(
          false,
        )
      }
    }

  /* =======================================================
     R2 EMPLOYEE IMAGE DELETE
  ======================================================== */

  const deleteEmployeeImage =
    async (
      employeeId: string,
    ) => {
      setUploadingImage(
        true,
      )

      try {
        const {
          data: sessionData,
          error: sessionError,
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
            'Your session has expired. Please sign in again.',
          )
        }

        const {
          data,
          error:
            functionError,
        } =
          await supabase.functions.invoke(
            'r2-employee-upload',
            {
              body: {
                action:
                  'delete',
                employee_id:
                  employeeId,
              },
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
                'Content-Type':
                  'application/json',
              },
            },
          )

        if (functionError) {
          throw functionError
        }

        if (
          !data?.success
        ) {
          throw new Error(
            data?.error ||
              'Employee photo removal failed.',
          )
        }

        return data
      } finally {
        setUploadingImage(
          false,
        )
      }
    }

  /* =======================================================
     SAVE EMPLOYEE
  ======================================================== */

  const handleSave =
    async () => {
      const fullName =
        normalize(
          form.full_name,
        )

      const role =
        normalize(
          form.role,
        )

      const phone =
        cleanPhone(
          form.phone,
        )

      const whatsapp =
        cleanPhone(
          form.whatsapp,
        )

      const email =
        normalize(
          form.email,
        )

      const address =
        normalize(
          form.address,
        )

      const joiningDate =
        normalize(
          form.joining_date,
        )

      const bankInformation =
        normalize(
          form.bank_information,
        )

      const notes =
        normalize(
          form.notes,
        )

      /* Required full name */
      if (!fullName) {
        error(
          'Please enter the employee full name.',
        )
        return
      }

      /* Required role */
      if (!role) {
        error(
          'Please enter the employee role or position.',
        )
        return
      }

      /* Required joining date */
      if (!joiningDate) {
        error(
          'Please select the joining date.',
        )
        return
      }

      /* Date validation */
      if (
        !isValidDateString(
          joiningDate,
        )
      ) {
        error(
          'Please enter a valid joining date.',
        )
        return
      }

      /* Phone validation */
      if (
        phone &&
        !validateInternationalPhone(
          phone,
        )
      ) {
        error(
          'Please enter a valid international phone number.',
        )
        return
      }

      /* WhatsApp validation */
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

      /* Email validation */
      if (
        email &&
        !isValidEmail(
          email,
        )
      ) {
        error(
          'Please enter a valid email address.',
        )
        return
      }

      /* Status validation */
      if (
        !EMPLOYEE_STATUSES.includes(
          form.status,
        )
      ) {
        error(
          'Please select a valid employee status.',
        )
        return
      }

      /*
       * avatar_url is included because EmployeeForm
       * requires it.
       *
       * For R2 uploads, the Edge Function is the
       * authority that updates this value.
       */
      const employeeData: EmployeeForm =
        {
          full_name:
            fullName,
          role,
          phone,
          whatsapp,
          email,
          address,
          joining_date:
            joiningDate,
          status:
            form.status,
          avatar_url:
            form.avatar_url ||
            null,
          bank_information:
            bankInformation,
          notes,
        }

      setSaving(true)

      try {
        /* ===================================================
           EDIT
        ==================================================== */

        if (editing) {
          await updateEmployee(
            editing.id,
            employeeData,
          )

          /*
           * Upload replacement/new image.
           */
          if (
            selectedImage
          ) {
            await uploadEmployeeImage(
              editing.id,
              selectedImage,
            )
          }
          /*
           * Remove existing image.
           */
          else if (
            removeExistingImage &&
            existingAvatarUrl
          ) {
            await deleteEmployeeImage(
              editing.id,
            )
          }

          /*
           * Refresh from Supabase so avatar_url
           * is available everywhere.
           */
          await refreshData()

          success(
            selectedImage
              ? 'Employee and profile photo updated successfully.'
              : removeExistingImage
                ? 'Employee updated and profile photo removed.'
                : 'Employee updated successfully.',
          )
        }

        /* ===================================================
           CREATE
        ==================================================== */

        else {
          const createdEmployee =
            await addEmployee(
              employeeData,
            )

          /*
           * The employee UUID is required for
           * the R2 object path.
           */
          if (
            selectedImage
          ) {
            try {
              await uploadEmployeeImage(
                createdEmployee.id,
                selectedImage,
              )
            } catch (
              imageError
            ) {
              console.error(
                'Employee created but image upload failed:',
                imageError,
              )

              await refreshData()

              throw new Error(
                imageError instanceof
                Error
                  ? `Employee was created, but the profile photo could not be uploaded: ${imageError.message}`
                  : 'Employee was created, but the profile photo could not be uploaded.',
              )
            }
          }

          await refreshData()

          success(
            selectedImage
              ? 'Employee and profile photo created successfully.'
              : 'Employee created successfully.',
          )
        }

        setShowModal(false)
        resetForm()
      } catch (err) {
        console.error(
          'Failed to save employee:',
          err,
        )

        const message =
          err instanceof Error
            ? err.message
            : editing
              ? 'Failed to update employee. Please try again.'
              : 'Failed to create employee. Please try again.'

        error(message)
      } finally {
        setSaving(false)
      }
    }

  /* =======================================================
     DELETE EMPLOYEE
  ======================================================== */

  const handleDelete =
    async () => {
      if (!deleteId) {
        return
      }

      setDeleting(true)

      try {
        await deleteEmployee(
          deleteId,
        )

        success(
          'Employee removed successfully.',
        )

        setDeleteId(null)
      } catch (err) {
        console.error(
          'Failed to remove employee:',
          err,
        )

        error(
          err instanceof Error
            ? err.message
            : 'Failed to remove employee. Please try again.',
        )
      } finally {
        setDeleting(false)
      }
    }

  /* =======================================================
     EMPLOYEE DETAILS
  ======================================================== */

  const openDetails = (
    employeeId: string,
  ) => {
    if (!employeeId) {
      return
    }

    navigate(
      `/employees/${employeeId}`,
    )
  }

  /* =======================================================
     PDF EXPORT
  ======================================================== */

  const handleExportPDF =
    () => {
      if (
        filtered.length === 0
      ) {
        error(
          'No employees to export.',
        )
        return
      }

      try {
        generateReportPDF(
          'Employee Directory',
          `Showing ${
            filtered.length
          } team member${
            filtered.length !==
            1
              ? 's'
              : ''
          }`,
          [
            'ID',
            'Full Name',
            'Role',
            'Phone',
            'Email',
            'Joined',
            'Status',
          ],
          filtered.map(
            (employee) => [
              employee.employee_id ||
                '—',
              employee.full_name ||
                '—',
              employee.role ||
                '—',
              employee.phone ||
                '—',
              employee.email ||
                '—',
              employee.joining_date
                ? formatDate(
                    employee.joining_date,
                  )
                : '—',
              employee.status ||
                'Active',
            ],
          ),
          [
            {
              label:
                'Total Employees',
              value: `${employees.length}`,
            },
            {
              label:
                'Active Employees',
              value: `${
                employees.filter(
                  (employee) =>
                    employee.status ===
                    'Active',
                ).length
              }`,
            },
          ],
          settings,
        )

        success(
          `Exported ${
            filtered.length
          } employee${
            filtered.length !==
            1
              ? 's'
              : ''
          } to PDF.`,
        )
      } catch (err) {
        console.error(
          'Failed to export employees PDF:',
          err,
        )

        error(
          'Failed to generate employees PDF.',
        )
      }
    }

  /* =======================================================
     CSV EXPORT
  ======================================================== */

  const handleExportCSV =
    () => {
      if (
        filtered.length === 0
      ) {
        error(
          'No employees to export.',
        )
        return
      }

      try {
        exportCSVSimple(
          'employees-directory',
          [
            'ID',
            'Full Name',
            'Role',
            'Phone',
            'WhatsApp',
            'Email',
            'Address',
            'Joining Date',
            'Status',
            'Notes',
          ],
          filtered.map(
            (employee) => ({
              id:
                employee.employee_id ||
                '',
              name:
                employee.full_name ||
                '',
              role:
                employee.role ||
                '',
              phone:
                employee.phone ||
                '',
              whatsapp:
                employee.whatsapp ||
                '',
              email:
                employee.email ||
                '',
              address:
                employee.address ||
                '',
              joining_date:
                employee.joining_date ||
                '',
              status:
                employee.status ||
                '',
              notes:
                employee.notes ||
                '',
            }),
          ),
        )

        success(
          `Exported ${
            filtered.length
          } employee${
            filtered.length !==
            1
              ? 's'
              : ''
          } to CSV.`,
        )
      } catch (err) {
        console.error(
          'Failed to export employees CSV:',
          err,
        )

        error(
          'Failed to export employees CSV.',
        )
      }
    }

  /* =======================================================
     RENDER
  ======================================================== */

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} team members`}
        actions={
          <>
            <ExportDropdown
              onExportPDF={
                handleExportPDF
              }
              onExportCSV={
                handleExportCSV
              }
              disabled={
                filtered.length ===
                0
              }
            />

            <Button
              variant="primary"
              size="sm"
              icon={
                <Plus size={13} />
              }
              onClick={openNew}
            >
              Add Employee
            </Button>
          </>
        }
      />

      {/* =====================================================
          SEARCH
      ====================================================== */}

      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search employees..."
          className="w-64"
        />

        <span className="text-xs text-xp-muted ml-auto">
          {filtered.length}{' '}
          results
        </span>
      </div>

      {/* =====================================================
          EMPLOYEE TABLE
      ====================================================== */}

      <Card>
        {filtered.length ===
        0 ? (
          <EmptyState
            title={
              search
                ? 'No matching employees'
                : 'No employees'
            }
            description={
              search
                ? 'Try changing your search.'
                : 'Add your team members.'
            }
            action={
              search
                ? undefined
                : {
                    label:
                      'Add Employee',
                    onClick:
                      openNew,
                  }
            }
            icon={UserRound}
          />
        ) : (
          <Table
            headers={[
              'Employee',
              'Role',
              'Phone',
              'Email',
              'Joined',
              'Status',
              'Actions',
            ]}
          >
            {filtered.map(
              (employee) => {
                const initials =
                  getInitials(
                    employee.full_name,
                  )

                return (
                  <TableRow
                    key={
                      employee.id
                    }
                    onClick={() =>
                      openDetails(
                        employee.id,
                      )
                    }
                  >
                    {/* Employee */}
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar
                          employeeId={
                            employee.id
                          }
                          avatarKey={
                            employee.avatar_url
                          }
                          initials={
                            initials
                          }
                          size="sm"
                          alt={
                            employee.full_name
                          }
                        />

                        <div className="min-w-0">
                          <p className="font-medium text-[#111] truncate">
                            {
                              employee.full_name
                            }
                          </p>

                          <p className="text-xs text-xp-muted">
                            {
                              employee.employee_id
                            }
                          </p>
                        </div>
                      </div>
                    </Td>

                    {/* Role */}
                    <Td>
                      <span className="text-sm text-xp-muted">
                        {employee.role ||
                          '—'}
                      </span>
                    </Td>

                    {/* Phone */}
                    <Td>
                      <span className="text-sm text-xp-muted">
                        {employee.phone ||
                          '—'}
                      </span>
                    </Td>

                    {/* Email */}
                    <Td>
                      <span className="text-sm text-xp-muted">
                        {employee.email ||
                          '—'}
                      </span>
                    </Td>

                    {/* Joining */}
                    <Td>
                      <span className="text-sm text-xp-muted">
                        {employee.joining_date
                          ? formatDate(
                              employee.joining_date,
                            )
                          : '—'}
                      </span>
                    </Td>

                    {/* Status */}
                    <Td>
                      <Badge
                        variant={
                          employee.status ===
                          'Active'
                            ? 'success'
                            : 'muted'
                        }
                      >
                        {
                          employee.status
                        }
                      </Badge>
                    </Td>

                    {/* Actions */}
                    <Td>
                      <div
                        className="flex items-center gap-1"
                        onClick={(
                          event,
                        ) =>
                          event.stopPropagation()
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openDetails(
                              employee.id,
                            )
                          }
                          className="p-1.5 rounded-md text-xp-muted hover:text-[#111] hover:bg-xp-light-gray transition-colors"
                          title="View employee"
                          aria-label="View employee"
                        >
                          <Eye
                            size={13}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openEdit(
                              employee,
                            )
                          }
                          className="p-1.5 rounded-md text-xp-muted hover:text-[#111] hover:bg-xp-light-gray transition-colors"
                          title="Edit employee"
                          aria-label="Edit employee"
                        >
                          <Edit2
                            size={13}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDeleteId(
                              employee.id,
                            )
                          }
                          className="p-1.5 rounded-md text-xp-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove employee"
                          aria-label="Remove employee"
                        >
                          <Trash2
                            size={13}
                          />
                        </button>
                      </div>
                    </Td>
                  </TableRow>
                )
              },
            )}
          </Table>
        )}
      </Card>

      {/* =====================================================
          ADD / EDIT MODAL
      ====================================================== */}

      <Modal
        open={showModal}
        onClose={
          closeModal
        }
        title={
          editing
            ? 'Edit Employee'
            : 'Add Employee'
        }
        width="max-w-2xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={
                closeModal
              }
              disabled={
                saving ||
                uploadingImage
              }
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={
                handleSave
              }
              loading={
                saving ||
                uploadingImage
              }
            >
              {uploadingImage
                ? 'Uploading Photo...'
                : editing
                  ? 'Save Changes'
                  : 'Add Employee'}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-5">
          {/* =================================================
              PROFILE PHOTO
          ================================================== */}

          <div>
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-3">
              Profile Photo
            </p>

            <div className="flex items-center gap-4">
              {/* Preview */}
              <div className="relative shrink-0">
                {imagePreview ? (
                  <img
                    src={
                      imagePreview
                    }
                    alt="Employee preview"
                    className="w-24 h-24 rounded-full object-cover border border-xp-border shadow-sm"
                  />
                ) : existingAvatarUrl &&
                  !removeExistingImage ? (
                  <EmployeeAvatar
                    employeeId={
                      editing?.id
                    }
                    avatarKey={
                      existingAvatarUrl
                    }
                    initials={
                      editing
                        ? getInitials(
                            editing.full_name,
                          )
                        : 'U'
                    }
                    size="lg"
                    alt={
                      editing?.full_name ||
                      'Employee'
                    }
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-xp-light-purple border border-xp-border flex items-center justify-center">
                    <UserRound
                      size={34}
                      className="text-xp-purple"
                    />
                  </div>
                )}

                {(imagePreview ||
                  (existingAvatarUrl &&
                    !removeExistingImage)) && (
                  <button
                    type="button"
                    onClick={
                      handleRemoveImage
                    }
                    disabled={
                      saving ||
                      uploadingImage
                    }
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
                    title="Remove photo"
                    aria-label="Remove photo"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Upload controls */}
              <div className="flex-1">
                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={
                    handleImageSelect
                  }
                  className="hidden"
                  disabled={
                    saving ||
                    uploadingImage
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  disabled={
                    saving ||
                    uploadingImage
                  }
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-xp-border bg-white text-sm font-medium text-[#111] hover:bg-xp-light-gray transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {imagePreview ||
                  (existingAvatarUrl &&
                    !removeExistingImage) ? (
                    <>
                      <Camera
                        size={15}
                      />
                      Change Photo
                    </>
                  ) : (
                    <>
                      <Upload
                        size={15}
                      />
                      Upload Photo
                    </>
                  )}
                </button>

                <p className="mt-2 text-[11px] text-xp-muted">
                  JPG, PNG or WEBP ·
                  Maximum 5 MB
                </p>

                {selectedImage && (
                  <p className="mt-1 text-[11px] text-xp-purple truncate max-w-sm">
                    {
                      selectedImage.name
                    }
                  </p>
                )}

                {removeExistingImage &&
                  !selectedImage && (
                    <p className="mt-1 text-[11px] text-red-500">
                      Existing profile
                      photo will be
                      removed.
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* =================================================
              PERSONAL INFORMATION
          ================================================== */}

          <div>
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-3">
              Personal Information
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Full Name */}
              <div className="col-span-2">
                <Input
                  label="Full Name"
                  value={
                    form.full_name
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'full_name',
                      event.target
                        .value,
                    )
                  }
                  placeholder="Full legal name"
                  disabled={
                    saving ||
                    uploadingImage
                  }
                />
              </div>

              {/* Role */}
              <Input
                label="Role / Position"
                value={
                  form.role
                }
                onChange={(
                  event,
                ) =>
                  updateForm(
                    'role',
                    event.target
                      .value,
                  )
                }
                placeholder="Senior Developer"
                disabled={
                  saving ||
                  uploadingImage
                }
              />

              {/* Email */}
              <Input
                label="Email"
                type="email"
                value={
                  form.email
                }
                onChange={(
                  event,
                ) =>
                  updateForm(
                    'email',
                    event.target
                      .value,
                  )
                }
                placeholder="employee@company.com"
                disabled={
                  saving ||
                  uploadingImage
                }
              />

              {/* Phone */}
              <InternationalPhoneField
                label="Phone"
                country={
                  phoneCountry
                }
                value={
                  form.phone
                }
                onChange={
                  handlePhoneChange
                }
                onCountryChange={
                  handlePhoneCountryChange
                }
                disabled={
                  saving ||
                  uploadingImage
                }
              />

              {/* WhatsApp */}
              <InternationalPhoneField
                label="WhatsApp"
                country={
                  whatsappCountry
                }
                value={
                  form.whatsapp
                }
                onChange={
                  handleWhatsappChange
                }
                onCountryChange={
                  handleWhatsappCountryChange
                }
                disabled={
                  saving ||
                  uploadingImage
                }
                action={
                  form.phone ? (
                    <button
                      type="button"
                      onClick={
                        copyPhoneToWhatsapp
                      }
                      disabled={
                        saving ||
                        uploadingImage
                      }
                      className="text-[11px] font-normal text-xp-purple hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      (same as
                      phone)
                    </button>
                  ) : null
                }
              />

              {/* Joining Date */}
              <Input
                label="Joining Date"
                type="date"
                value={
                  form.joining_date
                }
                onChange={(
                  event,
                ) =>
                  updateForm(
                    'joining_date',
                    event.target
                      .value,
                  )
                }
                disabled={
                  saving ||
                  uploadingImage
                }
              />

              {/* Status */}
              <Select
                label="Status"
                value={
                  form.status
                }
                onChange={(
                  event,
                ) =>
                  updateForm(
                    'status',
                    event.target
                      .value as EmployeeStatus,
                  )
                }
                options={EMPLOYEE_STATUSES.map(
                  (
                    status,
                  ) => ({
                    value:
                      status,
                    label:
                      status,
                  }),
                )}
                disabled={
                  saving ||
                  uploadingImage
                }
              />
            </div>

            {/* Address */}
            <div className="mt-3">
              <Textarea
                label="Address"
                value={
                  form.address
                }
                onChange={(
                  event,
                ) =>
                  updateForm(
                    'address',
                    event.target
                      .value,
                  )
                }
                placeholder="Home address"
                disabled={
                  saving ||
                  uploadingImage
                }
              />
            </div>
          </div>

          {/* =================================================
              BANKING
          ================================================== */}

          <div>
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-3">
              Banking Information
            </p>

            <Textarea
              label="Bank Account Details"
              value={
                form.bank_information
              }
              onChange={(
                event,
              ) =>
                updateForm(
                  'bank_information',
                  event.target
                    .value,
                )
              }
              placeholder="Bank name, account number, branch..."
              disabled={
                saving ||
                uploadingImage
              }
            />
          </div>

          {/* =================================================
              NOTES
          ================================================== */}

          <Textarea
            label="Notes"
            value={
              form.notes
            }
            onChange={(
              event,
            ) =>
              updateForm(
                'notes',
                event.target
                  .value,
              )
            }
            placeholder="Additional notes..."
            disabled={
              saving ||
              uploadingImage
            }
          />
        </div>
      </Modal>

      {/* =====================================================
          DELETE CONFIRMATION
      ====================================================== */}

      <Modal
        open={!!deleteId}
        onClose={() =>
          deleting
            ? undefined
            : setDeleteId(
                null,
              )
        }
        title="Remove Employee"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteId(
                  null,
                )
              }
              disabled={
                deleting
              }
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              onClick={
                handleDelete
              }
              loading={
                deleting
              }
            >
              Remove
            </Button>
          </>
        }
      >
        <div className="p-6">
          <p className="text-sm text-xp-muted">
            This will permanently
            remove this employee
            record. This action
            cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  )
}