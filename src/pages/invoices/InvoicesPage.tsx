
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Eye,
  Download,
  FileText,
  Loader2,
} from 'lucide-react'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import {
  formatDate,
  exportCSVSimple,
  daysOverdue,
} from '../../lib/utils'

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
  ExportDropdown,
} from '../../components/ui'
import { generateReportPDF, generateInvoicePDF } from '../../lib/pdf'

import type { InvoiceStatus } from '../../types'

const statusVariant: Record<
  InvoiceStatus,
  any
> = {
  Draft: 'muted',
  Sent: 'blue',
  Partial: 'warning',
  Paid: 'success',
  Pending: 'muted',
  Overdue: 'danger',
  Cancelled: 'danger',
}

const statusOptions: InvoiceStatus[] = [
  'Draft',
  'Sent',
  'Pending',
  'Partial',
  'Paid',
  'Overdue',
  'Cancelled',
]

export default function InvoicesPage() {
  const navigate = useNavigate()

  const { invoices, clients, settings, loading } =
    useData()

  const { success, error: showError } =
    useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<InvoiceStatus | ''>('')

  const currencySymbol = settings?.currency_symbol || settings?.currency || 'LKR'

  /*
   * Filter invoices from real DataContext data.
   */
  const filtered = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase()

    return invoices.filter((invoice) => {
      const client = clients.find(
        (clientItem) =>
          clientItem.id === invoice.client_id
      )

      const searchableText = [
        invoice.invoice_number,
        client?.company_name || '',
        client?.contact_person || '',
        client?.email || '',
        client?.phone || '',
      ]
        .join(' ')
        .toLowerCase()

      const matchSearch =
        !normalizedSearch ||
        searchableText.includes(
          normalizedSearch
        )

      const matchStatus =
        !statusFilter ||
        invoice.status === statusFilter

      return matchSearch && matchStatus
    })
  }, [
    invoices,
    clients,
    search,
    statusFilter,
  ])

  /*
   * Summary calculations.
   */
  const totalOutstanding = useMemo(() => {
    return filtered.reduce(
      (sum, invoice) =>
        sum + Number(invoice.balance || 0),
      0
    )
  }, [filtered])

  const totalPaid = useMemo(() => {
    return filtered.reduce(
      (sum, invoice) =>
        sum + Number(invoice.paid || 0),
      0
    )
  }, [filtered])

  const overdueCount = useMemo(() => {
    return filtered.filter(
      (invoice) =>
        invoice.status === 'Overdue'
    ).length
  }, [filtered])

  /*
   * Export only currently filtered invoices as PDF.
   */
  const handleExportPDF = () => {
    if (filtered.length === 0) {
      showError('No invoices to export.')
      return
    }

    try {
      generateReportPDF(
        'Invoices Register',
        `Showing ${filtered.length} invoice${filtered.length !== 1 ? 's' : ''}`,
        ['Number', 'Client', 'Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Status'],
        filtered.map((inv) => {
          const client = clients.find((c) => c.id === inv.client_id)
          return [
            inv.invoice_number,
            client?.company_name || '—',
            inv.invoice_date ? formatDate(inv.invoice_date) : '—',
            inv.due_date ? formatDate(inv.due_date) : '—',
            `${currencySymbol} ${Number(inv.total || 0).toLocaleString()}`,
            `${currencySymbol} ${Number(inv.paid || 0).toLocaleString()}`,
            `${currencySymbol} ${Number(inv.balance || 0).toLocaleString()}`,
            inv.status,
          ]
        }),
        [
          { label: 'Total Invoiced', value: `${currencySymbol} ${filtered.reduce((s, i) => s + Number(i.total || 0), 0).toLocaleString()}` },
          { label: 'Total Paid', value: `${currencySymbol} ${totalPaid.toLocaleString()}` },
          { label: 'Total Outstanding', value: `${currencySymbol} ${totalOutstanding.toLocaleString()}` },
        ],
        settings
      )
      success(`Exported ${filtered.length} invoice${filtered.length !== 1 ? 's' : ''} to PDF.`)
    } catch (err) {
      console.error('Failed to export invoices PDF:', err)
      showError('Failed to generate PDF.')
    }
  }

  /*
   * Export only currently filtered invoices as CSV.
   */
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      showError('No invoices to export.')
      return
    }

    try {
      exportCSVSimple(
        'invoices',
        [
          'Number',
          'Client',
          'Date',
          'Due Date',
          'Total',
          'Paid',
          'Balance',
          'Status',
        ],
        filtered.map((invoice) => ({
          num: invoice.invoice_number,
          client:
            clients.find(
              (client) =>
                client.id === invoice.client_id
            )?.company_name || '',
          date: invoice.invoice_date,
          due: invoice.due_date,
          total: Number(
            invoice.total || 0
          ),
          paid: Number(
            invoice.paid || 0
          ),
          balance: Number(
            invoice.balance || 0
          ),
          status: invoice.status,
        }))
      )

      success(
        `Exported ${filtered.length} invoice${
          filtered.length !== 1 ? 's' : ''
        } to CSV.`
      )
    } catch (error) {
      console.error(
        'Failed to export invoices:',
        error
      )

      showError(
        'Failed to export invoices.'
      )
    }
  }

  /*
   * Initial loading state.
   */
  if (loading && invoices.length === 0) {
    return (
      <div>
        <PageHeader
          title="Invoices"
          subtitle="Loading invoices..."
        />

        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2
              size={24}
              className="animate-spin text-xp-muted mb-3"
            />

            <p className="text-sm text-xp-muted">
              Loading invoices...
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* =========================================================
          PAGE HEADER
      ========================================================== */}
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total invoice${
          invoices.length !== 1
            ? 's'
            : ''
        }`}
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
              onClick={() =>
                navigate('/invoices/new')
              }
            >
              New Invoice
            </Button>
          </>
        }
      />

      {/* =========================================================
          SUMMARY
      ========================================================== */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Outstanding
          </p>

          <p className="text-xl font-semibold text-xp-purple">
            LKR{' '}
            {totalOutstanding.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Collected
          </p>

          <p className="text-xl font-semibold text-[#111]">
            LKR{' '}
            {totalPaid.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Overdue
          </p>

          <p className="text-xl font-semibold text-red-600">
            {overdueCount}{' '}
            invoice
            {overdueCount !== 1
              ? 's'
              : ''}
          </p>
        </Card>
      </div>

      {/* =========================================================
          SEARCH / FILTER
      ========================================================== */}
      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search invoices..."
          className="w-64"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target
                .value as InvoiceStatus | ''
            )
          }
          className="h-9 px-3 rounded-lg border border-xp-border text-sm text-[#111] bg-white focus:outline-none focus:border-xp-purple"
        >
          <option value="">
            All Status
          </option>

          {statusOptions.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            )
          )}
        </select>

        {(search ||
          statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setStatusFilter('')
            }}
            className="text-xs text-xp-muted hover:text-[#111] transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="text-xs text-xp-muted ml-auto">
          {filtered.length} result
          {filtered.length !== 1
            ? 's'
            : ''}
        </span>
      </div>

      {/* =========================================================
          INVOICE TABLE
      ========================================================== */}
      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={
              invoices.length === 0
                ? 'No invoices'
                : 'No matching invoices'
            }
            description={
              invoices.length === 0
                ? 'Create your first invoice.'
                : 'Try changing your search or status filter.'
            }
            action={
              invoices.length === 0
                ? {
                    label:
                      'New Invoice',
                    onClick: () =>
                      navigate(
                        '/invoices/new'
                      ),
                  }
                : undefined
            }
            icon={FileText}
          />
        ) : (
          <Table
            headers={[
              'Invoice',
              'Client',
              'Date',
              'Due',
              'Total',
              'Paid',
              'Balance',
              'Status',
              '',
            ]}
          >
            {filtered.map((invoice) => {
              const client =
                clients.find(
                  (clientItem) =>
                    clientItem.id ===
                    invoice.client_id
                )

              const overdue =
                invoice.status ===
                'Overdue'
                  ? daysOverdue(
                      invoice.due_date
                    )
                  : 0

              const total = Number(
                invoice.total || 0
              )

              const paid = Number(
                invoice.paid || 0
              )

              const balance = Number(
                invoice.balance || 0
              )

              return (
                <TableRow
                  key={invoice.id}
                  onClick={() =>
                    navigate(
                      `/invoices/${invoice.id}`
                    )
                  }
                >
                  {/* Invoice Number */}
                  <Td>
                    <span className="font-semibold text-[#111] font-mono text-sm">
                      {
                        invoice.invoice_number
                      }
                    </span>
                  </Td>

                  {/* Client */}
                  <Td>
                    <span className="text-sm text-xp-muted">
                      {client?.company_name ||
                        '—'}
                    </span>
                  </Td>

                  {/* Invoice Date */}
                  <Td>
                    <span className="text-sm text-xp-muted">
                      {invoice.invoice_date
                        ? formatDate(
                            invoice.invoice_date
                          )
                        : '—'}
                    </span>
                  </Td>

                  {/* Due Date */}
                  <Td>
                    <span
                      className={`text-sm ${
                        overdue > 0
                          ? 'text-red-500 font-medium'
                          : 'text-xp-muted'
                      }`}
                    >
                      {invoice.due_date
                        ? formatDate(
                            invoice.due_date
                          )
                        : '—'}

                      {overdue > 0
                        ? ` (${overdue}d)`
                        : ''}
                    </span>
                  </Td>

                  {/* Total */}
                  <Td>
                    <span className="text-sm font-medium text-[#111]">
                      LKR{' '}
                      {total.toLocaleString()}
                    </span>
                  </Td>

                  {/* Paid */}
                  <Td>
                    <span className="text-sm text-[#111]">
                      LKR{' '}
                      {paid.toLocaleString()}
                    </span>
                  </Td>

                  {/* Balance */}
                  <Td>
                    <span
                      className={`text-sm font-medium ${
                        balance > 0
                          ? 'text-xp-purple'
                          : 'text-xp-muted'
                      }`}
                    >
                      LKR{' '}
                      {balance.toLocaleString()}
                    </span>
                  </Td>

                  {/* Status */}
                  <Td>
                    <Badge
                      variant={
                        statusVariant[
                          invoice.status
                        ]
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </Td>

                  {/* Actions */}
                  <Td>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          try {
                            generateInvoicePDF(invoice, client || { company_name: 'Unknown Client' }, settings)
                            success(`Downloaded invoice ${invoice.invoice_number} PDF.`)
                          } catch (err) {
                            console.error('Failed to download invoice PDF:', err)
                            showError('Failed to generate invoice PDF.')
                          }
                        }}
                        className="p-1.5 rounded-md text-xp-muted hover:text-xp-purple hover:bg-xp-light-purple transition-colors"
                        title="Download PDF"
                        aria-label={`Download ${invoice.invoice_number} PDF`}
                      >
                        <Download size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()

                          navigate(
                            `/invoices/${invoice.id}`
                          )
                        }}
                        className="p-1.5 rounded-md text-xp-muted hover:text-[#111] hover:bg-xp-light-gray transition-colors"
                        title="View invoice"
                        aria-label={`View ${invoice.invoice_number}`}
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </Td>
                </TableRow>
              )
            })}
          </Table>
        )}
      </Card>
    </div>
  )
}
