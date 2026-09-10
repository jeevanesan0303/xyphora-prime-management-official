import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  useParams,
  useNavigate,
} from 'react-router-dom'
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Camera,
} from 'lucide-react'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import {
  formatDate,
  exportCSVSimple,
} from '../../lib/utils'
import { generateReportPDF } from '../../lib/pdf'
import { supabase } from '../../lib/supabase'

import {
  Card,
  Badge,
  Button,
  EmptyState,
  ExportDropdown,
} from '../../components/ui'

import type {
  Employee,
} from '../../types'

/*
 * Compatibility type while avatar_url is being
 * added to the central Employee interface.
 */
type EmployeeWithAvatar = Employee & {
  avatar_url?: string | null
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{
    id: string
  }>()

  const navigate = useNavigate()

  const {
    success,
    error,
  } = useToast()

  const {
    employees,
    salaries,
    settings,
  } = useData()

  /*
   * ------------------------------------------------------------
   * EMPLOYEE
   * ------------------------------------------------------------
   */
  const employee = useMemo(() => {
    if (!id) {
      return undefined
    }

    return employees.find(
      (item) => item.id === id,
    )
  }, [employees, id])

  /*
   * ------------------------------------------------------------
   * SALARY RECORDS
   * ------------------------------------------------------------
   *
   * This hook intentionally runs even when the
   * employee is not found.
   */
  const empSalaries = useMemo(() => {
    if (!employee) {
      return []
    }

    return salaries
      .filter(
        (salary) =>
          salary.employee_id ===
          employee.id,
      )
      .sort((a, b) =>
        b.month.localeCompare(a.month),
      )
  }, [salaries, employee])

  /*
   * ------------------------------------------------------------
   * TOTAL SALARY PAID
   * ------------------------------------------------------------
   */
  const totalPaid = useMemo(() => {
    return empSalaries
      .filter(
        (salary) =>
          salary.status === 'Paid',
      )
      .reduce(
        (total, salary) =>
          total +
          Number(
            salary.net_salary || 0,
          ),
        0,
      )
  }, [empSalaries])

  /*
   * ------------------------------------------------------------
   * PENDING SALARY COUNT
   * ------------------------------------------------------------
   */
  const pendingCount = useMemo(() => {
    return empSalaries.filter(
      (salary) =>
        salary.status === 'Pending',
    ).length
  }, [empSalaries])

  /*
   * ------------------------------------------------------------
   * CURRENCY
   * ------------------------------------------------------------
   */
  const currency =
    settings?.currency_symbol ||
    settings?.currency ||
    'LKR'

  /*
   * ------------------------------------------------------------
   * EMPLOYEE INITIALS
   * ------------------------------------------------------------
   */
  const initials = useMemo(() => {
    if (!employee?.full_name) {
      return 'U'
    }

    return employee.full_name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(
        (name) =>
          name.charAt(0).toUpperCase(),
      )
      .slice(0, 2)
      .join('')
  }, [employee?.full_name])

  /*
   * ------------------------------------------------------------
   * EMPLOYEE AVATAR
   * ------------------------------------------------------------
   */
  const employeeWithAvatar =
    employee as
      | EmployeeWithAvatar
      | undefined

  const avatarObjectKey =
    employeeWithAvatar?.avatar_url ||
    null

  /*
   * Signed/private R2 URL.
   */
  const [avatarUrl, setAvatarUrl] =
    useState<string | null>(null)

  const [avatarLoading, setAvatarLoading] =
    useState(false)

  const [avatarError, setAvatarError] =
    useState(false)

  /*
   * ------------------------------------------------------------
   * LOAD PRIVATE R2 AVATAR URL
   * ------------------------------------------------------------
   */
  useEffect(() => {
    let cancelled = false

    const loadAvatar = async () => {
      setAvatarUrl(null)
      setAvatarError(false)

      if (!employee || !avatarObjectKey) {
        setAvatarLoading(false)
        return
      }

      /*
       * If the database already contains a complete
       * HTTP URL, use it directly.
       *
       * Normally avatar_url should contain the
       * private R2 object key.
       */
      if (
        avatarObjectKey.startsWith(
          'http://',
        ) ||
        avatarObjectKey.startsWith(
          'https://',
        )
      ) {
        setAvatarUrl(
          avatarObjectKey,
        )
        setAvatarLoading(false)
        return
      }

      setAvatarLoading(true)

      try {
        const {
          data,
          error:
            functionError,
        } =
          await supabase.functions.invoke(
            'r2-employee-url',
            {
              body: {
                employee_id:
                  employee.id,
              },
            },
          )

        if (functionError) {
          throw functionError
        }

        if (
          !data?.success ||
          !data?.url
        ) {
          throw new Error(
            data?.error ||
              'Unable to generate employee photo URL.',
          )
        }

        if (!cancelled) {
          setAvatarUrl(
            data.url,
          )
        }
      } catch (err) {
        console.error(
          'Failed to load employee avatar:',
          err,
        )

        if (!cancelled) {
          setAvatarError(true)
          setAvatarUrl(null)
        }
      } finally {
        if (!cancelled) {
          setAvatarLoading(false)
        }
      }
    }

    void loadAvatar()

    return () => {
      cancelled = true
    }
  }, [
    employee?.id,
    avatarObjectKey,
  ])

  /*
   * ------------------------------------------------------------
   * FORMAT SALARY MONTH
   * ------------------------------------------------------------
   */
  const formatSalaryMonth = (
    month: string,
  ): string => {
    if (!month) {
      return '—'
    }

    const date = new Date(
      `${month}-01T00:00:00`,
    )

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return month
    }

    return date.toLocaleString(
      'default',
      {
        month: 'long',
        year: 'numeric',
      },
    )
  }

  /*
   * ------------------------------------------------------------
   * FORMAT SALARY AMOUNT
   * ------------------------------------------------------------
   */
  const formatSalaryAmount = (
    amount: number,
  ): string => {
    return `${currency} ${amount.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}`
  }

  /*
   * ------------------------------------------------------------
   * WHATSAPP URL
   * ------------------------------------------------------------
   */
  const whatsappUrl = useMemo(() => {
    if (!employee?.whatsapp) {
      return null
    }

    const digits =
      employee.whatsapp.replace(
        /\D/g,
        '',
      )

    if (!digits) {
      return null
    }

    return `https://wa.me/${digits}`
  }, [employee?.whatsapp])

  /*
   * ------------------------------------------------------------
   * EMPLOYEE NOT FOUND
   * ------------------------------------------------------------
   *
   * All hooks have already executed above.
   */
  if (!employee) {
    return (
      <div className="py-16 px-6">
        <div className="max-w-md mx-auto text-center">
          <div className="w-12 h-12 rounded-full bg-xp-light-purple flex items-center justify-center mx-auto mb-4">
            <UserFallbackIcon />
          </div>

          <h2 className="text-base font-semibold text-[#111] mb-1">
            Employee not found
          </h2>

          <p className="text-sm text-xp-muted mb-5">
            The employee you're looking for
            does not exist or may have been
            removed.
          </p>

          <Button
            variant="outline"
            onClick={() =>
              navigate('/employees')
            }
            icon={
              <ArrowLeft size={14} />
            }
          >
            Back to Employees
          </Button>
        </div>
      </div>
    )
  }

  /*
   * ------------------------------------------------------------
   * EXPORT PDF
   * ------------------------------------------------------------
   */
  const handleExportPDF = () => {
    if (
      empSalaries.length === 0
    ) {
      error(
        'There are no salary records to export for this employee.',
      )
      return
    }

    try {
      generateReportPDF(
        `Employee Statement - ${employee.full_name}`,
        `Role: ${
          employee.role ||
          'Team Member'
        } | ID: ${
          employee.employee_id ||
          '—'
        } | Joined: ${
          employee.joining_date
            ? formatDate(
                employee.joining_date,
              )
            : '—'
        }`,
        [
          'Month',
          'Base Amount',
          'Allowances',
          'Bonus',
          'Deductions',
          'Net Salary',
          'Status',
        ],
        empSalaries.map(
          (salary) => [
            formatSalaryMonth(
              salary.month,
            ),
            formatSalaryAmount(
              Number(
                salary.base_amount ||
                  0,
              ),
            ),
            formatSalaryAmount(
              Number(
                salary.allowances ||
                  0,
              ),
            ),
            formatSalaryAmount(
              Number(
                salary.bonus || 0,
              ),
            ),
            formatSalaryAmount(
              Number(
                salary.deductions ||
                  0,
              ),
            ),
            formatSalaryAmount(
              Number(
                salary.net_salary ||
                  0,
              ),
            ),
            salary.status ||
              'Pending',
          ],
        ),
        [
          {
            label:
              'Total Compensation Paid',
            value:
              formatSalaryAmount(
                totalPaid,
              ),
          },
          {
            label:
              'Pending Payouts',
            value: `${pendingCount}`,
          },
        ],
        settings,
      )

      success(
        `Exported ${employee.full_name}'s statement to PDF.`,
      )
    } catch (err) {
      console.error(
        'Failed to export employee PDF:',
        err,
      )

      error(
        'Failed to generate employee PDF.',
      )
    }
  }

  /*
   * ------------------------------------------------------------
   * EXPORT CSV
   * ------------------------------------------------------------
   */
  const handleExportCSV = () => {
    if (
      empSalaries.length === 0
    ) {
      error(
        'There are no salary records to export for this employee.',
      )
      return
    }

    try {
      exportCSVSimple(
        `employee-${
          employee.employee_id ||
          'profile'
        }-salaries`,
        [
          'Employee',
          'ID',
          'Month',
          'Base Amount',
          'Allowances',
          'Bonus',
          'Commission',
          'Overtime',
          'Deductions',
          'Net Salary',
          'Status',
          'Payment Date',
        ],
        empSalaries.map(
          (salary) => ({
            employee:
              employee.full_name,
            id:
              employee.employee_id ||
              '',
            month:
              salary.month,
            base: Number(
              salary.base_amount ||
                0,
            ),
            allowances:
              Number(
                salary.allowances ||
                  0,
              ),
            bonus: Number(
              salary.bonus || 0,
            ),
            commission:
              Number(
                salary.commission ||
                  0,
              ),
            overtime:
              Number(
                salary.overtime ||
                  0,
              ),
            deductions:
              Number(
                salary.deductions ||
                  0,
              ),
            net_salary:
              Number(
                salary.net_salary ||
                  0,
              ),
            status:
              salary.status ||
              '',
            payment_date:
              salary.payment_date ||
              '',
          }),
        ),
      )

      success(
        `Exported ${employee.full_name}'s salary records to CSV.`,
      )
    } catch (err) {
      console.error(
        'Failed to export employee CSV:',
        err,
      )

      error(
        'Failed to export employee CSV.',
      )
    }
  }

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */
  return (
    <div>
      {/* =======================================================
          HEADER
      ======================================================== */}
      <div className="flex items-center gap-3 mb-6">
        {/* Back */}
        <button
          type="button"
          onClick={() =>
            navigate('/employees')
          }
          className="p-1.5 rounded-lg text-xp-muted hover:text-[#111] hover:bg-xp-light-gray transition-colors shrink-0"
          title="Back to employees"
          aria-label="Back to employees"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Employee Identity */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Header Avatar */}
          <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
            {avatarUrl &&
            !avatarError ? (
              <img
                src={avatarUrl}
                alt={
                  employee.full_name
                }
                className="w-full h-full object-cover"
                onError={() => {
                  setAvatarError(
                    true,
                  )
                }}
              />
            ) : (
              <div className="w-full h-full rounded-full bg-xp-light-purple flex items-center justify-center text-sm font-bold text-xp-purple">
                {initials}
              </div>
            )}

            {avatarLoading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <div className="w-3.5 h-3.5 border-2 border-xp-purple/30 border-t-xp-purple rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold text-[#111] truncate">
              {
                employee.full_name
              }
            </h1>

            <p className="text-xs text-xp-muted truncate">
              {employee.role ||
                'Team Member'}
              {' · '}
              {employee.employee_id ||
                'No ID'}
            </p>
          </div>

          <Badge
            variant={
              employee.status ===
              'Active'
                ? 'success'
                : 'muted'
            }
          >
            {employee.status}
          </Badge>
        </div>

        {/* Export */}
        <ExportDropdown
          onExportPDF={
            handleExportPDF
          }
          onExportCSV={
            handleExportCSV
          }
          label="Export Statement"
        />

        {/* Salary */}
        <Button
          variant="primary"
          size="sm"
          icon={
            <CreditCard size={13} />
          }
          onClick={() =>
            navigate('/salaries')
          }
        >
          Salary Records
        </Button>
      </div>

      {/* =======================================================
          EMPLOYEE PROFILE
      ======================================================== */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Large Avatar */}
          <div className="relative w-28 h-28 rounded-full overflow-hidden border border-xp-border bg-xp-light-purple shrink-0">
            {avatarUrl &&
            !avatarError ? (
              <img
                src={avatarUrl}
                alt={
                  employee.full_name
                }
                className="w-full h-full object-cover"
                onError={() => {
                  setAvatarError(
                    true,
                  )
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-xp-purple">
                {initials}
              </div>
            )}

            {avatarLoading && (
              <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-xp-purple/30 border-t-xp-purple rounded-full animate-spin" />
              </div>
            )}

            {!avatarUrl &&
              !avatarLoading && (
                <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-white border border-xp-border shadow-sm flex items-center justify-center">
                  <Camera
                    size={13}
                    className="text-xp-muted"
                  />
                </div>
              )}
          </div>

          {/* Identity */}
          <div className="text-center sm:text-left min-w-0 flex-1">
            <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-1">
              Employee Profile
            </p>

            <h2 className="text-xl font-semibold text-[#111]">
              {
                employee.full_name
              }
            </h2>

            <p className="text-sm text-xp-muted mt-1">
              {employee.role ||
                'Team Member'}
            </p>

            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-2 mt-3">
              <Badge
                variant={
                  employee.status ===
                  'Active'
                    ? 'success'
                    : 'muted'
                }
              >
                {
                  employee.status
                }
              </Badge>

              <span className="text-xs text-xp-muted">
                {
                  employee.employee_id ||
                  'No Employee ID'
                }
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* =======================================================
          SUMMARY
      ======================================================== */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Earned */}
        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Total Earned
          </p>

          <p className="text-lg font-semibold text-[#111]">
            {formatSalaryAmount(
              totalPaid,
            )}
          </p>
        </Card>

        {/* Salary Records */}
        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Salary Records
          </p>

          <p className="text-lg font-semibold text-[#111]">
            {empSalaries.length}
          </p>
        </Card>

        {/* Pending */}
        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Pending
          </p>

          <p className="text-lg font-semibold text-[#111]">
            {pendingCount}
          </p>
        </Card>

        {/* Joined */}
        <Card className="p-4">
          <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">
            Joined
          </p>

          <p className="text-lg font-semibold text-[#111]">
            {employee.joining_date
              ? formatDate(
                  employee.joining_date,
                )
              : '—'}
          </p>
        </Card>
      </div>

      {/* =======================================================
          MAIN CONTENT
      ======================================================== */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* =====================================================
            PERSONAL DETAILS
        ====================================================== */}
        <Card className="p-5">
          <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-4">
            Personal Details
          </p>

          <div className="space-y-3">
            {/* Email */}
            <div className="flex items-start gap-3">
              <Mail
                size={14}
                className="text-xp-muted mt-0.5 shrink-0"
              />

              <div className="min-w-0">
                <p className="text-[10px] text-xp-muted uppercase tracking-wide">
                  Email
                </p>

                {employee.email ? (
                  <a
                    href={`mailto:${employee.email}`}
                    onClick={(
                      event,
                    ) =>
                      event.stopPropagation()
                    }
                    className="text-sm text-[#111] hover:text-xp-purple break-all transition-colors"
                  >
                    {
                      employee.email
                    }
                  </a>
                ) : (
                  <p className="text-sm text-xp-muted">
                    —
                  </p>
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-3">
              <Phone
                size={14}
                className="text-xp-muted mt-0.5 shrink-0"
              />

              <div>
                <p className="text-[10px] text-xp-muted uppercase tracking-wide">
                  Phone
                </p>

                {employee.phone ? (
                  <a
                    href={`tel:${employee.phone}`}
                    className="text-sm text-[#111] hover:text-xp-purple transition-colors"
                  >
                    {
                      employee.phone
                    }
                  </a>
                ) : (
                  <p className="text-sm text-xp-muted">
                    —
                  </p>
                )}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="flex items-start gap-3">
              <Phone
                size={14}
                className="text-xp-muted mt-0.5 shrink-0"
              />

              <div>
                <p className="text-[10px] text-xp-muted uppercase tracking-wide">
                  WhatsApp
                </p>

                {employee.whatsapp &&
                whatsappUrl ? (
                  <a
                    href={
                      whatsappUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#111] hover:text-xp-purple transition-colors"
                  >
                    {
                      employee.whatsapp
                    }
                  </a>
                ) : (
                  <p className="text-sm text-xp-muted">
                    —
                  </p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3">
              <MapPin
                size={14}
                className="text-xp-muted mt-0.5 shrink-0"
              />

              <div className="min-w-0">
                <p className="text-[10px] text-xp-muted uppercase tracking-wide">
                  Address
                </p>

                <p className="text-sm text-[#111] whitespace-pre-wrap">
                  {
                    employee.address ||
                    '—'
                  }
                </p>
              </div>
            </div>

            {/* Bank */}
            <div className="flex items-start gap-3">
              <CreditCard
                size={14}
                className="text-xp-muted mt-0.5 shrink-0"
              />

              <div className="min-w-0">
                <p className="text-[10px] text-xp-muted uppercase tracking-wide">
                  Bank Details
                </p>

                <p className="text-sm text-[#111] whitespace-pre-wrap">
                  {
                    employee.bank_information ||
                    '—'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {employee.notes && (
            <div className="mt-4 pt-4 border-t border-xp-light-gray">
              <p className="text-[10px] text-xp-muted uppercase tracking-wide mb-1">
                Notes
              </p>

              <p className="text-sm text-xp-muted whitespace-pre-wrap">
                {
                  employee.notes
                }
              </p>
            </div>
          )}
        </Card>

        {/* =====================================================
            SALARY HISTORY
        ====================================================== */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest">
              Salary History
            </p>

            {empSalaries.length >
              8 && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/salaries',
                  )
                }
                className="text-xs text-xp-purple hover:text-xp-deep-purple font-medium transition-colors"
              >
                View All
              </button>
            )}
          </div>

          {empSalaries.length ===
          0 ? (
            <EmptyState
              title="No salary records"
              description="No salary records have been created for this employee yet."
            />
          ) : (
            <div className="space-y-2">
              {empSalaries
                .slice(0, 8)
                .map((salary) => {
                  const netSalary =
                    Number(
                      salary.net_salary ||
                        0,
                    )

                  return (
                    <div
                      key={
                        salary.id
                      }
                      className="flex items-center justify-between p-3 rounded-lg border border-xp-border hover:bg-xp-off-white transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111]">
                          {formatSalaryMonth(
                            salary.month,
                          )}
                        </p>

                        <p className="text-xs text-xp-muted">
                          {salary.payment_date
                            ? `Paid ${formatDate(
                                salary.payment_date,
                              )}`
                            : 'Payment pending'}
                        </p>
                      </div>

                      <div className="text-right shrink-0 ml-4">
                        <p className="text-sm font-semibold text-[#111]">
                          {formatSalaryAmount(
                            netSalary,
                          )}
                        </p>

                        <Badge
                          variant={
                            salary.status ===
                            'Paid'
                              ? 'success'
                              : 'warning'
                          }
                        >
                          {salary.status ||
                            'Pending'}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

/*
 * Small icon used for the "employee not found"
 * state without introducing another dependency.
 */
function UserFallbackIcon() {
  return (
    <div className="w-5 h-5 rounded-full bg-xp-purple/10 flex items-center justify-center">
      <span className="text-xs font-bold text-xp-purple">
        ?
      </span>
    </div>
  )
}