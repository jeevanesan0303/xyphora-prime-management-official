
import { useMemo, useState } from 'react'
import {
  Plus,
  Download,
  Edit2,
  Trash2,
  Receipt,
} from 'lucide-react'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import {
  formatDate,
  exportCSVSimple,
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
  Modal,
  Input,
  Textarea,
  Select,
  Checkbox,
  ExportDropdown,
} from '../../components/ui'
import { generateReportPDF } from '../../lib/pdf'

import type {
  Expense,
  PaymentMethod,
  ExpenseFrequency,
} from '../../types'

const categories = [
  'Salary',
  'Hosting',
  'Domain',
  'Software',
  'SaaS',
  'Marketing',
  'Advertising',
  'Office',
  'Internet',
  'Transportation',
  'Equipment',
  'Client Expense',
  'Development',
  'Other',
]

const paymentMethods: PaymentMethod[] = [
  'Bank Transfer',
  'Cash',
  'Card',
  'Online Payment',
  'Other',
]

const frequencies: ExpenseFrequency[] = [
  'Monthly',
  'Quarterly',
  'Yearly',
  'Custom',
]

type ExpenseForm = Omit<
  Expense,
  'id' | 'expense_id' | 'created_at'
>

const createEmptyForm = (): ExpenseForm => ({
  date: new Date()
    .toISOString()
    .slice(0, 10),

  category: 'Software',

  description: '',

  amount: 0,

  payment_method:
    'Bank Transfer',

  recurring: false,

  frequency: null,

  next_payment: null,

  last_paid: null,

  vendor: '',

  notes: '',
})

function isValidDate(value: string) {
  if (!value) {
    return false
  }

  const date = new Date(value)

  return !Number.isNaN(
    date.getTime(),
  )
}

