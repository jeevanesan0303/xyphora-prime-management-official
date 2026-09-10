import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Plus,
  Download,
  Eye,
  Edit2,
  Trash2,
} from 'lucide-react'
import { parsePhoneNumber } from 'react-phone-number-input'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'

import {
  formatDate,
  exportCSVSimple,
} from '../../lib/utils'
import { generateReportPDF } from '../../lib/pdf'

import {
  PageHeader,
  Button,
  ExportDropdown,
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
  InternationalPhoneField,
  replaceCountryCallingCode,
  cleanPhone,
  validateInternationalPhone,
  getCountryFromPhone,
  type Country,
} from '../../components/ui'

import type {
  Client,
  ClientStatus,
} from '../../types'

/*
 * ------------------------------------------------------------
 * STATUS
 * ------------------------------------------------------------
 */

const statusVariant: Record<
  ClientStatus,
  'success' | 'purple' | 'muted' | 'warning' | 'danger'
> = {
  Active: 'success',
  Lead: 'purple',
  Completed: 'muted',
  Maintenance: 'warning',
  Inactive: 'danger',
}

const statusOptions: {
  value: ClientStatus
  label: string
}[] = [
  {
    value: 'Active',
    label: 'Active',
  },
  {
    value: 'Inactive',
    label: 'Inactive',
  },
]

/*
 * ------------------------------------------------------------
 * FORM TYPE
 * ------------------------------------------------------------
 */

type ClientForm = Omit<
  Client,
  'id' | 'client_id' | 'created_at' | 'updated_at'
>

/*
 * ------------------------------------------------------------
 * EMPTY FORM
 * ------------------------------------------------------------
 */

const emptyForm = (): ClientForm => ({
  company_name: '',
  contact_person: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  business_type: '',
  website: '',
  registration_number: '',
  date_joined: new Date()
    .toISOString()
    .slice(0, 10),
  status: 'Active',
  notes: '',
})

/*
 * ------------------------------------------------------------
 * NORMALIZE TEXT
 * ------------------------------------------------------------
 */

const normalize = (
  value: string | null | undefined,
): string => {
  return value?.trim() || ''
}

/*
 * ------------------------------------------------------------
 * EMAIL VALIDATION
 * ------------------------------------------------------------
 */

const isValidEmail = (
  value: string,
): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  )
}

/*
 * ------------------------------------------------------------
 * ERROR MESSAGE
 * ------------------------------------------------------------
 */

const getErrorMessage = (
  err: unknown,
  fallback: string,
): string => {
  if (err instanceof Error && err.message) {
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
      message.trim()
    ) {
      return message
    }
  }

  return fallback
}

/*
 * ------------------------------------------------------------
 * PAGE
 * ------------------------------------------------------------
 */

