
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Receipt,
  RefreshCw,
  Wallet,
  Banknote,
  FolderKanban,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
  isValid,
  startOfDay,
} from 'date-fns'

import { useData } from '../../contexts/DataContext'
import { PageHeader, Card, Badge } from '../../components/ui'

type CalendarEventType =
  | 'invoice'
  | 'subscription'
  | 'expense'
  | 'salary'
  | 'project'

type CalendarEvent = {
  date: string
  label: string
  type: CalendarEventType
  id: string
  amount?: number
  secondaryLabel?: string
}

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  invoice: 'Invoice Due',
  subscription: 'Subscription',
  expense: 'Expense',
  salary: 'Salary',
  project: 'Project',
}

const EVENT_TYPE_STYLES: Record<CalendarEventType, string> = {
  invoice: 'bg-xp-purple text-white',
  subscription: 'bg-[#111] text-white',
  expense: 'bg-amber-500 text-white',
  salary: 'bg-emerald-500 text-white',
  project: 'bg-blue-500 text-white',
}

const BADGE_VARIANTS: Record<
  CalendarEventType,
  'purple' | 'default' | 'warning' | 'success'
> = {
  invoice: 'purple',
  subscription: 'default',
  expense: 'warning',
  salary: 'success',
  project: 'default',
}

function parseEventDate(value: string | null | undefined): Date | null {
  if (!value) return null

  const date = parseISO(value)

  return isValid(date) ? date : null
}

