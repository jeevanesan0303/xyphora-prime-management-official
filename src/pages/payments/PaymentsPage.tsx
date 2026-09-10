
import { useMemo, useState } from 'react'
import { Plus, Download, CreditCard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import { formatDate, exportCSVSimple } from '../../lib/utils'

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
  Select,
  ExportDropdown,
} from '../../components/ui'

import { generateReportPDF, generateReceiptPDF } from '../../lib/pdf'

import type {
  PaymentMethod,
  PaymentType,
} from '../../types'

const PAYMENT_TYPES: PaymentType[] = [
  'Advance',
  'Partial',
  'Milestone',
  'Full',
  'Final',
  'Subscription',
  'Renewal',
  'Other',
]

const PAYMENT_METHODS: PaymentMethod[] = [
  'Bank Transfer',
  'Cash',
  'Card',
  'Online Payment',
  'Other',
]

interface PaymentForm {
  client_id: string
  invoice_id: string
  project_id: string
  amount: string
  payment_type: PaymentType
  payment_method: PaymentMethod
  payment_date: string
  reference_number: string
  notes: string
}

const createEmptyForm = (): PaymentForm => ({
  client_id: '',
  invoice_id: '',
  project_id: '',
  amount: '',
  payment_type: 'Partial',
  payment_method: 'Bank Transfer',
  payment_date: new Date().toISOString().slice(0, 10),
  reference_number: '',
  notes: '',
})