export default function ExpensesPage() {
  const {
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    settings,
  } = useData()

  const {
    success,
    error,
  } = useToast()

  const [search, setSearch] =
    useState('')

  const [catFilter, setCatFilter] =
    useState('')

  const [showModal, setShowModal] =
    useState(false)

  const [editing, setEditing] =
    useState<Expense | null>(null)

  const [form, setForm] =
    useState<ExpenseForm>(
      createEmptyForm(),
    )

  const [deleteId, setDeleteId] =
    useState<string | null>(null)

  const [saving, setSaving] =
    useState(false)

  const [deleting, setDeleting] =
    useState(false)

  const currency =
    settings?.currency_symbol ||
    settings?.currency ||
    'LKR'

  /*
   * ---------------------------------------------------------
   * FILTERED EXPENSES
   * ---------------------------------------------------------
   */

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase()

    return expenses.filter(
      (expense) => {
        const description =
          expense.description
            ?.toLowerCase() || ''

        const vendor =
          expense.vendor
            ?.toLowerCase() || ''

        const expenseId =
          expense.expense_id
            ?.toLowerCase() || ''

        const category =
          expense.category
            ?.toLowerCase() || ''

        const method =
          expense.payment_method
            ?.toLowerCase() || ''

        const matchesSearch =
          !query ||
          description.includes(
            query,
          ) ||
          vendor.includes(query) ||
          expenseId.includes(query) ||
          category.includes(query) ||
          method.includes(query)

        const matchesCategory =
          !catFilter ||
          expense.category ===
            catFilter

        return (
          matchesSearch &&
          matchesCategory
        )
      },
    )
  }, [
    expenses,
    search,
    catFilter,
  ])

  /*
   * ---------------------------------------------------------
   * FILTERED TOTAL
   * ---------------------------------------------------------
   */

  const totalExpenses =
    useMemo(
      () =>
        filtered.reduce(
          (sum, expense) =>
            sum +
            Number(
              expense.amount || 0,
            ),
          0,
        ),
      [filtered],
    )

  /*
   * ---------------------------------------------------------
   * OPEN NEW
   * ---------------------------------------------------------
   */

  const openNew = () => {
    setEditing(null)

    setForm(
      createEmptyForm(),
    )

    setShowModal(true)
  }

  /*
   * ---------------------------------------------------------
   * OPEN EDIT
   * ---------------------------------------------------------
   */

  const openEdit = (
    expense: Expense,
  ) => {
    setEditing(expense)

    setForm({
      date: expense.date || '',

      category:
        expense.category ||
        'Other',

      description:
        expense.description ||
        '',

      amount: Number(
        expense.amount || 0,
      ),

      payment_method:
        expense.payment_method ||
        'Bank Transfer',

      recurring:
        Boolean(
          expense.recurring,
        ),

      frequency:
        expense.recurring
          ? expense.frequency
          : null,

      next_payment:
        expense.recurring
          ? expense.next_payment
          : null,

      last_paid:
        expense.last_paid ||
        null,

      vendor:
        expense.vendor || '',

      notes:
        expense.notes || '',
    })

    setShowModal(true)
  }

  /*
   * ---------------------------------------------------------
   * CLOSE MODAL
   * ---------------------------------------------------------
   */

  const closeModal = () => {
    if (saving) {
      return
    }

    setShowModal(false)

    setEditing(null)

    setForm(
      createEmptyForm(),
    )
  }

  /*
   * ---------------------------------------------------------
   * FORM UPDATE
   * ---------------------------------------------------------
   */

  const updateForm = <
    K extends keyof ExpenseForm,
  >(
    key: K,
    value: ExpenseForm[K],
  ) => {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    )
  }

  /*
   * ---------------------------------------------------------
   * SAVE EXPENSE
   * ---------------------------------------------------------
   */

  const handleSave =
    async () => {
      const description =
        form.description.trim()

      const vendor =
        form.vendor.trim()

      const notes =
        form.notes.trim()

      const amount =
        Number(form.amount)

      /*
       * Description
       */

      if (!description) {
        error(
          'Please enter an expense description.',
        )

        return
      }

      /*
       * Date
       */

      if (
        !form.date ||
        !isValidDate(form.date)
      ) {
        error(
          'Please select a valid expense date.',
        )

        return
      }

      /*
       * Amount
       */

      if (
        !Number.isFinite(
          amount,
        ) ||
        amount <= 0
      ) {
        error(
          'Expense amount must be greater than zero.',
        )

        return
      }

      /*
       * Category
       */

      if (!form.category) {
        error(
          'Please select an expense category.',
        )

        return
      }

      /*
       * Payment method
       */

      if (
        !form.payment_method
      ) {
        error(
          'Please select a payment method.',
        )

        return
      }

      /*
       * Recurring validation
       */

      if (
        form.recurring &&
        !form.frequency
      ) {
        error(
          'Please select a recurring expense frequency.',
        )

        return
      }

      if (
        form.recurring &&
        !form.next_payment
      ) {
        error(
          'Please select the next payment date.',
        )

        return
      }

      if (
        form.recurring &&
        form.next_payment &&
        !isValidDate(
          form.next_payment,
        )
      ) {
        error(
          'Please select a valid next payment date.',
        )

        return
      }

      /*
       * If recurring is disabled,
       * remove scheduling fields.
       */

      const expenseData: ExpenseForm =
        {
          date: form.date,

          category:
            form.category,

          description,

          amount,

          payment_method:
            form.payment_method,

          recurring:
            form.recurring,

          frequency:
            form.recurring
              ? form.frequency
              : null,

          next_payment:
            form.recurring
              ? form.next_payment
              : null,

          last_paid:
            form.last_paid || null,

          vendor,

          notes,
        }

      setSaving(true)

      try {
        if (editing) {
          await updateExpense(
            editing.id,
            expenseData,
          )

          success(
            'Expense updated successfully.',
          )
        } else {
          await addExpense(
            expenseData,
          )

          success(
            'Expense added successfully.',
          )
        }

        setShowModal(false)

        setEditing(null)

        setForm(
          createEmptyForm(),
        )
      } catch (err) {
        console.error(
          'Failed to save expense:',
          err,
        )

        error(
          err instanceof Error
            ? err.message
            : editing
              ? 'Failed to update expense. Please try again.'
              : 'Failed to add expense. Please try again.',
        )
      } finally {
        setSaving(false)
      }
    }

  /*
   * ---------------------------------------------------------
   * EXPORT (PDF & CSV)
   * ---------------------------------------------------------
   */

  const handleExportPDF = () => {
    if (filtered.length === 0) {
      error('There are no expenses to export.')
      return
    }

    try {
      generateReportPDF(
        'Expenses Register',
        `Showing ${filtered.length} expense item${filtered.length !== 1 ? 's' : ''}`,
        ['ID', 'Date', 'Category', 'Description', 'Vendor', 'Method', 'Amount'],
        filtered.map((e) => [
          e.expense_id || '—',
          e.date ? formatDate(e.date) : '—',
          e.category || '—',
          e.description || '—',
          e.vendor || '—',
          e.payment_method || '—',
          `${currency} ${Number(e.amount || 0).toLocaleString()}`,
        ]),
        [
          {
            label: 'Total Expenses',
            value: `${currency} ${totalExpenses.toLocaleString()}`,
          },
        ],
        settings
      )
      success(`Exported ${filtered.length} expense${filtered.length !== 1 ? 's' : ''} to PDF.`)
    } catch (err) {
      console.error('Failed to export expenses PDF:', err)
      error('Failed to generate expenses PDF.')
    }
  }

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      error(
        'There are no expenses to export.',
      )

      return
    }

    try {
      exportCSVSimple(
        'expenses',
        [
          'ID',
          'Date',
          'Category',
          'Description',
          'Amount',
          'Method',
          'Vendor',
          'Recurring',
          'Frequency',
          'Next Payment',
        ],
        filtered.map(
          (expense) => ({
            id:
              expense.expense_id,

            date:
              expense.date,

            cat:
              expense.category,

            desc:
              expense.description,

            amt:
              Number(
                expense.amount || 0,
              ),

            method:
              expense.payment_method,

            vendor:
              expense.vendor || '',

            recurring:
              expense.recurring
                ? 'Yes'
                : 'No',

            frequency:
              expense.frequency ||
              '',

            nextPayment:
              expense.next_payment ||
              '',
          }),
        ),
      )

      success(
        'Expenses exported to CSV successfully.',
      )
    } catch (err) {
      console.error(
        'Failed to export expenses:',
        err,
      )

      error(
        'Failed to export expenses.',
      )
    }
  }

  /*
   * ---------------------------------------------------------
   * DELETE
   * ---------------------------------------------------------
   */

  const handleDelete =
    async () => {
      if (!deleteId) {
        return
      }

      setDeleting(true)

      try {
        await deleteExpense(
          deleteId,
        )

        success(
          'Expense deleted successfully.',
        )

        setDeleteId(null)
      } catch (err) {
        console.error(
          'Failed to delete expense:',
          err,
        )

        error(
          err instanceof Error
            ? err.message
            : 'Failed to delete expense. Please try again.',
        )
      } finally {
        setDeleting(false)
      }
    }

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Expenses"
        subtitle={`${currency} ${totalExpenses.toLocaleString()} total (filtered)`}
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
              icon={
                <Plus
                  size={13}
                />
              }
              onClick={openNew}
            >
              Add Expense
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search expenses..."
          className="w-64"
        />

        <select
          value={catFilter}
          onChange={(event) =>
            setCatFilter(
              event.target.value,
            )
          }
          className="h-9 px-3 rounded-lg border border-xp-border text-sm text-[#111] bg-white focus:outline-none"
        >
          <option value="">
            All Categories
          </option>

          {categories.map(
            (category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ),
          )}
        </select>

        <span className="text-xs text-xp-muted ml-auto">
          {filtered.length}{' '}
          result
          {filtered.length !==
          1
            ? 's'
            : ''}
        </span>
      </div>

      {/* Expense table */}
      <Card>
        {filtered.length ===
        0 ? (
          <EmptyState
            title={
              search ||
              catFilter
                ? 'No matching expenses'
                : 'No expenses'
            }
            description={
              search ||
              catFilter
                ? 'Try changing your search or category filter.'
                : 'Track your first expense.'
            }
            action={
              search ||
              catFilter
                ? undefined
                : {
                    label:
                      'Add Expense',
                    onClick:
                      openNew,
                  }
            }
            icon={Receipt}
          />
        ) : (
          <Table
            headers={[
              'Expense',
              'Category',
              'Amount',
              'Method',
              'Date',
              'Recurring',
              'Actions',
            ]}
          >
            {filtered.map(
              (expense) => (
                <TableRow
                  key={
                    expense.id
                  }
                >
                  <Td>
                    <div>
                      <p className="font-medium text-[#111]">
                        {expense.description ||
                          'Untitled expense'}
                      </p>

                      <p className="text-xs text-xp-muted">
                        {expense.vendor ||
                          expense.expense_id}
                      </p>
                    </div>
                  </Td>

                  <Td>
                    <Badge variant="muted">
                      {
                        expense.category
                      }
                    </Badge>
                  </Td>

                  <Td>
                    <span className="text-sm font-semibold text-[#111]">
                      {currency}{' '}
                      {Number(
                        expense.amount ||
                          0,
                      ).toLocaleString()}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm text-xp-muted">
                      {
                        expense.payment_method
                      }
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm text-xp-muted">
                      {formatDate(
                        expense.date,
                      )}
                    </span>
                  </Td>

                  <Td>
                    {expense.recurring ? (
                      <Badge variant="purple">
                        {expense.frequency ||
                          'Recurring'}
                      </Badge>
                    ) : (
                      <span className="text-sm text-xp-muted">
                        —
                      </span>
                    )}
                  </Td>

                  <Td>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          openEdit(
                            expense,
                          )
                        }
                        className="p-1.5 rounded-md text-xp-muted hover:text-[#111] hover:bg-xp-light-gray"
                        title="Edit expense"
                      >
                        <Edit2
                          size={13}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDeleteId(
                            expense.id,
                          )
                        }
                        className="p-1.5 rounded-md text-xp-muted hover:text-red-600 hover:bg-red-50"
                        title="Delete expense"
                      >
                        <Trash2
                          size={13}
                        />
                      </button>
                    </div>
                  </Td>
                </TableRow>
              ),
            )}
          </Table>
        )}
      </Card>

      {/* Add / Edit Expense */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={
          editing
            ? 'Edit Expense'
            : 'Add Expense'
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
              onClick={
                handleSave
              }
              loading={saving}
            >
              {editing
                ? 'Save Changes'
                : 'Add Expense'}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <Input
            label="Description"
            value={
              form.description
            }
            onChange={(event) =>
              updateForm(
                'description',
                event.target
                  .value,
              )
            }
            placeholder="AWS hosting, Adobe CC..."
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={
                form.category
              }
              onChange={(event) =>
                updateForm(
                  'category',
                  event.target
                    .value,
                )
              }
              options={categories.map(
                (category) => ({
                  value:
                    category,
                  label:
                    category,
                }),
              )}
            />

            <Input
              label={`Amount (${currency})`}
              type="number"
              value={
                form.amount ===
                0
                  ? ''
                  : form.amount
              }
              onChange={(event) =>
                updateForm(
                  'amount',
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(event) =>
                updateForm(
                  'date',
                  event.target
                    .value,
                )
              }
            />

            <Select
              label="Payment Method"
              value={
                form.payment_method
              }
              onChange={(event) =>
                updateForm(
                  'payment_method',
                  event.target
                    .value as PaymentMethod,
                )
              }
              options={paymentMethods.map(
                (method) => ({
                  value:
                    method,
                  label:
                    method,
                }),
              )}
            />
          </div>

          <Input
            label="Vendor"
            value={form.vendor}
            onChange={(event) =>
              updateForm(
                'vendor',
                event.target
                  .value,
              )
            }
            placeholder="Amazon Web Services"
          />

          {/* Recurring */}
          <div className="p-3 bg-xp-off-white rounded-lg border border-xp-border">
            <Checkbox
              label="Recurring expense"
              checked={
                form.recurring
              }
              onChange={(
                checked,
              ) => {
                if (
                  checked
                ) {
                  updateForm(
                    'recurring',
                    true,
                  )

                  return
                }

                setForm(
                  (
                    current,
                  ) => ({
                    ...current,
                    recurring:
                      false,
                    frequency:
                      null,
                    next_payment:
                      null,
                  }),
                )
              }}
            />

            {form.recurring && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Select
                  label="Frequency"
                  value={
                    form.frequency ||
                    ''
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'frequency',
                      event.target
                        .value as ExpenseFrequency,
                    )
                  }
                  options={frequencies.map(
                    (
                      frequency,
                    ) => ({
                      value:
                        frequency,
                      label:
                        frequency,
                    }),
                  )}
                  placeholder="Select frequency"
                />

                <Input
                  label="Next Payment"
                  type="date"
                  value={
                    form.next_payment ||
                    ''
                  }
                  onChange={(
                    event,
                  ) =>
                    updateForm(
                      'next_payment',
                      event.target
                        .value ||
                        null,
                    )
                  }
                />
              </div>
            )}
          </div>

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(event) =>
              updateForm(
                'notes',
                event.target
                  .value,
              )
            }
            placeholder="Additional notes..."
          />
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteId}
        onClose={() => {
          if (!deleting) {
            setDeleteId(null)
          }
        }}
        title="Delete Expense"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteId(
                  null,
                )
              }
              disabled={deleting}
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              onClick={
                handleDelete
              }
              loading={deleting}
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="p-6">
          <p className="text-sm text-xp-muted">
            This expense record
            will be permanently
            deleted. This action
            cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  )
}