function formatAmount(
  amount: number | undefined,
  currencySymbol: string
): string {
  if (amount === undefined || !Number.isFinite(amount)) return ''

  return `${currencySymbol} ${amount.toLocaleString()}`
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const navigate = useNavigate()

  const {
    invoices,
    subscriptions,
    expenses,
    salaries,
    projects,
    projectMilestones,
    settings,
  } = useData()

  const currencySymbol = settings?.currency_symbol || settings?.currency || ''

  /*
   * Build all calendar events from real application data.
   *
   * No mock data is used here.
   */
  const events = useMemo<CalendarEvent[]>(() => {
    const calendarEvents: CalendarEvent[] = []

    // ---------------------------------------------------------
    // Invoice due dates
    // ---------------------------------------------------------
    invoices.forEach((invoice) => {
      const dueDate = parseEventDate(invoice.due_date)

      if (!dueDate) return

      const balance = Number(invoice.balance ?? 0)

      if (balance <= 0) return

      calendarEvents.push({
        date: invoice.due_date,
        label: `Invoice ${invoice.invoice_number}`,
        type: 'invoice',
        id: invoice.id,
        amount: balance,
      })
    })

    // ---------------------------------------------------------
    // Subscription renewal dates
    // ---------------------------------------------------------
    subscriptions.forEach((subscription) => {
      if (subscription.status === 'Cancelled') return

      const nextPayment = parseEventDate(subscription.next_payment)

      if (!nextPayment) return

      calendarEvents.push({
        date: subscription.next_payment,
        label: 'Subscription renewal',
        type: 'subscription',
        id: subscription.id,
        amount: Number(subscription.amount ?? 0),
      })
    })

    // ---------------------------------------------------------
    // Recurring expense dates
    // ---------------------------------------------------------
    expenses.forEach((expense) => {
      if (!expense.recurring || !expense.next_payment) return

      const nextPayment = parseEventDate(expense.next_payment)

      if (!nextPayment) return

      calendarEvents.push({
        date: expense.next_payment,
        label: expense.description,
        type: 'expense',
        id: expense.id,
        amount: Number(expense.amount ?? 0),
      })
    })

      // ---------------------------------------------------------
    // Salary payment dates
    // ---------------------------------------------------------
    salaries.forEach((salary) => {
      if (salary.status === 'Paid') return

      const salaryDate = parseEventDate(salary.payment_date)

      if (!salaryDate) return

      calendarEvents.push({
        date: format(salaryDate, 'yyyy-MM-dd'),
        label: 'Salary payment',
        type: 'salary',
        id: salary.id,
        amount: Number(salary.net_salary ?? 0),
      })
    })
    // ---------------------------------------------------------
    // Project milestone dates
    // ---------------------------------------------------------
    projectMilestones.forEach((milestone) => {
      const milestoneDate = parseEventDate(milestone.due_date)

      if (!milestoneDate) return

      if (milestone.status === 'Paid') return

      const project = projects.find(
        (item) => item.id === milestone.project_id
      )

      calendarEvents.push({
        date: milestone.due_date,
        label: milestone.label,
        type: 'project',
        id: milestone.id,
        amount: Number(milestone.amount ?? 0),
        secondaryLabel: project?.project_name,
      })
    })

    return calendarEvents.sort((a, b) => {
      const dateA = parseEventDate(a.date)?.getTime() ?? 0
      const dateB = parseEventDate(b.date)?.getTime() ?? 0

      return dateA - dateB
    })
  }, [
    invoices,
    subscriptions,
    expenses,
    salaries,
    projects,
    projectMilestones,
  ])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  const days = eachDayOfInterval({
    start: monthStart,
    end: monthEnd,
  })

  /*
   * Sunday = 0, Monday = 1, etc.
   * The calendar starts on Sunday.
   */
  const startDay = monthStart.getDay()

  const blanks = Array.from({ length: startDay })

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((event) => {
      const eventDate = parseEventDate(event.date)

      if (!eventDate) return false

      return isSameDay(eventDate, day)
    })
  }

  /*
   * Only future events are shown in the upcoming list.
   */
  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date())

    return events
      .filter((event) => {
        const eventDate = parseEventDate(event.date)

        if (!eventDate) return false

        return eventDate >= today
      })
      .sort((a, b) => {
        const dateA = parseEventDate(a.date)?.getTime() ?? 0
        const dateB = parseEventDate(b.date)?.getTime() ?? 0

        return dateA - dateB
      })
      .slice(0, 8)
  }, [events])

  const handleEventClick = (event: CalendarEvent) => {
    switch (event.type) {
      case 'invoice':
        navigate(`/invoices/${event.id}`)
        break

      case 'expense':
        navigate('/expenses')
        break

      case 'subscription':
        navigate('/subscriptions')
        break

      case 'salary':
        navigate('/salaries')
        break

      case 'project':
        /*
         * projectMilestone.id is used for the calendar event.
         * Find its parent project before navigating.
         */
        {
          const milestone = projectMilestones.find(
            (item) => item.id === event.id
          )

          if (milestone) {
            navigate(`/projects/${milestone.project_id}`)
          } else {
            navigate('/projects')
          }
        }
        break

      default:
        break
    }
  }

  return (
    <div>
      <PageHeader
        title="Business Calendar"
        subtitle="Payment deadlines, renewals, salaries, expenses, and project milestones"
      />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* =====================================================
            CALENDAR
        ====================================================== */}
        <div className="lg:col-span-2">
          <Card className="p-5">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#111]">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() =>
                    setCurrentMonth((date) => subMonths(date, 1))
                  }
                  className="p-1.5 rounded-md text-xp-muted hover:bg-xp-light-gray transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-2.5 py-1 text-xs font-medium text-xp-muted hover:bg-xp-light-gray rounded-md transition-colors"
                >
                  Today
                </button>

                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() =>
                    setCurrentMonth((date) => addMonths(date, 1))
                  }
                  className="p-1.5 rounded-md text-xp-muted hover:bg-xp-light-gray transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                (day) => (
                  <div
                    key={day}
                    className="text-center text-[10px] font-bold text-xp-muted uppercase tracking-wider py-1"
                  >
                    {day}
                  </div>
                )
              )}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {blanks.map((_, index) => (
                <div
                  key={`blank-${index}`}
                  className="aspect-square"
                  aria-hidden="true"
                />
              ))}

              {days.map((day) => {
                const dayEvents = getEventsForDay(day)
                const isToday = isSameDay(day, new Date())

                return (
                  <div
                    key={day.toISOString()}
                    className={`
                      aspect-square
                      min-h-18
                      p-1
                      rounded-lg
                      transition-colors
                      overflow-hidden
                      ${
                        isToday
                          ? 'bg-xp-light-purple'
                          : 'hover:bg-xp-off-white'
                      }
                    `}
                  >
                    <p
                      className={`
                        text-xs
                        font-medium
                        mb-0.5
                        ${
                          isToday
                            ? 'text-xp-purple'
                            : isSameMonth(day, currentMonth)
                              ? 'text-[#111]'
                              : 'text-[#c4c4c4]'
                        }
                      `}
                    >
                      {format(day, 'd')}
                    </p>

                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <button
                          key={`${event.type}-${event.id}`}
                          type="button"
                          title={`${event.label}${
                            event.amount !== undefined
                              ? ` — ${formatAmount(
                                  event.amount,
                                  currencySymbol
                                )}`
                              : ''
                          }`}
                          onClick={() => handleEventClick(event)}
                          className={`
                            block
                            w-full
                            text-left
                            text-[8px]
                            px-1
                            py-0.5
                            rounded
                            font-medium
                            truncate
                            cursor-pointer
                            transition-opacity
                            hover:opacity-80
                            ${EVENT_TYPE_STYLES[event.type]}
                          `}
                        >
                          {event.label.slice(0, 16)}
                        </button>
                      ))}

                      {dayEvents.length > 2 && (
                        <p className="text-[8px] text-xp-muted px-1">
                          +{dayEvents.length - 2} more
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-xp-light-gray">
              {(Object.keys(EVENT_TYPE_LABELS) as CalendarEventType[]).map(
                (type) => (
                  <div
                    key={type}
                    className="flex items-center gap-1.5"
                  >
                    <div
                      className={`
                        w-2.5
                        h-2.5
                        rounded-full
                        ${EVENT_TYPE_STYLES[type]}
                      `}
                    />

                    <span className="text-xs text-xp-muted">
                      {EVENT_TYPE_LABELS[type]}
                    </span>
                  </div>
                )
              )}
            </div>
          </Card>
        </div>

        {/* =====================================================
            UPCOMING EVENTS
        ====================================================== */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#111]">
                Upcoming Events
              </h3>

              <p className="text-xs text-xp-muted mt-0.5">
                Next scheduled business events
              </p>
            </div>

            <CalendarDays
              size={18}
              className="text-xp-muted"
            />
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CalendarDays
                size={28}
                className="text-xp-muted mb-3"
              />

              <p className="text-sm font-medium text-[#111]">
                No upcoming events
              </p>

              <p className="text-xs text-xp-muted mt-1">
                Your upcoming business deadlines will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const date = parseEventDate(event.date)

                if (!date) return null

                return (
                  <button
                    key={`${event.type}-${event.id}`}
                    type="button"
                    onClick={() => handleEventClick(event)}
                    className="
                      w-full
                      text-left
                      flex
                      items-start
                      gap-3
                      p-3
                      rounded-lg
                      hover:bg-xp-off-white
                      cursor-pointer
                      transition-colors
                      border
                      border-xp-border
                    "
                  >
                    {/* Date */}
                    <div className="text-center min-w-9">
                      <p className="text-xs font-bold text-xp-purple">
                        {format(date, 'MMM').toUpperCase()}
                      </p>

                      <p className="text-lg font-bold text-[#111] leading-none">
                        {format(date, 'd')}
                      </p>

                      <p className="text-[9px] text-xp-muted mt-0.5">
                        {format(date, 'EEE')}
                      </p>
                    </div>

                    {/* Event details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111] truncate">
                        {event.label}
                      </p>

                      {event.secondaryLabel && (
                        <p className="text-xs text-xp-muted truncate mt-0.5">
                          {event.secondaryLabel}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant={BADGE_VARIANTS[event.type]}>
                          {event.type}
                        </Badge>

                        {event.amount !== undefined &&
                          Number.isFinite(event.amount) && (
                            <span className="text-xs text-xp-muted">
                              {formatAmount(
                                event.amount,
                                currencySymbol
                              )}
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Event icon */}
                    <div className="shrink-0 text-xp-muted">
                      {event.type === 'invoice' && (
                        <Receipt size={16} />
                      )}

                      {event.type === 'subscription' && (
                        <RefreshCw size={16} />
                      )}

                      {event.type === 'expense' && (
                        <Wallet size={16} />
                      )}

                      {event.type === 'salary' && (
                        <Banknote size={16} />
                      )}

                      {event.type === 'project' && (
                        <FolderKanban size={16} />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
