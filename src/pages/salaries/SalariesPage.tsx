
import { useMemo, useState } from 'react'
import { Plus, Download, Edit2, DollarSign } from 'lucide-react'
import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import { exportCSVSimple } from '../../lib/utils'
import { generateReportPDF, generatePayslipPDF } from '../../lib/pdf'
import {
  PageHeader,
  Button,
  Badge,
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
  SalaryRecord,
  PaymentMethod,
  SalaryStatus,
} from '../../types'

type SalaryForm = Omit<SalaryRecord, 'id' | 'created_at'>

const PAYMENT_METHODS: PaymentMethod[] = [
  'Bank Transfer',
  'Cash',
  'Card',
  'Online Payment',
  'Other',
]

const SALARY_STATUSES: SalaryStatus[] = [
  'Pending',
  'Paid',
]

const toNumber = (value: unknown): number => {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return 0
  }

  return number
}

const emptyForm = (employeeId = ''): SalaryForm => ({
  employee_id: employeeId,
  month: new Date().toISOString().slice(0, 7),

  base_amount: 0,
  allowances: 0,
  bonus: 0,
  commission: 0,
  overtime: 0,
  deductions: 0,
  other_adjustments: 0,

  net_salary: 0,

  payment_date: null,
  payment_method: 'Bank Transfer',
  status: 'Pending',
  notes: '',
})

const calculateNetSalary = (form: SalaryForm): number => {
  const base = toNumber(form.base_amount)
  const allowances = toNumber(form.allowances)
  const bonus = toNumber(form.bonus)
  const commission = toNumber(form.commission)
  const overtime = toNumber(form.overtime)
  const otherAdjustments = toNumber(form.other_adjustments)
  const deductions = toNumber(form.deductions)

  return (
    base +
    allowances +
    bonus +
    commission +
    overtime +
    otherAdjustments -
    deductions
  )
}

