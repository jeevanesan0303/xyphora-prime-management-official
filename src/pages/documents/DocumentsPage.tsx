
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import {
  FolderOpen,
  FileText,
  File,
  Download,
  Eye,
  Trash2,
  Plus,
  Search,
  Upload,
  AlertTriangle,
  Building2,
  Briefcase,
  Receipt,
  CreditCard,
  User,
  Layers,
  X,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileCode,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import { formatDate, exportCSVSimple } from '../../lib/utils'
import { generateReportPDF } from '../../lib/pdf'

import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  Select,
  Textarea,
  Modal,
  EmptyState,
  ExportDropdown,
} from '../../components/ui'

import type { Document } from '../../types'

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type RelatedType =
  | 'client'
  | 'project'
  | 'invoice'
  | 'expense'
  | 'employee'
  | 'company'

type FileFilter =
  | 'all'
  | 'pdf'
  | 'docx'
  | 'sheet'
  | 'image'
  | 'other'

type UploadStage =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'saving'

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const MAX_FILE_SIZE = 50 * 1024 * 1024

const RELATED_TYPES: Array<{
  value: RelatedType
  label: string
}> = [
  {
    value: 'client',
    label: 'Client Document',
  },
  {
    value: 'project',
    label: 'Project File',
  },
  {
    value: 'invoice',
    label: 'Invoice Attachment',
  },
  {
    value: 'expense',
    label: 'Expense Receipt',
  },
  {
    value: 'employee',
    label: 'Employee Record',
  },
  {
    value: 'company',
    label: 'Company General',
  },
]

const FILE_FILTERS: Array<{
  value: FileFilter
  label: string
}> = [
  {
    value: 'all',
    label: 'All File Types',
  },
  {
    value: 'pdf',
    label: 'PDF Documents',
  },
  {
    value: 'docx',
    label: 'Word Documents',
  },
  {
    value: 'sheet',
    label: 'Spreadsheets',
  },
  {
    value: 'image',
    label: 'Images',
  },
  {
    value: 'other',
    label: 'Other Files',
  },
]

const CATEGORY_FILTERS = [
  {
    value: 'all',
    label: 'All Categories',
  },
  {
    value: 'client',
    label: 'Client',
  },
  {
    value: 'project',
    label: 'Project',
  },
  {
    value: 'invoice',
    label: 'Invoice',
  },
  {
    value: 'expense',
    label: 'Expense',
  },
  {
    value: 'employee',
    label: 'Employee',
  },
  {
    value: 'company',
    label: 'Company',
  },
]

const RELATED_TYPE_VARIANT: Record<
  RelatedType,
  'purple' | 'blue' | 'success' | 'warning' | 'muted' | 'default'
> = {
  client: 'purple',
  project: 'blue',
  invoice: 'success',
  expense: 'warning',
  employee: 'muted',
  company: 'default',
}

const RELATED_TYPE_ICONS: Record<
  RelatedType,
  typeof Building2
