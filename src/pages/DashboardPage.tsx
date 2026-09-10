import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Clock,
  Users,
  Briefcase,
  FileText,
  CreditCard,
} from 'lucide-react'
import { useData } from '../contexts/DataContext'
import { useToast } from '../contexts/ToastContext'
import {
  formatCurrency,
  formatDate,
  getGreeting,
  daysOverdue,
  daysDue,
  exportCSVSimple,
} from '../lib/utils'
import { Card, Badge, ExportDropdown } from '../components/ui'
import { generateReportPDF } from '../lib/pdf'
import type { InvoiceStatus } from '../types'

type ChartPeriod = 'monthly' | 'quarterly' | 'yearly'

interface MetricCardProps {
  label: string
  value: string
  trend?: string
  accent?: boolean
}

interface ChartPoint {
  label: string
  revenue: number
  expenses: number
}

interface ServiceRevenue {
  name: string
  value: number
}

interface TooltipPayloadItem {
  name?: string
  value?: number | string
  color?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

const PURPLE = '#7c3aed'
const BLACK = '#111111'

const CHART_COLORS = [
  '#111111',
  '#7c3aed',
  '#5b21b6',
  '#8b5cf6',
  '#a3a3a3',
  '#c4b5fd',
]

const MetricCard = ({
  label,
  value,
  trend,
  accent,
}: MetricCardProps) => (
  <motion.div
    whileHover={{ y: -1 }}
    transition={{ duration: 0.15 }}
  >
    <Card className="p-5">
      <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-3">
        {label}
      </p>

      <p
        className={`text-[26px] font-semibold tracking-tight ${
          accent ? 'text-xp-purple' : 'text-[#111]'
        }`}
      >
        {value}
      </p>

      {trend && (
        <p className="text-[11px] text-xp-muted mt-1.5">
          {trend}
        </p>
      )}
    </Card>
  </motion.div>
)

const CustomTooltip = ({
  active,
  payload,
  label,
}: CustomTooltipProps) => {
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
          className="flex items-center gap-2"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: item.color ?? BLACK,
            }}
          />

          <span className="text-xp-muted">
            {item.name}:
          </span>

          <span className="font-medium text-[#111]">
            {formatCurrency(Number(item.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  )
}

function getMonthStart(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  )
}

function getMonthKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', {
    month: 'short',
  })
}

function getQuarterStart(date: Date) {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3

  return new Date(
    date.getFullYear(),
    quarterMonth,
    1,
  )
}

function getQuarterKey(date: Date) {
  const quarter =
    Math.floor(date.getMonth() / 3) + 1

  return `${date.getFullYear()}-Q${quarter}`
}

function getQuarterLabel(date: Date) {
  const quarter =
    Math.floor(date.getMonth() / 3) + 1

  return `Q${quarter} ${date.getFullYear()}`
}

function getYearStart(date: Date) {
  return new Date(
    date.getFullYear(),
    0,
    1,
  )
}

function getYearKey(date: Date) {
  return String(date.getFullYear())
}

function getYearLabel(date: Date) {
  return String(date.getFullYear())
}

function safeDate(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? null
    : date
}