const getInitials = (name?: string): string => {
  if (!name) {
    return '?'
  }

  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

const formatMonth = (month: string): string => {
  if (!month) {
    return '—'
  }

  const date = new Date(`${month}-01T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return month
  }

  return date.toLocaleString('default', {
    month: 'short',
    year: 'numeric',
  })
}

export default function SalariesPage() {
  const {
    salaries,
    employees,
    settings,
    addSalary,
    updateSalary,
  } = useData()

  const { success, error } = useToast()

  const currency =
    settings?.currency_symbol ||
    settings?.currency ||
    'LKR'

  const [empFilter, setEmpFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SalaryRecord | null>(null)

  const [form, setForm] = useState<SalaryForm>(() =>
    emptyForm()
  )

  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  const filtered = useMemo(() => {
    return salaries.filter((salary) => {
      const matchesEmployee =
        !empFilter ||
        salary.employee_id === empFilter

      const matchesMonth =
        !monthFilter ||
        salary.month === monthFilter

      return matchesEmployee && matchesMonth
    })
  }, [salaries, empFilter, monthFilter])

  const totalPaid = useMemo(() => {
    return filtered
      .filter((salary) => salary.status === 'Paid')
      .reduce(
        (sum, salary) =>
          sum + toNumber(salary.net_salary),
        0
      )
  }, [filtered])

  const totalPending = useMemo(() => {
    return filtered
      .filter((salary) => salary.status === 'Pending')
      .reduce(
        (sum, salary) =>
          sum + toNumber(salary.net_salary),
        0
      )
  }, [filtered])

  const totalNet = useMemo(() => {
    return filtered.reduce(
      (sum, salary) =>
        sum + toNumber(salary.net_salary),
      0
    )
  }, [filtered])

  const openNew = (employeeId = '') => {
    setEditing(null)
    setForm(emptyForm(employeeId))
    setShowModal(true)
  }

  const openEdit = (salary: SalaryRecord) => {
    setEditing(salary)

    setForm({
      employee_id: salary.employee_id,
      month: salary.month,

      base_amount: toNumber(salary.base_amount),
      allowances: toNumber(salary.allowances),
      bonus: toNumber(salary.bonus),
      commission: toNumber(salary.commission),
      overtime: toNumber(salary.overtime),
      deductions: toNumber(salary.deductions),
      other_adjustments: toNumber(
        salary.other_adjustments
      ),

      net_salary: toNumber(salary.net_salary),

      payment_date: salary.payment_date || null,
      payment_method: salary.payment_method,
      status: salary.status,
      notes: salary.notes || '',
    })

    setShowModal(true)
  }

  const closeModal = () => {
    if (saving) {
      return
    }

    setShowModal(false)
    setEditing(null)
    setForm(emptyForm())
  }

  const updateFormField = <K extends keyof SalaryForm>(
    key: K,
    value: SalaryForm[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const validateForm = (): string | null => {
    if (!form.employee_id) {
      return 'Please select an employee.'
    }

    if (!form.month) {
      return 'Please select a salary month.'
    }

    const amountFields: Array<
      keyof Pick<
        SalaryForm,
        | 'base_amount'
        | 'allowances'
        | 'bonus'
        | 'commission'
        | 'overtime'
        | 'deductions'
        | 'other_adjustments'
      >
    > = [
      'base_amount',
      'allowances',
      'bonus',
      'commission',
      'overtime',
      'deductions',
      'other_adjustments',
    ]

    for (const field of amountFields) {
      const value = toNumber(form[field])

      if (value < 0) {
        return 'Salary amounts cannot be negative.'
      }
    }

    const netSalary = calculateNetSalary(form)

    if (!Number.isFinite(netSalary)) {
      return 'Unable to calculate the net salary.'
    }

    if (netSalary < 0) {
      return 'Net salary cannot be negative.'
    }

    if (form.status === 'Paid' && !form.payment_date) {
      return 'Payment date is required when salary status is Paid.'
    }

    if (
      form.payment_date &&
      !/^\d{4}-\d{2}-\d{2}$/.test(form.payment_date)
    ) {
      return 'Please enter a valid payment date.'
    }

    return null
  }

  const handleSave = async () => {
    const validationError = validateForm()

    if (validationError) {
      error(validationError)
      return
    }

    const netSalary = calculateNetSalary(form)

    const payload: SalaryForm = {
      ...form,

      base_amount: toNumber(form.base_amount),
      allowances: toNumber(form.allowances),
      bonus: toNumber(form.bonus),
      commission: toNumber(form.commission),
      overtime: toNumber(form.overtime),
      deductions: toNumber(form.deductions),
      other_adjustments: toNumber(
        form.other_adjustments
      ),

      net_salary: netSalary,

      payment_date:
        form.status === 'Paid'
          ? form.payment_date
          : null,
    }

    setSaving(true)

    try {
      if (editing) {
        await updateSalary(editing.id, payload)
        success('Salary record updated successfully.')
      } else {
        await addSalary(payload)
        success('Salary recorded successfully.')
      }

      setShowModal(false)
      setEditing(null)
      setForm(emptyForm())
    } catch (err) {
      console.error('Failed to save salary record:', err)

      error(
        err instanceof Error
          ? err.message
          : 'Failed to save salary record.'
      )
    } finally {
      setSaving(false)
    }
  }

  const handleExportPDF = async () => {
    if (filtered.length === 0) {
      error('There are no salary records to export.')
      return
    }

    setExporting(true)

    try {
      generateReportPDF(
        'Salary Report',
        `Period: ${monthFilter || 'All months'}`,
        [
          'Employee',
          'Month',
          'Base',
          'Allowances',
          'Bonus',
          'Deductions',
          'Net',
        ],
        filtered.map((salary) => {
          const employee = employees.find(
            (item) =>
              item.id === salary.employee_id
          )

          return [
            employee?.full_name || 'Unknown Employee',
            formatMonth(salary.month),
            toNumber(
              salary.base_amount
            ).toLocaleString(),
            toNumber(
              salary.allowances
            ).toLocaleString(),
            toNumber(
              salary.bonus
            ).toLocaleString(),
            toNumber(
              salary.deductions
            ).toLocaleString(),
            toNumber(
              salary.net_salary
            ).toLocaleString(),
          ]
        }),
        [
          {
            label: 'Total Paid',
            value: `${currency} ${totalPaid.toLocaleString()}`,
          },
          {
            label: 'Total Pending',
            value: `${currency} ${totalPending.toLocaleString()}`,
          },
          {
            label: 'Total Net',
            value: `${currency} ${totalNet.toLocaleString()}`,
          },
        ]
      )

      success('Salary PDF exported successfully.')
    } catch (err) {
      console.error('Failed to export salary PDF:', err)

      error('Failed to export salary PDF.')
    } finally {
      setExporting(false)
    }
  }

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      error('There are no salary records to export.')
      return
    }

    try {
      exportCSVSimple(
        'salaries',
        [
          'Employee',
          'Month',
          'Base',
          'Allowances',
          'Bonus',
          'Commission',
          'Overtime',
          'Deductions',
          'Other Adjustments',
          'Net Salary',
          'Payment Date',
          'Payment Method',
          'Status',
          'Notes',
        ],
        filtered.map((salary) => {
          const employee = employees.find(
            (item) =>
              item.id === salary.employee_id
          )

          return {
            employee:
              employee?.full_name ||
              'Unknown Employee',

            month: salary.month,

            base: toNumber(
              salary.base_amount
            ),

            allowances: toNumber(
              salary.allowances
            ),

            bonus: toNumber(
              salary.bonus
            ),

            commission: toNumber(
              salary.commission
            ),

            overtime: toNumber(
              salary.overtime
            ),

            deductions: toNumber(
              salary.deductions
            ),

            other_adjustments: toNumber(
              salary.other_adjustments
            ),

            net_salary: toNumber(
              salary.net_salary
            ),

            payment_date:
              salary.payment_date || '',

            payment_method:
              salary.payment_method,

            status: salary.status,

            notes: salary.notes || '',
          }
        })
      )

      success('Salary CSV exported successfully.')
    } catch (err) {
      console.error('Failed to export salary CSV:', err)

      error('Failed to export salary CSV.')
    }
  }

  const netPreview = calculateNetSalary(form)

  return (
    <div>
      <PageHeader
        title="Salaries"
        subtitle="Monthly salary records"
        actions={
          <>
            <ExportDropdown
              onExportPDF={handleExportPDF}
              onExportCSV={handleExportCSV}
              disabled={exporting || filtered.length === 0}
            />

            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => openNew()}
              disabled={saving}
            >
              Add Salary
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Total Paid
          </p>

          <p className="text-xl font-semibold text-[#111]">
            {currency} {totalPaid.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Pending
          </p>

          <p className="text-xl font-semibold text-xp-purple">
            {currency} {totalPending.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Records
          </p>

          <p className="text-xl font-semibold text-[#111]">
            {filtered.length}
          </p>
        </Card>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={empFilter}
          onChange={(event) =>
            setEmpFilter(event.target.value)
          }
          className="h-9 px-3 rounded-lg border border-xp-border text-sm text-[#111] bg-white focus:outline-none focus:border-xp-purple"
        >
          <option value="">
            All Employees
          </option>

          {employees.map((employee) => (
            <option
              key={employee.id}
              value={employee.id}
            >
              {employee.full_name}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={monthFilter}
          onChange={(event) =>
            setMonthFilter(event.target.value)
          }
          className="h-9 px-3 rounded-lg border border-xp-border text-sm text-[#111] bg-white focus:outline-none focus:border-xp-purple"
        />

        {(empFilter || monthFilter) && (
          <button
            type="button"
            onClick={() => {
              setEmpFilter('')
              setMonthFilter('')
            }}
            className="text-xs text-xp-purple hover:text-xp-deep-purple"
          >
            Clear
          </button>
        )}

        <span className="text-xs text-xp-muted ml-auto">
          {filtered.length} records
        </span>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title="No salary records"
            description="Record your first salary payment."
            action={{
              label: 'Add Salary',
              onClick: () => openNew(),
            }}
            icon={DollarSign}
          />
        ) : (
          <Table
            headers={[
              'Employee',
              'Month',
              'Base',
              'Allowances',
              'Bonus',
              'Deductions',
              'Net Salary',
              'Status',
              'Actions',
            ]}
          >
            {filtered.map((salary) => {
              const employee = employees.find(
                (item) =>
                  item.id === salary.employee_id
              )

              const initials = getInitials(
                employee?.full_name
              )

              return (
                <TableRow key={salary.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-xp-light-purple flex items-center justify-center text-[10px] font-bold text-xp-purple shrink-0">
                        {initials}
                      </div>

                      <span className="font-medium text-[#111]">
                        {employee?.full_name ||
                          'Unknown Employee'}
                      </span>
                    </div>
                  </Td>

                  <Td>
                    <span className="text-sm text-xp-muted">
                      {formatMonth(salary.month)}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm text-[#111]">
                      {currency}{' '}
                      {toNumber(
                        salary.base_amount
                      ).toLocaleString()}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm text-[#111]">
                      {currency}{' '}
                      {toNumber(
                        salary.allowances
                      ).toLocaleString()}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm text-[#111]">
                      {toNumber(salary.bonus) > 0
                        ? `${currency} ${toNumber(
                            salary.bonus
                          ).toLocaleString()}`
                        : '—'}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm text-red-500">
                      {toNumber(salary.deductions) > 0
                        ? `- ${currency} ${toNumber(
                            salary.deductions
                          ).toLocaleString()}`
                        : '—'}
                    </span>
                  </Td>

                  <Td>
                    <span className="text-sm font-semibold text-[#111]">
                      {currency}{' '}
                      {toNumber(
                        salary.net_salary
                      ).toLocaleString()}
                    </span>
                  </Td>

                  <Td>
                    <Badge
                      variant={
                        salary.status === 'Paid'
                          ? 'success'
                          : 'warning'
                      }
                    >
                      {salary.status}
                    </Badge>
                  </Td>

                  <Td>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          try {
                            const employee = employees.find(
                              (item) => item.id === salary.employee_id
                            )
                            generatePayslipPDF(salary, employee, settings)
                            success(`Downloaded payslip for ${employee?.full_name || 'employee'}.`)
                          } catch (err) {
                            console.error('Failed to download payslip:', err)
                            error('Failed to generate payslip PDF.')
                          }
                        }}
                        className="p-1.5 rounded-md text-xp-muted hover:text-xp-purple hover:bg-xp-light-purple transition-colors"
                        title="Download Payslip PDF"
                        aria-label="Download Payslip PDF"
                      >
                        <Download size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEdit(salary)
                        }
                        className="p-1.5 rounded-md text-xp-muted hover:text-[#111] hover:bg-xp-light-gray"
                        title="Edit salary"
                        disabled={saving}
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </Td>
                </TableRow>
              )
            })}
          </Table>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={closeModal}
        title={
          editing
            ? 'Edit Salary Record'
            : 'Add Salary Record'
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
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : editing
                  ? 'Save Changes'
                  : 'Record Salary'}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Employee"
              value={form.employee_id}
              onChange={(event) =>
                updateFormField(
                  'employee_id',
                  event.target.value
                )
              }
              options={employees.map(
                (employee) => ({
                  value: employee.id,
                  label: employee.full_name,
                })
              )}
              placeholder="Select employee"
            />

            <Input
              label="Month"
              type="month"
              value={form.month}
              onChange={(event) =>
                updateFormField(
                  'month',
                  event.target.value
                )
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Base Salary (${currency})`}
              type="number"
              min="0"
              step="0.01"
              value={
                form.base_amount === 0
                  ? ''
                  : form.base_amount
              }
              onChange={(event) =>
                updateFormField(
                  'base_amount',
                  toNumber(event.target.value)
                )
              }
              placeholder="0"
            />

            <Input
              label="Allowances"
              type="number"
              min="0"
              step="0.01"
              value={
                form.allowances === 0
                  ? ''
                  : form.allowances
              }
              onChange={(event) =>
                updateFormField(
                  'allowances',
                  toNumber(event.target.value)
                )
              }
              placeholder="0"
            />

            <Input
              label="Bonus"
              type="number"
              min="0"
              step="0.01"
              value={
                form.bonus === 0
                  ? ''
                  : form.bonus
              }
              onChange={(event) =>
                updateFormField(
                  'bonus',
                  toNumber(event.target.value)
                )
              }
              placeholder="0"
            />

            <Input
              label="Commission"
              type="number"
              min="0"
              step="0.01"
              value={
                form.commission === 0
                  ? ''
                  : form.commission
              }
              onChange={(event) =>
                updateFormField(
                  'commission',
                  toNumber(event.target.value)
                )
              }
              placeholder="0"
            />

            <Input
              label="Overtime"
              type="number"
              min="0"
              step="0.01"
              value={
                form.overtime === 0
                  ? ''
                  : form.overtime
              }
              onChange={(event) =>
                updateFormField(
                  'overtime',
                  toNumber(event.target.value)
                )
              }
              placeholder="0"
            />

            <Input
              label="Deductions"
              type="number"
              min="0"
              step="0.01"
              value={
                form.deductions === 0
                  ? ''
                  : form.deductions
              }
              onChange={(event) =>
                updateFormField(
                  'deductions',
                  toNumber(event.target.value)
                )
              }
              placeholder="0"
            />

            <Input
              label="Other Adjustments"
              type="number"
              min="0"
              step="0.01"
              value={
                form.other_adjustments === 0
                  ? ''
                  : form.other_adjustments
              }
              onChange={(event) =>
                updateFormField(
                  'other_adjustments',
                  toNumber(event.target.value)
                )
              }
              placeholder="0"
            />
          </div>

          <div className="p-4 bg-xp-light-purple rounded-lg border border-[#e9d5ff]">
            <p className="text-xs text-xp-muted mb-1">
              Net Salary
            </p>

            <p className="text-2xl font-bold text-xp-purple">
              {currency}{' '}
              {netPreview.toLocaleString()}
            </p>

            <p className="text-[10px] text-xp-muted mt-1">
              Base + Allowances + Bonus + Commission +
              Overtime + Other − Deductions
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Status"
              value={form.status}
              onChange={(event) =>
                updateFormField(
                  'status',
                  event.target.value as SalaryStatus
                )
              }
              options={SALARY_STATUSES.map(
                (status) => ({
                  value: status,
                  label: status,
                })
              )}
            />

            <Input
              label="Payment Date"
              type="date"
              value={form.payment_date || ''}
              onChange={(event) =>
                updateFormField(
                  'payment_date',
                  event.target.value || null
                )
              }
            />
          </div>

          <Select
            label="Payment Method"
            value={form.payment_method}
            onChange={(event) =>
              updateFormField(
                'payment_method',
                event.target.value as PaymentMethod
              )
            }
            options={PAYMENT_METHODS.map(
              (method) => ({
                value: method,
                label: method,
              })
            )}
          />

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(event) =>
              updateFormField(
                'notes',
                event.target.value
              )
            }
            placeholder="Notes..."
          />
        </div>
      </Modal>
    </div>
  )
}