export default function PaymentsPage() {
  const {
    payments,
    clients,
    invoices,
    projects,
    settings,
    addPayment,
  } = useData()

  const { success, error } = useToast()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<PaymentForm>(createEmptyForm())
  const [saving, setSaving] = useState(false)

  const currency = settings?.currency || 'LKR'
  const currencySymbol = settings?.currency_symbol || currency

  /*
   * Filter payments.
   *
   * Search supports:
   * - Payment ID
   * - Client company
   * - Invoice number
   * - Reference number
   * - Payment method
   * - Payment type
   */
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return payments
    }

    return payments.filter((payment) => {
      const client = clients.find(
        (client) => client.id === payment.client_id,
      )

      const invoice = invoices.find(
        (invoice) => invoice.id === payment.invoice_id,
      )

      const searchableValues = [
        payment.payment_id,
        payment.reference_number,
        payment.payment_method,
        payment.payment_type,
        client?.company_name,
        
        invoice?.invoice_number,
      ]

      return searchableValues.some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(query),
      )
    })
  }, [payments, clients, invoices, search])

  /*
   * Total amount collected.
   */
  const totalCollected = useMemo(() => {
    return payments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    )
  }, [payments])

  /*
   * Invoices available after selecting a client.
   *
   * Only invoices with an outstanding balance can receive
   * a new payment.
   */
  const clientInvoices = useMemo(() => {
    if (!form.client_id) {
      return []
    }

    return invoices.filter(
      (invoice) =>
        invoice.client_id === form.client_id &&
        Number(invoice.balance || 0) > 0 &&
        invoice.status !== 'Cancelled',
    )
  }, [form.client_id, invoices])

  /*
   * Projects belonging to the selected client.
   *
   * This allows the payment to remain connected to the
   * relevant project when the invoice has a project.
   */
  const clientProjects = useMemo(() => {
    if (!form.client_id) {
      return []
    }

    return projects.filter(
      (project) => project.client_id === form.client_id,
    )
  }, [form.client_id, projects])

  /*
   * Current selected invoice.
   */
  const selectedInvoice = useMemo(() => {
    if (!form.invoice_id) {
      return null
    }

    return (
      invoices.find(
        (invoice) => invoice.id === form.invoice_id,
      ) || null
    )
  }, [form.invoice_id, invoices])

  /*
   * Automatically determine the project from the selected
   * invoice when the invoice already has a project attached.
   */
  const handleInvoiceChange = (invoiceId: string) => {
    const invoice = invoices.find(
      (item) => item.id === invoiceId,
    )

    setForm((current) => ({
      ...current,
      invoice_id: invoiceId,
      project_id: invoice?.project_id || current.project_id,
    }))
  }

  /*
   * Open payment modal with a clean form.
   */
  const openPaymentModal = () => {
    setForm(createEmptyForm())
    setShowModal(true)
  }

  /*
   * Close payment modal.
   */
  const closePaymentModal = () => {
    if (saving) {
      return
    }

    setShowModal(false)
    setForm(createEmptyForm())
  }

  /*
   * Record payment in Supabase through DataContext.
   */
  const handleSave = async () => {
    const amount = Number(form.amount)

    if (!form.client_id) {
      error('Please select a client.')
      return
    }

    if (!form.invoice_id) {
      error('Please select an invoice.')
      return
    }

    if (!form.amount.trim()) {
      error('Please enter the payment amount.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      error('Payment amount must be greater than zero.')
      return
    }

    if (!form.payment_date) {
      error('Please select the payment date.')
      return
    }

    const invoice = invoices.find(
      (item) => item.id === form.invoice_id,
    )

    if (!invoice) {
      error('Selected invoice could not be found.')
      return
    }

    const invoiceBalance = Number(invoice.balance || 0)

    if (invoiceBalance <= 0) {
      error('This invoice has no outstanding balance.')
      return
    }

    if (amount > invoiceBalance) {
      error(
        `Payment cannot exceed the outstanding balance of ${currencySymbol} ${invoiceBalance.toLocaleString()}.`,
      )
      return
    }

    /*
     * If the invoice belongs to a project, always use the
     * invoice project. Otherwise use the manually selected project.
     */
    const projectId =
      invoice.project_id || form.project_id || null

    setSaving(true)

    try {
      await addPayment({
        client_id: form.client_id,
        invoice_id: form.invoice_id,
        project_id: projectId,
        amount,
        payment_type: form.payment_type,
        payment_method: form.payment_method,
        payment_date: form.payment_date,
        reference_number: form.reference_number.trim(),
        notes: form.notes.trim(),
      })

      success('Payment recorded successfully.')

      setShowModal(false)
      setForm(createEmptyForm())
    } catch (err) {
      console.error('Failed to record payment:', err)

      const message =
        err instanceof Error
          ? err.message
          : 'Failed to record payment. Please try again.'

      error(message)
    } finally {
      setSaving(false)
    }
  }

  /*
   * Export currently filtered payments as PDF.
   */
  const handleExportPDF = () => {
    if (filtered.length === 0) {
      error('No payments to export.')
      return
    }

    try {
      generateReportPDF(
        'Payments Received Register',
        `Showing ${filtered.length} payment${filtered.length !== 1 ? 's' : ''}`,
        ['Payment ID', 'Client', 'Invoice', 'Amount', 'Type', 'Method', 'Date', 'Reference'],
        filtered.map((payment) => {
          const client = clients.find((item) => item.id === payment.client_id)
          const invoice = invoices.find((item) => item.id === payment.invoice_id)
          return [
            payment.payment_id,
            client?.company_name || '—',
            invoice?.invoice_number || '—',
            `${currencySymbol} ${Number(payment.amount || 0).toLocaleString()}`,
            payment.payment_type,
            payment.payment_method,
            payment.payment_date ? formatDate(payment.payment_date) : '—',
            payment.reference_number || '—',
          ]
        }),
        [
          {
            label: 'Total Collected',
            value: `${currencySymbol} ${filtered.reduce((sum, p) => sum + Number(p.amount || 0), 0).toLocaleString()}`,
          },
        ],
        settings
      )
      success(`Exported ${filtered.length} payment${filtered.length !== 1 ? 's' : ''} to PDF.`)
    } catch (err) {
      console.error('Failed to export payments PDF:', err)
      error('Failed to export payments PDF.')
    }
  }

  /*
   * Export currently filtered payments as CSV.
   */
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      error('No payments to export.')
      return
    }

    try {
      exportCSVSimple(
        'payments',
        [
          'ID',
          'Client',
          'Invoice',
          'Amount',
          'Type',
          'Method',
          'Date',
          'Reference',
        ],
        filtered.map((payment) => {
          const client = clients.find(
            (item) => item.id === payment.client_id,
          )

          const invoice = invoices.find(
            (item) => item.id === payment.invoice_id,
          )

          return {
            id: payment.payment_id,
            client: client?.company_name || '',
            invoice: invoice?.invoice_number || '',
            amount: Number(payment.amount || 0),
            type: payment.payment_type,
            method: payment.payment_method,
            date: payment.payment_date,
            reference: payment.reference_number || '',
          }
        }),
      )

      success('Payments exported to CSV successfully.')
    } catch (err) {
      console.error('Failed to export payments:', err)
      error('Failed to export payments.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={`${currencySymbol} ${totalCollected.toLocaleString()} total collected`}
        actions={
          <>
            <ExportDropdown
              onExportPDF={handleExportPDF}
              onExportCSV={handleExportCSV}
              disabled={filtered.length === 0}
            />

            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={openPaymentModal}
            >
              Record Payment
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search payments..."
          className="w-64"
        />

        <span className="text-xs text-xp-muted ml-auto">
          {filtered.length} results
        </span>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={search ? 'No matching payments' : 'No payments'}
            description={
              search
                ? 'Try changing your search.'
                : 'Record your first payment.'
            }
            action={
              search
                ? undefined
                : {
                    label: 'Record Payment',
                    onClick: openPaymentModal,
                  }
            }
            icon={CreditCard}
          />
        ) : (
          <Table
            headers={[
              'Payment ID',
              'Client',
              'Invoice',
              'Amount',
              'Type',
              'Method',
              'Date',
              'Reference',
              '',
            ]}
          >
            {filtered.map((payment) => {
              const client = clients.find(
                (item) => item.id === payment.client_id,
              )

              const invoice = invoices.find(
                (item) => item.id === payment.invoice_id,
              )

              return (
                <TableRow key={payment.id}>
                  <Td>
                    <span className="font-mono text-sm font-medium text-[#111]">
                      {payment.payment_id}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm text-xp-muted">
                      {client?.company_name || '—'}
                    </span>
                  </Td>

                  <Td>
                    {invoice ? (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/invoices/${payment.invoice_id}`,
                          )
                        }
                        className="text-sm text-xp-purple hover:text-xp-deep-purple font-mono"
                      >
                        {invoice.invoice_number}
                      </button>
                    ) : (
                      <span className="text-sm text-xp-muted">
                        —
                      </span>
                    )}
                  </Td>

                  <Td>
                    <span className="text-sm font-semibold text-[#111]">
                      {currencySymbol}{' '}
                      {Number(
                        payment.amount || 0,
                      ).toLocaleString()}
                    </span>
                  </Td>

                  <Td>
                    <Badge variant="purple">
                      {payment.payment_type}
                    </Badge>
                  </Td>

                  <Td>
                    <span className="text-sm text-xp-muted">
                      {payment.payment_method}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm text-xp-muted">
                      {formatDate(payment.payment_date)}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-xs font-mono text-xp-dark-muted">
                      {payment.reference_number || '—'}
                    </span>
                  </Td>

                  <Td>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        try {
                          const project = projects.find(
                            (p) => p.id === payment.project_id || p.id === invoice?.project_id
                          )
                          generateReceiptPDF(payment, {
                            clientName: client?.company_name,
                            invoiceNumber: invoice?.invoice_number,
                            projectName: project?.project_name,
                            settings,
                          })
                          success(`Downloaded receipt for ${payment.payment_id}.`)
                        } catch (err) {
                          console.error('Failed to download receipt:', err)
                          error('Failed to generate receipt PDF.')
                        }
                      }}
                      className="p-1.5 rounded-md text-xp-muted hover:text-xp-purple hover:bg-xp-light-purple transition-colors"
                      title="Download Receipt PDF"
                      aria-label={`Download Receipt for ${payment.payment_id}`}
                    >
                      <Download size={13} />
                    </button>
                  </Td>
                </TableRow>
              )
            })}
          </Table>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={closePaymentModal}
        title="Record Payment"
        width="max-w-lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={closePaymentModal}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              variant="purple"
              onClick={handleSave}
              loading={saving}
            >
              Record Payment
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <Select
            label="Client"
            value={form.client_id}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                client_id: event.target.value,
                invoice_id: '',
                project_id: '',
                amount: '',
              }))
            }
            options={clients.map((client) => ({
              value: client.id,
              label: client.company_name,
            }))}
            placeholder="Select client"
          />

          <Select
            label="Invoice"
            value={form.invoice_id}
            onChange={(event) =>
              handleInvoiceChange(event.target.value)
            }
            options={clientInvoices.map((invoice) => ({
              value: invoice.id,
              label: `${invoice.invoice_number} (${currencySymbol} ${Number(
                invoice.balance || 0,
              ).toLocaleString()} due)`,
            }))}
            placeholder={
              form.client_id
                ? clientInvoices.length > 0
                  ? 'Select invoice'
                  : 'No outstanding invoices'
                : 'Select client first'
            }
            disabled={!form.client_id}
          />

          {selectedInvoice && (
            <div className="rounded-xl border border-xp-border bg-xp-soft p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-xp-muted">
                  Outstanding Balance
                </span>

                <span className="text-sm font-semibold text-[#111]">
                  {currencySymbol}{' '}
                  {Number(
                    selectedInvoice.balance || 0,
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <Input
            label={`Amount (${currency})`}
            type="number"
            value={form.amount}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
            placeholder="0.00"
            min="0"
            step="0.01"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Payment Type"
              value={form.payment_type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payment_type:
                    event.target.value as PaymentType,
                }))
              }
              options={PAYMENT_TYPES.map((value) => ({
                value,
                label: value,
              }))}
            />

            <Select
              label="Payment Method"
              value={form.payment_method}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payment_method:
                    event.target.value as PaymentMethod,
                }))
              }
              options={PAYMENT_METHODS.map((value) => ({
                value,
                label: value,
              }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Payment Date"
              type="date"
              value={form.payment_date}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  payment_date: event.target.value,
                }))
              }
            />

            <Input
              label="Reference Number"
              value={form.reference_number}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reference_number: event.target.value,
                }))
              }
              placeholder="TXN-00000"
            />
          </div>

          <Select
            label="Project"
            value={form.project_id}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                project_id: event.target.value,
              }))
            }
            options={clientProjects.map((project) => ({
              value: project.id,
              label: project.project_name,
            }))}
            placeholder={
              form.client_id
                ? 'Select project (optional)'
                : 'Select client first'
            }
            disabled={
              !form.client_id ||
              clientProjects.length === 0 ||
              Boolean(selectedInvoice?.project_id)
            }
          />

          {selectedInvoice?.project_id && (
            <p className="text-xs text-xp-muted">
              The project linked to this invoice will be
              used automatically.
            </p>
          )}

          <Input
            label="Notes"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            placeholder="Optional payment notes"
          />
        </div>
      </Modal>
    </div>
  )
}
