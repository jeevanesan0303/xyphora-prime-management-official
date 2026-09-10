import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileBarChart,
  TrendingUp,
  Receipt,
  BarChart3,
  Users,
  Briefcase,
  UserRound,
  FileText,
  RefreshCcw,
  CreditCard,
  DollarSign,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { useData } from '../../contexts/DataContext'
import { formatCurrency, exportCSVSimple } from '../../lib/utils'
import { PageHeader, Card, ExportDropdown } from '../../components/ui'
import { generateReportPDF } from '../../lib/pdf'
import { useToast } from '../../contexts/ToastContext'

interface ReportItem {
  label: string
  desc: string
  icon: typeof TrendingUp
  to: string
}

interface ChartData {
  month: string
  revenue: number
  expenses: number
}

interface TooltipPayloadItem {
  name?: string
  value?: number | string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

const reports: ReportItem[] = [
  {
    label: 'Profit & Loss',
    desc: 'Revenue vs expenses breakdown',
    icon: TrendingUp,
    to: '/reports/profit-loss',
  },
  {
    label: 'Income Report',
    desc: 'All income transactions',
    icon: TrendingUp,
    to: '/reports/income',
  },
  {
    label: 'Expense Report',
    desc: 'Detailed expense analysis',
    icon: Receipt,
    to: '/reports/expenses',
  },
  {
    label: 'Cash Flow',
    desc: 'Money in vs money out',
    icon: BarChart3,
    to: '/reports/cash-flow',
  },
  {
    label: 'Client Report',
    desc: 'Revenue and outstanding by client',
    icon: Users,
    to: '/reports/clients',
  },
  {
    label: 'Project Report',
    desc: 'Project status and values',
    icon: Briefcase,
    to: '/reports/projects',
  },
  {
    label: 'Employee Report',
    desc: 'Team salary analysis',
    icon: UserRound,
    to: '/reports/employees',
  },
  {
    label: 'Invoice Report',
    desc: 'All invoice data',
    icon: FileText,
    to: '/invoices',
  },
  {
    label: 'Subscription Report',
    desc: 'Recurring revenue analysis',
    icon: RefreshCcw,
    to: '/subscriptions',
  },
  {
    label: 'Outstanding Payments',
    desc: 'Unpaid invoice balances',
    icon: CreditCard,
    to: '/reports/cash-flow',
  },
]

function CustomTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps) {
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
          key={`${item.name ?? 'value'}-${index}`}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-xp-muted">
            {item.name}
          </span>

          <span className="font-medium text-[#111]">
            {formatCurrency(Number(item.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  )
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

export default function ReportsPage() {
  const navigate = useNavigate()
  const { success } = useToast()

  const {
    payments,
    expenses,
    salaries,
    invoices,
    clients,
    settings,
  } = useData()

  const currencySymbol =
    settings?.currency_symbol ||
    settings?.currency ||
    'LKR'

  /*
   * ---------------------------------------------------------
   * FINANCIAL TOTALS
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

  const totalExpenses = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0,
      ),
    [expenses],
  )

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

  const totalOperatingCosts =
    totalExpenses + totalSalaries

  const netProfit =
    totalRevenue - totalOperatingCosts

  const outstanding = useMemo(
    () =>
      invoices.reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.balance || 0),
        0,
      ),
    [invoices],
  )

  /*
   * ---------------------------------------------------------
   * REAL 6-MONTH CHART DATA
   * ---------------------------------------------------------
   */

  const chartData = useMemo<ChartData[]>(() => {
    const now = new Date()

    const currentMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    )

    const result: ChartData[] = []

    for (let index = 5; index >= 0; index--) {
      const monthDate = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() - index,
        1,
      )

      const monthKey =
        getMonthKey(monthDate)

      const revenue = payments
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
            monthKey
          )
        })
        .reduce(
          (sum, payment) =>
            sum +
            Number(payment.amount || 0),
          0,
        )

      const expenseAmount = expenses
        .filter((expense) => {
          const expenseDate =
            parseDate(expense.date)

          if (!expenseDate) {
            return false
          }

          return (
            getMonthKey(expenseDate) ===
            monthKey
          )
        })
        .reduce(
          (sum, expense) =>
            sum +
            Number(expense.amount || 0),
          0,
        )

      const salaryAmount = salaries
        .filter((salary) => {
          if (
            salary.status !== 'Paid'
          ) {
            return false
          }

          const salaryDate =
            parseDate(salary.month)

          if (!salaryDate) {
            return false
          }

          return (
            getMonthKey(salaryDate) ===
            monthKey
          )
        })
        .reduce(
          (sum, salary) =>
            sum +
            Number(
              salary.net_salary || 0,
            ),
          0,
        )

      result.push({
        month:
          getMonthLabel(monthDate),
        revenue,
        expenses:
          expenseAmount + salaryAmount,
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
   * EXECUTIVE & QUICK REPORTS (PDF & CSV)
   * ---------------------------------------------------------
   */

  const handleExportExecutivePDF = () => {
    try {
      generateReportPDF(
        'Executive Financial Report',
        `Generated on ${new Date().toLocaleDateString('en-GB')}`,
        ['Financial Metric', 'Value'],
        [
          ['Total Revenue', `${currencySymbol} ${totalRevenue.toLocaleString()}`],
          ['Operating Expenses', `${currencySymbol} ${totalExpenses.toLocaleString()}`],
          ['Salaries Paid', `${currencySymbol} ${totalSalaries.toLocaleString()}`],
          ['Total Operating Costs', `${currencySymbol} ${totalOperatingCosts.toLocaleString()}`],
          ['Net Profit', `${currencySymbol} ${netProfit.toLocaleString()}`],
          ['Total Outstanding Invoices', `${currencySymbol} ${outstanding.toLocaleString()}`],
        ],
        [
          { label: 'Net Profit', value: formatCurrency(netProfit) },
          { label: 'Outstanding', value: formatCurrency(outstanding) },
        ],
        settings
      )
      success('Executive financial report PDF generated.')
    } catch (err) {
      console.error('Failed to generate executive PDF:', err)
    }
  }

  const handleExportExecutiveCSV = () => {
    try {
      exportCSVSimple(
        'executive-financial-summary',
        ['Metric', 'Amount', 'Currency'],
        [
          { metric: 'Total Revenue', amount: totalRevenue, currency: currencySymbol },
          { metric: 'Total Expenses', amount: totalExpenses, currency: currencySymbol },
          { metric: 'Total Salaries', amount: totalSalaries, currency: currencySymbol },
          { metric: 'Total Operating Costs', amount: totalOperatingCosts, currency: currencySymbol },
          { metric: 'Net Profit', amount: netProfit, currency: currencySymbol },
          { metric: 'Total Outstanding Invoices', amount: outstanding, currency: currencySymbol },
        ]
      )
      success('Executive financial summary CSV exported.')
    } catch (err) {
      console.error('Failed to export executive CSV:', err)
    }
  }

  const handleQuickPDF = (
    reportName: string,
  ) => {
    try {
      if (
        reportName ===
        'Profit & Loss'
      ) {
        generateReportPDF(
          'Profit & Loss Report',
          `Generated ${new Date().toLocaleDateString(
            'en-GB',
          )}`,
          ['Category', 'Amount'],
          [
            [
              'Total Revenue',
              `${currencySymbol} ${totalRevenue.toLocaleString()}`,
            ],
            [
              'Total Expenses',
              `${currencySymbol} ${totalExpenses.toLocaleString()}`,
            ],
            [
              'Salaries',
              `${currencySymbol} ${totalSalaries.toLocaleString()}`,
            ],
            [
              'Net Profit',
              `${currencySymbol} ${netProfit.toLocaleString()}`,
            ],
          ],
          [
            {
              label: 'Net Profit',
              value:
                formatCurrency(
                  netProfit,
                ),
            },
          ],
          settings
        )
      } else {
        const outstandingInvoices =
          invoices.filter(
            (invoice) =>
              Number(
                invoice.balance || 0,
              ) > 0,
          )

        generateReportPDF(
          'Outstanding Payments',
          `Generated ${new Date().toLocaleDateString(
            'en-GB',
          )}`,
          [
            'Invoice',
            'Client',
            'Balance',
            'Status',
          ],
          outstandingInvoices.map(
            (invoice) => [
              invoice.invoice_number,
              clients.find(
                (client) =>
                  client.id ===
                  invoice.client_id,
              )?.company_name ||
                'Unknown client',
              `${currencySymbol} ${Number(
                invoice.balance || 0,
              ).toLocaleString()}`,
              invoice.status,
            ],
          ),
          [
            {
              label: 'Total Outstanding',
              value:
                formatCurrency(
                  outstanding,
                ),
            },
          ],
          settings
        )
      }

      success(
        `${reportName} PDF generated successfully.`,
      )
    } catch (error) {
      console.error(
        'Report PDF generation failed:',
        error,
      )
    }
  }

  const handleQuickCSV = (reportName: string) => {
    try {
      if (reportName === 'Profit & Loss') {
        exportCSVSimple(
          'profit-loss-summary',
          ['Category', 'Amount', 'Currency'],
          [
            { category: 'Total Revenue', amount: totalRevenue, currency: currencySymbol },
            { category: 'Total Expenses', amount: totalExpenses, currency: currencySymbol },
            { category: 'Total Salaries', amount: totalSalaries, currency: currencySymbol },
            { category: 'Net Profit', amount: netProfit, currency: currencySymbol },
          ]
        )
      } else {
        const outstandingInvoices = invoices.filter(
          (invoice) => Number(invoice.balance || 0) > 0
        )
        exportCSVSimple(
          'outstanding-invoices',
          ['Invoice Number', 'Client', 'Total', 'Paid', 'Balance', 'Due Date', 'Status'],
          outstandingInvoices.map((inv) => {
            const client = clients.find((c) => c.id === inv.client_id)
            return {
              invoice: inv.invoice_number,
              client: client?.company_name || '',
              total: Number(inv.total || 0),
              paid: Number(inv.paid || 0),
              balance: Number(inv.balance || 0),
              due_date: inv.due_date || '',
              status: inv.status,
            }
          })
        )
      }
      success(`${reportName} CSV exported successfully.`)
    } catch (error) {
      console.error('Report CSV export failed:', error)
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports Center"
        subtitle="Financial and business intelligence"
        actions={
          <ExportDropdown
            onExportPDF={handleExportExecutivePDF}
            onExportCSV={handleExportExecutiveCSV}
            label="Export Executive Report"
          />
        }
      />

      {/* Financial summary */}
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
          },
          {
            label: 'Outstanding',
            value:
              formatCurrency(
                outstanding,
              ),
            accent: true,
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
                  : 'text-[#111]'
              }`}
            >
              {metric.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Revenue vs Expenses */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[#111]">
              Revenue vs Expenses
            </h3>

            <p className="text-xs text-xp-muted mt-0.5">
              Real financial data — last 6 months
            </p>
          </div>

          <FileBarChart
            size={18}
            className="text-xp-muted"
          />
        </div>

        <ResponsiveContainer
          width="100%"
          height={200}
        >
          <AreaChart
            data={chartData}
          >
            <defs>
              <linearGradient
                id="rg"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#111"
                  stopOpacity={0.08}
                />

                <stop
                  offset="95%"
                  stopColor="#111"
                  stopOpacity={0}
                />
              </linearGradient>

              <linearGradient
                id="eg"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#7c3aed"
                  stopOpacity={0.1}
                />

                <stop
                  offset="95%"
                  stopColor="#7c3aed"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

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
                      value / 1000000
                    ).toFixed(1)}M`
                  : value >= 1000
                    ? `${(
                        value / 1000
                      ).toFixed(0)}k`
                    : `${value}`
              }
            />

            <Tooltip
              content={
                <CustomTooltip />
              }
            />

            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#111"
              strokeWidth={2}
              fill="url(#rg)"
              dot={false}
            />

            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke="#7c3aed"
              strokeWidth={2}
              fill="url(#eg)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Report cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => {
          const Icon = report.icon

          return (
            <Card
              key={report.label}
              onClick={() =>
                navigate(report.to)
              }
              className="p-5 cursor-pointer hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-xp-light-gray flex items-center justify-center shrink-0 group-hover:bg-xp-light-purple transition-colors">
                  <Icon
                    size={16}
                    className="text-xp-muted group-hover:text-xp-purple transition-colors"
                  />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#111]">
                    {report.label}
                  </p>

                  <p className="text-xs text-xp-muted mt-0.5">
                    {report.desc}
                  </p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Quick report actions */}
      <div className="mt-6">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#111]">
                Quick Reports
              </h3>

              <p className="text-xs text-xp-muted mt-0.5">
                Generate commonly used reports
              </p>
            </div>

            <FileBarChart
              size={18}
              className="text-xp-muted"
            />
          </div>

          <div className="flex flex-wrap gap-2.5 mt-4">
            <button
              type="button"
              onClick={() =>
                handleQuickPDF(
                  'Profit & Loss',
                )
              }
              className="px-3 py-2 text-xs font-medium rounded-lg bg-[#111] text-white hover:bg-black transition-colors"
            >
              P&L Report (PDF)
            </button>

            <button
              type="button"
              onClick={() =>
                handleQuickCSV(
                  'Profit & Loss',
                )
              }
              className="px-3 py-2 text-xs font-medium rounded-lg border border-xp-border text-[#111] hover:bg-xp-light-gray transition-colors"
            >
              P&L Summary (CSV)
            </button>

            <button
              type="button"
              onClick={() =>
                handleQuickPDF(
                  'Outstanding Payments',
                )
              }
              className="px-3 py-2 text-xs font-medium rounded-lg bg-xp-purple text-white hover:bg-xp-deep-purple transition-colors"
            >
              Outstanding (PDF)
            </button>

            <button
              type="button"
              onClick={() =>
                handleQuickCSV(
                  'Outstanding Payments',
                )
              }
              className="px-3 py-2 text-xs font-medium rounded-lg border border-xp-border text-[#111] hover:bg-xp-light-gray transition-colors"
            >
              Outstanding (CSV)
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}