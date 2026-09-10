
import { useMemo } from 'react'
import { ArrowLeft, Download } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
import { formatCurrency, exportCSVSimple } from '../../lib/utils'
import { generateReportPDF } from '../../lib/pdf'
import {
  PageHeader,
  Button,
  Card,
  ExportDropdown,
} from '../../components/ui'

interface TooltipPayloadItem {
  name?: string
  value?: number | string
}

interface ProfitLossTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

interface MonthlyProfitLoss {
  month: string
  revenue: number
  expenses: number
  profit: number
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
  return date.toLocaleDateString('en-GB', {
    month: 'short',
  })
}

function ProfitLossTooltip({
  active,
  payload,
  label,
}: ProfitLossTooltipProps) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="bg-white border border-xp-border rounded-lg shadow-lg px-3 py-2.5 text-xs">
      <p className="font-semibold text-[#111] mb-1.5">
        {label}
      </p>

      <div className="space-y-1">
        {payload.map((item, index) => (
          <div
            key={`${item.name ?? 'value'}-${index}`}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-xp-muted">
              {item.name}
            </span>

            <span className="font-medium text-[#111]">
              {formatCurrency(
                Number(item.value ?? 0),
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProfitLossPage() {
  const navigate = useNavigate()
  const { success } = useToast()

  const {
    payments,
    expenses,
    salaries,
    settings,
  } = useData()

  const currencySymbol =
    settings?.currency_symbol ||
    settings?.currency ||
    'LKR'

  /*
   * ---------------------------------------------------------
   * TOTAL REVENUE
   * ---------------------------------------------------------
   */

  const totalRevenue = useMemo(
    () =>
      payments.reduce(
        (sum, payment) =>
          sum + Number(payment.amount || 0),
        0,
      ),
    [payments],
  )

  /*
   * ---------------------------------------------------------
   * TOTAL EXPENSES
   * ---------------------------------------------------------
   */

  const totalExpenses = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0,
      ),
    [expenses],
  )

  /*
   * ---------------------------------------------------------
   * PAID SALARIES
   * ---------------------------------------------------------
   */

  const totalSalaries = useMemo(
    () =>
      salaries
        .filter(
          (salary) =>
            salary.status === 'Paid',
        )
        .reduce(
          (sum, salary) =>
            sum +
            Number(
              salary.net_salary || 0,
            ),
          0,
        ),
    [salaries],
  )

  /*
   * ---------------------------------------------------------
   * PROFIT / LOSS
   * ---------------------------------------------------------
   */

  const totalOperatingCosts =
    totalExpenses + totalSalaries

  const netProfit =
    totalRevenue - totalOperatingCosts

  const profitMargin =
    totalRevenue > 0
      ? (netProfit / totalRevenue) * 100
      : 0

  /*
   * ---------------------------------------------------------
   * REVENUE BREAKDOWN
   * ---------------------------------------------------------
   */

  const projectRevenue = useMemo(
    () =>
      payments
        .filter(
          (payment) =>
            payment.payment_type !==
            'Subscription',
        )
        .reduce(
          (sum, payment) =>
            sum +
            Number(payment.amount || 0),
          0,
        ),
    [payments],
  )

  const subscriptionRevenue =
    useMemo(
      () =>
        payments
          .filter(
            (payment) =>
              payment.payment_type ===
              'Subscription',
          )
          .reduce(
            (sum, payment) =>
              sum +
              Number(payment.amount || 0),
            0,
          ),
      [payments],
    )

  /*
   * ---------------------------------------------------------
   * EXPENSE BY CATEGORY
   * ---------------------------------------------------------
   */

  const expenseByCategory =
    useMemo(() => {
      const categories =
        new Map<string, number>()

      expenses.forEach((expense) => {
        const category =
          expense.category?.trim() ||
          'Other'

        const amount =
          Number(expense.amount || 0)

        categories.set(
          category,
          (categories.get(category) || 0) +
            amount,
        )
      })

      return Array.from(
        categories.entries(),
      ).sort(
        (a, b) => b[1] - a[1],
      )
    }, [expenses])

  /*
   * ---------------------------------------------------------
   * MONTHLY P&L
   *
   * Revenue = real payments
   * Expenses = real expenses + paid salaries
   * ---------------------------------------------------------
   */

  const monthlyProfitLoss =
    useMemo<MonthlyProfitLoss[]>(() => {
      const now = new Date()

      const currentMonth =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        )

      const result: MonthlyProfitLoss[] =
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

        const expenseTotal =
          expenses
            .filter((expense) => {
              const expenseDate =
                parseDate(
                  expense.date,
                )

              if (!expenseDate) {
                return false
              }

              return (
                getMonthKey(
                  expenseDate,
                ) === monthKey
              )
            })
            .reduce(
              (sum, expense) =>
                sum +
                Number(
                  expense.amount || 0,
                ),
              0,
            )

        const salaryTotal =
          salaries
            .filter((salary) => {
              if (
                salary.status !==
                'Paid'
              ) {
                return false
              }

              const salaryDate =
                parseDate(
                  salary.month,
                )

              if (!salaryDate) {
                return false
              }

              return (
                getMonthKey(
                  salaryDate,
                ) === monthKey
              )
            })
            .reduce(
              (sum, salary) =>
                sum +
                Number(
                  salary.net_salary ||
                    0,
                ),
              0,
            )

        const totalMonthlyExpenses =
          expenseTotal +
          salaryTotal

        result.push({
          month:
            getMonthLabel(
              monthDate,
            ),
          revenue,
          expenses:
            totalMonthlyExpenses,
          profit:
            revenue -
            totalMonthlyExpenses,
        })
      }

      return result
    }, [
      payments,
      expenses,
      salaries,
    ])

  /*
   * ---------------------------------------------------------
   * PDF EXPORT
   * ---------------------------------------------------------
   */

  const handlePDF = () => {
    try {
      const rows: string[][] = [
        [
          'REVENUE',
          '',
        ],
        [
          'Project Payments',
          `${currencySymbol} ${projectRevenue.toLocaleString()}`,
        ],
        [
          'Subscription Revenue',
          `${currencySymbol} ${subscriptionRevenue.toLocaleString()}`,
        ],
        [
          'Total Revenue',
          `${currencySymbol} ${totalRevenue.toLocaleString()}`,
        ],
        [
          '',
          '',
        ],
        [
          'EXPENSES',
          '',
        ],
      ]

      expenseByCategory.forEach(
        ([category, amount]) => {
          rows.push([
            category,
            `${currencySymbol} ${amount.toLocaleString()}`,
          ])
        },
      )

      rows.push([
        'Salaries',
        `${currencySymbol} ${totalSalaries.toLocaleString()}`,
      ])

      rows.push([
        'Total Expenses',
        `${currencySymbol} ${totalOperatingCosts.toLocaleString()}`,
      ])

      rows.push([
        '',
        '',
      ])

      rows.push([
        'NET PROFIT',
        `${currencySymbol} ${netProfit.toLocaleString()}`,
      ])

      rows.push([
        'Profit Margin',
        `${profitMargin.toFixed(1)}%`,
      ])

      generateReportPDF(
        'Profit & Loss Report',
        `Generated ${new Date().toLocaleDateString(
          'en-GB',
        )}`,
        ['Item', 'Amount'],
        rows,
        [
          {
            label: 'Net Profit',
            value:
              formatCurrency(
                netProfit,
              ),
          },
          {
            label: 'Profit Margin',
            value: `${profitMargin.toFixed(
              1,
            )}%`,
          },
        ],
        settings
      )

      success(
        'Profit & Loss PDF generated successfully.',
      )
    } catch (error) {
      console.error(
        'Profit & Loss PDF generation failed:',
        error,
      )
    }
  }

  const handleCSV = () => {
    try {
      const csvRows: Array<{ section: string; item: string; amount: number | string }> = [
        { section: 'REVENUE', item: 'Project Payments', amount: projectRevenue },
        { section: 'REVENUE', item: 'Subscription Revenue', amount: subscriptionRevenue },
        { section: 'REVENUE', item: 'Total Revenue', amount: totalRevenue },
      ]

      expenseByCategory.forEach(([category, amount]) => {
        csvRows.push({ section: 'EXPENSES', item: category, amount })
      })

      csvRows.push(
        { section: 'EXPENSES', item: 'Salaries', amount: totalSalaries },
        { section: 'EXPENSES', item: 'Total Expenses', amount: totalOperatingCosts },
        { section: 'SUMMARY', item: 'Net Profit', amount: netProfit },
        { section: 'SUMMARY', item: 'Profit Margin', amount: `${profitMargin.toFixed(1)}%` },
      )

      exportCSVSimple('profit-and-loss-statement', ['Section', 'Line Item', 'Amount'], csvRows)
      success('Profit & Loss CSV exported successfully.')
    } catch (err) {
      console.error('Failed to export P&L CSV:', err)
    }
  }

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() =>
            navigate('/reports')
          }
          className="p-1.5 rounded-lg text-xp-muted hover:bg-xp-light-gray"
          aria-label="Back to reports"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex-1">
          <h1 className="text-[20px] font-semibold text-[#111]">
            Profit & Loss
          </h1>

          <p className="text-xs text-xp-muted">
            All-time financial summary
          </p>
        </div>

        <ExportDropdown
          onExportPDF={handlePDF}
          onExportCSV={handleCSV}
          label="Export P&L"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Total Revenue',
            value:
              formatCurrency(
                totalRevenue,
              ),
          },
          {
            label: 'Total Expenses',
            value:
              formatCurrency(
                totalOperatingCosts,
              ),
            accent: true,
          },
          {
            label: 'Net Profit',
            value:
              formatCurrency(
                netProfit,
              ),
            highlight:
              netProfit > 0,
            negative:
              netProfit < 0,
          },
          {
            label: 'Profit Margin',
            value: `${profitMargin.toFixed(
              1,
            )}%`,
            highlight:
              profitMargin > 0,
            negative:
              profitMargin < 0,
          },
        ].map((metric) => (
          <Card
            key={metric.label}
            className="p-4"
          >
            <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
              {metric.label}
            </p>

            <p
              className={`text-xl font-semibold ${
                metric.accent
                  ? 'text-xp-purple'
                  : metric.highlight
                    ? 'text-emerald-600'
                    : metric.negative
                      ? 'text-red-500'
                      : 'text-[#111]'
              }`}
            >
              {metric.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Charts + Summary */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Monthly P&L Chart */}
        <Card className="p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#111]">
              Monthly P&L
            </h3>

            <p className="text-xs text-xp-muted mt-0.5">
              Real payments, expenses and paid salaries
            </p>
          </div>

          <ResponsiveContainer
            width="100%"
            height={220}
          >
            <BarChart
              data={
                monthlyProfitLoss
              }
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
                  <ProfitLossTooltip />
                }
              />

              <Bar
                dataKey="revenue"
                name="Revenue"
                fill="#111"
                radius={[
                  3,
                  3,
                  0,
                  0,
                ]}
              />

              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="#7c3aed"
                radius={[
                  3,
                  3,
                  0,
                  0,
                ]}
              />

              <Bar
                dataKey="profit"
                name="Profit"
                fill="#10b981"
                radius={[
                  3,
                  3,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* P&L Summary */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-[#111] mb-4">
            P&L Summary
          </h3>

          <div className="space-y-0">
            {/* Revenue */}
            <div className="py-3 border-b border-xp-light-gray">
              <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-2">
                Revenue
              </p>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-xp-muted">
                    Project Revenue
                  </span>

                  <span className="font-medium text-[#111]">
                    {formatCurrency(
                      projectRevenue,
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-xp-muted">
                    Subscription Revenue
                  </span>

                  <span className="font-medium text-[#111]">
                    {formatCurrency(
                      subscriptionRevenue,
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-xp-light-gray">
                  <span className="text-[#111]">
                    Total Revenue
                  </span>

                  <span className="text-[#111]">
                    {formatCurrency(
                      totalRevenue,
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Expenses */}
            <div className="py-3 border-b border-xp-light-gray">
              <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-2">
                Expenses
              </p>

              <div className="space-y-2">
                {expenseByCategory.length ===
                0 ? (
                  <p className="text-xs text-xp-muted py-1">
                    No expense records available.
                  </p>
                ) : (
                  expenseByCategory.map(
                    ([category, amount]) => (
                      <div
                        key={category}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-xp-muted">
                          {category}
                        </span>

                        <span className="text-[#111]">
                          {formatCurrency(
                            amount,
                          )}
                        </span>
                      </div>
                    ),
                  )
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-xp-muted">
                    Salaries
                  </span>

                  <span className="text-[#111]">
                    {formatCurrency(
                      totalSalaries,
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-sm font-semibold pt-1 border-t border-xp-light-gray">
                  <span className="text-[#111]">
                    Total Expenses
                  </span>

                  <span className="text-xp-purple">
                    {formatCurrency(
                      totalOperatingCosts,
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className="py-3">
              <div className="flex justify-between items-center gap-4">
                <span className="text-base font-bold text-[#111]">
                  Net Profit
                </span>

                <span
                  className={`text-xl font-bold ${
                    netProfit >= 0
                      ? 'text-emerald-600'
                      : 'text-red-500'
                  }`}
                >
                  {formatCurrency(
                    netProfit,
                  )}
                </span>
              </div>

              <p className="text-xs text-xp-muted mt-1">
                Margin:{' '}
                {profitMargin.toFixed(
                  1,
                )}
                %
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