export default function ClientsPage() {
  const {
    clients,
    addClient,
    updateClient,
    deleteClient,
    loading: dataLoading,
    settings,
  } = useData()

  const {
    success,
    error,
  } = useToast()

  const navigate = useNavigate()
  const location = useLocation()

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('')

  const [
    showModal,
    setShowModal,
  ] = useState(false)

  const [
    editing,
    setEditing,
  ] = useState<Client | null>(null)

  const [
    form,
    setForm,
  ] = useState<ClientForm>(
    emptyForm(),
  )

  const [phoneCountry, setPhoneCountry] = useState<Country>('LK')
  const [whatsappCountry, setWhatsappCountry] = useState<Country>('LK')

  const [
    errors,
    setErrors,
  ] = useState<Record<string, string>>(
    {},
  )

  const [
    deleteId,
    setDeleteId,
  ] = useState<string | null>(null)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    deleting,
    setDeleting,
  ] = useState(false)

  /*
   * ----------------------------------------------------------
   * OPEN NEW CLIENT FROM /clients/new
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (
      location.pathname ===
      '/clients/new'
    ) {
      setForm(emptyForm())
      setEditing(null)
      setErrors({})
      setPhoneCountry('LK')
      setWhatsappCountry('LK')
      setShowModal(true)
    }
  }, [location.pathname])

  /*
   * ----------------------------------------------------------
   * SEARCH + FILTER
   * ----------------------------------------------------------
   */

  const filtered = clients.filter(
    (client) => {
      const searchValue =
        search.trim().toLowerCase()

      const matchSearch =
        !searchValue ||
        client.company_name
          .toLowerCase()
          .includes(searchValue) ||
        client.contact_person
          .toLowerCase()
          .includes(searchValue) ||
        client.email
          .toLowerCase()
          .includes(searchValue) ||
        client.client_id
          .toLowerCase()
          .includes(searchValue) ||
        client.phone
          .toLowerCase()
          .includes(searchValue) ||
        client.whatsapp
          .toLowerCase()
          .includes(searchValue) ||
        client.business_type
          .toLowerCase()
          .includes(searchValue) ||
        client.registration_number
          .toLowerCase()
          .includes(searchValue)

      const matchStatus =
        !statusFilter ||
        client.status === statusFilter

      return (
        matchSearch &&
        matchStatus
      )
    },
  )

  /*
   * ----------------------------------------------------------
   * FORM VALIDATION
   * ----------------------------------------------------------
   */

  const validate = (): boolean => {
    const errs: Record<
      string,
      string
    > = {}

    const companyName =
      normalize(form.company_name)

    const contactPerson =
      normalize(form.contact_person)

    const email =
      normalize(form.email)

    const phone =
      cleanPhone(form.phone)

    const whatsapp =
      cleanPhone(form.whatsapp)

    if (!companyName) {
      errs.company_name =
        'Company name is required.'
    }

    if (!contactPerson) {
      errs.contact_person =
        'Contact person is required.'
    }

    if (!email) {
      errs.email =
        'Email is required.'
    } else if (
      !isValidEmail(email)
    ) {
      errs.email =
        'Please enter a valid email address.'
    }

    if (
      phone &&
      !validateInternationalPhone(phone)
    ) {
      errs.phone =
        'Please enter a valid international phone number.'
    }

    if (
      whatsapp &&
      !validateInternationalPhone(whatsapp)
    ) {
      errs.whatsapp =
        'Please enter a valid international WhatsApp number.'
    }

    setErrors(errs)

    return (
      Object.keys(errs)
        .length === 0
    )
  }

  /*
   * ----------------------------------------------------------
   * OPEN NEW
   * ----------------------------------------------------------
   */

  const openNew = () => {
    setForm(emptyForm())
    setEditing(null)
    setErrors({})
    setPhoneCountry('LK')
    setWhatsappCountry('LK')
    setShowModal(true)
  }

  /*
   * ----------------------------------------------------------
   * OPEN EDIT
   * ----------------------------------------------------------
   */

  const openEdit = (
    client: Client,
  ) => {
    const pCountry = getCountryFromPhone(client.phone, 'LK')
    const wCountry = getCountryFromPhone(client.whatsapp, pCountry)
    setPhoneCountry(pCountry)
    setWhatsappCountry(wCountry)

    setForm({
      company_name:
        client.company_name ?? '',

      contact_person:
        client.contact_person ?? '',

      phone:
        client.phone ?? '',

      whatsapp:
        client.whatsapp ?? '',

      email:
        client.email ?? '',

      address:
        client.address ?? '',

      business_type:
        client.business_type ?? '',

      website:
        client.website ?? '',

      registration_number:
        client.registration_number ??
        '',

      date_joined:
        client.date_joined ?? '',

      status:
        client.status,

      notes:
        client.notes ?? '',
    })

    setEditing(client)
    setErrors({})
    setShowModal(true)
  }

  /*
   * ----------------------------------------------------------
   * CLOSE MODAL
   * ----------------------------------------------------------
   */

  const closeModal = () => {
    if (saving) {
      return
    }

    setShowModal(false)
    setEditing(null)
    setErrors({})
    setForm(emptyForm())
    setPhoneCountry('LK')
    setWhatsappCountry('LK')

    /*
     * If user entered /clients/new directly,
     * return to normal clients page.
     */
    if (
      location.pathname ===
      '/clients/new'
    ) {
      navigate('/clients', {
        replace: true,
      })
    }
  }

  /*
   * ----------------------------------------------------------
   * SAVE CLIENT
   * ----------------------------------------------------------
   */

  const handleSave = async () => {
    if (!validate()) {
      return
    }

    setSaving(true)
    setErrors({})

    try {
      const payload = {
        company_name:
          normalize(
            form.company_name,
          ),

        contact_person:
          normalize(
            form.contact_person,
          ),

        phone:
          cleanPhone(form.phone),

        whatsapp:
          cleanPhone(
            form.whatsapp,
          ),

        email:
          normalize(form.email),

        address:
          normalize(
            form.address,
          ),

        business_type:
          normalize(
            form.business_type,
          ),

        website:
          normalize(
            form.website,
          ),

        registration_number:
          normalize(
            form.registration_number,
          ),

        date_joined:
          form.date_joined || new Date().toISOString().slice(0, 10),

        status:
          form.status,

        notes:
          normalize(form.notes),
      }

      if (editing) {
        await updateClient(
          editing.id,
          payload,
        )

        success(
          'Client updated successfully.',
        )
      } else {
        await addClient(
          payload,
        )

        success(
          'Client created successfully.',
        )
      }

      setShowModal(false)
      setEditing(null)
      setForm(emptyForm())
      setErrors({})

      if (
        location.pathname ===
        '/clients/new'
      ) {
        navigate('/clients', {
          replace: true,
        })
      }
    } catch (err: unknown) {
      const message =
        getErrorMessage(
          err,
          editing
            ? 'Unable to update client.'
            : 'Unable to create client.',
        )

      error(message)
    } finally {
      setSaving(false)
    }
  }

  /*
   * ----------------------------------------------------------
   * DELETE CLIENT
   * ----------------------------------------------------------
   */

  const handleDelete = async (
    id: string,
  ) => {
    setDeleting(true)

    try {
      await deleteClient(id)

      success(
        'Client deleted successfully.',
      )

      setDeleteId(null)
    } catch (err: unknown) {
      error(
        getErrorMessage(
          err,
          'Unable to delete client.',
        ),
      )
    } finally {
      setDeleting(false)
    }
  }

  /*
   * ----------------------------------------------------------
   * EXPORT
   * ----------------------------------------------------------
   */

  const handleExport = () => {
    if (
      filtered.length === 0
    ) {
      error(
        'There are no clients to export.',
      )
      return
    }

    exportCSVSimple(
      'clients',
      [
        'ID',
        'Company',
        'Contact',
        'Phone',
        'WhatsApp',
        'Email',
        'Business Type',
        'Status',
        'Joined',
      ],
      filtered.map(
        (client) => ({
          id:
            client.client_id,

          company:
            client.company_name,

          contact:
            client.contact_person,

          phone:
            client.phone,

          whatsapp:
            client.whatsapp,

          email:
            client.email,

          business_type:
            client.business_type,

          status:
            client.status,

          joined:
            client.date_joined,
        }),
      ),
    )

    success(
      'Clients exported as CSV successfully.',
    )
  }

  const handleExportPDF = () => {
    if (filtered.length === 0) {
      error('There are no clients to export.')
      return
    }

    generateReportPDF(
      'Client Directory Report',
      `Total: ${filtered.length} client(s)`,
      ['Client ID', 'Company Name', 'Contact Person', 'Phone / WhatsApp', 'Email', 'Status', 'Date Joined'],
      filtered.map((client) => [
        client.client_id,
        client.company_name,
        client.contact_person,
        client.phone || client.whatsapp || '—',
        client.email,
        client.status,
        formatDate(client.date_joined),
      ]),
      [{ label: 'Total Clients', value: String(filtered.length) }],
      settings,
    )

    success('Clients exported as PDF successfully.')
  }

  /*
   * ----------------------------------------------------------
   * FORM FIELD UPDATE
   * ----------------------------------------------------------
   */

  const updateFormField = <
    K extends keyof ClientForm
  >(
    key: K,
    value: ClientForm[K],
  ) => {
    setForm(
      (previous) => ({
        ...previous,
        [key]: value,
      }),
    )

    const errorKey =
      String(key)

    if (
      errors[errorKey]
    ) {
      setErrors(
        (previous) => {
          const next = {
            ...previous,
          }

          delete next[
            errorKey
          ]

          return next
        },
      )
    }
  }

  const handlePhoneCountryChange = (newCountry: Country) => {
    const oldPhoneCountry = phoneCountry
    const oldWhatsappCountry = whatsappCountry
    setPhoneCountry(newCountry)
    setWhatsappCountry(newCountry)

    const nextPhone = replaceCountryCallingCode(form.phone, oldPhoneCountry, newCountry)
    const nextWhatsapp = replaceCountryCallingCode(form.whatsapp, oldWhatsappCountry, newCountry)

    setForm((previous) => ({
      ...previous,
      phone: nextPhone,
      whatsapp: nextWhatsapp,
    }))

    if (errors.phone || errors.whatsapp) {
      setErrors((previous) => {
        const next = { ...previous }
        delete next.phone
        delete next.whatsapp
        return next
      })
    }
  }

  const handlePhoneChange = (nextPhone: string) => {
    let nextWhatsapp = form.whatsapp
    let detectedCountry: Country | undefined

    try {
      const parsed = parsePhoneNumber(nextPhone)
      if (parsed?.country && parsed.country !== phoneCountry) {
        detectedCountry = parsed.country
      }
    } catch {
      // ignore
    }

    if (detectedCountry) {
      const oldPhoneCountry = phoneCountry
      const oldWhatsappCountry = whatsappCountry
      setPhoneCountry(detectedCountry)
      setWhatsappCountry(detectedCountry)
      nextWhatsapp = replaceCountryCallingCode(form.whatsapp, oldWhatsappCountry, detectedCountry)
    }

    setForm((previous) => ({
      ...previous,
      phone: nextPhone,
      whatsapp: nextWhatsapp,
    }))

    if (errors.phone) {
      setErrors((previous) => {
        const next = { ...previous }
        delete next.phone
        return next
      })
    }
  }

  const handleWhatsappCountryChange = (newCountry: Country) => {
    const oldWhatsappCountry = whatsappCountry
    setWhatsappCountry(newCountry)
    const nextWhatsapp = replaceCountryCallingCode(form.whatsapp, oldWhatsappCountry, newCountry)
    setForm((previous) => ({
      ...previous,
      whatsapp: nextWhatsapp,
    }))
    if (errors.whatsapp) {
      setErrors((previous) => {
        const next = { ...previous }
        delete next.whatsapp
        return next
      })
    }
  }

  const handleWhatsappChange = (nextWhatsapp: string) => {
    try {
      const parsed = parsePhoneNumber(nextWhatsapp)
      if (parsed?.country && parsed.country !== whatsappCountry) {
        setWhatsappCountry(parsed.country)
      }
    } catch {
      // ignore
    }

    updateFormField('whatsapp', nextWhatsapp)
  }

  const copyPhoneToWhatsapp = () => {
    setWhatsappCountry(phoneCountry)
    setForm((previous) => ({
      ...previous,
      whatsapp: previous.phone,
    }))
    if (errors.whatsapp) {
      setErrors((previous) => {
        const next = { ...previous }
        delete next.whatsapp
        return next
      })
    }
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} total clients`}
        actions={
          <>
            <ExportDropdown
              onExportCSV={handleExport}
              onExportPDF={handleExportPDF}
              disabled={
                dataLoading ||
                filtered.length === 0
              }
            />

            <Button
              variant="primary"
              size="sm"
              icon={
                <Plus size={13} />
              }
              onClick={
                openNew
              }
              disabled={
                dataLoading
              }
            >
              New Client
            </Button>
          </>
        }
      />

      {/* ========================================================
          FILTERS
      ========================================================= */}

      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search clients..."
          className="w-64"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value,
            )
          }
          className="
            h-9
            px-3
            rounded-lg
            border
            border-xp-border
            text-sm
            text-[#111]
            bg-white
            focus:outline-none
            focus:ring-2
            focus:ring-xp-purple/20
            focus:border-xp-purple
          "
        >
          <option value="">
            All Status
          </option>

          {statusOptions.map(
            (option) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {option.label}
              </option>
            ),
          )}
        </select>

        <span className="text-xs text-xp-muted ml-auto">
          {filtered.length}{' '}
          result
          {filtered.length !==
          1
            ? 's'
            : ''}
        </span>
      </div>

      {/* ========================================================
          CLIENT TABLE
      ========================================================= */}

      <Card>
        {dataLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-sm text-xp-muted">
              <div
                className="
                  h-4
                  w-4
                  rounded-full
                  border-2
                  border-xp-purple/20
                  border-t-xp-purple
                  animate-spin
                "
              />

              Loading clients...
            </div>
          </div>
        ) : filtered.length ===
          0 ? (
          <EmptyState
            title="No clients found"
            description="Add your first client to start managing your business."
            action={{
              label: 'Add Client',
              onClick: openNew,
            }}
          />
        ) : (
          <Table
            headers={[
              'Client',
              'Contact',
              'Business Type',
              'Status',
              'Joined',
              'Actions',
            ]}
          >
            {filtered.map(
              (client) => (
                <TableRow
                  key={
                    client.id
                  }
                  onClick={() =>
                    navigate(
                      `/clients/${client.id}`,
                    )
                  }
                >
                  <Td>
                    <div>
                      <p className="font-medium text-[#111]">
                        {
                          client.company_name
                        }
                      </p>

                      <p className="text-xs text-xp-muted">
                        {
                          client.client_id
                        }
                      </p>
                    </div>
                  </Td>

                  <Td>
                    <div>
                      <p className="text-[#111]">
                        {
                          client.contact_person
                        }
                      </p>

                      <p className="text-xs text-xp-muted">
                        {
                          client.email
                        }
                      </p>
                    </div>
                  </Td>

                  <Td>
                    <span className="text-xp-muted text-sm">
                      {
                        client.business_type ||
                        '—'
                      }
                    </span>
                  </Td>

                  <Td>
                    <Badge
                      variant={
                        statusVariant[
                          client.status
                        ]
                      }
                    >
                      {
                        client.status
                      }
                    </Badge>
                  </Td>

                  <Td>
                    <span className="text-sm text-xp-muted">
                      {formatDate(
                        client.date_joined,
                      )}
                    </span>
                  </Td>

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
                          navigate(
                            `/clients/${client.id}`,
                          )
                        }
                        className="
                          p-1.5
                          rounded-md
                          text-xp-muted
                          hover:text-[#111]
                          hover:bg-xp-light-gray
                        "
                        aria-label="View client"
                      >
                        <Eye
                          size={13}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEdit(
                            client,
                          )
                        }
                        className="
                          p-1.5
                          rounded-md
                          text-xp-muted
                          hover:text-[#111]
                          hover:bg-xp-light-gray
                        "
                        aria-label="Edit client"
                      >
                        <Edit2
                          size={13}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDeleteId(
                            client.id,
                          )
                        }
                        className="
                          p-1.5
                          rounded-md
                          text-xp-muted
                          hover:text-red-600
                          hover:bg-red-50
                        "
                        aria-label="Delete client"
                      >
                        <Trash2
                          size={13}
                        />
                      </button>
                    </div>
                  </Td>
                </TableRow>
              ),
            )}
          </Table>
        )}
      </Card>

      {/* ========================================================
          CLIENT MODAL
      ========================================================= */}

      <Modal
        open={showModal}
        onClose={
          closeModal
        }
        title={
          editing
            ? 'Edit Client'
            : 'New Client'
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
                saving
              }
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={
                handleSave
              }
              disabled={
                saving
              }
            >
              {saving
                ? editing
                  ? 'Saving...'
                  : 'Creating...'
                : editing
                  ? 'Save Changes'
                  : 'Create Client'}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-6">
          {/* ====================================================
              CLIENT INFORMATION
          ===================================================== */}

          <div>
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-3">
              Client Information
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input
                  label="Company Name"
                  value={
                    form.company_name
                  }
                  onChange={(
                    event,
                  ) =>
                    updateFormField(
                      'company_name',
                      event.target
                        .value,
                    )
                  }
                  error={
                    errors.company_name
                  }
                  placeholder="ABC Construction Ltd"
                  disabled={
                    saving
                  }
                />
              </div>

              <Input
                label="Contact Person"
                value={
                  form.contact_person
                }
                onChange={(
                  event,
                ) =>
                  updateFormField(
                    'contact_person',
                    event.target
                      .value,
                  )
                }
                error={
                  errors.contact_person
                }
                placeholder="John Smith"
                disabled={
                  saving
                }
              />

              <Input
                label="Email"
                type="email"
                value={
                  form.email
                }
                onChange={(
                  event,
                ) =>
                  updateFormField(
                    'email',
                    event.target
                      .value,
                  )
                }
                error={
                  errors.email
                }
                placeholder="contact@company.com"
                disabled={
                  saving
                }
              />

              {/* ==================================================
                  INTERNATIONAL PHONE
              =================================================== */}

              <InternationalPhoneField
                label="Phone"
                country={phoneCountry}
                value={form.phone}
                onChange={handlePhoneChange}
                onCountryChange={handlePhoneCountryChange}
                error={errors.phone}
                disabled={saving}
              />

              {/* ==================================================
                  INTERNATIONAL WHATSAPP
              =================================================== */}

              <InternationalPhoneField
                label="WhatsApp"
                country={whatsappCountry}
                value={form.whatsapp}
                onChange={handleWhatsappChange}
                onCountryChange={handleWhatsappCountryChange}
                error={errors.whatsapp}
                disabled={saving}
                action={
                  form.phone ? (
                    <button
                      type="button"
                      onClick={copyPhoneToWhatsapp}
                      className="text-[11px] font-normal text-xp-purple hover:underline cursor-pointer lowercase"
                    >
                      (same as phone)
                    </button>
                  ) : null
                }
              />
            </div>
          </div>

          {/* ====================================================
              BUSINESS INFORMATION
          ===================================================== */}

          <div>
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-3">
              Business Information
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input
                  label="Business Type"
                  value={
                    form.business_type
                  }
                  onChange={(
                    event,
                  ) =>
                    updateFormField(
                      'business_type',
                      event.target
                        .value,
                    )
                  }
                  placeholder="Construction"
                  disabled={
                    saving
                  }
                />
              </div>

              <Input
                label="Date Joined"
                type="date"
                value={
                  form.date_joined
                }
                onChange={(
                  event,
                ) =>
                  updateFormField(
                    'date_joined',
                    event.target
                      .value,
                  )
                }
                disabled={
                  saving
                }
              />

              <Select
                label="Status"
                value={
                  form.status
                }
                onChange={(
                  event,
                ) =>
                  updateFormField(
                    'status',
                    event.target
                      .value as ClientStatus,
                  )
                }
                options={
                  statusOptions
                }
                disabled={
                  saving
                }
              />
            </div>

            <div className="mt-3">
              <Textarea
                label="Address"
                value={
                  form.address
                }
                onChange={(
                  event,
                ) =>
                  updateFormField(
                    'address',
                    event.target
                      .value,
                  )
                }
                placeholder="Full address..."
                disabled={
                  saving
                }
              />
            </div>
          </div>

          {/* ====================================================
              NOTES
          ===================================================== */}

          <div>
            <Textarea
              label="Notes"
              value={
                form.notes
              }
              onChange={(
                event,
              ) =>
                updateFormField(
                  'notes',
                  event.target
                    .value,
                )
              }
              placeholder="Additional notes about this client..."
              disabled={
                saving
              }
            />
          </div>
        </div>
      </Modal>

      {/* ========================================================
          DELETE CONFIRMATION
      ========================================================= */}

      <Modal
        open={!!deleteId}
        onClose={() => {
          if (!deleting) {
            setDeleteId(null)
          }
        }}
        title="Delete Client"
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
              onClick={() => {
                if (
                  deleteId
                ) {
                  void handleDelete(
                    deleteId,
                  )
                }
              }}
              disabled={
                deleting
              }
            >
              {deleting
                ? 'Deleting...'
                : 'Delete Client'}
            </Button>
          </>
        }
      >
        <div className="p-6">
          <p className="text-sm text-xp-muted">
            This action cannot be
            undone. Associated
            projects, invoices and
            payments may be affected
            depending on your database
            relationships.
          </p>
        </div>
      </Modal>
    </div>
  )
}