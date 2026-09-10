
import {
  useParams,
  useNavigate,
} from 'react-router-dom'

import {
  useState,
} from 'react'

import {
  ArrowLeft,
  CreditCard,
  Printer,
  Trash2,
  Loader2,
} from 'lucide-react'

import {
  useData,
} from '../../contexts/DataContext'

import {
  useToast,
} from '../../contexts/ToastContext'

import {
  formatDate,
  exportCSVSimple,
} from '../../lib/utils'

import {
  Card,
  Badge,
  Button,
  Modal,
  Input,
  Select,
  ExportDropdown,
} from '../../components/ui'

import { generateInvoicePDF } from '../../lib/pdf'

import InvoicePreviewDocument from '../../components/invoices/InvoicePreviewDocument'

import type {
  InvoiceStatus,
  PaymentMethod,
  PaymentType,
} from '../../types'

/*
 * ============================================================
 * Invoice status badge variants
 * ============================================================
 */

const statusVariant: Record<
  InvoiceStatus,
  'muted' | 'blue' | 'warning' | 'success' | 'danger'
> = {
  Draft: 'muted',
  Sent: 'blue',
  Partial: 'warning',
  Paid: 'success',
  Pending: 'muted',
  Overdue: 'danger',
  Cancelled: 'danger',
}

/*
 * ============================================================
 * Payment options
 * ============================================================
 */

