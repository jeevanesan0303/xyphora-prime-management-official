
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Plus,
  Download,
  Eye,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import { formatDate, exportCSVSimple } from '../../lib/utils'
import { generateReportPDF } from '../../lib/pdf'

import {
  PageHeader,
  Button,
  ExportDropdown,
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
  ProgressBar,
} from '../../components/ui'

import type { Project, ProjectStatus } from '../../types'

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

const statusOptions: Array<{
  value: ProjectStatus
  label: string
}> = [
  {
    value: 'Planning',
    label: 'Planning',
  },
  {
    value: 'Proposal',
    label: 'Proposal',
  },
  {
    value: 'Approved',
    label: 'Approved',
  },
  {
    value: 'In Progress',
    label: 'In Progress',
  },
  {
    value: 'Testing',
    label: 'Testing',
  },
  {
    value: 'Completed',
    label: 'Completed',
  },
  {
    value: 'Delivered',
    label: 'Delivered',
  },
  {
    value: 'Maintenance',
    label: 'Maintenance',
  },
  {
    value: 'Cancelled',
    label: 'Cancelled',
  },
]

type ProjectForm = Omit<
  Project,
  'id' | 'project_id' | 'created_at' | 'updated_at'
>

const emptyForm = (): ProjectForm => {
  const form: ProjectForm = {
    project_name: '',
    client_id: '',
    service_id: '',
    description: '',
    technology: '',
    start_date: new Date().toISOString().slice(0, 10),
    expected_completion: '',
    actual_completion: null,
    project_value: 0,
    progress: 0,
    status: 'Planning',
    notes: '',
  }

  return form
}

