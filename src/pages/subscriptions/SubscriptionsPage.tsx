
import { useMemo, useState } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCcw,
  CheckCircle,
} from 'lucide-react'
import {
  addMonths,
  addQuarters,
  addYears,
  format,
  isValid,
  parseISO,
} from 'date-fns'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import { formatDate, exportCSVSimple } from '../../lib/utils'
import { generateReportPDF } from '../../lib/pdf'

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
  Textarea,
  Select,
  ExportDropdown,
} from '../../components/ui'

import type {
  Subscription,
  BillingCycle,
  SubscriptionStatus,
} from '../../types'

const BILLING_CYCLES: BillingCycle[] = [
  'Monthly',
  'Quarterly',
  'Yearly',
  'Custom',
]

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  'Active',
  'Due Soon',
  'Overdue',
  'Cancelled',
]

const statusVariant: Record<
  SubscriptionStatus,
  'success' | 'warning' | 'danger' | 'muted'
> = {
  Active: 'success',
  'Due Soon': 'warning',
  Overdue: 'danger',
  Cancelled: 'muted',
}

type SubscriptionForm = {
  client_id: string
  service_id: string
  amount: number
  billing_cycle: BillingCycle
  start_date: string
  last_payment: string | null
  next_payment: string
  status: SubscriptionStatus
  notes: string
}

const createEmptyForm = (): SubscriptionForm => ({
  client_id: '',
  service_id: '',
  amount: 0,
  billing_cycle: 'Monthly',
  start_date: new Date().toISOString().slice(0, 10),
  last_payment: null,
  next_payment: '',
  status: 'Active',
  notes: '',
})

const normalizeSearchValue = (
  value: string | null | undefined,
) => value?.trim().toLowerCase() || ''

const toDateValue = (value: string) => {
  const date = parseISO(value)

  return isValid(date) ? date : null
}

const getMonthlyRecurringAmount = (
  amount: number,
  billingCycle: BillingCycle,
): number => {
  const safeAmount = Number(amount)

  if (!Number.isFinite(safeAmount)) {
    return 0
  }

  switch (billingCycle) {
    case 'Monthly':
      return safeAmount

    case 'Quarterly':
      return safeAmount / 3

    case 'Yearly':
      return safeAmount / 12

    case 'Custom':
    default:
      return 0
  }
}

