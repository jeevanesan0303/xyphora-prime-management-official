
import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import {
  formatDate,
  formatCurrency,
  exportCSVSimple,
} from '../../lib/utils'
import {
  PageHeader,
  Card,
  Badge,
  Table,
  TableRow,
  Td,
  ExportDropdown,
} from '../../components/ui'
import { generateReportPDF } from '../../lib/pdf'

interface IncomeChartItem {
  month: string
  revenue: number
}

interface TooltipPayloadItem {
  name?: string
  value?: number | string
}

interface IncomeTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

function parseDate(
  value: string | null | undefined,
) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}`
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString(
    'en-GB',
    {
      month: 'short',
    },
  )
}

function IncomeTooltip({
  active,
  payload,
  label,
}: IncomeTooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="bg-white border border-xp-border rounded-lg shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-[#111] mb-1.5">
        {label}
      </p>

      {payload.map((item, index) => (
        <div
          key={`${item.name ?? 'income'}-${index}`}
          className="flex items-center justify-between gap-4"
        >
          <span className="text-xp-muted">
            {item.name || 'Income'}
          </span>

          <span className="font-medium text-[#111]">
            {formatCurrency(
              Number(item.value ?? 0),
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function IncomePage() {
  const {
    payments,
    clients,
    invoices,
    settings,
  } = useData()

  const { success, error } = useToast()

  const currencySymbol =
    settings?.currency_symbol ||
    settings?.currency ||
    'LKR'

  /*
   * ---------------------------------------------------------
   * TOTAL INCOME
   * ---------------------------------------------------------
   */

  const totalIncome = useMemo(
    () =>
      payments.reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount || 0),
        0,
      ),
    [payments],
  )

  /*
   * ---------------------------------------------------------
   * CURRENT MONTH INCOME
   * ---------------------------------------------------------
   */

  const currentMonthKey = useMemo(
    () => getMonthKey(new Date()),
    [],
  )

  const thisMonthIncome = useMemo(
    () =>
      payments
        .filter((payment) => {
          const paymentDate =
            parseDate(
              payment.payment_date,
            )

          if (!paymentDate) {
            return false
          }

          return (
            getMonthKey(paymentDate) ===
            currentMonthKey
          )
        })
        .reduce(
          (sum, payment) =>
            sum +
            Number(payment.amount || 0),
          0,
        ),
    [
      payments,
      currentMonthKey,
    ],
  )

  /*
   * ---------------------------------------------------------
   * AVERAGE TRANSACTION
   * ---------------------------------------------------------
   */

  const averageTransaction =
    payments.length > 0
      ? totalIncome / payments.length
      : 0

  /*
   * ---------------------------------------------------------
   * MONTHLY INCOME CHART
   *
   * Always shows the last 6 calendar months.
   * Months without payments are included as 0.
   * ---------------------------------------------------------
   */

  const chartData =
    useMemo<IncomeChartItem[]>(() => {
      const now = new Date()

      const currentMonth =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        )

      const result: IncomeChartItem[] =
        []

      for (
        let index = 5;
        index >= 0;
        index--
      ) {
        const monthDate =
          new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() -
              index,
            1,
          )

        const monthKey =
          getMonthKey(monthDate)

        const revenue =
          payments
            .filter((payment) => {
              const paymentDate =
                parseDate(
                  payment.payment_date,
                )

              if (!paymentDate) {
                return false
              }

              return (
                getMonthKey(
                  paymentDate,
                ) === monthKey
              )
            })
            .reduce(
              (sum, payment) =>
                sum +
                Number(
                  payment.amount || 0,
                ),
              0,
            )

        result.push({
          month:
            getMonthLabel(
              monthDate,
            ),
          revenue,
        })
      }

      return result
    }, [payments])

  /*
   * ---------------------------------------------------------
   * PAYMENT TYPE BREAKDOWN
   * ---------------------------------------------------------
   */

  const byType = useMemo(() => {
    const typeMap =
      new Map<string, number>()

    payments.forEach((payment) => {
      const type =
        payment.payment_type ||
        'Other'

      const amount =
        Number(payment.amount || 0)

      typeMap.set(
        type,
        (typeMap.get(type) || 0) +
          amount,
      )
    })

    return Array.from(
      typeMap.entries(),
    ).sort(
      (a, b) => b[1] - a[1],
    )
  }, [payments])

  /*
   * ---------------------------------------------------------
   * PAYMENT RECORDS
   *
   * Newest payments first.
   * ---------------------------------------------------------
   */

  const sortedPayments =
    useMemo(() => {
      return [...payments].sort(
        (a, b) => {
          const dateA =
            parseDate(
              a.payment_date,
            )?.getTime() || 0

          const dateB =
            parseDate(
              b.payment_date,
            )?.getTime() || 0

          return dateB - dateA
        },
      )
    }, [payments])

  /*
   * ---------------------------------------------------------
   * EXPORT (PDF & CSV)
   * ---------------------------------------------------------
   */

  const handleExportPDF = () => {
    if (payments.length === 0) {
      error('No income transactions to export.')
      return
    }

    try {
      generateReportPDF(
        'Income & Revenue Report',
        `Generated on ${new Date().toLocaleDateString('en-GB')}`,
        ['Payment ID', 'Client', 'Invoice', 'Amount', 'Type', 'Method', 'Date'],
        sortedPayments.map((p) => {
          const client = clients.find((c) => c.id === p.client_id)
          const invoice = invoices.find((inv) => inv.id === p.invoice_id)
          return [
            p.payment_id,
            client?.company_name || '—',
            invoice?.invoice_number || '—',
            `${currencySymbol} ${Number(p.amount || 0).toLocaleString()}`,
            p.payment_type,
            p.payment_method,
            p.payment_date ? formatDate(p.payment_date) : '—',
          ]
        }),
        [
          { label: 'Total Revenue', value: `${currencySymbol} ${totalIncome.toLocaleString()}` },
          { label: 'This Month', value: `${currencySymbol} ${thisMonthIncome.toLocaleString()}` },
          { label: 'Total Transactions', value: `${payments.length}` },
        ],
        settings
      )
      success(`Exported ${payments.length} income transaction${payments.length !== 1 ? 's' : ''} to PDF.`)
    } catch (err) {
      console.error('Failed to export income PDF:', err)
      error('Failed to generate income PDF.')
    }
  }

  const handleExportCSV = () => {
    if (payments.length === 0) {
      error('No income transactions to export.')
      return
    }

    try {
      exportCSVSimple(
        'income-records',
        ['Payment ID', 'Client', 'Invoice', 'Amount', 'Type', 'Method', 'Date', 'Reference'],
        sortedPayments.map((p) => {
          const client = clients.find((c) => c.id === p.client_id)
          const invoice = invoices.find((inv) => inv.id === p.invoice_id)
          return {
            id: p.payment_id,
            client: client?.company_name || '',
            invoice: invoice?.invoice_number || '',
            amount: Number(p.amount || 0),
            type: p.payment_type,
            method: p.payment_method,
            date: p.payment_date,
            reference: p.reference_number || '',
          }
        })
      )
      success(`Exported ${payments.length} income transaction${payments.length !== 1 ? 's' : ''} to CSV.`)
    } catch (err) {
      console.error('Failed to export income CSV:', err)
      error('Failed to export income CSV.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Income"
        subtitle="Revenue from all payment sources"
        actions={
          <ExportDropdown
            onExportPDF={handleExportPDF}
            onExportCSV={handleExportCSV}
            disabled={payments.length === 0}
          />
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          {
            label: 'Total Income',
            value:
              formatCurrency(
                totalIncome,
              ),
          },
          {
            label: 'This Month',
            value:
              formatCurrency(
                thisMonthIncome,
              ),
          },
          {
            label: 'Transactions',
            value: String(
              payments.length,
            ),
          },
          {
            label: 'Avg. Transaction',
            value:
              formatCurrency(
                averageTransaction,
              ),
          },
        ].map((metric) => (
          <Card
            key={metric.label}
            className="p-4"
          >
            <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
              {metric.label}
            </p>

            <p className="text-xl font-semibold text-[#111]">
              {metric.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        {/* Monthly Revenue */}
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#111]">
              Monthly Revenue
            </h3>

            <p className="text-xs text-xp-muted mt-0.5">
              Real payment records — last 6 months
            </p>
          </div>

          <ResponsiveContainer
            width="100%"
            height={200}
          >
            <BarChart
              data={chartData}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f3f3f3"
              />

              <XAxis
                dataKey="month"
                tick={{
                  fontSize: 11,
                  fill: '#737373',
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fontSize: 10,
                  fill: '#737373',
                }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(
                  value: number,
                ) =>
                  value >= 1000000
                    ? `${(
                        value /
                        1000000
                      ).toFixed(1)}M`
                    : value >= 1000
                      ? `${(
                          value /
                          1000
                        ).toFixed(0)}k`
                      : `${value}`
                }
              />

              <Tooltip
                content={
                  <IncomeTooltip />
                }
              />

              <Bar
                dataKey="revenue"
                name="Revenue"
                fill="#111"
                radius={[
                  4,
                  4,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Payment Type */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-[#111] mb-1">
            By Payment Type
          </h3>

          <p className="text-xs text-xp-muted mb-4">
            Income distribution
          </p>

          {byType.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-xp-muted">
                No payment records available.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {byType.map(
                ([type, amount]) => {
                  const percentage =
                    totalIncome > 0
                      ? Math.min(
                          100,
                          Math.max(
                            0,
                            (amount /
                              totalIncome) *
                              100,
                          ),
                        )
                      : 0

                  return (
                    <div
                      key={type}
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-xp-muted">
                          {type}
                        </span>

                        <span className="text-xs font-medium text-[#111]">
                          {formatCurrency(
                            amount,
                          )}
                        </span>
                      </div>

                      <div className="h-1.5 bg-xp-light-gray rounded-full overflow-hidden">
                        <div
                          className="h-full bg-xp-purple rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>

                      <p className="text-[10px] text-xp-muted mt-1 text-right">
                        {percentage.toFixed(
                          1,
                        )}
                        %
                      </p>
                    </div>
                  )
                },
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Payment Records */}
      <Card>
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#111]">
                Payment Records
              </h3>

              <p className="text-xs text-xp-muted mt-0.5">
                {payments.length}{' '}
                transaction
                {payments.length !==
                1
                  ? 's'
                  : ''}
              </p>
            </div>

            <Badge variant="purple">
              {currencySymbol}
            </Badge>
          </div>
        </div>

        {sortedPayments.length ===
        0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-xp-muted">
              No payment records available.
            </p>

            <p className="text-xs text-xp-muted mt-1">
              Payments will appear here once
              they are recorded.
            </p>
          </div>
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
            ]}
          >
            {sortedPayments.map(
              (payment) => {
                const client =
                  clients.find(
                    (item) =>
                      item.id ===
                      payment.client_id,
                  )

                const invoice =
                  invoices.find(
                    (item) =>
                      item.id ===
                      payment.invoice_id,
                  )

                return (
                  <TableRow
                    key={payment.id}
                  >
                    <Td>
                      <span className="font-mono text-xs font-medium text-[#111]">
                        {
                          payment.payment_id
                        }
                      </span>
                    </Td>

                    <Td>
                      <span className="text-sm text-xp-muted">
                        {client?.company_name ||
                          'Unknown client'}
                      </span>
                    </Td>

                    <Td>
                      <span className="text-xs font-mono text-xp-purple">
                        {invoice?.invoice_number ||
                          '—'}
                      </span>
                    </Td>

                    <Td>
                      <span className="text-sm font-semibold text-[#111]">
                        {formatCurrency(
                          Number(
                            payment.amount ||
                              0,
                          ),
                        )}
                      </span>
                    </Td>

                    <Td>
                      <Badge variant="purple">
                        {
                          payment.payment_type
                        }
                      </Badge>
                    </Td>

                    <Td>
                      <span className="text-sm text-xp-muted">
                        {
                          payment.payment_method
                        }
                      </span>
                    </Td>

                    <Td>
                      <span className="text-sm text-xp-muted">
                        {formatDate(
                          payment.payment_date,
                        )}
                      </span>
                    </Td>
                  </TableRow>
                )
              },
            )}
          </Table>
        )}
      </Card>
    </div>
  )
}