> = {
  client: Building2,
  project: Briefcase,
  invoice: Receipt,
  expense: CreditCard,
  employee: User,
  company: Layers,
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const formatSize = (bytes: number): string => {
  const safeBytes = Number.isFinite(bytes)
    ? Math.max(0, bytes)
    : 0

  if (safeBytes === 0) {
    return '0 B'
  }

  if (safeBytes < 1024) {
    return `${safeBytes} B`
  }

  if (safeBytes < 1024 * 1024) {
    return `${(safeBytes / 1024).toFixed(1)} KB`
  }

  if (safeBytes < 1024 * 1024 * 1024) {
    return `${(safeBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return `${(
    safeBytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`
}

const getFileExtension = (
  fileName: string
): string => {
  const parts = fileName.split('.')

  if (parts.length <= 1) {
    return 'FILE'
  }

  return parts[parts.length - 1]
    .trim()
    .toUpperCase()
}

const getFileTypeIcon = (
  type: string,
  name: string
) => {
  const lowerType = (
    type || ''
  ).toLowerCase()

  const lowerName = (
    name || ''
  ).toLowerCase()

  if (
    lowerType.includes('pdf') ||
    lowerName.endsWith('.pdf')
  ) {
    return (
      <FileText
        size={18}
        className="text-red-500 shrink-0"
      />
    )
  }

  if (
    lowerType.includes('word') ||
    lowerType.includes('docx') ||
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc')
  ) {
    return (
      <FileText
        size={18}
        className="text-blue-500 shrink-0"
      />
    )
  }

  if (
    lowerType.includes('sheet') ||
    lowerType.includes('excel') ||
    lowerType.includes('csv') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.csv')
  ) {
    return (
      <FileSpreadsheet
        size={18}
        className="text-emerald-600 shrink-0"
      />
    )
  }

  if (
    lowerType.includes('image') ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.gif')
  ) {
    return (
      <FileImage
        size={18}
        className="text-purple-500 shrink-0"
      />
    )
  }

  if (
    lowerType.includes('zip') ||
    lowerType.includes('archive') ||
    lowerName.endsWith('.zip') ||
    lowerName.endsWith('.rar') ||
    lowerName.endsWith('.7z')
  ) {
    return (
      <FileArchive
        size={18}
        className="text-amber-500 shrink-0"
      />
    )
  }

  if (
    lowerType.includes('json') ||
    lowerType.includes('javascript') ||
    lowerType.includes('html') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.js') ||
    lowerName.endsWith('.ts') ||
    lowerName.endsWith('.tsx') ||
    lowerName.endsWith('.html')
  ) {
    return (
      <FileCode
        size={18}
        className="text-cyan-600 shrink-0"
      />
    )
  }

  return (
    <File
      size={18}
      className="text-xp-muted shrink-0"
    />
  )
}

const matchesFileFilter = (
  doc: Document,
  filter: FileFilter
): boolean => {
  if (filter === 'all') {
    return true
  }

  const type = (
    doc.file_type || ''
  ).toLowerCase()

  const name = (
    doc.file_name || ''
  ).toLowerCase()

  if (filter === 'pdf') {
    return (
      type.includes('pdf') ||
      name.endsWith('.pdf')
    )
  }

  if (filter === 'docx') {
    return (
      type.includes('word') ||
      type.includes('docx') ||
      name.endsWith('.doc') ||
      name.endsWith('.docx')
    )
  }

  if (filter === 'sheet') {
    return (
      type.includes('sheet') ||
      type.includes('excel') ||
      type.includes('csv') ||
      name.endsWith('.xls') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.csv')
    )
  }

  if (filter === 'image') {
    return (
      type.includes('image') ||
      /\.(png|jpe?g|webp|gif)$/i.test(name)
    )
  }

  return !(
    type.includes('pdf') ||
    type.includes('word') ||
    type.includes('docx') ||
    type.includes('image') ||
    type.includes('sheet') ||
    type.includes('excel') ||
    type.includes('csv')
  )
}

const getRelatedEntityName = (
  type: RelatedType,
  id: string | null,
  clients: ReturnType<typeof useData>['clients'],
  projects: ReturnType<typeof useData>['projects'],
  invoices: ReturnType<typeof useData>['invoices'],
  expenses: ReturnType<typeof useData>['expenses'],
  employees: ReturnType<typeof useData>['employees']
): string => {
  if (!id) {
    return type === 'company'
      ? 'Company'
      : 'General'
  }

  if (type === 'client') {
    const client = clients.find(
      (item) => item.id === id
    )

    return client?.company_name || id
  }

  if (type === 'project') {
    const project = projects.find(
      (item) => item.id === id
    )

    return project?.project_name || id
  }

  if (type === 'invoice') {
    const invoice = invoices.find(
      (item) => item.id === id
    )

    return invoice?.invoice_number || id
  }

  if (type === 'expense') {
    const expense = expenses.find(
      (item) => item.id === id
    )

    if (!expense) {
      return id
    }

    const category =
      expense.category || 'Expense'

    const vendor =
      expense.vendor || 'Unknown vendor'

    return `${category} - ${vendor}`
  }

  if (type === 'employee') {
    const employee = employees.find(
      (item) => item.id === id
    )

    return employee?.full_name || id
  }

  return 'Company'
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function DocumentsPage() {
  const {
    documents,
    clients,
    projects,
    invoices,
    expenses,
    employees,
    settings,
    refreshData,
  } = useData()

  const {
    success,
    error,
  } = useToast()

  /* ---------------------------------------------------------------------- */
  /* Filters                                                                 */
  /* ---------------------------------------------------------------------- */

  const [search, setSearch] =
    useState('')

  const [selectedType, setSelectedType] =
    useState<FileFilter>('all')

  const [selectedCategory, setSelectedCategory] =
    useState<string>('all')

  /* ---------------------------------------------------------------------- */
  /* Modal state                                                             */
  /* ---------------------------------------------------------------------- */

  const [showUploadModal, setShowUploadModal] =
    useState(false)

  const [viewingDoc, setViewingDoc] =
    useState<Document | null>(null)

  const [deletingDoc, setDeletingDoc] =
    useState<Document | null>(null)

  /* ---------------------------------------------------------------------- */
  /* Upload state                                                            */
  /* ---------------------------------------------------------------------- */

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null)

  const [fileName, setFileName] =
    useState('')

  const [fileType, setFileType] =
    useState('application/octet-stream')

  const [relatedType, setRelatedType] =
    useState<RelatedType>('client')

  const [relatedId, setRelatedId] =
    useState('')

  const [notes, setNotes] =
    useState('')

  const [uploading, setUploading] =
    useState(false)

  const [uploadStage, setUploadStage] =
    useState<UploadStage>('idle')

  const [deleting, setDeleting] =
    useState(false)

  const [downloadingId, setDownloadingId] =
    useState<string | null>(null)

  const [dragActive, setDragActive] =
    useState(false)

  const fileInputRef =
    useRef<HTMLInputElement | null>(null)

  /* ---------------------------------------------------------------------- */
  /* Filtered documents                                                      */
  /* ---------------------------------------------------------------------- */

  const filteredDocuments = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase()

    return documents.filter((doc) => {
      const fileName =
        (doc.file_name || '').toLowerCase()

      const documentNotes =
        (doc.notes || '').toLowerCase()

      const relatedName =
        getRelatedEntityName(
          doc.related_type as RelatedType,
          doc.related_id,
          clients,
          projects,
          invoices,
          expenses,
          employees
        ).toLowerCase()

      const matchesSearch =
        normalizedSearch === '' ||
        fileName.includes(
          normalizedSearch
        ) ||
        documentNotes.includes(
          normalizedSearch
        ) ||
        relatedName.includes(
          normalizedSearch
        )

      const matchesCategory =
        selectedCategory === 'all' ||
        doc.related_type ===
          selectedCategory

      const matchesType =
        matchesFileFilter(
          doc,
          selectedType
        )

      return (
        matchesSearch &&
        matchesCategory &&
        matchesType
      )
    })
  }, [
    documents,
    clients,
    projects,
    invoices,
    expenses,
    employees,
    search,
    selectedCategory,
    selectedType,
  ])

  /* ---------------------------------------------------------------------- */
  /* Statistics                                                              */
  /* ---------------------------------------------------------------------- */

  const totalStorage = useMemo(() => {
    return documents.reduce(
      (total, doc) =>
        total +
        Math.max(
          0,
          Number(doc.file_size) || 0
        ),
      0
    )
  }, [documents])

  const pdfCount = useMemo(() => {
    return documents.filter((doc) =>
      matchesFileFilter(
        doc,
        'pdf'
      )
    ).length
  }, [documents])

  const clientAttachmentCount =
    useMemo(() => {
      return documents.filter(
        (doc) =>
          doc.related_type ===
          'client'
      ).length
    }, [documents])

  /* ---------------------------------------------------------------------- */
  /* Entity options                                                          */
  /* ---------------------------------------------------------------------- */

  const entityOptions = useMemo(() => {
    if (relatedType === 'client') {
      return clients.map((client) => ({
        value: client.id,
        label: client.contact_person
          ? `${client.company_name} (${client.contact_person})`
          : client.company_name,
      }))
    }

    if (relatedType === 'project') {
      return projects.map((project) => ({
        value: project.id,
        label: `${project.project_name} (${project.project_id})`,
      }))
    }

    if (relatedType === 'invoice') {
      return invoices.map((invoice) => ({
        value: invoice.id,
        label: `${invoice.invoice_number} - ${Number(
          invoice.total
        ).toLocaleString()}`,
      }))
    }

    if (relatedType === 'expense') {
      return expenses.map((expense) => ({
        value: expense.id,
        label: `${expense.category} - ${expense.vendor}`,
      }))
    }

    if (relatedType === 'employee') {
      return employees.map((employee) => ({
        value: employee.id,
        label: `${employee.full_name} (${employee.role})`,
      }))
    }

    return []
  }, [
    relatedType,
    clients,
    projects,
    invoices,
    expenses,
    employees,
  ])

  /* ---------------------------------------------------------------------- */
  /* File selection                                                          */
  /* ---------------------------------------------------------------------- */

  const handleFileChange = (
    file: File | null
  ) => {
    if (!file) {
      return
    }

    if (file.size <= 0) {
      error(
        'The selected file is empty.'
      )
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      error(
        `File is too large. Maximum allowed size is ${formatSize(
          MAX_FILE_SIZE
        )}.`
      )

      return
    }

    setSelectedFile(file)
    setFileName(file.name)
    setFileType(
      file.type ||
        'application/octet-stream'
    )
  }

  const handleNativeFileInput = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0]

    if (file) {
      handleFileChange(file)
    }

    event.target.value = ''
  }

  const handleDrop = (
    event: DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()

    setDragActive(false)

    const file =
      event.dataTransfer.files?.[0]

    if (file) {
      handleFileChange(file)
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Upload form reset                                                       */
  /* ---------------------------------------------------------------------- */

  const resetUploadForm = () => {
    setSelectedFile(null)
    setFileName('')
    setFileType(
      'application/octet-stream'
    )
    setRelatedType('client')
    setRelatedId('')
    setNotes('')
    setDragActive(false)
    setUploadStage('idle')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const closeUploadModal = () => {
    if (uploading) {
      return
    }

    setShowUploadModal(false)
    resetUploadForm()
  }

  /* ---------------------------------------------------------------------- */
  /* Upload                                                                  */
  /* ---------------------------------------------------------------------- */

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      error(
        'Please select a file to upload.'
      )
      return
    }

    const trimmedFileName =
      fileName.trim()

    if (!trimmedFileName) {
      error(
        'Please enter a file name.'
      )
      return
    }

    if (selectedFile.size <= 0) {
      error(
        'The selected file is empty.'
      )
      return
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      error(
        `File is too large. Maximum allowed size is ${formatSize(
          MAX_FILE_SIZE
        )}.`
      )
      return
    }

    if (
      relatedType !== 'company' &&
      !relatedId
    ) {
      error(
        `Please select the ${relatedType} this document belongs to.`
      )
      return
    }

    setUploading(true)
    setUploadStage('preparing')

    let storagePath: string | null = null

    try {
      /* ------------------------------------------------------------------ */
      /* Step 1: Generate secure R2 upload URL                              */
      /* ------------------------------------------------------------------ */

      const {
        data: uploadData,
        error: uploadFunctionError,
      } =
        await supabase.functions.invoke(
          'document-upload',
          {
            body: {
              file_name:
                trimmedFileName,
              file_type:
                fileType ||
                selectedFile.type ||
                'application/octet-stream',
              file_size:
                selectedFile.size,
              related_type:
                relatedType,
              related_id:
                relatedType ===
                'company'
                  ? null
                  : relatedId || null,
            },
          }
        )

      if (uploadFunctionError) {
        throw new Error(
          uploadFunctionError.message ||
            'Unable to initialize file upload.'
        )
      }

      if (
        !uploadData?.success ||
        !uploadData.upload_url ||
        !uploadData.storage_path
      ) {
        throw new Error(
          uploadData?.error ||
            'The server did not return a valid upload URL.'
        )
      }

      storagePath =
        uploadData.storage_path

      /* ------------------------------------------------------------------ */
      /* Step 2: Upload directly to Cloudflare R2                           */
      /* ------------------------------------------------------------------ */

      setUploadStage('uploading')

      const contentType =
        fileType ||
        selectedFile.type ||
        'application/octet-stream'

      const r2Response =
        await fetch(
          uploadData.upload_url,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                contentType,
            },
            body: selectedFile,
          }
        )

      if (!r2Response.ok) {
        let responseText = ''

        try {
          responseText =
            await r2Response.text()
        } catch {
          responseText = ''
        }

        console.error(
          'Cloudflare R2 upload failed:',
          {
            status:
              r2Response.status,
            response:
              responseText,
          }
        )

        throw new Error(
          `Cloud storage upload failed (${r2Response.status}).`
        )
      }

      /* ------------------------------------------------------------------ */
      /* Step 3: Save document metadata                                    */
      /* ------------------------------------------------------------------ */

      setUploadStage('saving')

      const {
        data: completeData,
        error:
          completeFunctionError,
      } =
        await supabase.functions.invoke(
          'document-upload-complete',
          {
            body: {
              file_name:
                trimmedFileName,
              file_type:
                contentType,
              file_size:
                selectedFile.size,
              storage_path:
                storagePath,
              related_type:
                relatedType,
              related_id:
                relatedType ===
                'company'
                  ? null
                  : relatedId || null,
              notes:
                notes.trim(),
            },
          }
        )

      if (completeFunctionError) {
        /*
         * The R2 object may now exist while the database
         * record was not created. We report this clearly.
         *
         * We intentionally do not pretend the operation
         * succeeded.
         */
        throw new Error(
          completeFunctionError.message ||
            'The file was uploaded, but its document record could not be saved.'
        )
      }

      if (
        !completeData?.success ||
        !completeData.document
      ) {
        throw new Error(
          completeData?.error ||
            'The file was uploaded, but document registration failed.'
        )
      }

      /* ------------------------------------------------------------------ */
      /* Step 4: Refresh application data                                  */
      /* ------------------------------------------------------------------ */

      await refreshData()

      success(
        `"${trimmedFileName}" uploaded successfully.`
      )

      setShowUploadModal(false)
      resetUploadForm()
    } catch (err) {
      console.error(
        'Document upload failed:',
        err
      )

      error(
        err instanceof Error
          ? err.message
          : 'Failed to upload document.'
      )
    } finally {
      setUploading(false)
      setUploadStage('idle')
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Download                                                                */
  /* ---------------------------------------------------------------------- */

  const handleDownload = async (
    doc: Document
  ) => {
    if (!doc.id) {
      error(
        'Invalid document.'
      )
      return
    }

    setDownloadingId(doc.id)

    try {
      const {
        data,
        error: functionError,
      } =
        await supabase.functions.invoke(
          'document-download',
          {
            body: {
              document_id:
                doc.id,
            },
          }
        )

      if (functionError) {
        throw new Error(
          functionError.message ||
            'Unable to prepare document download.'
        )
      }

      if (
        !data?.success ||
        !data.download_url
      ) {
        throw new Error(
          data?.error ||
            'A secure download URL was not generated.'
        )
      }

      const link =
        document.createElement(
          'a'
        )

      link.href =
        data.download_url

      link.download =
        data.file_name ||
        doc.file_name

      link.target = '_blank'
      link.rel =
        'noopener noreferrer'

      document.body.appendChild(
        link
      )

      link.click()
      link.remove()
    } catch (err) {
      console.error(
        'Document download failed:',
        err
      )

      error(
        err instanceof Error
          ? err.message
          : 'Failed to download document.'
      )
    } finally {
      setDownloadingId(null)
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Delete                                                                  */
  /* ---------------------------------------------------------------------- */

  const handleDeleteConfirm =
    async () => {
      if (!deletingDoc) {
        return
      }

      setDeleting(true)

      try {
        const {
          data,
          error: functionError,
        } =
          await supabase.functions.invoke(
            'document-delete',
            {
              body: {
                document_id:
                  deletingDoc.id,
              },
            }
          )

        if (functionError) {
          throw new Error(
            functionError.message ||
              'Unable to delete document.'
          )
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
              'Unable to delete document.'
          )
        }

        if (
          viewingDoc?.id ===
          deletingDoc.id
        ) {
          setViewingDoc(null)
        }

        await refreshData()

        success(
          `Document "${deletingDoc.file_name}" deleted successfully.`
        )

        setDeletingDoc(null)
      } catch (err) {
        console.error(
          'Document deletion failed:',
          err
        )

        error(
          err instanceof Error
            ? err.message
            : 'Failed to delete document.'
        )
      } finally {
        setDeleting(false)
      }
    }

  /* ---------------------------------------------------------------------- */
  /* Upload status                                                           */
  /* ---------------------------------------------------------------------- */

  const uploadStatusText =
    uploadStage === 'preparing'
      ? 'Preparing secure upload...'
      : uploadStage === 'uploading'
        ? 'Uploading to Cloudflare R2...'
        : uploadStage === 'saving'
          ? 'Saving document information...'
          : 'Secure upload ready'

  /* ---------------------------------------------------------------------- */
  /* Export PDF & CSV                                                       */
  /* ---------------------------------------------------------------------- */

  const handleExportPDF = () => {
    if (filteredDocuments.length === 0) {
      error('No documents to export.')
      return
    }

    try {
      generateReportPDF(
        'Document Registry',
        `Showing ${filteredDocuments.length} document record${filteredDocuments.length !== 1 ? 's' : ''}`,
        ['File Name', 'Category', 'Related Entity', 'File Type', 'Upload Date'],
        filteredDocuments.map((doc) => [
          doc.file_name || '—',
          doc.related_type || 'company',
          getRelatedEntityName(
            doc.related_type as RelatedType,
            doc.related_id,
            clients,
            projects,
            invoices,
            expenses,
            employees
          ),
          doc.file_type || '—',
          doc.upload_date ? formatDate(doc.upload_date) : '—',
        ]),
        [
          { label: 'Total Documents', value: `${documents.length}` },
          { label: 'Filtered Documents', value: `${filteredDocuments.length}` },
        ],
        settings
      )
      success(`Exported ${filteredDocuments.length} document${filteredDocuments.length !== 1 ? 's' : ''} to PDF.`)
    } catch (err) {
      console.error('Failed to export documents PDF:', err)
      error('Failed to generate documents PDF.')
    }
  }

  const handleExportCSV = () => {
    if (filteredDocuments.length === 0) {
      error('No documents to export.')
      return
    }

    try {
      exportCSVSimple(
        'documents-registry',
        ['File Name', 'Category', 'Related Entity', 'File Type', 'File Size (Bytes)', 'Upload Date', 'Notes'],
        filteredDocuments.map((doc) => ({
          name: doc.file_name || '',
          category: doc.related_type || '',
          entity: getRelatedEntityName(
            doc.related_type as RelatedType,
            doc.related_id,
            clients,
            projects,
            invoices,
            expenses,
            employees
          ),
          type: doc.file_type || '',
          size: doc.file_size || 0,
          upload_date: doc.upload_date || '',
          notes: doc.notes || '',
        }))
      )
      success(`Exported ${filteredDocuments.length} document${filteredDocuments.length !== 1 ? 's' : ''} to CSV.`)
    } catch (err) {
      console.error('Failed to export documents CSV:', err)
      error('Failed to export documents CSV.')
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle={`${documents.length} documents stored and managed securely`}
        actions={
          <>
            <ExportDropdown
              onExportPDF={handleExportPDF}
              onExportCSV={handleExportCSV}
              disabled={filteredDocuments.length === 0}
            />

            <Button
              variant="purple"
              size="sm"
              icon={
                <Plus size={14} />
              }
              onClick={() =>
                setShowUploadModal(true)
              }
            >
              Upload Document
            </Button>
          </>
        }
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest">
              Total Documents
            </p>

            <FolderOpen
              size={16}
              className="text-[#6366f1]"
            />
          </div>

          <p className="text-2xl font-bold text-[#111] mt-2">
            {documents.length}
          </p>

          <p className="text-xs text-xp-muted mt-0.5">
            Files in repository
          </p>
        </Card>

        <Card className="p-4.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest">
              Total Storage
            </p>

            <Layers
              size={16}
              className="text-purple-600"
            />
          </div>

          <p className="text-2xl font-bold text-[#111] mt-2">
            {formatSize(
              totalStorage
            )}
          </p>

          <p className="text-xs text-xp-muted mt-0.5">
            Cloud document storage
          </p>
        </Card>

        <Card className="p-4.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest">
              PDF Documents
            </p>

            <FileText
              size={16}
              className="text-red-500"
            />
          </div>

          <p className="text-2xl font-bold text-[#111] mt-2">
            {pdfCount}
          </p>

          <p className="text-xs text-xp-muted mt-0.5">
            Contracts, invoices & receipts
          </p>
        </Card>

        <Card className="p-4.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest">
              Client Attachments
            </p>

            <Building2
              size={16}
              className="text-emerald-600"
            />
          </div>

          <p className="text-2xl font-bold text-[#111] mt-2">
            {clientAttachmentCount}
          </p>

          <p className="text-xs text-xp-muted mt-0.5">
            Client-related documents
          </p>
        </Card>
      </div>

      {/* Search and filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center gap-3 justify-between">
          <div className="w-full md:w-80">
            <Input
              prefix={
                <Search
                  size={14}
                  className="text-xp-muted"
                />
              }
              placeholder="Search files, notes or records..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              suffix={
                search ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch('')
                    }
                    className="text-xp-muted hover:text-[#111] p-0.5"
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                ) : undefined
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="w-40">
              <Select
                value={
                  selectedCategory
                }
                onChange={(event) =>
                  setSelectedCategory(
                    event.target.value
                  )
                }
                options={
                  CATEGORY_FILTERS
                }
              />
            </div>

            <div className="w-40">
              <Select
                value={selectedType}
                onChange={(event) =>
                  setSelectedType(
                    event.target
                      .value as FileFilter
                  )
                }
                options={
                  FILE_FILTERS
                }
              />
            </div>

            {(search ||
              selectedCategory !==
                'all' ||
              selectedType !==
                'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setSelectedCategory(
                    'all'
                  )
                  setSelectedType(
                    'all'
                  )
                }}
                className="text-xs text-xp-muted hover:text-[#111]"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Documents */}
      <Card>
        {filteredDocuments.length === 0 ? (
          <EmptyState
            title={
              documents.length === 0
                ? 'No documents stored yet'
                : 'No matching documents found'
            }
            description={
              documents.length === 0
                ? 'Upload client contracts, requirements, invoices, or expense receipts to get started.'
                : 'Try adjusting your search query or filter selections.'
            }
            icon={FolderOpen}
            action={
              documents.length === 0
                ? {
                    label:
                      'Upload First Document',
                    onClick: () =>
                      setShowUploadModal(
                        true
                      ),
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-xp-off-white/70 border-b border-xp-border text-[11px] font-bold text-xp-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">
                    File
                  </th>

                  <th className="py-3.5 px-4">
                    Type
                  </th>

                  <th className="py-3.5 px-4">
                    Size
                  </th>

                  <th className="py-3.5 px-4">
                    Related To
                  </th>

                  <th className="py-3.5 px-4">
                    Uploaded
                  </th>

                  <th className="py-3.5 px-5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-xp-border/60">
                {filteredDocuments.map(
                  (doc) => {
                    const relatedType =
                      doc.related_type as RelatedType

                    const entityName =
                      getRelatedEntityName(
                        relatedType,
                        doc.related_id,
                        clients,
                        projects,
                        invoices,
                        expenses,
                        employees
                      )

                    const RelatedIcon =
                      RELATED_TYPE_ICONS[
                        relatedType
                      ]

                    const isDownloading =
                      downloadingId ===
                      doc.id

                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-xp-off-white/50 transition-colors group"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-xp-off-white border border-xp-border flex items-center justify-center shrink-0">
                              {getFileTypeIcon(
                                doc.file_type,
                                doc.file_name
                              )}
                            </div>

                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingDoc(
                                    doc
                                  )
                                }
                                className="font-semibold text-[#111] hover:text-xp-purple transition-colors truncate text-left block max-w-72"
                                title={
                                  doc.file_name
                                }
                              >
                                {
                                  doc.file_name
                                }
                              </button>

                              {doc.notes ? (
                                <p className="text-xs text-xp-muted truncate max-w-72 mt-0.5">
                                  {
                                    doc.notes
                                  }
                                </p>
                              ) : (
                                <p className="text-[11px] text-gray-400 italic">
                                  No notes added
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-xp-light-gray text-xp-muted uppercase">
                            {getFileExtension(
                              doc.file_name
                            )}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-xs font-medium text-xp-muted font-mono">
                          {formatSize(
                            Number(
                              doc.file_size
                            ) || 0
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {RelatedIcon && (
                              <RelatedIcon
                                size={13}
                                className="text-xp-muted shrink-0"
                              />
                            )}

                            <Badge
                              variant={
                                RELATED_TYPE_VARIANT[
                                  relatedType
                                ] ||
                                'default'
                              }
                            >
                              <span className="capitalize">
                                {
                                  doc.related_type
                                }
                              </span>
                            </Badge>

                            {entityName !==
                              'General' &&
                              entityName !==
                                'Company' && (
                                <span
                                  className="text-xs text-xp-muted truncate max-w-36"
                                  title={
                                    entityName
                                  }
                                >
                                  ·{' '}
                                  {
                                    entityName
                                  }
                                </span>
                              )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-xp-muted">
                          {formatDate(
                            doc.upload_date
                          )}
                        </td>

                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setViewingDoc(
                                  doc
                                )
                              }
                              className="p-1.5 rounded-lg text-xp-muted hover:text-[#111] hover:bg-xp-light-gray transition-colors"
                              title="View document"
                            >
                              <Eye
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDownload(
                                  doc
                                )
                              }
                              disabled={
                                isDownloading
                              }
                              className="p-1.5 rounded-lg text-xp-muted hover:text-[#111] hover:bg-xp-light-gray transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Download document"
                            >
                              <Download
                                size={15}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDeletingDoc(
                                  doc
                                )
                              }
                              disabled={
                                isDownloading
                              }
                              className="p-1.5 rounded-lg text-xp-muted hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete document"
                            >
                              <Trash2
                                size={15}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Upload modal */}
      <Modal
        open={showUploadModal}
        onClose={
          closeUploadModal
        }
        title="Upload New Document"
        width="max-w-xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={
                closeUploadModal
              }
              disabled={uploading}
            >
              Cancel
            </Button>

            <Button
              variant="purple"
              onClick={
                handleUploadSubmit
              }
              loading={uploading}
              disabled={uploading}
              icon={
                <Upload size={14} />
              }
            >
              {uploading
                ? 'Uploading...'
                : 'Upload Document'}
            </Button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() =>
              setDragActive(false)
            }
            onDrop={
              handleDrop
            }
            onClick={() =>
              uploading
                ? undefined
                : fileInputRef.current?.click()
            }
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
              uploading
                ? 'cursor-not-allowed opacity-70'
                : 'cursor-pointer'
            } ${
              dragActive
                ? 'border-xp-purple bg-purple-50/50'
                : selectedFile
                  ? 'border-emerald-400 bg-emerald-50/20'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={
                handleNativeFileInput
              }
              disabled={uploading}
              className="hidden"
            />

            <div className="w-12 h-12 rounded-full bg-xp-light-purple text-xp-purple mx-auto flex items-center justify-center mb-2.5">
              <Upload size={20} />
            </div>

            {selectedFile ? (
              <div>
                <p className="text-sm font-bold text-[#111] break-all">
                  {
                    selectedFile.name
                  }
                </p>

                <p className="text-xs text-xp-muted mt-1">
                  {formatSize(
                    selectedFile.size
                  )}{' '}
                  · Click or drag to replace
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-[#111]">
                  Click to select file or drag & drop
                </p>

                <p className="text-xs text-xp-muted mt-1">
                  Maximum file size:{' '}
                  {formatSize(
                    MAX_FILE_SIZE
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Upload status */}
          {uploading && (
            <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-xp-purple animate-pulse" />

                  <p className="text-xs font-semibold text-purple-800">
                    {uploadStatusText}
                  </p>
                </div>

                <span className="text-[10px] font-mono text-purple-600 uppercase">
                  {uploadStage}
                </span>
              </div>
            </div>
          )}

          {/* File details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Input
                label="File Name *"
                value={fileName}
                onChange={(event) =>
                  setFileName(
                    event.target.value
                  )
                }
                disabled={uploading}
                placeholder="e.g. Service_Agreement.pdf"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <Input
                label="File Type"
                value={fileType}
                onChange={(event) =>
                  setFileType(
                    event.target.value
                  )
                }
                disabled={uploading}
                placeholder="application/pdf"
              />
            </div>
          </div>

          {/* Relationship */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Select
                label="Related Category"
                value={relatedType}
                onChange={(event) => {
                  setRelatedType(
                    event.target
                      .value as RelatedType
                  )
                  setRelatedId('')
                }}
                options={
                  RELATED_TYPES
                }
                disabled={uploading}
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              {entityOptions.length >
              0 ? (
                <Select
                  label={`Select ${
                    relatedType
                      .charAt(0)
                      .toUpperCase() +
                    relatedType.slice(
                      1
                    )
                  }`}
                  value={relatedId}
                  onChange={(event) =>
                    setRelatedId(
                      event.target.value
                    )
                  }
                  disabled={uploading}
                  options={[
                    {
                      value: '',
                      label:
                        '-- None / General --',
                    },
                    ...entityOptions,
                  ]}
                />
              ) : (
                <div className="flex flex-col justify-end h-full pb-1">
                  <p className="text-xs text-xp-muted">
                    General document — not linked to a specific record.
                  </p>
                </div>
              )}
            </div>
          </div>

          <Textarea
            label="Notes / Description"
            value={notes}
            onChange={(event) =>
              setNotes(
                event.target.value
              )
            }
            disabled={uploading}
            placeholder="Add helpful notes, context, or description..."
          />

          {/* Secure storage notice */}
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <Upload
              size={16}
              className="text-emerald-600 shrink-0 mt-0.5"
            />

            <div>
              <p className="text-xs font-semibold text-emerald-800">
                Secure Cloud Storage
              </p>

              <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                Files are uploaded directly to
                private Cloudflare R2 storage using
                a temporary secure upload URL.
                Your R2 credentials are never exposed
                to the browser.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* View modal */}
      <Modal
        open={!!viewingDoc}
        onClose={() =>
          setViewingDoc(null)
        }
        title={
          viewingDoc?.file_name ||
          'Document Details'
        }
        width="max-w-2xl"
        footer={
          viewingDoc ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setViewingDoc(null)
                }
              >
                Close
              </Button>

              <Button
                variant="danger"
                size="sm"
                icon={
                  <Trash2 size={13} />
                }
                onClick={() =>
                  setDeletingDoc(
                    viewingDoc
                  )
                }
              >
                Delete
              </Button>

              <Button
                variant="purple"
                size="sm"
                icon={
                  <Download size={13} />
                }
                loading={
                  downloadingId ===
                  viewingDoc.id
                }
                onClick={() =>
                  handleDownload(
                    viewingDoc
                  )
                }
              >
                Download File
              </Button>
            </>
          ) : null
        }
      >
        {viewingDoc && (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-xp-off-white border border-xp-border">
              <div className="w-12 h-12 rounded-xl bg-white border border-xp-border flex items-center justify-center shrink-0">
                {getFileTypeIcon(
                  viewingDoc.file_type,
                  viewingDoc.file_name
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-[#111] break-all">
                  {
                    viewingDoc.file_name
                  }
                </h3>

                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-xp-muted">
                  <span className="font-mono">
                    {formatSize(
                      Number(
                        viewingDoc.file_size
                      ) || 0
                    )}
                  </span>

                  <span>·</span>

                  <span>
                    Uploaded{' '}
                    {formatDate(
                      viewingDoc.upload_date
                    )}
                  </span>

                  <span>·</span>

                  <Badge
                    variant={
                      RELATED_TYPE_VARIANT[
                        viewingDoc
                          .related_type as RelatedType
                      ] ||
                      'default'
                    }
                  >
                    {
                      viewingDoc.related_type
                    }
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                <span className="text-xp-muted font-medium uppercase tracking-wider text-[10px] block mb-1">
                  Associated Record
                </span>

                <span className="font-bold text-[#111]">
                  {getRelatedEntityName(
                    viewingDoc.related_type as RelatedType,
                    viewingDoc.related_id,
                    clients,
                    projects,
                    invoices,
                    expenses,
                    employees
                  )}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-gray-100 bg-gray-50/50">
                <span className="text-xp-muted font-medium uppercase tracking-wider text-[10px] block mb-1">
                  MIME / File Format
                </span>

                <span className="font-mono font-semibold text-[#111] break-all">
                  {
                    viewingDoc.file_type
                  }
                </span>
              </div>
            </div>

            {viewingDoc.notes && (
              <div className="p-3.5 rounded-lg border border-purple-100 bg-purple-50/30">
                <span className="text-[10px] font-bold text-[#6366f1] uppercase tracking-wider block mb-1">
                  Notes & Description
                </span>

                <p className="text-xs text-[#374151] leading-relaxed whitespace-pre-wrap">
                  {
                    viewingDoc.notes
                  }
                </p>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between text-xs text-xp-muted">
                <span className="font-medium flex items-center gap-1.5">
                  <FileText
                    size={13}
                  />
                  Document Preview
                </span>

                <span className="text-[11px] font-mono">
                  Private R2 storage
                </span>
              </div>

              <div className="p-8 text-center space-y-4 bg-linear-to-b from-white to-gray-50/40">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 text-xp-purple mx-auto flex items-center justify-center border border-purple-100">
                  {getFileTypeIcon(
                    viewingDoc.file_type,
                    viewingDoc.file_name
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-sm text-[#111]">
                    {
                      viewingDoc.file_name
                    }
                  </h4>

                  <p className="text-xs text-xp-muted mt-1 max-w-sm mx-auto leading-relaxed">
                    This document is stored privately
                    in Cloudflare R2. Use the secure
                    download action to retrieve the
                    original file.
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  icon={
                    <Download size={13} />
                  }
                  loading={
                    downloadingId ===
                    viewingDoc.id
                  }
                  onClick={() =>
                    handleDownload(
                      viewingDoc
                    )
                  }
                >
                  Download
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete modal */}
      <Modal
        open={!!deletingDoc}
        onClose={() =>
          deleting
            ? undefined
            : setDeletingDoc(null)
        }
        title="Delete Document"
        width="max-w-md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDeletingDoc(null)
              }
              disabled={deleting}
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              size="sm"
              icon={
                <Trash2 size={13} />
              }
              onClick={
                handleDeleteConfirm
              }
              loading={deleting}
              disabled={deleting}
            >
              Delete Document
            </Button>
          </>
        }
      >
        {deletingDoc && (
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs">
              <AlertTriangle
                size={18}
                className="shrink-0"
              />

              <span>
                Are you sure you want to permanently delete{' '}
                <strong>
                  {
                    deletingDoc.file_name
                  }
                </strong>
                ?
              </span>
            </div>

            <p className="text-xs text-xp-muted leading-relaxed">
              This permanently removes the file
              from Cloudflare R2 storage and
              removes its document record from
              the system. This action cannot be
              undone.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