export default function DashboardPage() {
  const {
    invoices,
    payments,
    subscriptions,
    expenses,
    salaries,
    clients,
    projects,
    settings,
  } = useData()

  const { success, error: showToastError } = useToast()
  const navigate = useNavigate()

  const [chartPeriod, setChartPeriod] =
    useState<ChartPeriod>('monthly')

  const currencySymbol =
    settings?.currency_symbol ||
    settings?.currency ||
    'LKR'

  const today = useMemo(
    () => new Date(),
    [],
  )

  const currentMonthKey = useMemo(
    () => getMonthKey(today),
    [today],
  )

  /*
   * ---------------------------------------------------------
   * FINANCIAL METRICS
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
          (salary) => salary.status === 'Paid',
        )
        .reduce(
          (sum, salary) =>
            sum + Number(salary.net_salary || 0),
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
          sum + Number(invoice.balance || 0),
        0,
      ),
    [invoices],
  )

  const thisMonthRevenue = useMemo(
    () =>
      payments
        .filter(
          (payment) =>
            payment.payment_date?.startsWith(
              currentMonthKey,
            ),
        )
        .reduce(
          (sum, payment) =>
            sum + Number(payment.amount || 0),
          0,
        ),
    [payments, currentMonthKey],
  )

  const thisMonthExpenses = useMemo(
    () =>
      expenses
        .filter(
          (expense) =>
            expense.date?.startsWith(
              currentMonthKey,
            ),
        )
        .reduce(
          (sum, expense) =>
            sum + Number(expense.amount || 0),
          0,
        ),
    [expenses, currentMonthKey],
  )

  const thisMonthSalaries = useMemo(
    () =>
      salaries
        .filter(
          (salary) =>
            salary.status === 'Paid' &&
            salary.month?.startsWith(
              currentMonthKey,
            ),
        )
        .reduce(
          (sum, salary) =>
            sum + Number(salary.net_salary || 0),
          0,
        ),
    [salaries, currentMonthKey],
  )

  const thisMonthTotalCosts =
    thisMonthExpenses + thisMonthSalaries

  /*
   * ---------------------------------------------------------
   * RECURRING REVENUE
   * ---------------------------------------------------------
   */

  const mrr = useMemo(() => {
    return subscriptions
      .filter(
        (subscription) =>
          subscription.status === 'Active',
      )
      .reduce((sum, subscription) => {
        const amount =
          Number(subscription.amount || 0)

        switch (subscription.billing_cycle) {
          case 'Monthly':
            return sum + amount

          case 'Quarterly':
            return sum + amount / 3

          case 'Yearly':
            return sum + amount / 12

          default:
            return sum
        }
      }, 0)
  }, [subscriptions])

  const arr = mrr * 12

  /*
   * ---------------------------------------------------------
   * ALERTS
   * ---------------------------------------------------------
   */

  const overdueInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const dueDate = safeDate(
          invoice.due_date,
        )

        if (!dueDate) {
          return false
        }

        return (
          Number(invoice.balance || 0) > 0 &&
          daysOverdue(invoice.due_date) > 0
        )
      }),
    [invoices],
  )

  const pendingInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const balance =
          Number(invoice.balance || 0)

        if (balance <= 0) {
          return false
        }

        const days = daysDue(
          invoice.due_date,
        )

        return (
          days >= 0 &&
          days <= 7
        )
      }),
    [invoices],
  )

  const dueSoonSubs = useMemo(
    () =>
      subscriptions.filter(
        (subscription) =>
          subscription.status === 'Due Soon',
      ),
    [subscriptions],
  )

  const pendingSalaries = useMemo(
    () =>
      salaries.filter(
        (salary) =>
          salary.status === 'Pending',
      ),
    [salaries],
  )

  /*
   * ---------------------------------------------------------
   * REVENUE VS EXPENSE CHART
   *
   * Uses real payments + expenses + paid salaries.
   * ---------------------------------------------------------
   */

  const chartData = useMemo<ChartPoint[]>(() => {
    const result: ChartPoint[] = []

    if (chartPeriod === 'monthly') {
      const start = getMonthStart(today)

      for (let index = 5; index >= 0; index--) {
        const date = new Date(
          start.getFullYear(),
          start.getMonth() - index,
          1,
        )

        const key = getMonthKey(date)

        const revenue = payments
          .filter(
            (payment) => {
              const paymentDate =
                safeDate(
                  payment.payment_date,
                )

              return (
                paymentDate &&
                getMonthKey(paymentDate) ===
                  key
              )
            },
          )
          .reduce(
            (sum, payment) =>
              sum +
              Number(payment.amount || 0),
            0,
          )

        const expenseTotal = expenses
          .filter((expense) => {
            const expenseDate =
              safeDate(expense.date)

            return (
              expenseDate &&
              getMonthKey(expenseDate) ===
                key
            )
          })
          .reduce(
            (sum, expense) =>
              sum +
              Number(expense.amount || 0),
            0,
          )

        const salaryTotal = salaries
          .filter((salary) => {
            if (
              salary.status !== 'Paid'
            ) {
              return false
            }

            const salaryDate =
              safeDate(salary.month)

            return (
              salaryDate &&
              getMonthKey(salaryDate) ===
                key
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
          label: getMonthLabel(date),
          revenue,
          expenses:
            expenseTotal + salaryTotal,
        })
      }
    }

    if (chartPeriod === 'quarterly') {
      const start =
        getQuarterStart(today)

      for (let index = 3; index >= 0; index--) {
        const date = new Date(
          start.getFullYear(),
          start.getMonth() -
            index * 3,
          1,
        )

        const key =
          getQuarterKey(date)

        const revenue = payments
          .filter((payment) => {
            const paymentDate =
              safeDate(
                payment.payment_date,
              )

            return (
              paymentDate &&
              getQuarterKey(
                paymentDate,
              ) === key
            )
          })
          .reduce(
            (sum, payment) =>
              sum +
              Number(payment.amount || 0),
            0,
          )

        const expenseTotal = expenses
          .filter((expense) => {
            const expenseDate =
              safeDate(expense.date)

            return (
              expenseDate &&
              getQuarterKey(
                expenseDate,
              ) === key
            )
          })
          .reduce(
            (sum, expense) =>
              sum +
              Number(expense.amount || 0),
            0,
          )

        const salaryTotal = salaries
          .filter((salary) => {
            if (
              salary.status !== 'Paid'
            ) {
              return false
            }

            const salaryDate =
              safeDate(salary.month)

            return (
              salaryDate &&
              getQuarterKey(
                salaryDate,
              ) === key
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
          label:
            getQuarterLabel(date),
          revenue,
          expenses:
            expenseTotal + salaryTotal,
        })
      }
    }

    if (chartPeriod === 'yearly') {
      const start =
        getYearStart(today)

      for (let index = 4; index >= 0; index--) {
        const date = new Date(
          start.getFullYear() -
            index,
          0,
          1,
        )

        const key =
          getYearKey(date)

        const revenue = payments
          .filter((payment) => {
            const paymentDate =
              safeDate(
                payment.payment_date,
              )

            return (
              paymentDate &&
              getYearKey(
                paymentDate,
              ) === key
            )
          })
          .reduce(
            (sum, payment) =>
              sum +
              Number(payment.amount || 0),
            0,
          )

        const expenseTotal = expenses
          .filter((expense) => {
            const expenseDate =
              safeDate(expense.date)

            return (
              expenseDate &&
              getYearKey(
                expenseDate,
              ) === key
            )
          })
          .reduce(
            (sum, expense) =>
              sum +
              Number(expense.amount || 0),
            0,
          )

        const salaryTotal = salaries
          .filter((salary) => {
            if (
              salary.status !== 'Paid'
            ) {
              return false
            }

            const salaryDate =
              safeDate(salary.month)

            return (
              salaryDate &&
              getYearKey(
                salaryDate,
              ) === key
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
          label:
            getYearLabel(date),
          revenue,
          expenses:
            expenseTotal + salaryTotal,
        })
      }
    }

    return result
  }, [
    chartPeriod,
    today,
    payments,
    expenses,
    salaries,
  ])

  const chartDescription =
    chartPeriod === 'monthly'
      ? 'Last 6 months'
      : chartPeriod === 'quarterly'
        ? 'Last 4 quarters'
        : 'Last 5 years'

  /*
   * ---------------------------------------------------------
   * REVENUE BY SERVICE / INVOICE LINE
   *
   * Since invoice_items currently store the service/product
   * as "description", we aggregate real invoice item values.
   * ---------------------------------------------------------
   */

  const revenueByService =
    useMemo<ServiceRevenue[]>(() => {
      const serviceMap =
        new Map<string, number>()

      invoices.forEach((invoice) => {
        invoice.items?.forEach((item) => {
          const name =
            item.description?.trim()

          if (!name) {
            return
          }

          const total =
            Number(item.total || 0)

          if (total <= 0) {
            return
          }

          serviceMap.set(
            name,
            (serviceMap.get(name) || 0) +
              total,
          )
        })
      })

      return Array.from(
        serviceMap.entries(),
      )
        .map(([name, value]) => ({
          name,
          value,
        }))
        .sort(
          (a, b) => b.value - a.value,
        )
        .slice(0, 6)
    }, [invoices])

  const totalServiceRevenue =
    revenueByService.reduce(
      (sum, item) =>
        sum + item.value,
      0,
    )

  /*
   * ---------------------------------------------------------
   * BUSINESS SNAPSHOT
   * ---------------------------------------------------------
   */

  const activeClients = useMemo(
    () =>
      clients.filter(
        (client) =>
          client.status === 'Active',
      ).length,
    [clients],
  )

  const activeProjects = useMemo(
    () =>
      projects.filter((project) =>
        [
          'In Progress',
          'Approved',
          'Testing',
        ].includes(project.status),
      ).length,
    [projects],
  )

  const pendingInvoiceCount =
    useMemo(
      () =>
        invoices.filter(
          (invoice) =>
            invoice.status === 'Pending' ||
            invoice.status === 'Partial',
        ).length,
      [invoices],
    )

  /*
   * ---------------------------------------------------------
   * RECENT PROJECTS
   * ---------------------------------------------------------
   */

  const recentProjects = useMemo(
    () =>
      [...projects]
        .sort((a, b) => {
          const dateA =
            safeDate(a.created_at)
              ?.getTime() || 0

          const dateB =
            safeDate(b.created_at)
              ?.getTime() || 0

          return dateB - dateA
        })
        .slice(0, 4),
    [projects],
  )

  const statusVariants: Record<
    string,
    'muted' |
      'blue' |
      'warning' |
      'success' |
      'danger' |
      'purple'
  > = {
    Planning: 'muted',
    Proposal: 'blue',
    Approved: 'purple',
    'In Progress': 'purple',
    Testing: 'warning',
    Completed: 'success',
    Delivered: 'success',
    Maintenance: 'warning',
    Cancelled: 'danger',
  }

  /*
   * ---------------------------------------------------------
   * EXPORT (PDF & CSV)
   * ---------------------------------------------------------
   */

  const handleExportPDF = () => {
    try {
      generateReportPDF(
        'Executive Dashboard Brief',
        `Generated on ${today.toLocaleDateString('en-GB')}`,
        ['Business Metric / KPI', 'Current Value'],
        [
          ['Total Revenue (Collected)', `${currencySymbol} ${totalRevenue.toLocaleString()}`],
          ['This Month Revenue', `${currencySymbol} ${thisMonthRevenue.toLocaleString()}`],
          ['Total Operating Expenses', `${currencySymbol} ${totalExpenses.toLocaleString()}`],
          ['Total Salaries Paid', `${currencySymbol} ${totalSalaries.toLocaleString()}`],
          ['Total Operating Costs', `${currencySymbol} ${totalOperatingCosts.toLocaleString()}`],
          ['Net Operating Profit', `${currencySymbol} ${netProfit.toLocaleString()}`],
          ['Outstanding Invoices', `${currencySymbol} ${outstanding.toLocaleString()}`],
          ['Active Clients', `${activeClients}`],
          ['Active Projects', `${activeProjects}`],
          ['Pending Invoices', `${pendingInvoiceCount}`],
        ],
        [
          { label: 'Net Profit', value: formatCurrency(netProfit) },
          { label: 'Total Outstanding', value: formatCurrency(outstanding) },
        ],
        settings
      )
      success('Executive dashboard report PDF downloaded.')
    } catch (err) {
      console.error('Failed to export executive PDF:', err)
      showToastError('Failed to generate executive PDF.')
    }
  }

  const handleExportCSV = () => {
    try {
      exportCSVSimple(
        'executive-dashboard-summary',
        ['Metric', 'Value', 'Currency / Unit'],
        [
          { metric: 'Total Revenue', value: totalRevenue, unit: currencySymbol },
          { metric: 'This Month Revenue', value: thisMonthRevenue, unit: currencySymbol },
          { metric: 'Operating Expenses', value: totalExpenses, unit: currencySymbol },
          { metric: 'Salaries Paid', value: totalSalaries, unit: currencySymbol },
          { metric: 'Total Costs', value: totalOperatingCosts, unit: currencySymbol },
          { metric: 'Net Profit', value: netProfit, unit: currencySymbol },
          { metric: 'Outstanding Invoices Amount', value: outstanding, unit: currencySymbol },
          { metric: 'Active Clients', value: activeClients, unit: 'Count' },
          { metric: 'Active Projects', value: activeProjects, unit: 'Count' },
          { metric: 'Pending Invoices', value: pendingInvoiceCount, unit: 'Count' },
        ]
      )
      success('Executive dashboard summary exported to CSV.')
    } catch (err) {
      console.error('Failed to export executive CSV:', err)
      showToastError('Failed to export executive CSV.')
    }
  }

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#111] tracking-tight">
            {getGreeting()}, Administrator.
          </h1>

          <p className="text-sm text-xp-muted mt-0.5">
            Here's what's happening across
            Xyphora Prime.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            onExportPDF={handleExportPDF}
            onExportCSV={handleExportCSV}
            label="Export Brief"
          />

          <Badge variant="purple">
            {today.toLocaleDateString(
              'en-GB',
              {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              },
            )}
          </Badge>
        </div>
      </div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(
            totalRevenue,
          )}
          trend={`+${currencySymbol} ${thisMonthRevenue.toLocaleString()} this month`}
        />

        <MetricCard
          label="Total Expenses"
          value={formatCurrency(
            totalOperatingCosts,
          )}
          accent
          trend={`${currencySymbol} ${thisMonthTotalCosts.toLocaleString()} this month`}
        />

        <MetricCard
          label="Net Profit"
          value={formatCurrency(
            netProfit,
          )}
          trend={
            netProfit > 0
              ? 'Profitable'
              : netProfit < 0
                ? 'Operating at a loss'
                : 'Break-even'
          }
        />

        <MetricCard
          label="Outstanding"
          value={formatCurrency(
            outstanding,
          )}
          accent
          trend={`${overdueInvoices.length} overdue invoice${
            overdueInvoices.length !== 1
              ? 's'
              : ''
          }`}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'This Month Revenue',
            value: formatCurrency(
              thisMonthRevenue,
            ),
          },
          {
            label: 'This Month Expenses',
            value: formatCurrency(
              thisMonthTotalCosts,
            ),
          },
          {
            label: 'Monthly Recurring',
            value: formatCurrency(mrr),
            accent: true,
          },
          {
            label: 'Annual Recurring',
            value: formatCurrency(arr),
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
              className={`text-lg font-semibold tracking-tight ${
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

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Revenue vs Expenses */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-[#111]">
                Revenue vs Expenses
              </h3>

              <p className="text-xs text-xp-muted mt-0.5">
                {chartDescription}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  'monthly',
                  'quarterly',
                  'yearly',
                ] as ChartPeriod[]
              ).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() =>
                    setChartPeriod(period)
                  }
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors capitalize ${
                    chartPeriod === period
                      ? 'bg-[#111] text-white'
                      : 'text-xp-muted hover:bg-xp-light-gray'
                  }`}
                >
                  {period.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#111]" />

              <span className="text-xs text-xp-muted">
                Revenue
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-xp-purple" />

              <span className="text-xs text-xp-muted">
                Expenses
              </span>
            </div>
          </div>

          <ResponsiveContainer
            width="100%"
            height={220}
          >
            <AreaChart
              data={chartData}
            >
              <defs>
                <linearGradient
                  id="revGrad"
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
                  id="expGrad"
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
                dataKey="label"
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
                tickFormatter={(value: number) =>
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
                stroke={BLACK}
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={false}
              />

              <Area
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke={PURPLE}
                strokeWidth={2}
                fill="url(#expGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Revenue by Service */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-[#111] mb-1">
            Revenue by Service
          </h3>

          <p className="text-xs text-xp-muted mb-4">
            Based on invoice line items
          </p>

          {revenueByService.length === 0 ? (
            <div className="h-45 flex items-center justify-center">
              <p className="text-xs text-xp-muted text-center">
                No invoice service data
                available yet.
              </p>
            </div>
          ) : (
            <>
              <ResponsiveContainer
                width="100%"
                height={180}
              >
                <PieChart>
                  <Pie
                    data={revenueByService}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {revenueByService.map(
                      (item, index) => (
                        <Cell
                          key={`${item.name}-${index}`}
                          fill={
                            CHART_COLORS[
                              index %
                                CHART_COLORS.length
                            ]
                          }
                        />
                      ),
                    )}
                  </Pie>

                  <Tooltip
                    formatter={(
                      value
                    ) =>
                      formatCurrency(
                        Number(value),
                      )
                    }
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-2 mt-2">
                {revenueByService.map(
                  (item, index) => {
                    const percentage =
                      totalServiceRevenue >
                      0
                        ? (
                            (item.value /
                              totalServiceRevenue) *
                            100
                          ).toFixed(1)
                        : '0.0'

                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              background:
                                CHART_COLORS[
                                  index %
                                    CHART_COLORS.length
                                ],
                            }}
                          />

                          <span className="text-xs text-xp-muted truncate">
                            {item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-xp-muted">
                            {percentage}%
                          </span>

                          <span className="text-xs font-medium text-[#111]">
                            {formatCurrency(
                              item.value,
                            )}
                          </span>
                        </div>
                      </div>
                    )
                  },
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Alerts + Quick Stats */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Overdue */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle
              size={15}
              className="text-red-500"
            />

            <h3 className="text-sm font-semibold text-[#111]">
              Overdue Payments
            </h3>

            {overdueInvoices.length >
              0 && (
              <Badge variant="danger">
                {
                  overdueInvoices.length
                }
              </Badge>
            )}
          </div>

          {overdueInvoices.length ===
          0 ? (
            <p className="text-xs text-xp-muted text-center py-4">
              No overdue payments.
            </p>
          ) : (
            <div className="space-y-3">
              {overdueInvoices
                .slice(0, 4)
                .map((invoice) => {
                  const client =
                    clients.find(
                      (item) =>
                        item.id ===
                        invoice.client_id,
                    )

                  return (
                    <div
                      key={invoice.id}
                      onClick={() =>
                        navigate(
                          `/invoices/${invoice.id}`,
                        )
                      }
                      className="flex items-start justify-between p-3 bg-red-50 border border-red-100 rounded-lg cursor-pointer hover:bg-red-100/50 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[#111]">
                          {client?.company_name ||
                            'Unknown client'}
                        </p>

                        <p className="text-[11px] text-xp-muted mt-0.5">
                          {
                            invoice.invoice_number
                          }
                        </p>

                        <p className="text-[10px] text-red-500 mt-1">
                          {daysOverdue(
                            invoice.due_date,
                          )}
                          d overdue
                        </p>
                      </div>

                      <p className="text-xs font-semibold text-red-600">
                        {formatCurrency(
                          Number(
                            invoice.balance ||
                              0,
                          ),
                        )}
                      </p>
                    </div>
                  )
                })}
            </div>
          )}
        </Card>

        {/* Upcoming */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock
              size={15}
              className="text-xp-purple"
            />

            <h3 className="text-sm font-semibold text-[#111]">
              Upcoming (7 days)
            </h3>
          </div>

          <div className="space-y-3">
            {pendingInvoices
              .slice(0, 2)
              .map((invoice) => {
                const client =
                  clients.find(
                    (item) =>
                      item.id ===
                      invoice.client_id,
                  )

                return (
                  <div
                    key={invoice.id}
                    onClick={() =>
                      navigate(
                        `/invoices/${invoice.id}`,
                      )
                    }
                    className="flex items-start justify-between p-3 bg-xp-off-white border border-xp-border rounded-lg cursor-pointer hover:bg-xp-light-gray transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#111]">
                        {client?.company_name ||
                          'Unknown client'}
                      </p>

                      <p className="text-[11px] text-xp-muted mt-0.5">
                        {
                          invoice.invoice_number
                        }
                      </p>

                      <p className="text-[10px] text-xp-purple mt-1">
                        Due{' '}
                        {formatDate(
                          invoice.due_date,
                          'dd MMM',
                        )}
                      </p>
                    </div>

                    <p className="text-xs font-semibold text-[#111]">
                      {formatCurrency(
                        Number(
                          invoice.balance ||
                            0,
                        ),
                      )}
                    </p>
                  </div>
                )
              })}

            {dueSoonSubs.map(
              (subscription) => {
                const client =
                  clients.find(
                    (item) =>
                      item.id ===
                      subscription.client_id,
                  )

                return (
                  <div
                    key={subscription.id}
                    className="flex items-start justify-between p-3 bg-xp-off-white border border-xp-border rounded-lg"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#111]">
                        {client?.company_name ||
                          'Unknown client'}
                      </p>

                      <p className="text-[11px] text-xp-muted mt-0.5">
                        Subscription renewal
                      </p>

                      <p className="text-[10px] text-xp-purple mt-1">
                        Due{' '}
                        {formatDate(
                          subscription.next_payment,
                          'dd MMM',
                        )}
                      </p>
                    </div>

                    <p className="text-xs font-semibold text-xp-purple">
                      {formatCurrency(
                        Number(
                          subscription.amount ||
                            0,
                        ),
                      )}
                    </p>
                  </div>
                )
              },
            )}

            {pendingInvoices.length ===
              0 &&
              dueSoonSubs.length ===
                0 && (
                <p className="text-xs text-xp-muted text-center py-4">
                  No upcoming payments.
                </p>
              )}
          </div>
        </Card>

        {/* Business Snapshot */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-[#111] mb-4">
            Business Snapshot
          </h3>

          <div className="space-y-4">
            {[
              {
                label: 'Active Clients',
                value: activeClients,
                icon: Users,
                to: '/clients',
              },
              {
                label: 'Active Projects',
                value: activeProjects,
                icon: Briefcase,
                to: '/projects',
              },
              {
                label: 'Pending Invoices',
                value:
                  pendingInvoiceCount,
                icon: FileText,
                to: '/invoices',
              },
              {
                label: 'Pending Salaries',
                value:
                  pendingSalaries.length,
                icon: CreditCard,
                to: '/salaries',
              },
            ].map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.label}
                  onClick={() =>
                    navigate(item.to)
                  }
                  className="flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-xp-light-gray flex items-center justify-center group-hover:bg-xp-light-purple transition-colors">
                      <Icon
                        size={14}
                        className="text-xp-muted group-hover:text-xp-purple transition-colors"
                      />
                    </div>

                    <span className="text-sm text-xp-muted">
                      {item.label}
                    </span>
                  </div>

                  <span className="text-sm font-semibold text-[#111]">
                    {item.value}
                  </span>
                </div>
              )
            })}
          </div>

          {pendingSalaries.length >
            0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-xs text-amber-700 font-medium">
                {
                  pendingSalaries.length
                }{' '}
                salary payment
                {pendingSalaries.length !==
                1
                  ? 's'
                  : ''}{' '}
                pending.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Projects */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#111]">
            Recent Projects
          </h3>

          <button
            type="button"
            onClick={() =>
              navigate('/projects')
            }
            className="text-xs text-xp-purple hover:text-xp-deep-purple font-medium"
          >
            View all
          </button>
        </div>

        {recentProjects.length ===
        0 ? (
          <div className="py-8 text-center">
            <Briefcase
              size={22}
              className="mx-auto text-xp-muted mb-2"
            />

            <p className="text-xs text-xp-muted">
              No projects available yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentProjects.map(
              (project) => {
                const client =
                  clients.find(
                    (item) =>
                      item.id ===
                      project.client_id,
                  )

                const progress = Math.min(
                  100,
                  Math.max(
                    0,
                    Number(
                      project.progress ||
                        0,
                    ),
                  ),
                )

                return (
                  <div
                    key={project.id}
                    onClick={() =>
                      navigate(
                        `/projects/${project.id}`,
                      )
                    }
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-xp-off-white cursor-pointer transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-xp-light-gray flex items-center justify-center shrink-0 group-hover:bg-xp-light-purple transition-colors">
                      <Briefcase
                        size={14}
                        className="text-xp-muted group-hover:text-xp-purple transition-colors"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111] truncate">
                        {
                          project.project_name
                        }
                      </p>

                      <p className="text-xs text-xp-muted truncate">
                        {client?.company_name ||
                          'Unknown client'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-medium text-[#111]">
                          {progress}%
                        </p>

                        <div className="w-16 h-1 bg-xp-light-gray rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-xp-purple rounded-full"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      </div>

                      <Badge
                        variant={
                          statusVariants[
                            project.status
                          ] || 'muted'
                        }
                      >
                        {
                          project.status
                        }
                      </Badge>
                    </div>
                  </div>
                )
              },
            )}
          </div>
        )}
      </Card>
    </div>
  )
}