const paymentTypeOptions: {
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

const paymentMethodOptions: {
  value: PaymentMethod
  label: string
}[] = [
  {
    value: 'Bank Transfer',
    label: 'Bank Transfer',
  },
  {
    value: 'Cash',
    label: 'Cash',
  },
  {
    value: 'Card',
    label: 'Card',
  },
  {
    value: 'Online Payment',
    label: 'Online Payment',
  },
  {
    value: 'Other',
    label: 'Other',
  },
]

/*
 * ============================================================
 * Helpers
 * ============================================================
 */

const roundMoney = (
  value: number
) =>
  Math.round(
    value * 100
  ) / 100

const formatMoney = (
  value: number
) =>
  Number(
    value || 0
  ).toLocaleString(
    'en-US',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )

const getToday = () =>
  new Date()
    .toISOString()
    .slice(0, 10)

/*
 * ============================================================
 * Page
 * ============================================================
 */

export default function InvoiceDetailPage() {
  const {
    id,
  } = useParams<{
    id: string
  }>()

  const navigate =
    useNavigate()

  const {
    invoices,
    clients,
    projects,
    payments,
    addPayment,
    settings,
    deleteInvoice,
  } = useData()

  const {
    success,
    error: showError,
  } = useToast()

  /*
   * ==========================================================
   * Payment modal state
   * ==========================================================
   */

  const [
    showPayment,
    setShowPayment,
  ] = useState(false)

  const [
    payAmount,
    setPayAmount,
  ] = useState('')

  const [
    payMethod,
    setPayMethod,
  ] =
    useState<PaymentMethod>(
      'Bank Transfer'
    )

  const [
    payType,
    setPayType,
  ] =
    useState<PaymentType>(
      'Partial'
    )

  const [
    payDate,
    setPayDate,
  ] = useState(getToday())

  const [
    payRef,
    setPayRef,
  ] = useState('')

  const [
    paying,
    setPaying,
  ] = useState(false)

  const [
    deleting,
    setDeleting,
  ] = useState(false)

  /*
   * ==========================================================
   * Find invoice
   * ==========================================================
   */

  const invoice =
    invoices.find(
      (item) =>
        item.id === id
    )

  /*
   * ==========================================================
   * Invoice not found
   * ==========================================================
   */

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[#111]">
            Invoice not found
          </h2>

          <p className="text-sm text-xp-muted mt-1">
            The invoice may have been deleted or is no longer available.
          </p>

          <Button
            variant="outline"
            size="sm"
            icon={
              <ArrowLeft
                size={14}
              />
            }
            onClick={() =>
              navigate(
                '/invoices'
              )
            }
            className="mt-4"
          >
            Back to Invoices
          </Button>
        </div>
      </div>
    )
  }

  /*
   * ==========================================================
   * Related records
   * ==========================================================
   */

  const client =
    clients.find(
      (item) =>
        item.id ===
        invoice.client_id
    )

  const project =
    invoice.project_id
      ? projects.find(
          (item) =>
            item.id ===
            invoice.project_id
        )
      : undefined

  const invoicePayments =
    payments.filter(
      (payment) =>
        payment.invoice_id ===
        invoice.id
    )

  /*
   * ==========================================================
   * Currency
   *
   * Invoice currently uses company settings for currency
   * because the Invoice type does not contain a currency field.
   * ==========================================================
   */

  const currency =
    settings.currency ||
    'LKR'

  /*
   * ==========================================================
   * Payment
   * ==========================================================
   */

  const handlePayment =
    async () => {
      if (paying) {
        return
      }

      const amount =
        Number(
          payAmount
        )

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        showError(
          'Enter a valid payment amount.'
        )
        return
      }

      const balance =
        Number(
          invoice.balance
        ) || 0

      if (
        amount >
        balance
      ) {
        showError(
          `Payment amount cannot exceed the outstanding balance of ${currency} ${formatMoney(balance)}.`
        )
        return
      }

      if (!payDate) {
        showError(
          'Payment date is required.'
        )
        return
      }

      setPaying(true)

      try {
        await addPayment({
          client_id:
            invoice.client_id,

          invoice_id:
            invoice.id,

          project_id:
            invoice.project_id,

          amount:
            roundMoney(
              amount
            ),

          payment_type:
            payType,

          payment_method:
            payMethod,

          payment_date:
            payDate,

          reference_number:
            payRef.trim(),

          notes: '',
        })

        success(
          'Payment recorded successfully.'
        )

        /*
         * Reset form after successful
         * Supabase insertion.
         */

        setShowPayment(false)
        setPayAmount('')
        setPayRef('')
        setPayType(
          'Partial'
        )
        setPayMethod(
          'Bank Transfer'
        )
        setPayDate(
          getToday()
        )
      } catch (err) {
        console.error(
          'Failed to record payment:',
          err
        )

        showError(
          err instanceof Error
            ? err.message
            : 'Failed to record payment.'
        )
      } finally {
        setPaying(false)
      }
    }

  /*
   * ==========================================================
   * Export handlers (PDF & CSV)
   * ==========================================================
   */

  const handleExportPDF = () => {
    try {
      generateInvoicePDF(invoice, client || { company_name: 'Unknown Client' }, settings)
      success(`Invoice ${invoice.invoice_number} PDF downloaded.`)
    } catch (err) {
      console.error('Failed to download invoice PDF:', err)
      showError('Failed to generate invoice PDF.')
    }
  }

  const handleExportCSV = () => {
    try {
      const itemsData = (invoice.items || []).map((item, idx) => ({
        item: idx + 1,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        invoice_number: invoice.invoice_number,
        client: client?.company_name || '',
        date: invoice.invoice_date,
        due_date: invoice.due_date,
        subtotal: invoice.subtotal,
        tax: invoice.tax || 0,
        discount: invoice.discount || 0,
        invoice_total: invoice.total,
        paid: invoice.paid || 0,
        balance: invoice.balance || 0,
        status: invoice.status,
      }))

      exportCSVSimple(
        `invoice-${invoice.invoice_number}-items`,
        [
          'Item #',
          'Description',
          'Quantity',
          'Unit Price',
          'Line Total',
          'Invoice #',
          'Client',
          'Date',
          'Due Date',
          'Subtotal',
          'Tax',
          'Discount',
          'Invoice Total',
          'Paid',
          'Balance',
          'Status',
        ],
        itemsData
      )
      success(`Invoice ${invoice.invoice_number} CSV exported.`)
    } catch (err) {
      console.error('Failed to export invoice CSV:', err)
      showError('Failed to export invoice CSV.')
    }
  }

  /*
   * ==========================================================
   * Print
   * ==========================================================
   */

  const handlePrint =
    () => {
      window.print()
    }

  /*
   * ==========================================================
   * Delete invoice
   * ==========================================================
   */

  const handleDelete =
    async () => {
      if (
        deleting ||
        !invoice.id
      ) {
        return
      }

      const confirmed =
        window.confirm(
          `Are you sure you want to delete invoice ${invoice.invoice_number}? This action cannot be undone.`
        )

      if (!confirmed) {
        return
      }

      setDeleting(true)

      try {
        await deleteInvoice(
          invoice.id
        )

        success(
          'Invoice deleted successfully.'
        )

        navigate(
          '/invoices'
        )
      } catch (err) {
        console.error(
          'Failed to delete invoice:',
          err
        )

        showError(
          err instanceof Error
            ? err.message
            : 'Failed to delete invoice.'
        )
      } finally {
        setDeleting(false)
      }
    }

  /*
   * ==========================================================
   * Open payment modal
   * ==========================================================
   */

  const openPaymentModal =
    () => {
      const balance =
        Number(
          invoice.balance
        ) || 0

      if (
        balance <= 0
      ) {
        showError(
          'This invoice has no outstanding balance.'
        )
        return
      }

      setPayAmount('')
      setPayRef('')
      setPayDate(
        getToday()
      )
      setPayType(
        'Partial'
      )
      setPayMethod(
        'Bank Transfer'
      )

      setShowPayment(true)
    }

  /*
   * ==========================================================
   * Render
   * ==========================================================
   */

  return (
    <div>
      {/* ======================================================
          TOP ACTION BAR
      ======================================================= */}

      <div className="flex items-center gap-3 mb-6 no-print">
        <button
          type="button"
          onClick={() =>
            navigate(
              '/invoices'
            )
          }
          className="p-1.5 rounded-lg text-xp-muted hover:bg-xp-light-gray transition-colors"
          title="Back to invoices"
        >
          <ArrowLeft
            size={16}
          />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold text-[#111] font-mono">
              {
                invoice.invoice_number
              }
            </h1>

            <Badge
              variant={
                statusVariant[
                  invoice.status
                ]
              }
            >
              {
                invoice.status
              }
            </Badge>
          </div>

          <p className="text-xs text-xp-muted mt-0.5">
            {client?.company_name ||
              'Client'}{' '}
            ·{' '}
            {formatDate(
              invoice.invoice_date
            )}
          </p>
        </div>

        <ExportDropdown
          onExportPDF={handleExportPDF}
          onExportCSV={handleExportCSV}
          label="Export Invoice"
        />

        <Button
          variant="outline"
          size="sm"
          icon={
            <Printer
              size={13}
            />
          }
          onClick={
            handlePrint
          }
        >
          Print Preview
        </Button>

        {invoice.balance >
          0 && (
          <Button
            variant="purple"
            size="sm"
            icon={
              paying ? (
                <Loader2
                  size={13}
                  className="animate-spin"
                />
              ) : (
                <CreditCard
                  size={13}
                />
              )
            }
            onClick={
              openPaymentModal
            }
            disabled={
              paying ||
              deleting
            }
          >
            Record Payment
          </Button>
        )}

        <button
          type="button"
          onClick={
            handleDelete
          }
          disabled={
            deleting ||
            paying
          }
          className="p-1.5 rounded-lg text-xp-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Delete invoice"
        >
          {deleting ? (
            <Loader2
              size={15}
              className="animate-spin"
            />
          ) : (
            <Trash2
              size={15}
            />
          )}
        </button>
      </div>

      {/* ======================================================
          SUMMARY CARDS
      ======================================================= */}

      <div className="grid lg:grid-cols-3 gap-4 mb-6 no-print">
        {[
          {
            label:
              'Invoice Total',
            value: `${currency} ${formatMoney(invoice.total)}`,
          },
          {
            label:
              'Amount Paid',
            value: `${currency} ${formatMoney(invoice.paid)}`,
          },
          {
            label:
              'Balance Due',
            value: `${currency} ${formatMoney(invoice.balance)}`,
            accent:
              invoice.balance >
              0,
          },
        ].map(
          (
            metric,
            index
          ) => (
            <Card
              key={index}
              className="p-4"
            >
              <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
                {
                  metric.label
                }
              </p>

              <p
                className={`text-xl font-semibold ${
                  metric.accent
                    ? 'text-xp-purple'
                    : 'text-[#111]'
                }`}
              >
                {
                  metric.value
                }
              </p>
            </Card>
          )
        )}
      </div>

      {/* ======================================================
          MAIN CONTENT
      ======================================================= */}

      <div className="grid xl:grid-cols-12 gap-8 items-start print:block print:w-full print:p-0 print:m-0">
        {/* ====================================================
            INVOICE DOCUMENT
        ===================================================== */}

        <div className="xl:col-span-8 flex justify-center print:block print:w-full print:p-0 print:m-0">
          <InvoicePreviewDocument
            invoiceNumber={
              invoice.invoice_number
            }
            invoiceDate={
              invoice.invoice_date
            }
            dueDate={
              invoice.due_date
            }
            currency={
              currency
            }
            client={
              client
            }
            items={
              invoice.items
            }
            subtotal={
              invoice.subtotal
            }
            discount={
              invoice.discount
            }
            tax={
              invoice.tax
            }
            total={
              invoice.total
            }
            paymentTerms={
              invoice.payment_terms
            }
            paymentType={
              invoice.payment_type
            }
            notes={
              invoice.notes
            }
            settings={
              settings
            }
            accountHolderName={
              settings.account_holder_name ||
              ''
            }
            paymentReference={
              client?.client_id ||
              invoice.invoice_number
            }
          />
        </div>

        {/* ====================================================
            PAYMENTS / DETAILS
        ===================================================== */}

        <div className="xl:col-span-4 space-y-5 no-print">
          {/* ==================================================
              PAYMENT HISTORY
          =================================================== */}

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#111]">
                Payment History
              </h3>

              {invoice.balance >
                0 && (
                <button
                  type="button"
                  onClick={
                    openPaymentModal
                  }
                  className="text-xs text-xp-purple hover:text-xp-deep-purple font-medium"
                >
                  + Record
                </button>
              )}
            </div>

            {invoicePayments.length ===
            0 ? (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-full bg-xp-off-white border border-xp-border flex items-center justify-center mx-auto mb-3">
                  <CreditCard
                    size={16}
                    className="text-xp-muted"
                  />
                </div>

                <p className="text-sm text-xp-muted">
                  No payments
                  recorded.
                </p>

                {invoice.balance >
                  0 && (
                  <button
                    type="button"
                    onClick={
                      openPaymentModal
                    }
                    className="text-sm text-xp-purple hover:text-xp-deep-purple mt-2 font-medium"
                  >
                    + Record
                    Payment
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {invoicePayments.map(
                  (
                    payment
                  ) => (
                    <div
                      key={
                        payment.id
                      }
                      className="flex items-center justify-between p-3 bg-xp-off-white rounded-lg border border-xp-border"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111]">
                          {
                            currency
                          }{' '}
                          {formatMoney(
                            payment.amount
                          )}
                        </p>

                        <p className="text-xs text-xp-muted">
                          {
                            payment.payment_method
                          }{' '}
                          ·{' '}
                          {formatDate(
                            payment.payment_date
                          )}
                        </p>

                        {payment.reference_number && (
                          <p className="text-[10px] font-mono text-xp-dark-muted mt-0.5 truncate">
                            {
                              payment.reference_number
                            }
                          </p>
                        )}
                      </div>

                      <Badge variant="purple">
                        {
                          payment.payment_type
                        }
                      </Badge>
                    </div>
                  )
                )}
              </div>
            )}
          </Card>

          {/* ==================================================
              INVOICE DETAILS
          =================================================== */}

          <Card className="p-5">
            <h3 className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-3">
              Invoice Details
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-xp-muted">
                  Invoice Date
                </span>

                <span className="text-xs font-medium text-[#111]">
                  {formatDate(
                    invoice.invoice_date
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-xp-muted">
                  Due Date
                </span>

                <span className="text-xs font-medium text-[#111]">
                  {formatDate(
                    invoice.due_date
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-xp-muted">
                  Payment Type
                </span>

                <span className="text-xs font-medium text-[#111]">
                  {
                    invoice.payment_type
                  }
                </span>
              </div>

              {invoice.payment_terms && (
                <div className="pt-3 border-t border-xp-border">
                  <p className="text-xs text-xp-muted mb-1">
                    Payment Terms
                  </p>

                  <p className="text-xs leading-5 text-[#111]">
                    {
                      invoice.payment_terms
                    }
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* ==================================================
              ASSOCIATED PROJECT
          =================================================== */}

          {project && (
            <Card className="p-5">
              <h3 className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-2">
                Associated Project
              </h3>

              <p className="text-sm font-medium text-[#111]">
                {
                  project.project_name
                }
              </p>

              <p className="text-xs text-xp-muted mt-0.5">
                {
                  project.project_id
                }
              </p>
            </Card>
          )}

          {/* ==================================================
              CLIENT
          =================================================== */}

          {client && (
            <Card className="p-5">
              <h3 className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-3">
                Bill To
              </h3>

              <p className="text-sm font-semibold text-[#111]">
                {
                  client.company_name
                }
              </p>

              {client.contact_person && (
                <p className="text-xs text-xp-muted mt-1">
                  {
                    client.contact_person
                  }
                </p>
              )}

              {client.email && (
                <p className="text-xs text-xp-muted mt-1">
                  {
                    client.email
                  }
                </p>
              )}

              {client.phone && (
                <p className="text-xs text-xp-muted mt-1">
                  {
                    client.phone
                  }
                </p>
              )}

              {client.address && (
                <p className="text-xs text-xp-muted mt-1 leading-5">
                  {
                    client.address
                  }
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* ======================================================
          PAYMENT MODAL
      ======================================================= */}

      <Modal
        open={
          showPayment
        }
        onClose={() => {
          if (!paying) {
            setShowPayment(
              false
            )
          }
        }}
        title="Record Payment"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setShowPayment(
                  false
                )
              }
              disabled={
                paying
              }
            >
              Cancel
            </Button>

            <Button
              variant="purple"
              onClick={
                handlePayment
              }
              loading={
                paying
              }
              disabled={
                paying
              }
            >
              Record Payment
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          {/* Balance */}

          <div className="p-3 bg-xp-off-white rounded-lg border border-xp-border text-sm">
            <p className="text-xp-muted">
              Balance due:{' '}
              <span className="font-bold text-xp-purple">
                {
                  currency
                }{' '}
                {formatMoney(
                  invoice.balance
                )}
              </span>
            </p>
          </div>

          {/* Amount */}

          <Input
            label={`Amount (${currency})`}
            type="number"
            min="0"
            max={
              invoice.balance
            }
            step="0.01"
            value={
              payAmount
            }
            onChange={(event) =>
              setPayAmount(
                event.target
                  .value
              )
            }
            placeholder="0.00"
            disabled={
              paying
            }
          />

          {/* Payment type / method */}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Payment Type"
              value={
                payType
              }
              onChange={(event) =>
                setPayType(
                  event.target
                    .value as PaymentType
                )
              }
              options={
                paymentTypeOptions
              }
              disabled={
                paying
              }
            />

            <Select
              label="Payment Method"
              value={
                payMethod
              }
              onChange={(event) =>
                setPayMethod(
                  event.target
                    .value as PaymentMethod
                )
              }
              options={
                paymentMethodOptions
              }
              disabled={
                paying
              }
            />
          </div>

          {/* Date / reference */}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Payment Date"
              type="date"
              value={
                payDate
              }
              onChange={(event) =>
                setPayDate(
                  event.target
                    .value
                )
              }
              disabled={
                paying
              }
            />

            <Input
              label="Reference Number"
              value={
                payRef
              }
              onChange={(event) =>
                setPayRef(
                  event.target
                    .value
                )
              }
              placeholder="TXN-00000"
              disabled={
                paying
              }
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
