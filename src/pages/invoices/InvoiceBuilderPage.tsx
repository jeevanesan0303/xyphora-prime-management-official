
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import {
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Eye,
  Printer,
  Building2,
  CreditCard,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'

import {
  Button,
  Input,
  Textarea,
  Select,
  Card,
} from '../../components/ui'

import InvoicePreviewDocument from '../../components/invoices/InvoicePreviewDocument'

import type {
  InvoiceItem,
  PaymentType,
} from '../../types'

const paymentTypeOpts: {
  value: PaymentType
  label: string
}[] = [
  {
    value: 'Advance',
    label: 'Advance',
  },
  {
    value: 'Partial',
    label: 'Partial',
  },
  {
    value: 'Milestone',
    label: 'Milestone',
  },
  {
    value: 'Full',
    label: 'Full',
  },
  {
    value: 'Final',
    label: 'Final',
  },
  {
    value: 'Subscription',
    label: 'Subscription',
  },
  {
    value: 'Renewal',
    label: 'Renewal',
  },
  {
    value: 'Other',
    label: 'Other',
  },
]

const currencyOpts = [
  {
    value: 'LKR',
    label: 'LKR - Sri Lankan Rupee',
  },
  {
    value: 'USD',
    label: 'USD - US Dollar ($)',
  },
  {
    value: 'EUR',
    label: 'EUR - Euro (€)',
  },
  {
    value: 'GBP',
    label: 'GBP - British Pound (£)',
  },
  {
    value: 'AED',
    label: 'AED - UAE Dirham',
  },
  {
    value: 'AUD',
    label: 'AUD - Australian Dollar',
  },
  {
    value: 'CAD',
    label: 'CAD - Canadian Dollar',
  },
  {
    value: 'INR',
    label: 'INR - Indian Rupee (₹)',
  },
  {
    value: 'SGD',
    label: 'SGD - Singapore Dollar',
  },
]

const createItemId = () =>
  crypto.randomUUID()

const emptyItem = (): InvoiceItem => ({
  id: createItemId(),
  invoice_id: '',
  description: '',
  quantity: 1,
  unit_price: 0,
  discount: 0,
  tax: 0,
  total: 0,
})

const roundMoney = (value: number) =>
  Math.round(value * 100) / 100

const calculateItem = (
  item: InvoiceItem
): InvoiceItem => {
  const quantity = Math.max(
    0,
    Number(item.quantity) || 0
  )

  const unitPrice = Math.max(
    0,
    Number(item.unit_price) || 0
  )

  const discountRate = Math.min(
    100,
    Math.max(
      0,
      Number(item.discount) || 0
    )
  )

  const taxRate = Math.max(
    0,
    Number(item.tax) || 0
  )

  const gross =
    quantity * unitPrice

  const discountAmount =
    gross * (discountRate / 100)

  const afterDiscount =
    gross - discountAmount

  const taxAmount =
    afterDiscount * (taxRate / 100)

  const total =
    afterDiscount + taxAmount

  return {
    ...item,
    quantity,
    unit_price: unitPrice,
    discount: discountRate,
    tax: taxRate,
    total: roundMoney(total),
  }
}

const getToday = () =>
  new Date()
    .toISOString()
    .slice(0, 10)

const getDueDate = () => {
  const date = new Date()

  date.setDate(
    date.getDate() + 30
  )

  return date
    .toISOString()
    .slice(0, 10)
}

export default function InvoiceBuilderPage() {
  const navigate = useNavigate()

  const [searchParams] =
    useSearchParams()

  const {
    clients,
    projects,
    settings,
    loading,
    addInvoice,
    addClient,
    nextInvoiceNumber,
  } = useData()

  const {
    success,
    error: showError,
  } = useToast()

  const queryClientId =
    searchParams.get('clientId') ||
    searchParams.get('client_id') ||
    ''

  const queryProjectId =
    searchParams.get('projectId') ||
    searchParams.get('project_id') ||
    ''

  /*
   * ============================================================
   * Initial values
   * ============================================================
   */

  const initialClient = useMemo(
    () =>
      clients.find(
        (client) =>
          client.id === queryClientId
      ),
    [clients, queryClientId]
  )

  const [invoiceNumber, setInvoiceNumber] =
    useState('')

  const [clientId, setClientId] =
    useState(queryClientId)

  const [clientName, setClientName] =
    useState(
      initialClient?.company_name || ''
    )

  const [clientAddress, setClientAddress] =
    useState(
      initialClient?.address || ''
    )

  const [projectId, setProjectId] =
    useState(queryProjectId)

  const [invoiceDate, setInvoiceDate] =
    useState(getToday())

  const [dueDate, setDueDate] =
    useState(getDueDate())

  const [currency, setCurrency] =
    useState(
      settings.currency || 'LKR'
    )

  /*
   * ============================================================
   * Company / Sender
   * ============================================================
   */

  const [companyName, setCompanyName] =
    useState(
      settings.company_name || ''
    )

  const [companySubtitle, setCompanySubtitle] =
    useState(
      'Software & Digital Solutions'
    )

  const [companyAddress, setCompanyAddress] =
    useState(
      settings.address || ''
    )

  const [companyEmail, setCompanyEmail] =
    useState(
      settings.email || ''
    )

  const [companyPhone, setCompanyPhone] =
    useState(
      settings.phone || ''
    )

  const [companyWebsite, setCompanyWebsite] =
    useState(
      settings.website || ''
    )

  /*
   * ============================================================
   * Bank / Payment
   * ============================================================
   */

  const [
    accountHolderName,
    setAccountHolderName,
  ] = useState(
    settings.account_holder_name || ''
  )

  const [bankName, setBankName] =
    useState(
      settings.bank_name || ''
    )

  const [bankBranch, setBankBranch] =
    useState(
      settings.bank_branch || ''
    )

  const [bankAccount, setBankAccount] =
    useState(
      settings.bank_account || ''
    )

  const [bankCountry, setBankCountry] =
    useState('Sri Lanka')

  const [
    paymentReference,
    setPaymentReference,
  ] = useState('')

  const [paymentTerms, setPaymentTerms] =
    useState(
      settings.default_payment_terms ||
        ''
    )

  const [paymentType, setPaymentType] =
    useState<PaymentType>('Full')

  /*
   * ============================================================
   * Line items
   * ============================================================
   */

  const [items, setItems] = useState<
    InvoiceItem[]
  >([emptyItem()])

  /*
   * ============================================================
   * Additional information
   * ============================================================
   */

  const [notes, setNotes] =
    useState(
      settings.default_notes || ''
    )

  const [terms, setTerms] =
    useState(
      settings.terms_and_conditions || ''
    )

  const [thankYouHeading, setThankYouHeading] =
    useState('THANK YOU!')

  const [thankYouMessage, setThankYouMessage] =
    useState(
      `Thank you for choosing\n${
        settings.company_name ||
        'Xyphora Prime Pvt Ltd'
      }.`
    )

  /*
   * ============================================================
   * UI state
   * ============================================================
   */

  const [showPreview, setShowPreview] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [
    showCompanyDetails,
    setShowCompanyDetails,
  ] = useState(false)

  const [
    showBankDetails,
    setShowBankDetails,
  ] = useState(false)

  const [
    showAdditionalDetails,
    setShowAdditionalDetails,
  ] = useState(false)

  /*
   * ============================================================
   * Generate invoice number once.
   * ============================================================
   */

  useEffect(() => {
    if (!invoiceNumber) {
      setInvoiceNumber(
        nextInvoiceNumber()
      )
    }
  }, [
    invoiceNumber,
    nextInvoiceNumber,
  ])

  /*
   * ============================================================
   * Initialize from URL client/project.
   * ============================================================
   */

  useEffect(() => {
    if (!queryClientId) {
      return
    }

    const selectedClient =
      clients.find(
        (item) =>
          item.id === queryClientId
      )

    if (!selectedClient) {
      return
    }

    setClientId(
      selectedClient.id
    )

    setClientName(
      selectedClient.company_name
    )

    setClientAddress(
      selectedClient.address || ''
    )

    setPaymentReference(
      selectedClient.client_id ||
        invoiceNumber
    )
  }, [
    queryClientId,
    clients,
    invoiceNumber,
  ])

  /*
   * ============================================================
   * Sync company settings.
   * ============================================================
   */

  useEffect(() => {
    setCurrency(
      settings.currency || 'LKR'
    )

    setCompanyName(
      settings.company_name || ''
    )

    setCompanyAddress(
      settings.address || ''
    )

    setCompanyEmail(
      settings.email || ''
    )

    setCompanyPhone(
      settings.phone || ''
    )

    setCompanyWebsite(
      settings.website || ''
    )

    setAccountHolderName(
      settings.account_holder_name ||
        ''
    )

    setBankName(
      settings.bank_name || ''
    )

    setBankBranch(
      settings.bank_branch || ''
    )

    setBankAccount(
      settings.bank_account || ''
    )

    setPaymentTerms(
      settings.default_payment_terms ||
        ''
    )

    setNotes(
      settings.default_notes || ''
    )

    setTerms(
      settings.terms_and_conditions ||
        ''
    )

    setThankYouMessage(
      `Thank you for choosing\n${
        settings.company_name ||
        'Xyphora Prime Pvt Ltd'
      }.`
    )
  }, [settings])

  /*
   * ============================================================
   * Related client/project data
   * ============================================================
   */

  const client = useMemo(
    () =>
      clients.find(
        (item) =>
          item.id === clientId
      ),
    [clients, clientId]
  )

  const clientProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          !clientId ||
          project.client_id ===
            clientId
      ),
    [projects, clientId]
  )

  /*
   * ============================================================
   * Handle client change
   * ============================================================
   */

  const handleClientDropdownChange = (
    selectedId: string
  ) => {
    setClientId(selectedId)
    setProjectId('')

    const selectedClient =
      clients.find(
        (item) =>
          item.id === selectedId
      )

    if (selectedClient) {
      setClientName(
        selectedClient.company_name
      )

      setClientAddress(
        selectedClient.address || ''
      )

      setPaymentReference(
        selectedClient.client_id ||
          invoiceNumber
      )
    } else {
      setClientName('')
      setClientAddress('')

      setPaymentReference(
        invoiceNumber
      )
    }
  }

  /*
   * ============================================================
   * Totals
   * ============================================================
   */

  const totals = useMemo(() => {
    const calculatedItems =
      items.map(calculateItem)

    const subtotal =
      calculatedItems.reduce(
        (sum, item) => {
          const quantity =
            Number(
              item.quantity
            ) || 0

          const unitPrice =
            Number(
              item.unit_price
            ) || 0

          return (
            sum +
            quantity *
              unitPrice
          )
        },
        0
      )

    const discount =
      calculatedItems.reduce(
        (sum, item) => {
          const base =
            (Number(
              item.quantity
            ) || 0) *
            (Number(
              item.unit_price
            ) || 0)

          return (
            sum +
            base *
              ((Number(
                item.discount
              ) || 0) /
                100)
          )
        },
        0
      )

    const tax =
      calculatedItems.reduce(
        (sum, item) => {
          const base =
            (Number(
              item.quantity
            ) || 0) *
            (Number(
              item.unit_price
            ) || 0)

          const discountAmount =
            base *
            ((Number(
              item.discount
            ) || 0) /
              100)

          const afterDiscount =
            base -
            discountAmount

          return (
            sum +
            afterDiscount *
              ((Number(
                item.tax
              ) || 0) /
                100)
          )
        },
        0
      )

    const total =
      calculatedItems.reduce(
        (sum, item) =>
          sum +
          Number(
            item.total || 0
          ),
        0
      )

    return {
      subtotal: roundMoney(
        subtotal
      ),
      discount: roundMoney(
        discount
      ),
      tax: roundMoney(tax),
      total: roundMoney(total),
      items: calculatedItems,
    }
  }, [items])

  /*
   * ============================================================
   * Line item updates
   * ============================================================
   */

  const updateItem = (
    id: string,
    key: keyof InvoiceItem,
    value: string | number
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [key]: value,
            }
          : item
      )
    )
  }

  const addItem = () => {
    setItems((current) => [
      ...current,
      emptyItem(),
    ])
  }

  const removeItem = (
    id: string
  ) => {
    setItems((current) => {
      if (current.length <= 1) {
        return current
      }

      return current.filter(
        (item) =>
          item.id !== id
      )
    })
  }

  /*
   * ============================================================
   * Validation
   * ============================================================
   */

  const validateInvoice = () => {
    if (
      !invoiceNumber.trim()
    ) {
      showError(
        'Invoice number is required.'
      )
      return false
    }

    if (
      !clientId &&
      !clientName.trim()
    ) {
      showError(
        'Please select a client or enter a billing name.'
      )
      return false
    }

    if (!invoiceDate) {
      showError(
        'Invoice date is required.'
      )
      return false
    }

    if (!dueDate) {
      showError(
        'Due date is required.'
      )
      return false
    }

    if (
      new Date(dueDate).getTime() <
      new Date(
        invoiceDate
      ).getTime()
    ) {
      showError(
        'Due date cannot be earlier than the invoice date.'
      )
      return false
    }

    if (
      totals.items.length === 0
    ) {
      showError(
        'Add at least one line item.'
      )
      return false
    }

    if (
      totals.items.some(
        (item) =>
          !item.description.trim()
      )
    ) {
      showError(
        'All line items must have a description.'
      )
      return false
    }

    if (
      totals.items.some(
        (item) =>
          Number(
            item.quantity
          ) <= 0
      )
    ) {
      showError(
        'Quantity must be greater than zero.'
      )
      return false
    }

    if (
      totals.items.some(
        (item) =>
          Number(
            item.unit_price
          ) < 0
      )
    ) {
      showError(
        'Unit price cannot be negative.'
      )
      return false
    }

    return true
  }

  /*
   * ============================================================
   * Save invoice
   * ============================================================
   */

  const handleSave = async (
    status: 'Draft' | 'Sent'
  ) => {
    if (saving) {
      return
    }

    if (!validateInvoice()) {
      return
    }

    setSaving(true)

    try {
      let targetClientId =
        clientId

      const trimmedName =
        clientName.trim()

      /*
       * --------------------------------------------------------
       * Find or create client
       * --------------------------------------------------------
       */

      if (
        !targetClientId &&
        trimmedName
      ) {
        const existingClient =
          clients.find(
            (item) =>
              item.company_name
                .trim()
                .toLowerCase() ===
              trimmedName
                .toLowerCase()
          )

        if (existingClient) {
          targetClientId =
            existingClient.id
        } else {
          const newClient =
            await addClient({
              company_name:
                trimmedName,
              contact_person:
                trimmedName,
              email: '',
              phone: '',
              whatsapp: '',
              address:
                clientAddress.trim(),
              business_type:
                'General',
              website: '',
              registration_number:
                '',
              date_joined:
                invoiceDate,
              status: 'Active',
              notes: '',
            })

          targetClientId =
            newClient.id
        }
      }

      if (!targetClientId) {
        throw new Error(
          'A valid client is required to create the invoice.'
        )
      }

      /*
       * --------------------------------------------------------
       * Validate project belongs to selected client
       * --------------------------------------------------------
       */

      const selectedProject =
        projectId
          ? projects.find(
              (project) =>
                project.id ===
                projectId
            )
          : undefined

      if (
        selectedProject &&
        selectedProject.client_id !==
          targetClientId
      ) {
        throw new Error(
          'The selected project does not belong to the selected client.'
        )
      }

      /*
       * --------------------------------------------------------
       * Prepare invoice items
       *
       * IMPORTANT:
       * InvoiceItem requires id + invoice_id.
       *
       * invoice_id is intentionally empty here because the
       * invoice does not exist in Supabase yet.
       *
       * DataContext should assign the real invoice ID when
       * inserting invoice_items.
       * --------------------------------------------------------
       */

      const invoiceItems: InvoiceItem[] =
        totals.items.map(
          (item) => ({
            id:
              item.id ||
              createItemId(),

            invoice_id: '',

            description:
              item.description.trim(),

            quantity:
              Number(
                item.quantity
              ) || 0,

            unit_price:
              Number(
                item.unit_price
              ) || 0,

            discount:
              Number(
                item.discount
              ) || 0,

            tax:
              Number(
                item.tax
              ) || 0,

            total:
              Number(
                item.total
              ) || 0,
          })
        )

      /*
       * --------------------------------------------------------
       * Create invoice in Supabase
       *
       * IMPORTANT:
       * Capture the returned invoice object.
       * This fixes the "Cannot find name 'invoice'" errors.
       * --------------------------------------------------------
       */

      const invoice =
        await addInvoice({
          client_id:
            targetClientId,

          project_id:
            projectId || null,

          invoice_date:
            invoiceDate,

          due_date:
            dueDate,

          payment_terms:
            paymentTerms.trim(),

          items:
            invoiceItems,

          subtotal:
            totals.subtotal,

          discount:
            totals.discount,

          tax:
            totals.tax,

          total:
            totals.total,

          paid: 0,

          balance:
            totals.total,

          payment_type:
            paymentType,

          status,

          notes:
            notes.trim(),

          terms:
            terms.trim(),
        })

      /*
       * --------------------------------------------------------
       * Success
       * --------------------------------------------------------
       */

      success(
        status === 'Draft'
          ? `Invoice ${invoice.invoice_number} saved as draft.`
          : `Invoice ${invoice.invoice_number} created successfully.`
      )

      /*
       * --------------------------------------------------------
       * Navigate to invoice detail
       * --------------------------------------------------------
       */

      navigate(
        `/invoices/${invoice.id}`
      )
    } catch (err) {
      console.error(
        'Failed to save invoice:',
        err
      )

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to save invoice.'
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * ============================================================
   * Print
   * ============================================================
   */

  const handlePrint = () => {
    window.print()
  }

  /*
   * ============================================================
   * Loading
   * ============================================================
   */

  if (
    loading &&
    clients.length === 0 &&
    projects.length === 0
  ) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-2 text-sm text-xp-muted">
          <Loader2
            size={18}
            className="animate-spin"
          />
          Loading invoice builder...
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ========================================================
          TOP ACTION BAR
      ========================================================= */}

      <div className="flex items-center gap-3 mb-6 no-print">
        <button
          type="button"
          onClick={() =>
            navigate('/invoices')
          }
          className="p-1.5 rounded-lg text-xp-muted hover:bg-xp-light-gray transition-colors"
          title="Back to invoices"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold text-[#111]">
              Invoice Editor
            </h1>

            {invoiceNumber && (
              <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-purple-100 text-purple-700 font-bold">
                {invoiceNumber}
              </span>
            )}
          </div>

          <p className="text-xs text-xp-muted mt-0.5">
            Edit any detail below and see the A4 preview update live in real-time.
          </p>
        </div>

        <Button
          variant={
            showPreview
              ? 'purple'
              : 'ghost'
          }
          size="sm"
          icon={
            <Eye size={13} />
          }
          onClick={() =>
            setShowPreview(
              (value) => !value
            )
          }
        >
          {showPreview
            ? 'Hide Preview'
            : 'Show Preview'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          icon={
            <Printer size={13} />
          }
          onClick={handlePrint}
        >
          Print / PDF
        </Button>

        <Button
          variant="secondary"
          size="sm"
          icon={
            saving ? (
              <Loader2
                size={13}
                className="animate-spin"
              />
            ) : (
              <Save size={13} />
            )
          }
          onClick={() =>
            handleSave('Draft')
          }
          loading={saving}
          disabled={saving}
        >
          Save Draft
        </Button>

        <Button
          variant="primary"
          size="sm"
          loading={saving}
          disabled={saving}
          onClick={() =>
            handleSave('Sent')
          }
        >
          Create Invoice
        </Button>
      </div>

      {/* ========================================================
          MAIN BUILDER
      ========================================================= */}

      <div
        className={`grid ${
          showPreview
            ? 'xl:grid-cols-12'
            : 'grid-cols-1 max-w-3xl mx-auto'
        } gap-8 items-start print:block print:w-full print:p-0 print:m-0`}
      >
        {/* ======================================================
            FORM EDITOR
        ======================================================= */}

        <div
          className={`space-y-5 no-print ${
            showPreview
              ? 'xl:col-span-6'
              : 'w-full'
          }`}
        >
          {/* ====================================================
              1. INVOICE & CLIENT
          ===================================================== */}

          <Card className="p-5 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText
                  size={16}
                  className="text-[#6366f1]"
                />

                <p className="text-xs font-bold text-xp-muted uppercase tracking-widest">
                  Invoice & Client Details
                </p>
              </div>

              <span className="text-[11px] text-xp-muted">
                Fully Editable
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Input
                label="Invoice Number *"
                value={invoiceNumber}
                onChange={(event) =>
                  setInvoiceNumber(
                    event.target.value
                  )
                }
                placeholder="e.g. XP-INV-0012"
              />

              <Select
                label="Currency"
                value={currency}
                onChange={(event) =>
                  setCurrency(
                    event.target.value
                  )
                }
                options={currencyOpts}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2 sm:col-span-1">
                <Select
                  label="Select Existing Client"
                  value={clientId}
                  onChange={(event) =>
                    handleClientDropdownChange(
                      event.target.value
                    )
                  }
                  options={[
                    {
                      value: '',
                      label:
                        '— Custom / Type Directly —',
                    },
                    ...clients.map(
                      (item) => ({
                        value: item.id,
                        label:
                          item.company_name,
                      })
                    ),
                  ]}
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <Select
                  label="Associated Project (Optional)"
                  value={projectId}
                  onChange={(event) =>
                    setProjectId(
                      event.target.value
                    )
                  }
                  options={[
                    {
                      value: '',
                      label:
                        '— No Project —',
                    },
                    ...clientProjects.map(
                      (project) => ({
                        value:
                          project.id,
                        label:
                          project.project_name,
                      })
                    ),
                  ]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 pt-3 border-t border-gray-100">
              <div className="col-span-2 sm:col-span-1">
                <Input
                  label="BILL TO: Company / Client Name *"
                  value={clientName}
                  onChange={(event) => {
                    const value =
                      event.target
                        .value

                    setClientName(
                      value
                    )

                    if (
                      client &&
                      client.company_name !==
                        value
                    ) {
                      setClientId('')
                      setProjectId('')
                    }
                  }}
                  placeholder="Type client or company name..."
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <Input
                  label="BILL TO: Client Address / Country"
                  value={clientAddress}
                  onChange={(event) =>
                    setClientAddress(
                      event.target
                        .value
                    )
                  }
                  placeholder="e.g. Colombo, Sri Lanka"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
              <Input
                label="Invoice Date"
                type="date"
                value={invoiceDate}
                onChange={(event) =>
                  setInvoiceDate(
                    event.target.value
                  )
                }
              />

              <Input
                label="Due Date"
                type="date"
                value={dueDate}
                onChange={(event) =>
                  setDueDate(
                    event.target.value
                  )
                }
              />

              <Input
                label="Payment Terms"
                value={paymentTerms}
                onChange={(event) =>
                  setPaymentTerms(
                    event.target.value
                  )
                }
                placeholder="Payment due upon receipt of invoice."
              />

              <Select
                label="Payment Type"
                value={paymentType}
                onChange={(event) =>
                  setPaymentType(
                    event.target
                      .value as PaymentType
                  )
                }
                options={
                  paymentTypeOpts
                }
              />
            </div>
          </Card>

          {/* ====================================================
              2. LINE ITEMS
          ===================================================== */}

          <Card className="p-5 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-xp-muted uppercase tracking-widest">
                  Line Items & Amounts
                </p>

                <p className="text-[11px] text-xp-muted mt-0.5">
                  Enter quantity, unit price, discount and tax.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                icon={
                  <Plus size={12} />
                }
                onClick={addItem}
                disabled={saving}
              >
                Add Line Item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map(
                (item, index) => {
                  const calculated =
                    calculateItem(
                      item
                    )

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200/80 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-xp-purple uppercase tracking-wider">
                          Item #{index + 1}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#111]">
                            Item Total:{' '}
                            <span className="text-[#4338ca]">
                              {currency}{' '}
                              {calculated.total.toLocaleString(
                                'en-US',
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </span>
                          </span>

                          {items.length >
                            1 && (
                            <button
                              type="button"
                              onClick={() =>
                                removeItem(
                                  item.id
                                )
                              }
                              disabled={
                                saving
                              }
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors ml-2 disabled:opacity-50"
                              title="Remove this item"
                            >
                              <Trash2
                                size={14}
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <input
                          value={
                            item.description
                          }
                          onChange={(
                            event
                          ) =>
                            updateItem(
                              item.id,
                              'description',
                              event.target
                                .value
                            )
                          }
                          placeholder="Description (e.g. Website Design & Development)"
                          disabled={
                            saving
                          }
                          className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm text-[#111] bg-white focus:outline-none focus:border-xp-purple focus:ring-1 focus:ring-xp-purple disabled:bg-gray-100"
                        />
                      </div>

                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-3">
                          <label className="block text-[10px] font-bold text-xp-muted uppercase mb-1">
                            Quantity
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={
                              item.quantity ===
                              0
                                ? ''
                                : item.quantity
                            }
                            onChange={(
                              event
                            ) => {
                              const value =
                                event
                                  .target
                                  .value

                              updateItem(
                                item.id,
                                'quantity',
                                value ===
                                  ''
                                  ? 0
                                  : Number(
                                      value
                                    ) || 0
                              )
                            }}
                            placeholder="1"
                            disabled={
                              saving
                            }
                            className="w-full h-8 px-2.5 rounded-lg border border-gray-300 text-sm text-[#111] bg-white text-center focus:outline-none focus:border-xp-purple disabled:bg-gray-100"
                          />
                        </div>

                        <div className="col-span-5">
                          <label className="block text-[10px] font-bold text-[#4338ca] uppercase mb-1">
                            Unit Price (
                            {currency}) *
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={
                              item.unit_price ===
                              0
                                ? ''
                                : item.unit_price
                            }
                            onChange={(
                              event
                            ) => {
                              const value =
                                event
                                  .target
                                  .value

                              updateItem(
                                item.id,
                                'unit_price',
                                value ===
                                  ''
                                  ? 0
                                  : Number(
                                      value
                                    ) || 0
                              )
                            }}
                            placeholder="0.00"
                            disabled={
                              saving
                            }
                            className="w-full h-8 px-2.5 rounded-lg border border-[#6366f1] text-sm text-[#111] font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-xp-purple/20 disabled:bg-gray-100"
                          />
                        </div>

                        <div className="col-span-4">
                          <label className="block text-[10px] font-bold text-xp-muted uppercase mb-1">
                            Total (
                            {currency})
                          </label>

                          <div className="w-full h-8 px-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-[#111] flex items-center justify-end font-mono">
                            {calculated.total.toLocaleString(
                              'en-US',
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-xp-muted uppercase mb-1">
                            Discount (%)
                          </label>

                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={
                              item.discount ===
                              0
                                ? ''
                                : item.discount
                            }
                            onChange={(
                              event
                            ) => {
                              const value =
                                event
                                  .target
                                  .value

                              updateItem(
                                item.id,
                                'discount',
                                value ===
                                  ''
                                  ? 0
                                  : Number(
                                      value
                                    ) || 0
                              )
                            }}
                            placeholder="0"
                            disabled={
                              saving
                            }
                            className="w-full h-8 px-2.5 rounded-lg border border-gray-300 text-sm text-[#111] bg-white focus:outline-none focus:border-xp-purple disabled:bg-gray-100"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-xp-muted uppercase mb-1">
                            Tax (%)
                          </label>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              item.tax === 0
                                ? ''
                                : item.tax
                            }
                            onChange={(
                              event
                            ) => {
                              const value =
                                event
                                  .target
                                  .value

                              updateItem(
                                item.id,
                                'tax',
                                value ===
                                  ''
                                  ? 0
                                  : Number(
                                      value
                                    ) || 0
                              )
                            }}
                            placeholder="0"
                            disabled={
                              saving
                            }
                            className="w-full h-8 px-2.5 rounded-lg border border-gray-300 text-sm text-[#111] bg-white focus:outline-none focus:border-xp-purple disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  )
                }
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-200 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-xp-muted font-medium">
                  Subtotal
                </span>

                <span className="font-semibold text-[#111]">
                  {currency}{' '}
                  {totals.subtotal.toLocaleString(
                    'en-US',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-xp-muted font-medium">
                  Discount
                </span>

                <span className="font-semibold text-[#111]">
                  - {currency}{' '}
                  {totals.discount.toLocaleString(
                    'en-US',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-xp-muted font-medium">
                  Tax
                </span>

                <span className="font-semibold text-[#111]">
                  {currency}{' '}
                  {totals.tax.toLocaleString(
                    'en-US',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="font-extrabold text-[#111] uppercase tracking-wider text-sm">
                  Total Amount Due
                </span>

                <span className="text-2xl font-black text-xp-purple tracking-tight">
                  {currency}{' '}
                  {totals.total.toLocaleString(
                    'en-US',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </span>
              </div>
            </div>
          </Card>

          {/* ====================================================
              3. COMPANY
          ===================================================== */}

          <Card className="p-5 shadow-sm border border-gray-200">
            <button
              type="button"
              onClick={() =>
                setShowCompanyDetails(
                  (value) => !value
                )
              }
              className="w-full flex items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <Building2
                  size={16}
                  className="text-[#6366f1]"
                />

                <span className="text-xs font-bold text-[#111] uppercase tracking-wider">
                  Company / Sender Details
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-xp-purple font-medium">
                <span>
                  {showCompanyDetails
                    ? 'Hide'
                    : 'Edit Company Info'}
                </span>

                {showCompanyDetails ? (
                  <ChevronUp
                    size={14}
                  />
                ) : (
                  <ChevronDown
                    size={14}
                  />
                )}
              </div>
            </button>

            {showCompanyDetails && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Company Name"
                    value={
                      companyName
                    }
                    onChange={(
                      event
                    ) =>
                      setCompanyName(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Company Subtitle / Tagline"
                    value={
                      companySubtitle
                    }
                    onChange={(
                      event
                    ) =>
                      setCompanySubtitle(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    label="Company Address"
                    value={
                      companyAddress
                    }
                    onChange={(
                      event
                    ) =>
                      setCompanyAddress(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Email"
                    type="email"
                    value={
                      companyEmail
                    }
                    onChange={(
                      event
                    ) =>
                      setCompanyEmail(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Phone Number"
                    value={
                      companyPhone
                    }
                    onChange={(
                      event
                    ) =>
                      setCompanyPhone(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    label="Website"
                    value={
                      companyWebsite
                    }
                    onChange={(
                      event
                    ) =>
                      setCompanyWebsite(
                        event.target
                          .value
                      )
                    }
                  />
                </div>
              </div>
            )}
          </Card>

          {/* ====================================================
              4. BANK
          ===================================================== */}

          <Card className="p-5 shadow-sm border border-gray-200">
            <button
              type="button"
              onClick={() =>
                setShowBankDetails(
                  (value) => !value
                )
              }
              className="w-full flex items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <CreditCard
                  size={16}
                  className="text-[#6366f1]"
                />

                <span className="text-xs font-bold text-[#111] uppercase tracking-wider">
                  Bank & Payment Details
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-xp-purple font-medium">
                <span>
                  {showBankDetails
                    ? 'Hide'
                    : 'Edit Bank Info'}
                </span>

                {showBankDetails ? (
                  <ChevronUp
                    size={14}
                  />
                ) : (
                  <ChevronDown
                    size={14}
                  />
                )}
              </div>
            </button>

            {showBankDetails && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Account Holder Name"
                    value={
                      accountHolderName
                    }
                    onChange={(
                      event
                    ) =>
                      setAccountHolderName(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Bank Name"
                    value={bankName}
                    onChange={(
                      event
                    ) =>
                      setBankName(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Bank Branch"
                    value={bankBranch}
                    onChange={(
                      event
                    ) =>
                      setBankBranch(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Account Number"
                    value={
                      bankAccount
                    }
                    onChange={(
                      event
                    ) =>
                      setBankAccount(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Bank Country"
                    value={
                      bankCountry
                    }
                    onChange={(
                      event
                    ) =>
                      setBankCountry(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <Input
                    label="Payment Reference Code"
                    value={
                      paymentReference
                    }
                    onChange={(
                      event
                    ) =>
                      setPaymentReference(
                        event.target
                          .value
                      )
                    }
                    placeholder={
                      invoiceNumber
                    }
                  />
                </div>
              </div>
            )}
          </Card>

          {/* ====================================================
              5. NOTES / TERMS
          ===================================================== */}

          <Card className="p-5 shadow-sm border border-gray-200">
            <button
              type="button"
              onClick={() =>
                setShowAdditionalDetails(
                  (value) => !value
                )
              }
              className="w-full flex items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <FileText
                  size={16}
                  className="text-[#6366f1]"
                />

                <span className="text-xs font-bold text-[#111] uppercase tracking-wider">
                  Notes, Terms & Appreciation Message
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-xp-purple font-medium">
                <span>
                  {showAdditionalDetails
                    ? 'Hide'
                    : 'Edit Messages'}
                </span>

                {showAdditionalDetails ? (
                  <ChevronUp
                    size={14}
                  />
                ) : (
                  <ChevronDown
                    size={14}
                  />
                )}
              </div>
            </button>

            {showAdditionalDetails && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Thank You Heading"
                    value={
                      thankYouHeading
                    }
                    onChange={(
                      event
                    ) =>
                      setThankYouHeading(
                        event.target
                          .value
                      )
                    }
                  />

                  <Input
                    label="Thank You Subtext"
                    value={
                      thankYouMessage
                    }
                    onChange={(
                      event
                    ) =>
                      setThankYouMessage(
                        event.target
                          .value
                      )
                    }
                  />
                </div>

                <Textarea
                  label="Notes to Client"
                  value={notes}
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target
                        .value
                    )
                  }
                  placeholder="Notes to client..."
                />

                <Textarea
                  label="Terms & Conditions"
                  value={terms}
                  onChange={(
                    event
                  ) =>
                    setTerms(
                      event.target
                        .value
                    )
                  }
                  placeholder="Payment terms..."
                />
              </div>
            )}
          </Card>
        </div>

        {/* ======================================================
            LIVE INVOICE PREVIEW
        ======================================================= */}

        {showPreview && (
          <div className="xl:col-span-6 sticky top-6 overflow-x-auto pb-8 print:static print:block print:overflow-visible print:p-0 print:m-0 print:w-full print:max-w-none">
            <div className="mb-2 flex items-center justify-between no-print px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-xp-muted">
                Live A4 Document Preview
              </span>

              <span className="text-[11px] text-[#6366f1] font-semibold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                Real-Time Reactive
              </span>
            </div>

            <div className="transform origin-top transition-all shadow-xl rounded-sm print:transform-none print:shadow-none print:m-0 print:p-0 print:w-full">
              <InvoicePreviewDocument
                invoiceNumber={
                  invoiceNumber
                }
                invoiceDate={
                  invoiceDate
                }
                dueDate={
                  dueDate
                }
                currency={
                  currency
                }
                companyName={
                  companyName
                }
                companySubtitle={
                  companySubtitle
                }
                companyAddress={
                  companyAddress
                }
                companyEmail={
                  companyEmail
                }
                companyPhone={
                  companyPhone
                }
                companyWebsite={
                  companyWebsite
                }
                client={client}
                clientName={
                  clientName
                }
                clientAddress={
                  clientAddress
                }
                items={
                  totals.items
                }
                subtotal={
                  totals.subtotal
                }
                discount={
                  totals.discount
                }
                tax={totals.tax}
                total={
                  totals.total
                }
                paymentTerms={
                  paymentTerms
                }
                paymentType={
                  paymentType
                }
                accountHolderName={
                  accountHolderName
                }
                bankName={
                  bankName
                }
                bankBranch={
                  bankBranch
                }
                bankAccount={
                  bankAccount
                }
                bankCountry={
                  bankCountry
                }
                paymentReference={
                  paymentReference
                }
                notes={notes}
                terms={terms}
                thankYouHeading={
                  thankYouHeading
                }
                thankYouMessage={
                  thankYouMessage
                }
                settings={
                  settings
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
