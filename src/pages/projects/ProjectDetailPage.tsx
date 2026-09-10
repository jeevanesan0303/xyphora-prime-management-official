
import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit2,
  FileText,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  CircleDollarSign,
  CheckCircle2,
  Clock3,
} from 'lucide-react'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import { formatDate, exportCSVSimple, formatCurrency } from '../../lib/utils'
import { generateReportPDF } from '../../lib/pdf'

import {
  Card,
  Badge,
  Button,
  ExportDropdown,
  ProgressBar,
} from '../../components/ui'

import type {
  ProjectStatus,
  ProjectMilestone,
} from '../../types'

const statusColors: Record<ProjectStatus, any> = {
  Planning: 'muted',
  Proposal: 'muted',
  Approved: 'blue',
  'In Progress': 'purple',
  Testing: 'warning',
  Completed: 'success',
  Delivered: 'success',
  Maintenance: 'warning',
  Cancelled: 'danger',
}

type MilestoneForm = {
  label: string
  amount: string
  due_date: string
  status: ProjectMilestone['status']
  notes: string
}

const emptyMilestoneForm: MilestoneForm = {
  label: '',
  amount: '',
  due_date: '',
  status: 'Pending',
  notes: '',
}

const milestoneStatusColors: Record<
  ProjectMilestone['status'],
  any