export default function SubscriptionsPage() {
  const {
    subscriptions,
    clients,
    services,
    settings,
    addSubscription,
    updateSubscription,
    deleteSubscription,
  } = useData()

  const { success, error } = useToast()

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] =
    useState<Subscription | null>(null)

  const [form, setForm] =
    useState<SubscriptionForm>(
      createEmptyForm(),
    )

  const [deleteId, setDeleteId] =
    useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] =
    useState(false)

  const [markingPaidId, setMarkingPaidId] =
    useState<string | null>(null)

  /*
   * Currency comes from company settings.
   * Falls back to LKR only if settings are
   * not available yet.
   */
  const currency =
    settings?.currency_symbol ||
    settings?.currency ||
    'LKR'

  /*
   * Calculate MRR from all active
   * subscriptions.
   *
   * Monthly  = amount
   * Quarterly = amount / 3
   * Yearly = amount / 12
   * Custom = excluded because the current
   * Subscription model does not store a
   * custom interval.
   */
  const mrr = useMemo(() => {
    return subscriptions
      .filter(
        (subscription) =>
          subscription.status !== 'Cancelled',
      )
      .reduce(
        (total, subscription) =>
          total +
          getMonthlyRecurringAmount(
            Number(subscription.amount || 0),
            subscription.billing_cycle,
          ),
        0,
      )
  }, [subscriptions])

  const arr = useMemo(
    () => mrr * 12,
    [mrr],
  )

  const activeCount = useMemo(
    () =>
      subscriptions.filter(
        (subscription) =>
          subscription.status === 'Active',
      ).length,
    [subscriptions],
  )

  /*
   * Search subscriptions by:
   * - Subscription ID
   * - Client
   * - Service
   * - Billing cycle
   * - Status
   */
  const filtered = useMemo(() => {
    const query =
      normalizeSearchValue(search)

    if (!query) {
      return subscriptions
    }

    return subscriptions.filter(
      (subscription) => {
        const client = clients.find(
          (item) =>
            item.id ===
            subscription.client_id,
        )

        const service = services.find(
          (item) =>
            item.id ===
            subscription.service_id,
        )

        const searchableValues = [
          subscription.subscription_id,
          client?.company_name,
          service?.name,
          subscription.billing_cycle,
          subscription.status,
          subscription.notes,
        ]

        return searchableValues.some(
          (value) =>
            normalizeSearchValue(value).includes(
              query,
            ),
        )
      },
    )
  }, [
    subscriptions,
    clients,
    services,
    search,
  ])

  /*
   * Open new subscription form.
   */
  const openNew = () => {
    setEditing(null)
    setForm(createEmptyForm())
    setShowModal(true)
  }

  /*
   * Open edit form.
   */
  const openEdit = (
    subscription: Subscription,
  ) => {
    setEditing(subscription)

    setForm({
      client_id:
        subscription.client_id,
      service_id:
        subscription.service_id,
      amount: Number(
        subscription.amount || 0,
      ),
      billing_cycle:
        subscription.billing_cycle,
      start_date:
        subscription.start_date,
      last_payment:
        subscription.last_payment,
      next_payment:
        subscription.next_payment,
      status: subscription.status,
      notes: subscription.notes || '',
    })

    setShowModal(true)
  }

  /*
   * Close add/edit modal.
   */
  const closeModal = () => {
    if (saving) {
      return
    }

    setShowModal(false)
    setEditing(null)
    setForm(createEmptyForm())
  }

  /*
   * Generic typed form updater.
   */
  const updateForm = <
    K extends keyof SubscriptionForm,
  >(
    key: K,
    value: SubscriptionForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  /*
   * Validate and save subscription.
   */
  const handleSave = async () => {
    const amount = Number(form.amount)

    if (!form.client_id) {
      error('Please select a client.')
      return
    }

    if (!form.service_id) {
      error('Please select a service.')
      return
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      error(
        'Subscription amount must be greater than zero.',
      )
      return
    }

    if (!form.billing_cycle) {
      error(
        'Please select a billing cycle.',
      )
      return
    }

    if (!form.start_date) {
      error('Please select a start date.')
      return
    }

    if (!form.next_payment) {
      error(
        'Please select the next payment date.',
      )
      return
    }

    const startDate = toDateValue(
      form.start_date,
    )

    const nextPaymentDate = toDateValue(
      form.next_payment,
    )

    if (!startDate) {
      error('Start date is invalid.')
      return
    }

    if (!nextPaymentDate) {
      error(
        'Next payment date is invalid.',
      )
      return
    }

    if (
      form.last_payment &&
      !toDateValue(form.last_payment)
    ) {
      error(
        'Last payment date is invalid.',
      )
      return
    }

    const subscriptionData: SubscriptionForm =
      {
        client_id: form.client_id,
        service_id: form.service_id,
        amount,
        billing_cycle:
          form.billing_cycle,
        start_date:
          form.start_date,
        last_payment:
          form.last_payment || null,
        next_payment:
          form.next_payment,
        status: form.status,
        notes: form.notes.trim(),
      }

    setSaving(true)

    try {
      if (editing) {
        await updateSubscription(
          editing.id,
          subscriptionData,
        )

        success(
          'Subscription updated successfully.',
        )
      } else {
        await addSubscription(
          subscriptionData,
        )

        success(
          'Subscription created successfully.',
        )
      }

      setShowModal(false)
      setEditing(null)
      setForm(createEmptyForm())
    } catch (err) {
      console.error(
        'Failed to save subscription:',
        err,
      )

      const message =
        err instanceof Error
          ? err.message
          : editing
            ? 'Failed to update subscription. Please try again.'
            : 'Failed to create subscription. Please try again.'

      error(message)
    } finally {
      setSaving(false)
    }
  }

  /*
   * Calculate the next payment date
   * from the actual payment date.
   */
  const calculateNextPayment = (
    subscription: Subscription,
    paymentDate: string,
  ): string | null => {
    const baseDate =
      toDateValue(paymentDate)

    if (!baseDate) {
      return null
    }

    let nextDate: Date

    switch (
      subscription.billing_cycle
    ) {
      case 'Monthly':
        nextDate = addMonths(
          baseDate,
          1,
        )
        break

      case 'Quarterly':
        nextDate = addQuarters(
          baseDate,
          1,
        )
        break

      case 'Yearly':
        nextDate = addYears(
          baseDate,
          1,
        )
        break

      case 'Custom':
      default:
        /*
         * Custom intervals are not represented
         * in the current Subscription type.
         */
        return null
    }

    return format(
      nextDate,
      'yyyy-MM-dd',
    )
  }

  /*
   * Mark subscription as paid.
   */
  const handleMarkPaid = async (
    subscription: Subscription,
  ) => {
    if (
      subscription.status === 'Cancelled'
    ) {
      error(
        'Cancelled subscriptions cannot be marked as paid.',
      )
      return
    }

    const today = new Date()
      .toISOString()
      .slice(0, 10)

    const nextPayment =
      calculateNextPayment(
        subscription,
        today,
      )

    if (!nextPayment) {
      error(
        'The next payment date could not be calculated for this billing cycle.',
      )
      return
    }

    setMarkingPaidId(subscription.id)

    try {
      await updateSubscription(
        subscription.id,
        {
          last_payment: today,
          next_payment: nextPayment,
          status: 'Active',
        },
      )

      success(
        `Subscription marked as paid. Next payment: ${formatDate(
          nextPayment,
        )}`,
      )
    } catch (err) {
      console.error(
        'Failed to mark subscription as paid:',
        err,
      )

      const message =
        err instanceof Error
          ? err.message
          : 'Failed to mark subscription as paid.'

      error(message)
    } finally {
      setMarkingPaidId(null)
    }
  }

  /*
   * Delete subscription.
   */
  const handleDelete = async () => {
    if (!deleteId) {
      return
    }

    setDeleting(true)

    try {
      await deleteSubscription(deleteId)

      success(
        'Subscription deleted successfully.',
      )

      setDeleteId(null)
    } catch (err) {
      console.error(
        'Failed to delete subscription:',
        err,
      )

      const message =
        err instanceof Error
          ? err.message
          : 'Failed to delete subscription. Please try again.'

      error(message)
    } finally {
      setDeleting(false)
    }
  }

  const handleExportPDF = () => {
    if (filtered.length === 0) {
      error('No subscriptions to export.')
      return
    }

    try {
      generateReportPDF(
        'Subscriptions Register',
        `Showing ${filtered.length} subscription${filtered.length !== 1 ? 's' : ''}`,
        ['ID', 'Client', 'Service', 'Amount', 'Billing Cycle', 'Next Payment', 'Status'],
        filtered.map((sub) => {
          const client = clients.find((c) => c.id === sub.client_id)
          const service = services.find((s) => s.id === sub.service_id)
          return [
            sub.subscription_id,
            client?.company_name || '—',
            service?.name || '—',
            `${currency} ${Number(sub.amount || 0).toLocaleString()}`,
            sub.billing_cycle,
            sub.next_payment ? formatDate(sub.next_payment) : '—',
            sub.status,
          ]
        }),
        [
          { label: 'Monthly Recurring Revenue (MRR)', value: `${currency} ${Math.round(mrr).toLocaleString()}` },
          { label: 'Annual Recurring Revenue (ARR)', value: `${currency} ${Math.round(arr).toLocaleString()}` },
          { label: 'Active Subscriptions', value: `${activeCount}` },
        ],
        settings
      )
      success(`Exported ${filtered.length} subscription${filtered.length !== 1 ? 's' : ''} to PDF.`)
    } catch (err) {
      console.error('Failed to export subscriptions PDF:', err)
      error('Failed to generate subscriptions PDF.')
    }
  }

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      error('No subscriptions to export.')
      return
    }

    try {
      exportCSVSimple(
        'subscriptions',
        ['ID', 'Client', 'Service', 'Amount', 'Billing Cycle', 'Start Date', 'Last Payment', 'Next Payment', 'Status', 'Notes'],
        filtered.map((sub) => {
          const client = clients.find((c) => c.id === sub.client_id)
          const service = services.find((s) => s.id === sub.service_id)
          return {
            id: sub.subscription_id,
            client: client?.company_name || '',
            service: service?.name || '',
            amount: Number(sub.amount || 0),
            billing_cycle: sub.billing_cycle,
            start_date: sub.start_date,
            last_payment: sub.last_payment || '',
            next_payment: sub.next_payment,
            status: sub.status,
            notes: sub.notes || '',
          }
        })
      )
      success(`Exported ${filtered.length} subscription${filtered.length !== 1 ? 's' : ''} to CSV.`)
    } catch (err) {
      console.error('Failed to export subscriptions CSV:', err)
      error('Failed to export subscriptions CSV.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle={`${currency} ${Math.round(
          mrr,
        ).toLocaleString()} monthly recurring revenue`}
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
              onClick={openNew}
            >
              New Subscription
            </Button>
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            MRR
          </p>

          <p className="text-xl font-semibold text-xp-purple">
            {currency}{' '}
            {Math.round(
              mrr,
            ).toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            ARR
          </p>

          <p className="text-xl font-semibold text-[#111]">
            {currency}{' '}
            {Math.round(
              arr,
            ).toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Active
          </p>

          <p className="text-xl font-semibold text-[#111]">
            {activeCount}
          </p>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search subscriptions..."
          className="w-64"
        />

        <span className="text-xs text-xp-muted ml-auto">
          {filtered.length} results
        </span>
      </div>

      {/* Subscription table */}
      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={
              search
                ? 'No matching subscriptions'
                : 'No subscriptions'
            }
            description={
              search
                ? 'Try changing your search.'
                : 'Create your first recurring revenue subscription.'
            }
            action={
              search
                ? undefined
                : {
                    label:
                      'New Subscription',
                    onClick: openNew,
                  }
            }
            icon={RefreshCcw}
          />
        ) : (
          <Table
            headers={[
              'Client',
              'Service',
              'Amount',
              'Cycle',
              'Last Payment',
              'Next Payment',
              'Status',
              'Actions',
            ]}
          >
            {filtered.map(
              (subscription) => {
                const client =
                  clients.find(
                    (item) =>
                      item.id ===
                      subscription.client_id,
                  )

                const service =
                  services.find(
                    (item) =>
                      item.id ===
                      subscription.service_id,
                  )

                const isMarkingPaid =
                  markingPaidId ===
                  subscription.id

                return (
                  <TableRow
                    key={subscription.id}
                  >
                    <Td>
                      <div>
                        <span className="font-medium text-[#111]">
                          {client?.company_name ||
                            '—'}
                        </span>

                        <p className="text-xs text-xp-muted font-mono mt-0.5">
                          {
                            subscription.subscription_id
                          }
                        </p>
                      </div>
                    </Td>

                    <Td>
                      <span className="text-sm text-xp-muted">
                        {service?.name || '—'}
                      </span>
                    </Td>

                    <Td>
                      <span className="text-sm font-semibold text-[#111]">
                        {currency}{' '}
                        {Number(
                          subscription.amount ||
                            0,
                        ).toLocaleString()}
                      </span>
                    </Td>

                    <Td>
                      <Badge variant="muted">
                        {
                          subscription.billing_cycle
                        }
                      </Badge>
                    </Td>

                    <Td>
                      <span className="text-sm text-xp-muted">
                        {subscription.last_payment
                          ? formatDate(
                              subscription.last_payment,
                            )
                          : '—'}
                      </span>
                    </Td>

                    <Td>
                      <span
                        className={`text-sm font-medium ${
                          subscription.status ===
                          'Overdue'
                            ? 'text-red-500'
                            : subscription.status ===
                                'Due Soon'
                              ? 'text-amber-600'
                              : 'text-[#111]'
                        }`}
                      >
                        {subscription.next_payment
                          ? formatDate(
                              subscription.next_payment,
                            )
                          : '—'}
                      </span>
                    </Td>

                    <Td>
                      <Badge
                        variant={
                          statusVariant[
                            subscription.status
                          ]
                        }
                      >
                        {subscription.status}
                      </Badge>
                    </Td>

                    <Td>
                      <div className="flex items-center gap-1">
                        {(subscription.status ===
                          'Due Soon' ||
                          subscription.status ===
                            'Overdue') && (
                          <button
                            type="button"
                            onClick={() =>
                              handleMarkPaid(
                                subscription,
                              )
                            }
                            disabled={
                              isMarkingPaid
                            }
                            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Mark as paid"
                          >
                            <CheckCircle
                              size={13}
                            />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            openEdit(
                              subscription,
                            )
                          }
                          disabled={
                            isMarkingPaid
                          }
                          className="p-1.5 rounded-md text-xp-muted hover:text-[#111] hover:bg-xp-light-gray disabled:opacity-50"
                          title="Edit subscription"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDeleteId(
                              subscription.id,
                            )
                          }
                          disabled={
                            isMarkingPaid
                          }
                          className="p-1.5 rounded-md text-xp-muted hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Delete subscription"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </Td>
                  </TableRow>
                )
              },
            )}
          </Table>
        )}
      </Card>

      {/* Add / Edit Subscription */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={
          editing
            ? 'Edit Subscription'
            : 'New Subscription'
        }
        width="max-w-lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
            >
              {editing
                ? 'Save Changes'
                : 'Create'}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <Select
            label="Client"
            value={form.client_id}
            onChange={(event) =>
              updateForm(
                'client_id',
                event.target.value,
              )
            }
            options={clients.map(
              (client) => ({
                value: client.id,
                label:
                  client.company_name,
              }),
            )}
            placeholder="Select client"
          />

          <Select
            label="Service"
            value={form.service_id}
            onChange={(event) =>
              updateForm(
                'service_id',
                event.target.value,
              )
            }
            options={services.map(
              (service) => ({
                value: service.id,
                label: service.name,
              }),
            )}
            placeholder="Select service"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Amount (${currency})`}
              type="number"
              value={
                form.amount === 0
                  ? ''
                  : form.amount
              }
              onChange={(event) =>
                updateForm(
                  'amount',
                  Number(
                    event.target.value,
                  ),
                )
              }
              placeholder="0.00"
              min="0"
              step="0.01"
            />

            <Select
              label="Billing Cycle"
              value={form.billing_cycle}
              onChange={(event) =>
                updateForm(
                  'billing_cycle',
                  event.target
                    .value as BillingCycle,
                )
              }
              options={BILLING_CYCLES.map(
                (cycle) => ({
                  value: cycle,
                  label: cycle,
                }),
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(event) =>
                updateForm(
                  'start_date',
                  event.target.value,
                )
              }
            />

            <Input
              label="Next Payment"
              type="date"
              value={form.next_payment}
              onChange={(event) =>
                updateForm(
                  'next_payment',
                  event.target.value,
                )
              }
            />
          </div>

          <Select
            label="Status"
            value={form.status}
            onChange={(event) =>
              updateForm(
                'status',
                event.target
                  .value as SubscriptionStatus,
              )
            }
            options={SUBSCRIPTION_STATUSES.map(
              (status) => ({
                value: status,
                label: status,
              }),
            )}
          />

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(event) =>
              updateForm(
                'notes',
                event.target.value,
              )
            }
            placeholder="Notes..."
          />
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteId}
        onClose={() =>
          deleting
            ? undefined
            : setDeleteId(null)
        }
        title="Delete Subscription"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteId(null)
              }
              disabled={deleting}
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="p-6">
          <p className="text-sm text-xp-muted">
            This subscription will be
            permanently deleted. This action
            cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  )
}