export default function ProjectsPage() {
  const {
    projects,
    clients,
    services,
    settings,
    loading,
    addProject,
    updateProject,
    deleteProject,
  } = useData()

  const { success, error } = useToast()

  const navigate = useNavigate()
  const location = useLocation()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)

  const [form, setForm] = useState<ProjectForm>(() =>
    emptyForm()
  )

  const [deleteId, setDeleteId] = useState<string | null>(
    null
  )

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (location.pathname === '/projects/new') {
      setEditing(null)
      setForm(emptyForm())
      setShowModal(true)
    }
  }, [location.pathname])

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return projects.filter((project) => {
      const client = clients.find(
        (clientItem) =>
          clientItem.id === project.client_id
      )

      const projectName =
        project.project_name?.toLowerCase() ?? ''

      const projectId =
        project.project_id?.toLowerCase() ?? ''

      const clientName =
        client?.company_name?.toLowerCase() ?? ''

      const matchSearch =
        !normalizedSearch ||
        projectName.includes(normalizedSearch) ||
        projectId.includes(normalizedSearch) ||
        clientName.includes(normalizedSearch)

      const matchStatus =
        !statusFilter ||
        project.status === statusFilter

      return matchSearch && matchStatus
    })
  }, [projects, clients, search, statusFilter])

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  const openEdit = (project: Project) => {
    const editForm: ProjectForm = {
      project_name: project.project_name ?? '',
      client_id: project.client_id ?? '',
      service_id: project.service_id ?? '',
      description: project.description ?? '',
      technology: project.technology ?? '',
      start_date: project.start_date ?? '',
      expected_completion:
        project.expected_completion ?? '',
      actual_completion:
        project.actual_completion ?? null,
      project_value: Number(
        project.project_value ?? 0
      ),
      progress: Number(project.progress ?? 0),
      status: project.status,
      notes: project.notes ?? '',
    }

    setEditing(project)
    setForm(editForm)
    setShowModal(true)
  }

  const closeModal = () => {
    if (saving) {
      return
    }

    setShowModal(false)
    setEditing(null)
    setForm(emptyForm())

    if (location.pathname === '/projects/new') {
      navigate('/projects', {
        replace: true,
      })
    }
  }

  const getProgressForStatus = (
    status: ProjectStatus,
    currentProgress: number
  ): number => {
    switch (status) {
      case 'Completed':
      case 'Delivered':
      case 'Maintenance':
        return 100

      case 'Planning':
      case 'Proposal':
      case 'Approved':
      case 'Cancelled':
        return 0

      case 'Testing':
        return 90

      case 'In Progress':
        return currentProgress > 0 &&
          currentProgress < 100
          ? currentProgress
          : 25

      default:
        return currentProgress
    }
  }

  const handleProgressChange = (
    newProgress: number
  ) => {
    if (form.status !== 'In Progress') {
      return
    }

    const safeProgress = Math.max(
      0,
      Math.min(100, Number(newProgress))
    )

    setForm((previous) => ({
      ...previous,
      progress: safeProgress,
    }))
  }

  const handleStatusChange = (
    newStatus: ProjectStatus
  ) => {
    setForm((previous) => ({
      ...previous,
      status: newStatus,
      progress: getProgressForStatus(
        newStatus,
        previous.progress
      ),
    }))
  }

  const updateField = <
    K extends keyof ProjectForm
  >(
    key: K,
    value: ProjectForm[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    const projectName =
      form.project_name.trim()

    if (!projectName) {
      error('Project name is required.')
      return
    }

    if (!form.client_id) {
      error('Please select a client.')
      return
    }

    const projectValue = Number(
      form.project_value
    )

    if (
      !Number.isFinite(projectValue) ||
      projectValue < 0
    ) {
      error(
        'Project value must be a valid positive amount.'
      )
      return
    }

    let finalProgress = Number(
      form.progress
    )

    if (form.status !== 'In Progress') {
      finalProgress =
        getProgressForStatus(
          form.status,
          finalProgress
        )
    }

    finalProgress = Math.max(
      0,
      Math.min(100, finalProgress)
    )

    const finalForm: ProjectForm = {
      ...form,
      project_name: projectName,
      project_value: projectValue,
      progress: finalProgress,
      description:
        form.description?.trim() || '',
      technology:
        form.technology?.trim() || '',
      notes: form.notes?.trim() || '',
      service_id:
        form.service_id || '',
      expected_completion:
        form.expected_completion || '',
      actual_completion:
        form.actual_completion || null,
    }

    try {
      setSaving(true)

      if (editing) {
        await updateProject(
          editing.id,
          finalForm
        )

        success(
          'Project updated successfully.'
        )
      } else {
        await addProject(finalForm)

        success(
          'Project created successfully.'
        )
      }

      closeModal()
    } catch (err) {
      console.error(
        'Project save error:',
        err
      )

      const message =
        err instanceof Error
          ? err.message
          : 'Unable to save project.'

      error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) {
      return
    }

    try {
      setDeleting(true)

      await deleteProject(deleteId)

      success(
        'Project deleted successfully.'
      )

      setDeleteId(null)
    } catch (err) {
      console.error(
        'Project delete error:',
        err
      )

      const message =
        err instanceof Error
          ? err.message
          : 'Unable to delete project.'

      error(message)
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = () => {
    try {
      exportCSVSimple(
        'projects',
        [
          'ID',
          'Name',
          'Client',
          'Status',
          'Value',
          'Progress',
        ],
        filtered.map((project) => ({
          id: project.project_id,
          name: project.project_name,
          client:
            clients.find(
              (client) =>
                client.id ===
                project.client_id
            )?.company_name || '',
          status: project.status,
          value: project.project_value,
          progress: project.progress,
        }))
      )

      success(
        'Projects exported as CSV successfully.'
      )
    } catch (err) {
      console.error(
        'Project export error:',
        err
      )

      error(
        'Unable to export projects.'
      )
    }
  }

  const handleExportPDF = () => {
    if (filtered.length === 0) {
      error('There are no projects to export.')
      return
    }

    const sym = settings?.currency_symbol || settings?.currency || 'LKR'
    const totalVal = filtered.reduce((s, p) => s + Number(p.project_value || 0), 0)

    generateReportPDF(
      'Projects Summary Report',
      `Total: ${filtered.length} project(s)`,
      ['Project ID', 'Project Name', 'Client', 'Technology', 'Status', 'Progress', 'Value'],
      filtered.map((project) => [
        project.project_id,
        project.project_name,
        clients.find((c) => c.id === project.client_id)?.company_name || '—',
        project.technology || '—',
        project.status,
        `${project.progress || 0}%`,
        `${sym} ${Number(project.project_value || 0).toLocaleString()}`,
      ]),
      [{ label: 'Total Value', value: `${sym} ${totalVal.toLocaleString()}` }],
      settings,
    )

    success('Projects exported as PDF successfully.')
  }

  const clientOptions = clients.map(
    (client) => ({
      value: client.id,
      label: client.company_name,
    })
  )

  const serviceOptions = services.map(
    (service) => ({
      value: service.id,
      label: service.name,
    })
  )

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} total projects`}
        actions={
          <>
            <ExportDropdown
              onExportCSV={handleExport}
              onExportPDF={handleExportPDF}
              disabled={
                loading ||
                filtered.length === 0
              }
            />

            <Button
              variant="primary"
              size="sm"
              icon={
                <Plus size={13} />
              }
              onClick={openNew}
              disabled={loading}
            >
              New Project
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search projects..."
          className="w-64"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
          className="h-9 px-3 rounded-lg border border-xp-border text-sm text-[#111] bg-white focus:outline-none focus:ring-2 focus:ring-xp-purple/20 focus:border-xp-purple"
        >
          <option value="">
            All Status
          </option>

          {statusOptions.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>

        <span className="text-xs text-xp-muted ml-auto">
          {filtered.length} results
        </span>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-2 text-sm text-xp-muted">
              <Loader2
                size={18}
                className="animate-spin"
              />
              Loading projects...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={
              search || statusFilter
                ? 'No matching projects'
                : 'No projects'
            }
            description={
              search || statusFilter
                ? 'Try changing your search or status filter.'
                : 'Create your first project.'
            }
            action={
              !search &&
              !statusFilter
                ? {
                    label:
                      'New Project',
                    onClick:
                      openNew,
                  }
                : undefined
            }
          />
        ) : (
          <Table
            headers={[
              'Project',
              'Client',
              'Value',
              'Progress',
              'Status',
              'Due',
              'Actions',
            ]}
          >
            {filtered.map(
              (project) => {
                const client =
                  clients.find(
                    (clientItem) =>
                      clientItem.id ===
                      project.client_id
                  )

                return (
                  <TableRow
                    key={project.id}
                    onClick={() =>
                      navigate(
                        `/projects/${project.id}`
                      )
                    }
                  >
                    <Td>
                      <div>
                        <p className="font-medium text-[#111]">
                          {
                            project.project_name
                          }
                        </p>

                        <p className="text-xs text-xp-muted">
                          {
                            project.project_id
                          }
                        </p>
                      </div>
                    </Td>

                    <Td>
                      <span className="text-sm text-xp-muted">
                        {
                          client?.company_name ||
                          '—'
                        }
                      </span>
                    </Td>

                    <Td>
                      <span className="text-sm font-medium text-[#111]">
                        LKR{' '}
                        {Number(
                          project.project_value ||
                            0
                        ).toLocaleString()}
                      </span>
                    </Td>

                    <Td>
                      <div className="w-28">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-xp-muted">
                            {
                              project.progress
                            }
                            %
                          </span>
                        </div>

                        <ProgressBar
                          value={
                            project.progress
                          }
                        />
                      </div>
                    </Td>

                    <Td>
                      <Badge
                        variant={
                          statusColors[
                            project.status
                          ]
                        }
                      >
                        {
                          project.status
                        }
                      </Badge>
                    </Td>

                    <Td>
                      <span className="text-sm text-xp-muted">
                        {
                          project.expected_completion
                            ? formatDate(
                                project.expected_completion
                              )
                            : '—'
                        }
                      </span>
                    </Td>

                    <Td>
                      <div
                        className="flex items-center gap-1"
                        onClick={(
                          event
                        ) =>
                          event.stopPropagation()
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/projects/${project.id}`
                            )
                          }
                          className="p-1.5 rounded-md text-xp-muted hover:text-[#111] hover:bg-xp-light-gray"
                          title="View project"
                        >
                          <Eye
                            size={13}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openEdit(
                              project
                            )
                          }
                          className="p-1.5 rounded-md text-xp-muted hover:text-[#111] hover:bg-xp-light-gray"
                          title="Edit project"
                        >
                          <Edit2
                            size={13}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setDeleteId(
                              project.id
                            )
                          }
                          className="p-1.5 rounded-md text-xp-muted hover:text-red-600 hover:bg-red-50"
                          title="Delete project"
                        >
                          <Trash2
                            size={13}
                          />
                        </button>
                      </div>
                    </Td>
                  </TableRow>
                )
              }
            )}
          </Table>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={closeModal}
        title={
          editing
            ? 'Edit Project'
            : 'New Project'
        }
        width="max-w-2xl"
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
              {saving ? (
                <>
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />

                  {editing
                    ? 'Saving...'
                    : 'Creating...'}
                </>
              ) : editing ? (
                'Save Changes'
              ) : (
                'Create Project'
              )}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input
                label="Project Name"
                value={
                  form.project_name
                }
                onChange={(event) =>
                  updateField(
                    'project_name',
                    event.target.value
                  )
                }
                placeholder="Website Development"
                disabled={saving}
              />
            </div>

            <Select
              label="Client"
              value={
                form.client_id
              }
              onChange={(event) =>
                updateField(
                  'client_id',
                  event.target.value
                )
              }
              options={
                clientOptions
              }
              placeholder="Select client"
              disabled={saving}
            />

            <Select
              label="Service"
              value={
                form.service_id
              }
              onChange={(event) =>
                updateField(
                  'service_id',
                  event.target.value
                )
              }
              options={
                serviceOptions
              }
              placeholder="Select service"
              disabled={saving}
            />

            <Input
              label="Start Date"
              type="date"
              value={
                form.start_date
              }
              onChange={(event) =>
                updateField(
                  'start_date',
                  event.target.value
                )
              }
              disabled={saving}
            />

            <Input
              label="Expected Completion"
              type="date"
              value={
                form.expected_completion
              }
              onChange={(event) =>
                updateField(
                  'expected_completion',
                  event.target.value
                )
              }
              disabled={saving}
            />

            <Input
              label="Project Value (LKR)"
              type="number"
              min="0"
              value={
                form.project_value ===
                0
                  ? ''
                  : form.project_value
              }
              onChange={(event) =>
                updateField(
                  'project_value',
                  event.target
                    .value === ''
                    ? 0
                    : Number(
                        event.target
                          .value
                      )
                )
              }
              placeholder="0"
              disabled={saving}
            />

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-xp-muted uppercase tracking-wide">
                  Progress (
                  {
                    form.progress
                  }
                  %)
                </label>

                {form.status !==
                  'In Progress' && (
                  <span className="text-[10px] text-xp-muted italic font-normal">
                    Editable only in
                    In Progress
                  </span>
                )}
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={
                  form.progress
                }
                disabled={
                  saving ||
                  form.status !==
                    'In Progress'
                }
                onChange={(event) =>
                  handleProgressChange(
                    Number(
                      event.target
                        .value
                    )
                  )
                }
                className={`w-full mt-1.5 accent-xp-purple ${
                  form.status !==
                  'In Progress'
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer'
                }`}
              />
            </div>

            <Select
              label="Status"
              value={
                form.status
              }
              onChange={(event) =>
                handleStatusChange(
                  event.target
                    .value as ProjectStatus
                )
              }
              options={
                statusOptions
              }
              disabled={saving}
            />

            <Input
              label="Technology"
              value={
                form.technology
              }
              onChange={(event) =>
                updateField(
                  'technology',
                  event.target.value
                )
              }
              placeholder="React, Node.js..."
              disabled={saving}
            />
          </div>

          <Textarea
            label="Description"
            value={
              form.description
            }
            onChange={(event) =>
              updateField(
                'description',
                event.target.value
              )
            }
            placeholder="Project description..."
            disabled={saving}
          />

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(event) =>
              updateField(
                'notes',
                event.target.value
              )
            }
            placeholder="Additional notes..."
            disabled={saving}
          />
        </div>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => {
          if (!deleting) {
            setDeleteId(null)
          }
        }}
        title="Delete Project"
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
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </>
        }
      >
        <div className="p-6">
          <p className="text-sm text-xp-muted">
            This will permanently
            delete this project.
          </p>
        </div>
      </Modal>
    </div>
  )
}