> = {
  Pending: 'warning',
  Paid: 'success',
  Upcoming: 'blue',
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success, error: showError } = useToast()

  const {
    projects,
    clients,
    services,
    invoices,
    payments,
    projectMilestones,
    addProjectMilestone,
    updateProjectMilestone,
    deleteProjectMilestone,
    loading,
    settings,
  } = useData()

  const [showMilestoneModal, setShowMilestoneModal] =
    useState(false)

  const [editingMilestone, setEditingMilestone] =
    useState<ProjectMilestone | null>(null)

  const [milestoneForm, setMilestoneForm] =
    useState<MilestoneForm>(emptyMilestoneForm)

  const [savingMilestone, setSavingMilestone] =
    useState(false)

  const [deletingMilestoneId, setDeletingMilestoneId] =
    useState<string | null>(null)

  /*
   * Find project.
   */
  const project = useMemo(() => {
    if (!id) {
      return undefined
    }

    return projects.find(
      (projectItem) => projectItem.id === id
    )
  }, [projects, id])

  /*
   * Find related client.
   */
  const client = useMemo(() => {
    if (!project) {
      return undefined
    }

    return clients.find(
      (clientItem) =>
        clientItem.id === project.client_id
    )
  }, [clients, project])

  /*
   * Find related service.
   */
  const service = useMemo(() => {
    if (!project || !project.service_id) {
      return undefined
    }

    return services.find(
      (serviceItem) =>
        serviceItem.id === project.service_id
    )
  }, [services, project])

  /*
   * Find invoices belonging to this project.
   */
  const projectInvoices = useMemo(() => {
    if (!id) {
      return []
    }

    return invoices.filter(
      (invoice) => invoice.project_id === id
    )
  }, [invoices, id])

  /*
   * Find payments belonging to this project.
   */
  const projectPayments = useMemo(() => {
    if (!id) {
      return []
    }

    return payments.filter(
      (payment) => payment.project_id === id
    )
  }, [payments, id])

  /*
   * Find milestones belonging to this project.
   */
  const projectMilestoneList = useMemo(() => {
    if (!id) {
      return []
    }

    return projectMilestones
      .filter(
        (milestone) =>
          milestone.project_id === id
      )
      .sort((a, b) => {
        const firstDate = a.due_date
          ? new Date(a.due_date).getTime()
          : Number.MAX_SAFE_INTEGER

        const secondDate = b.due_date
          ? new Date(b.due_date).getTime()
          : Number.MAX_SAFE_INTEGER

        return firstDate - secondDate
      })
  }, [projectMilestones, id])

  /*
   * Calculate total paid.
   */
  const totalPaid = useMemo(() => {
    return projectPayments.reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0
    )
  }, [projectPayments])

  /*
   * Calculate outstanding balance.
   */
  const balance = useMemo(() => {
    if (!project) {
      return 0
    }

    return (
      Number(project.project_value || 0) -
      totalPaid
    )
  }, [project, totalPaid])

  /*
   * Milestone financial totals.
   */
  const milestoneTotal = useMemo(() => {
    return projectMilestoneList.reduce(
      (sum, milestone) =>
        sum + Number(milestone.amount || 0),
      0
    )
  }, [projectMilestoneList])

  const milestonePaidTotal = useMemo(() => {
    return projectMilestoneList
      .filter(
        (milestone) =>
          milestone.status === 'Paid'
      )
      .reduce(
        (sum, milestone) =>
          sum + Number(milestone.amount || 0),
        0
      )
  }, [projectMilestoneList])

  const pendingMilestoneCount = useMemo(() => {
    return projectMilestoneList.filter(
      (milestone) =>
        milestone.status === 'Pending'
    ).length
  }, [projectMilestoneList])

  const upcomingMilestoneCount = useMemo(() => {
    return projectMilestoneList.filter(
      (milestone) =>
        milestone.status === 'Upcoming'
    ).length
  }, [projectMilestoneList])

  /*
   * Safely normalize project values.
   */
  const projectValue = Number(
    project?.project_value || 0
  )

  const projectProgress = Math.max(
    0,
    Math.min(
      100,
      Number(project?.progress || 0)
    )
  )

  /*
   * Open Add Milestone modal.
   */
  const openAddMilestone = () => {
    setEditingMilestone(null)
    setMilestoneForm(emptyMilestoneForm)
    setShowMilestoneModal(true)
  }

  /*
   * Open Edit Milestone modal.
   */
  const openEditMilestone = (
    milestone: ProjectMilestone
  ) => {
    setEditingMilestone(milestone)

    setMilestoneForm({
      label: milestone.label || '',
      amount:
        milestone.amount !== undefined &&
        milestone.amount !== null
          ? String(milestone.amount)
          : '',
      due_date: milestone.due_date || '',
      status: milestone.status,
      notes: milestone.notes || '',
    })

    setShowMilestoneModal(true)
  }

  /*
   * Close milestone modal.
   */
  const closeMilestoneModal = () => {
    if (savingMilestone) {
      return
    }

    setShowMilestoneModal(false)
    setEditingMilestone(null)
    setMilestoneForm(emptyMilestoneForm)
  }

  /*
   * Save milestone to Supabase.
   */
  const handleSaveMilestone = async () => {
    if (!project) {
      return
    }

    const label = milestoneForm.label.trim()
    const amount = Number(
      milestoneForm.amount || 0
    )

    if (!label) {
      showError('Milestone name is required.')
      return
    }

    if (
      milestoneForm.amount.trim() !== '' &&
      (!Number.isFinite(amount) || amount < 0)
    ) {
      showError(
        'Milestone amount must be a valid positive number.'
      )
      return
    }

    if (!milestoneForm.due_date) {
      showError('Milestone due date is required.')
      return
    }

    setSavingMilestone(true)

    try {
      if (editingMilestone) {
        await updateProjectMilestone(
          editingMilestone.id,
          {
            label,
            amount,
            due_date:
              milestoneForm.due_date,
            status:
              milestoneForm.status,
            notes:
              milestoneForm.notes.trim(),
          }
        )

        success(
          'Milestone updated successfully.'
        )
      } else {
        await addProjectMilestone({
          project_id: project.id,
          label,
          amount,
          due_date:
            milestoneForm.due_date,
          status:
            milestoneForm.status,
          notes:
            milestoneForm.notes.trim(),
        })

        success(
          'Milestone added successfully.'
        )
      }

      closeMilestoneModal()
    } catch (err) {
      console.error(
        'Failed to save project milestone:',
        err
      )

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to save milestone.'
      )
    } finally {
      setSavingMilestone(false)
    }
  }

  /*
   * Delete milestone from Supabase.
   */
  const handleDeleteMilestone = async (
    milestone: ProjectMilestone
  ) => {
    const confirmed = window.confirm(
      `Delete "${milestone.label}"? This action cannot be undone.`
    )

    if (!confirmed) {
      return
    }

    setDeletingMilestoneId(milestone.id)

    try {
      await deleteProjectMilestone(
        milestone.id
      )

      success(
        'Milestone deleted successfully.'
      )
    } catch (err) {
      console.error(
        'Failed to delete project milestone:',
        err
      )

      showError(
        err instanceof Error
          ? err.message
          : 'Failed to delete milestone.'
      )
    } finally {
      setDeletingMilestoneId(null)
    }
  }

  const handleExportPDF = () => {
    if (!project) return
    const sym = settings?.currency_symbol || settings?.currency || 'LKR'

    const rows = projectMilestoneList.map((m) => [
      m.label,
      formatDate(m.due_date),
      m.status,
      `${sym} ${Number(m.amount || 0).toLocaleString()}`,
      m.notes || '—',
    ])

    generateReportPDF(
      `Project Report - ${project.project_name}`,
      `Client: ${client?.company_name || '—'} · Status: ${project.status} · Progress: ${project.progress}%`,
      ['Milestone', 'Due Date', 'Status', 'Amount', 'Notes'],
      rows.length > 0 ? rows : [['No milestones recorded', '—', '—', '—', '—']],
      [
        { label: 'Project Value', value: `${sym} ${projectValue.toLocaleString()}` },
        { label: 'Total Paid', value: `${sym} ${totalPaid.toLocaleString()}` },
        { label: 'Balance Due', value: `${sym} ${balance.toLocaleString()}` },
      ],
      settings,
    )

    success('Project report exported as PDF.')
  }

  const handleExportCSV = () => {
    if (!project) return
    exportCSVSimple(
      `Project_${project.project_id}`,
      ['Milestone / Item', 'Due Date', 'Status', 'Amount', 'Notes'],
      projectMilestoneList.map((m) => ({
        milestone: m.label,
        due_date: m.due_date,
        status: m.status,
        amount: Number(m.amount || 0),
        notes: m.notes || '',
      }))
    )
    success('Project exported as CSV.')
  }

  /*
   * Initial loading state.
   */
  if (loading && !project) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-2 text-sm text-xp-muted">
          <Loader2
            size={18}
            className="animate-spin"
          />
          Loading project...
        </div>
      </div>
    )
  }

  /*
   * Project not found.
   */
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-xp-muted mb-4">
          Project not found.
        </p>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/projects')}
        >
          Back to Projects
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* =========================================================
          BACK NAVIGATION + HEADER
      ========================================================== */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate('/projects')}
          className="p-1.5 rounded-lg text-xp-muted hover:text-[#111] hover:bg-xp-light-gray transition-colors"
          aria-label="Back to projects"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold text-[#111] tracking-tight">
              {project.project_name}
            </h1>

            <Badge
              variant={
                statusColors[project.status]
              }
            >
              {project.status}
            </Badge>
          </div>

          <p className="text-xs text-xp-muted mt-0.5">
            {project.project_id}

            {client?.company_name
              ? ` · ${client.company_name}`
              : ''}
          </p>
        </div>

        <ExportDropdown
          onExportPDF={handleExportPDF}
          onExportCSV={handleExportCSV}
          label="Export"
        />

        <Button
          variant="outline"
          size="sm"
          icon={<Edit2 size={13} />}
          onClick={() =>
            navigate('/projects', {
              state: {
                editProjectId: project.id,
              },
            })
          }
        >
          Edit
        </Button>

        <Button
          variant="primary"
          size="sm"
          icon={<FileText size={13} />}
          onClick={() =>
            navigate(
              `/invoices/new?clientId=${project.client_id}&projectId=${project.id}`
            )
          }
        >
          New Invoice
        </Button>
      </div>

      {/* =========================================================
          FINANCIAL / PROGRESS SUMMARY
      ========================================================== */}
      <div className="grid lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Project Value',
            value: `LKR ${projectValue.toLocaleString()}`,
          },
          {
            label: 'Total Paid',
            value: `LKR ${totalPaid.toLocaleString()}`,
          },
          {
            label: 'Balance',
            value: `LKR ${balance.toLocaleString()}`,
            accent: balance > 0,
          },
          {
            label: 'Progress',
            value: `${projectProgress}%`,
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

      {/* =========================================================
          MAIN CONTENT
      ========================================================== */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Project Details */}
        <Card className="p-5">
          <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-4">
            Project Details
          </p>

          <div className="space-y-3">
            {[
              {
                label: 'Client',
                value:
                  client?.company_name || '—',
              },
              {
                label: 'Service',
                value:
                  service?.name || '—',
              },
              {
                label: 'Technology',
                value:
                  project.technology ||
                  '—',
              },
              {
                label: 'Start Date',
                value: project.start_date
                  ? formatDate(
                      project.start_date
                    )
                  : '—',
              },
              {
                label:
                  'Expected Completion',
                value:
                  project.expected_completion
                    ? formatDate(
                        project.expected_completion
                      )
                    : '—',
              },
              {
                label:
                  'Actual Completion',
                value:
                  project.actual_completion
                    ? formatDate(
                        project.actual_completion
                      )
                    : 'Ongoing',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex justify-between gap-4"
              >
                <span className="text-xs text-xp-muted uppercase tracking-wide">
                  {item.label}
                </span>

                <span className="text-sm text-[#111] font-medium text-right">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="mt-4 pt-4 border-t border-xp-light-gray">
            <p className="text-xs text-xp-muted mb-2">
              Progress
            </p>

            <ProgressBar
              value={projectProgress}
            />

            <p className="text-xs text-xp-muted mt-1 text-right">
              {projectProgress}% complete
            </p>
          </div>

          {/* Description */}
          {project.description && (
            <div className="mt-4 pt-4 border-t border-xp-light-gray">
              <p className="text-xs text-xp-muted uppercase tracking-wide mb-1">
                Description
              </p>

              <p className="text-sm text-xp-muted leading-relaxed whitespace-pre-wrap">
                {project.description}
              </p>
            </div>
          )}

          {/* Notes */}
          {project.notes && (
            <div className="mt-4 pt-4 border-t border-xp-light-gray">
              <p className="text-xs text-xp-muted uppercase tracking-wide mb-1">
                Notes
              </p>

              <p className="text-sm text-xp-muted leading-relaxed whitespace-pre-wrap">
                {project.notes}
              </p>
            </div>
          )}
        </Card>

        {/* Invoices */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest">
              Invoices
            </p>

            {projectInvoices.length > 0 && (
              <span className="text-xs text-xp-muted">
                {projectInvoices.length}{' '}
                invoice
                {projectInvoices.length !==
                1
                  ? 's'
                  : ''}
              </span>
            )}
          </div>

          {projectInvoices.length === 0 ? (
            <div className="text-center py-8">
              <FileText
                size={24}
                className="mx-auto mb-2 text-xp-muted"
              />

              <p className="text-sm text-xp-muted">
                No invoices for this
                project.
              </p>

              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  navigate(
                    `/invoices/new?clientId=${project.client_id}&projectId=${project.id}`
                  )
                }
              >
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {projectInvoices.map(
                (invoice) => (
                  <div
                    key={invoice.id}
                    onClick={() =>
                      navigate(
                        `/invoices/${invoice.id}`
                      )
                    }
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border border-xp-border hover:bg-xp-off-white cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111]">
                        {
                          invoice.invoice_number
                        }
                      </p>

                      <p className="text-xs text-xp-muted">
                        {invoice.due_date
                          ? `Due ${formatDate(
                              invoice.due_date
                            )}`
                          : 'No due date'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-[#111]">
                        LKR{' '}
                        {Number(
                          invoice.total ||
                            0
                        ).toLocaleString()}
                      </p>

                      <Badge
                        variant={
                          invoice.status ===
                          'Paid'
                            ? 'success'
                            : invoice.status ===
                              'Overdue'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {
                          invoice.status
                        }
                      </Badge>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </Card>
      </div>

      {/* =========================================================
          PROJECT MILESTONES
      ========================================================== */}
      <Card className="p-5 mt-4">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest">
              Project Milestones
            </p>

            <p className="text-xs text-xp-muted mt-1">
              Track project delivery stages and milestone payments.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={openAddMilestone}
          >
            Add Milestone
          </Button>
        </div>

        {/* Milestone Summary */}
        {projectMilestoneList.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="rounded-lg border border-xp-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <CircleDollarSign
                  size={14}
                  className="text-xp-muted"
                />
                <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest">
                  Milestone Value
                </p>
              </div>

              <p className="text-sm font-semibold text-[#111]">
                LKR {milestoneTotal.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-xp-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2
                  size={14}
                  className="text-xp-muted"
                />
                <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest">
                  Paid Value
                </p>
              </div>

              <p className="text-sm font-semibold text-[#111]">
                LKR{' '}
                {milestonePaidTotal.toLocaleString()}
              </p>
            </div>

            <div className="rounded-lg border border-xp-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock3
                  size={14}
                  className="text-xp-muted"
                />
                <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest">
                  Pending
                </p>
              </div>

              <p className="text-sm font-semibold text-[#111]">
                {pendingMilestoneCount}
              </p>
            </div>

            <div className="rounded-lg border border-xp-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays
                  size={14}
                  className="text-xp-muted"
                />
                <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest">
                  Upcoming
                </p>
              </div>

              <p className="text-sm font-semibold text-[#111]">
                {upcomingMilestoneCount}
              </p>
            </div>
          </div>
        )}

        {/* Milestone List */}
        {projectMilestoneList.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-xp-border rounded-lg">
            <CalendarDays
              size={28}
              className="mx-auto mb-3 text-xp-muted"
            />

            <p className="text-sm font-medium text-[#111]">
              No milestones yet
            </p>

            <p className="text-xs text-xp-muted mt-1">
              Add milestones to track project stages and payments.
            </p>

            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              icon={<Plus size={13} />}
              onClick={openAddMilestone}
            >
              Add First Milestone
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {projectMilestoneList.map(
              (milestone, index) => (
                <div
                  key={milestone.id}
                  className="group rounded-lg border border-xp-border p-4 hover:bg-xp-off-white transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Step */}
                    <div className="shrink-0 w-8 h-8 rounded-full bg-xp-light-gray flex items-center justify-center">
                      <span className="text-xs font-semibold text-[#111]">
                        {index + 1}
                      </span>
                    </div>

                    {/* Main */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-[#111]">
                              {milestone.label}
                            </p>

                            <Badge
                              variant={
                                milestoneStatusColors[
                                  milestone.status
                                ]
                              }
                            >
                              {milestone.status}
                            </Badge>
                          </div>

                          {milestone.notes && (
                            <p className="text-xs text-xp-muted mt-1 whitespace-pre-wrap">
                              {milestone.notes}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-[#111]">
                            LKR{' '}
                            {Number(
                              milestone.amount ||
                                0
                            ).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-xp-light-gray">
                        <div className="flex items-center gap-1.5 text-xs text-xp-muted">
                          <CalendarDays
                            size={13}
                          />

                          <span>
                            Due{' '}
                            {milestone.due_date
                              ? formatDate(
                                  milestone.due_date
                                )
                              : '—'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() =>
                              openEditMilestone(
                                milestone
                              )
                            }
                            className="p-1.5 rounded-md text-xp-muted hover:text-[#111] hover:bg-xp-light-gray transition-colors"
                            title="Edit milestone"
                          >
                            <Pencil
                              size={13}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteMilestone(
                                milestone
                              )
                            }
                            disabled={
                              deletingMilestoneId ===
                              milestone.id
                            }
                            className="p-1.5 rounded-md text-xp-muted hover:text-red-600 hover:bg-xp-light-gray transition-colors disabled:opacity-50"
                            title="Delete milestone"
                          >
                            {deletingMilestoneId ===
                            milestone.id ? (
                              <Loader2
                                size={13}
                                className="animate-spin"
                              />
                            ) : (
                              <Trash2
                                size={13}
                              />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </Card>

      {/* =========================================================
          PAYMENTS
      ========================================================== */}
      <Card className="p-5 mt-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-xp-muted uppercase tracking-widest">
            Payments
          </p>

          <p className="text-sm font-semibold text-[#111]">
            LKR{' '}
            {totalPaid.toLocaleString()}
          </p>
        </div>

        {projectPayments.length === 0 ? (
          <p className="text-sm text-xp-muted text-center py-6">
            No payments recorded for
            this project.
          </p>
        ) : (
          <div className="space-y-2">
            {projectPayments.map(
              (payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border border-xp-border"
                >
                  <div>
                    <p className="text-sm font-medium text-[#111]">
                      {payment.payment_type}
                    </p>

                    <p className="text-xs text-xp-muted">
                      {payment.payment_date
                        ? formatDate(
                            payment.payment_date
                          )
                        : '—'}

                      {payment.reference_number
                        ? ` · ${payment.reference_number}`
                        : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#111]">
                      LKR{' '}
                      {Number(
                        payment.amount ||
                          0
                      ).toLocaleString()}
                    </p>

                    <p className="text-xs text-xp-muted">
                      {
                        payment.payment_method
                      }
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </Card>

      {/* =========================================================
          MILESTONE MODAL
      ========================================================== */}
      {showMilestoneModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeMilestoneModal()
            }
          }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-xp-border"
            role="dialog"
            aria-modal="true"
            aria-labelledby="milestone-modal-title"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-xp-light-gray">
              <div>
                <h2
                  id="milestone-modal-title"
                  className="text-base font-semibold text-[#111]"
                >
                  {editingMilestone
                    ? 'Edit Milestone'
                    : 'Add Milestone'}
                </h2>

                <p className="text-xs text-xp-muted mt-0.5">
                  {editingMilestone
                    ? 'Update this project milestone.'
                    : 'Create a new project milestone.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeMilestoneModal}
                disabled={savingMilestone}
                className="text-xp-muted hover:text-[#111] text-xl leading-none disabled:opacity-50"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Milestone Name */}
              <div>
                <label className="block text-xs font-medium text-[#111] mb-1.5">
                  Milestone Name
                  <span className="text-red-500">
                    {' '}
                    *
                  </span>
                </label>

                <input
                  type="text"
                  value={milestoneForm.label}
                  onChange={(event) =>
                    setMilestoneForm(
                      (current) => ({
                        ...current,
                        label:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="e.g. Project Advance"
                  disabled={savingMilestone}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-xp-border bg-white text-[#111] outline-none focus:border-xp-purple transition-colors disabled:bg-xp-off-white"
                />
              </div>

              {/* Amount + Due Date */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#111] mb-1.5">
                    Amount
                  </label>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-xp-muted">
                      LKR
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        milestoneForm.amount
                      }
                      onChange={(event) =>
                        setMilestoneForm(
                          (current) => ({
                            ...current,
                            amount:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="0.00"
                      disabled={savingMilestone}
                      className="w-full h-9 pl-12 pr-3 text-sm rounded-lg border border-xp-border bg-white text-[#111] outline-none focus:border-xp-purple transition-colors disabled:bg-xp-off-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#111] mb-1.5">
                    Due Date
                    <span className="text-red-500">
                      {' '}
                      *
                    </span>
                  </label>

                  <input
                    type="date"
                    value={
                      milestoneForm.due_date
                    }
                    onChange={(event) =>
                      setMilestoneForm(
                        (current) => ({
                          ...current,
                          due_date:
                            event.target
                              .value,
                        })
                      )
                    }
                    disabled={savingMilestone}
                    className="w-full h-9 px-3 text-sm rounded-lg border border-xp-border bg-white text-[#111] outline-none focus:border-xp-purple transition-colors disabled:bg-xp-off-white"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-[#111] mb-1.5">
                  Status
                </label>

                <select
                  value={milestoneForm.status}
                  onChange={(event) =>
                    setMilestoneForm(
                      (current) => ({
                        ...current,
                        status:
                          event.target
                            .value as ProjectMilestone['status'],
                      })
                    )
                  }
                  disabled={savingMilestone}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-xp-border bg-white text-[#111] outline-none focus:border-xp-purple transition-colors disabled:bg-xp-off-white"
                >
                  <option value="Pending">
                    Pending
                  </option>
                  <option value="Upcoming">
                    Upcoming
                  </option>
                  <option value="Paid">
                    Paid
                  </option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-[#111] mb-1.5">
                  Notes
                </label>

                <textarea
                  value={milestoneForm.notes}
                  onChange={(event) =>
                    setMilestoneForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Optional milestone notes..."
                  rows={3}
                  disabled={savingMilestone}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-xp-border bg-white text-[#111] outline-none focus:border-xp-purple transition-colors resize-none disabled:bg-xp-off-white"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-xp-light-gray">
              <Button
                variant="outline"
                size="sm"
                onClick={closeMilestoneModal}
                disabled={savingMilestone}
              >
                Cancel
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveMilestone}
                disabled={savingMilestone}
                icon={
                  savingMilestone ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  ) : editingMilestone ? (
                    <Pencil size={13} />
                  ) : (
                    <Plus size={13} />
                  )
                }
              >
                {savingMilestone
                  ? 'Saving...'
                  : editingMilestone
                  ? 'Update Milestone'
                  : 'Add Milestone'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
