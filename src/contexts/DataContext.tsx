import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

import type {
  Client,
  Service,
  Project,
  ProjectMilestone,
  Invoice,
  Payment,
  Expense,
  Subscription,
  Employee,
  SalaryRecord,
  Document,
  ActivityLog,
  CompanySettings,
  InvoiceItem,
} from '../types'

import { supabase } from '../lib/supabase'

interface DataContextType {
  clients: Client[]
  services: Service[]
  projects: Project[]
  projectMilestones: ProjectMilestone[]
  invoices: Invoice[]
  payments: Payment[]
  expenses: Expense[]
  subscriptions: Subscription[]
  employees: Employee[]
  salaries: SalaryRecord[]
  documents: Document[]
  activityLogs: ActivityLog[]
  settings: CompanySettings

  loading: boolean
  refreshData: () => Promise<void>

  nextInvoiceNumber: () => string

  // Client CRUD
  addClient: (
    c: Omit<Client, 'id' | 'client_id' | 'created_at' | 'updated_at'>
  ) => Promise<Client>

  updateClient: (
    id: string,
    c: Partial<Client>
  ) => Promise<void>

  deleteClient: (id: string) => Promise<void>

  // Service CRUD
  addService: (
    s: Omit<Service, 'id' | 'created_at'>
  ) => Promise<Service>

  updateService: (
    id: string,
    s: Partial<Service>
  ) => Promise<void>

  deleteService: (id: string) => Promise<void>

  // Project CRUD
  addProject: (
    p: Omit<Project, 'id' | 'project_id' | 'created_at' | 'updated_at'>
  ) => Promise<Project>

  updateProject: (
    id: string,
    p: Partial<Project>
  ) => Promise<void>

  deleteProject: (id: string) => Promise<void>

  // Project Milestone CRUD
  addProjectMilestone: (
    milestone: Omit<ProjectMilestone, 'id'>
  ) => Promise<ProjectMilestone>

  updateProjectMilestone: (
    id: string,
    milestone: Partial<ProjectMilestone>
  ) => Promise<void>

  deleteProjectMilestone: (
    id: string
  ) => Promise<void>

  // Invoice CRUD
  addInvoice: (
    inv: Omit<
      Invoice,
      'id' | 'invoice_number' | 'created_at' | 'updated_at'
    > & {
      invoice_number?: string
    }
  ) => Promise<Invoice>

  updateInvoice: (
    id: string,
    inv: Partial<Invoice>
  ) => Promise<void>

  deleteInvoice: (id: string) => Promise<void>

  // Payment CRUD
  addPayment: (
    p: Omit<Payment, 'id' | 'payment_id' | 'created_at'>
  ) => Promise<Payment>

  // Expense CRUD
  addExpense: (
    e: Omit<Expense, 'id' | 'expense_id' | 'created_at'>
  ) => Promise<Expense>

  updateExpense: (
    id: string,
    e: Partial<Expense>
  ) => Promise<void>

  deleteExpense: (id: string) => Promise<void>

  // Subscription CRUD
  addSubscription: (
    s: Omit<
      Subscription,
      'id' | 'subscription_id' | 'created_at'
    >
  ) => Promise<Subscription>

  updateSubscription: (
    id: string,
    s: Partial<Subscription>
  ) => Promise<void>

  deleteSubscription: (id: string) => Promise<void>

  // Employee CRUD
  addEmployee: (
    e: Omit<Employee, 'id' | 'employee_id' | 'created_at'>
  ) => Promise<Employee>

  updateEmployee: (
    id: string,
    e: Partial<Employee>
  ) => Promise<void>

  deleteEmployee: (id: string) => Promise<void>

  // Salary CRUD
  addSalary: (
    s: Omit<SalaryRecord, 'id' | 'created_at'>
  ) => Promise<SalaryRecord>

  updateSalary: (
    id: string,
    s: Partial<SalaryRecord>
  ) => Promise<void>

  // Document CRUD
  addDocument: (
    doc: Omit<Document, 'id' | 'upload_date'>
  ) => Promise<Document>

  deleteDocument: (id: string) => Promise<void>

  // Settings
  updateSettings: (
    s: Partial<CompanySettings>
  ) => Promise<void>

  // Activity
  addActivity: (
    action: string,
    description: string,
    entity_type: string,
    entity_id?: string
  ) => Promise<void>
}

const DataContext = createContext<DataContextType | null>(null)

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const pad = (value: number) =>
  String(value).padStart(3, '0')

const createUUID = () =>
  crypto.randomUUID()

const throwSupabaseError = (
  error: { message?: string } | null,
  operation: string
) => {
  if (error) {
    throw new Error(
      `${operation} failed: ${
        error.message ||
        'Unknown database error'
      }`
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Database mappers                                                           */
/* -------------------------------------------------------------------------- */

const mapClient = (
  row: any
): Client => ({
  id: row.id,
  client_id: row.client_id,
  company_name:
    row.company_name,
  contact_person:
    row.contact_person,
  phone: row.phone,
  whatsapp: row.whatsapp,
  email: row.email,
  address: row.address,
  business_type:
    row.business_type,
  website: row.website,
  registration_number:
    row.registration_number,
  date_joined:
    row.date_joined,
  status: row.status,
  notes: row.notes,
  created_at:
    row.created_at,
  updated_at:
    row.updated_at,
})

const mapService = (
  row: any
): Service => ({
  id: row.id,
  name: row.name,
  description:
    row.description,
  default_price: Number(
    row.default_price ?? 0
  ),
  created_at:
    row.created_at,
})

const mapProject = (
  row: any
): Project => ({
  id: row.id,
  project_id:
    row.project_id,
  project_name:
    row.project_name,
  client_id:
    row.client_id,
  service_id:
    row.service_id,
  description:
    row.description,
  technology:
    row.technology,
  start_date:
    row.start_date,
  expected_completion:
    row.expected_completion,
  actual_completion:
    row.actual_completion,
  project_value: Number(
    row.project_value ?? 0
  ),
  progress: Number(
    row.progress ?? 0
  ),
  status: row.status,
  notes: row.notes,
  created_at:
    row.created_at,
  updated_at:
    row.updated_at,
})

const mapProjectMilestone = (
  row: any
): ProjectMilestone => ({
  id: row.id,
  project_id:
    row.project_id,
  label: row.label,
  amount: Number(
    row.amount ?? 0
  ),
  due_date:
    row.due_date,
  status: row.status,
  notes: row.notes,
})

const mapInvoiceItem = (
  row: any
): InvoiceItem => ({
  id: row.id,
  invoice_id:
    row.invoice_id,
  description:
    row.description,
  quantity: Number(
    row.quantity ?? 0
  ),
  unit_price: Number(
    row.unit_price ?? 0
  ),
  discount: Number(
    row.discount ?? 0
  ),
  tax: Number(
    row.tax ?? 0
  ),
  total: Number(
    row.total ?? 0
  ),
})

const mapInvoice = (
  row: any,
  items: InvoiceItem[] = []
): Invoice => ({
  id: row.id,
  invoice_number:
    row.invoice_number,
  client_id:
    row.client_id,
  project_id:
    row.project_id,
  invoice_date:
    row.invoice_date,
  due_date:
    row.due_date,
  payment_terms:
    row.payment_terms,
  items,
  subtotal: Number(
    row.subtotal ?? 0
  ),
  discount: Number(
    row.discount ?? 0
  ),
  tax: Number(
    row.tax ?? 0
  ),
  total: Number(
    row.total ?? 0
  ),
  paid: Number(
    row.paid ?? 0
  ),
  balance: Number(
    row.balance ?? 0
  ),
  payment_type:
    row.payment_type,
  status: row.status,
  notes: row.notes,
  terms: row.terms,
  created_at:
    row.created_at,
  updated_at:
    row.updated_at,
})

const mapPayment = (
  row: any
): Payment => ({
  id: row.id,
  payment_id:
    row.payment_id,
  client_id:
    row.client_id,
  invoice_id:
    row.invoice_id,
  project_id:
    row.project_id,
  amount: Number(
    row.amount ?? 0
  ),
  payment_type:
    row.payment_type,
  payment_method:
    row.payment_method,
  payment_date:
    row.payment_date,
  reference_number:
    row.reference_number,
  notes: row.notes,
  created_at:
    row.created_at,
})

const mapExpense = (
  row: any
): Expense => ({
  id: row.id,
  expense_id:
    row.expense_id,
  date: row.date,
  category:
    row.category,
  description:
    row.description,
  amount: Number(
    row.amount ?? 0
  ),
  payment_method:
    row.payment_method,
  recurring:
    row.recurring,
  frequency:
    row.frequency,
  next_payment:
    row.next_payment,
  last_paid:
    row.last_paid,
  vendor: row.vendor,
  notes: row.notes,
  created_at:
    row.created_at,
})

const mapSubscription = (
  row: any
): Subscription => ({
  id: row.id,
  subscription_id:
    row.subscription_id,
  client_id:
    row.client_id,
  service_id:
    row.service_id,
  amount: Number(
    row.amount ?? 0
  ),
  billing_cycle:
    row.billing_cycle,
  start_date:
    row.start_date,
  last_payment:
    row.last_payment,
  next_payment:
    row.next_payment,
  status: row.status,
  notes: row.notes,
  created_at:
    row.created_at,
})

/* -------------------------------------------------------------------------- */
/* Employee mapper                                                           */
/* -------------------------------------------------------------------------- */

const mapEmployee = (
  row: any
): Employee => ({
  id: row.id,
  employee_id:
    row.employee_id,
  full_name:
    row.full_name,
  role: row.role,
  phone: row.phone,
  whatsapp:
    row.whatsapp,
  email: row.email,
  address:
    row.address,
  joining_date:
    row.joining_date,
  status: row.status,

  /*
   * Employee profile photo.
   *
   * This is the PRIVATE Cloudflare R2 object key.
   * It is NOT a public URL.
   *
   * Example:
   * organizations/default/employees/{employeeId}/avatar-xxx.webp
   */
  avatar_url:
    row.avatar_url ?? null,

  bank_information:
    row.bank_information,
  notes: row.notes,
  created_at:
    row.created_at,
})

const mapSalary = (
  row: any
): SalaryRecord => ({
  id: row.id,
  employee_id:
    row.employee_id,
  month: row.month,
  base_amount: Number(
    row.base_amount ?? 0
  ),
  allowances: Number(
    row.allowances ?? 0
  ),
  bonus: Number(
    row.bonus ?? 0
  ),
  commission: Number(
    row.commission ?? 0
  ),
  overtime: Number(
    row.overtime ?? 0
  ),
  deductions: Number(
    row.deductions ?? 0
  ),
  other_adjustments:
    Number(
      row.other_adjustments ?? 0
    ),
  net_salary: Number(
    row.net_salary ?? 0
  ),
  payment_date:
    row.payment_date,
  payment_method:
    row.payment_method,
  status: row.status,
  notes: row.notes,
  created_at:
    row.created_at,
})

const mapDocument = (
  row: any
): Document => ({
  id: row.id,
  file_name:
    row.file_name,
  file_type:
    row.file_type,
  file_size:
    row.file_size,
  storage_path:
    row.storage_path,
  related_type:
    row.related_type,
  related_id:
    row.related_id,
  upload_date:
    row.upload_date,
  notes: row.notes,
})

const mapActivity = (
  row: any
): ActivityLog => ({
  id: row.id,
  action: row.action,
  description:
    row.description,
  entity_type:
    row.entity_type,
  entity_id:
    row.entity_id,
  created_at:
    row.created_at,
})

const mapSettings = (
  row: any
): CompanySettings => ({
  company_name:
    row.company_name,
  registration_number:
    row.registration_number,
  address:
    row.address,
  phone: row.phone,
  email: row.email,
  website: row.website,
  vat_number:
    row.vat_number,
  bank_name:
    row.bank_name,
  bank_account:
    row.bank_account,
  bank_branch:
    row.bank_branch,
  account_holder_name:
    row.account_holder_name,
  invoice_prefix:
    row.invoice_prefix,
  invoice_starting_number:
    Number(
      row.invoice_starting_number ??
        1
    ),
  default_payment_terms:
    row.default_payment_terms,
  default_notes:
    row.default_notes,
  terms_and_conditions:
    row.terms_and_conditions,
  invoice_footer:
    row.invoice_footer,
  currency:
    row.currency,
  currency_symbol:
    row.currency_symbol,
  timezone:
    row.timezone,
  date_format:
    row.date_format,
  financial_year_start:
    row.financial_year_start,
  opening_balance:
    Number(
      row.opening_balance ?? 0
    ),
  default_vat_rate:
    Number(
      row.default_vat_rate ?? 0
    ),
  vat_enabled:
    row.vat_enabled,
})

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function DataProvider({
  children,
}: {
  children: ReactNode
}) {
  const [clients, setClients] =
    useState<Client[]>([])

  const [services, setServices] =
    useState<Service[]>([])

  const [projects, setProjects] =
    useState<Project[]>([])

  const [
    projectMilestones,
    setProjectMilestones,
  ] =
    useState<ProjectMilestone[]>(
      []
    )

  const [invoices, setInvoices] =
    useState<Invoice[]>([])

  const [payments, setPayments] =
    useState<Payment[]>([])

  const [expenses, setExpenses] =
    useState<Expense[]>([])

  const [
    subscriptions,
    setSubscriptions,
  ] =
    useState<Subscription[]>(
      []
    )

  const [employees, setEmployees] =
    useState<Employee[]>([])

  const [salaries, setSalaries] =
    useState<SalaryRecord[]>([])

  const [
    documents,
    setDocuments,
  ] = useState<Document[]>([])

  const [
    activityLogs,
    setActivityLogs,
  ] = useState<ActivityLog[]>([])

  const [
    settings,
    setSettings,
  ] =
    useState<CompanySettings | null>(
      null
    )

  const [loading, setLoading] =
    useState(true)

  /* ---------------------------------------------------------------------- */
  /* Invoice items                                                            */
  /* ---------------------------------------------------------------------- */

  const fetchInvoiceItems =
    useCallback(
      async () => {
        const {
          data,
          error,
        } = await supabase
          .from('invoice_items')
          .select('*')
          .order(
            'created_at',
            {
              ascending: true,
            }
          )

        throwSupabaseError(
          error,
          'Loading invoice items'
        )

        return (
          data ?? []
        ).map(
          mapInvoiceItem
        )
      },
      []
    )

  /* ---------------------------------------------------------------------- */
  /* Project milestones                                                      */
  /* ---------------------------------------------------------------------- */

  const fetchProjectMilestones =
    useCallback(
      async () => {
        const {
          data,
          error,
        } = await supabase
          .from(
            'project_milestones'
          )
          .select('*')
          .order(
            'due_date',
            {
              ascending: true,
            }
          )

        throwSupabaseError(
          error,
          'Loading project milestones'
        )

        return (
          data ?? []
        ).map(
          mapProjectMilestone
        )
      },
      []
    )

  /* ---------------------------------------------------------------------- */
  /* Refresh all data                                                        */
  /* ---------------------------------------------------------------------- */

  const refreshData =
    useCallback(
      async () => {
        setLoading(true)

        try {
          const [
            clientsResult,
            servicesResult,
            projectsResult,
            milestones,
            invoicesResult,
            paymentsResult,
            expensesResult,
            subscriptionsResult,
            employeesResult,
            salariesResult,
            documentsResult,
            activityResult,
            settingsResult,
            invoiceItems,
          ] =
            await Promise.all([
              supabase
                .from('clients')
                .select('*')
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from('services')
                .select('*')
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from('projects')
                .select('*')
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                ),

              fetchProjectMilestones(),

              supabase
                .from('invoices')
                .select('*')
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from('payments')
                .select('*')
                .order(
                  'payment_date',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from('expenses')
                .select('*')
                .order(
                  'date',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from(
                  'subscriptions'
                )
                .select('*')
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from('employees')
                .select('*')
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from('salaries')
                .select('*')
                .order(
                  'month',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from('documents')
                .select('*')
                .order(
                  'upload_date',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from(
                  'activity_logs'
                )
                .select('*')
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from(
                  'company_settings'
                )
                .select('*')
                .limit(1)
                .maybeSingle(),

              fetchInvoiceItems(),
            ])

          throwSupabaseError(
            clientsResult.error,
            'Loading clients'
          )

          throwSupabaseError(
            servicesResult.error,
            'Loading services'
          )

          throwSupabaseError(
            projectsResult.error,
            'Loading projects'
          )

          throwSupabaseError(
            invoicesResult.error,
            'Loading invoices'
          )

          throwSupabaseError(
            paymentsResult.error,
            'Loading payments'
          )

          throwSupabaseError(
            expensesResult.error,
            'Loading expenses'
          )

          throwSupabaseError(
            subscriptionsResult.error,
            'Loading subscriptions'
          )

          throwSupabaseError(
            employeesResult.error,
            'Loading employees'
          )

          throwSupabaseError(
            salariesResult.error,
            'Loading salaries'
          )

          throwSupabaseError(
            documentsResult.error,
            'Loading documents'
          )

          throwSupabaseError(
            activityResult.error,
            'Loading activity logs'
          )

          throwSupabaseError(
            settingsResult.error,
            'Loading company settings'
          )

          setClients(
            (
              clientsResult.data ??
              []
            ).map(
              mapClient
            )
          )

          setServices(
            (
              servicesResult.data ??
              []
            ).map(
              mapService
            )
          )

          setProjects(
            (
              projectsResult.data ??
              []
            ).map(
              mapProject
            )
          )

          setProjectMilestones(
            milestones
          )

          setInvoices(
            (
              invoicesResult.data ??
              []
            ).map(
              (row) =>
                mapInvoice(
                  row,
                  invoiceItems.filter(
                    (item) =>
                      item.invoice_id ===
                      row.id
                  )
                )
            )
          )

          setPayments(
            (
              paymentsResult.data ??
              []
            ).map(
              mapPayment
            )
          )

          setExpenses(
            (
              expensesResult.data ??
              []
            ).map(
              mapExpense
            )
          )

          setSubscriptions(
            (
              subscriptionsResult.data ??
              []
            ).map(
              mapSubscription
            )
          )

          /*
           * IMPORTANT:
           * employeesResult.data contains avatar_url
           * because employees are loaded with select('*').
           *
           * mapEmployee now preserves that R2 object key.
           */
          setEmployees(
            (
              employeesResult.data ??
              []
            ).map(
              mapEmployee
            )
          )

          setSalaries(
            (
              salariesResult.data ??
              []
            ).map(
              mapSalary
            )
          )

          setDocuments(
            (
              documentsResult.data ??
              []
            ).map(
              mapDocument
            )
          )

          setActivityLogs(
            (
              activityResult.data ??
              []
            ).map(
              mapActivity
            )
          )

          if (
            settingsResult.data
          ) {
            setSettings(
              mapSettings(
                settingsResult.data
              )
            )
          }
        } finally {
          setLoading(false)
        }
      },
      [
        fetchInvoiceItems,
        fetchProjectMilestones,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Initial loading                                                         */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  /* ---------------------------------------------------------------------- */
  /* Realtime                                                                */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          'xyphora-management-data'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'clients',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'services',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'project_milestones',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'invoices',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'invoice_items',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payments',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'expenses',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'subscriptions',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'employees',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'salaries',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'documents',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'activity_logs',
          },
          () =>
            void refreshData()
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table:
              'company_settings',
          },
          () =>
            void refreshData()
        )
        .subscribe()

    return () => {
      void supabase.removeChannel(
        channel
      )
    }
  }, [refreshData])

  /* ---------------------------------------------------------------------- */
  /* Invoice numbering                                                       */
  /* ---------------------------------------------------------------------- */

  const nextInvoiceNumber =
    useCallback(
      () => {
        const prefix =
          settings?.invoice_prefix ||
          'XP-INV'

        const numbers =
          invoices
            .map((invoice) => {
              const match =
                invoice.invoice_number?.match(
                  /(\d+)$/
                )

              return match
                ? Number(
                    match[1]
                  )
                : 0
            })
            .filter(
              (number) =>
                number > 0
            )

        const startingNumber =
          settings?.invoice_starting_number ||
          1

        const highest =
          numbers.length >
          0
            ? Math.max(
                ...numbers
              )
            : startingNumber -
              1

        return `${prefix}-${pad(
          highest + 1
        )}`
      },
      [
        invoices,
        settings?.invoice_prefix,
        settings?.invoice_starting_number,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Activity                                                                */
  /* ---------------------------------------------------------------------- */

  const addActivity =
    useCallback(
      async (
        action: string,
        description: string,
        entity_type: string,
        entity_id?: string
      ) => {
        const {
          error,
        } = await supabase
          .from(
            'activity_logs'
          )
          .insert({
            id: createUUID(),
            action,
            description,
            entity_type,
            entity_id:
              entity_id ||
              null,
          })

        throwSupabaseError(
          error,
          'Creating activity log'
        )
      },
      []
    )

  /* ---------------------------------------------------------------------- */
  /* Clients                                                                 */
  /* ---------------------------------------------------------------------- */

  const addClient =
    useCallback(
      async (
        c: Omit<
          Client,
          | 'id'
          | 'client_id'
          | 'created_at'
          | 'updated_at'
        >
      ) => {
        const clientId =
          `XP-CLT-${pad(
            clients.length + 1
          )}`

        const {
          data,
          error,
        } = await supabase
          .from('clients')
          .insert({
            id: createUUID(),
            client_id:
              clientId,
            company_name:
              c.company_name,
            contact_person:
              c.contact_person,
            phone: c.phone,
            whatsapp:
              c.whatsapp,
            email: c.email,
            address:
              c.address,
            business_type:
              c.business_type,
            website:
              c.website,
            registration_number:
              c.registration_number,
            date_joined:
              c.date_joined,
            status: c.status,
            notes: c.notes,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating client'
        )

        if (!data) {
          throw new Error(
            'Creating client returned no data.'
          )
        }

        const client =
          mapClient(data)

        setClients(
          (previous) => [
            client,
            ...previous,
          ]
        )

        await addActivity(
          'Client Created',
          `New client ${client.company_name} added`,
          'client',
          client.id
        )

        return client
      },
      [
        clients.length,
        addActivity,
      ]
    )

  const updateClient =
    useCallback(
      async (
        id: string,
        c: Partial<Client>
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from('clients')
          .update({
            company_name:
              c.company_name,
            contact_person:
              c.contact_person,
            phone: c.phone,
            whatsapp:
              c.whatsapp,
            email: c.email,
            address:
              c.address,
            business_type:
              c.business_type,
            website:
              c.website,
            registration_number:
              c.registration_number,
            date_joined:
              c.date_joined,
            status: c.status,
            notes: c.notes,
          })
          .eq('id', id)
          .select()
          .single()

        throwSupabaseError(
          error,
          'Updating client'
        )

        if (!data) {
          throw new Error(
            'Updating client returned no data.'
          )
        }

        const client =
          mapClient(data)

        setClients(
          (previous) =>
            previous.map(
              (item) =>
                item.id === id
                  ? client
                  : item
            )
        )

        await addActivity(
          'Client Updated',
          'Client information updated',
          'client',
          id
        )
      },
      [addActivity]
    )

  const deleteClient =
    useCallback(
      async (id: string) => {
        const client =
          clients.find(
            (item) =>
              item.id === id
          )

        const {
          error,
        } = await supabase
          .from('clients')
          .delete()
          .eq('id', id)

        throwSupabaseError(
          error,
          'Deleting client'
        )

        setClients(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        )

        if (client) {
          await addActivity(
            'Client Deleted',
            `Client ${client.company_name} deleted`,
            'client',
            id
          )
        }
      },
      [
        clients,
        addActivity,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Services                                                                */
  /* ---------------------------------------------------------------------- */

  const addService =
    useCallback(
      async (
        s: Omit<
          Service,
          'id' | 'created_at'
        >
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from('services')
          .insert({
            id: createUUID(),
            name: s.name,
            description:
              s.description,
            default_price:
              s.default_price,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating service'
        )

        if (!data) {
          throw new Error(
            'Creating service returned no data.'
          )
        }

        const service =
          mapService(data)

        setServices(
          (previous) => [
            service,
            ...previous,
          ]
        )

        return service
      },
      []
    )

  const updateService =
    useCallback(
      async (
        id: string,
        s: Partial<Service>
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from('services')
          .update({
            name: s.name,
            description:
              s.description,
            default_price:
              s.default_price,
          })
          .eq('id', id)
          .select()
          .single()

        throwSupabaseError(
          error,
          'Updating service'
        )

        if (!data) {
          throw new Error(
            'Updating service returned no data.'
          )
        }

        const service =
          mapService(data)

        setServices(
          (previous) =>
            previous.map(
              (item) =>
                item.id === id
                  ? service
                  : item
            )
        )
      },
      []
    )

  const deleteService =
    useCallback(
      async (id: string) => {
        const {
          error,
        } = await supabase
          .from('services')
          .delete()
          .eq('id', id)

        throwSupabaseError(
          error,
          'Deleting service'
        )

        setServices(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        )
      },
      []
    )

  /* ---------------------------------------------------------------------- */
  /* Projects                                                                */
  /* ---------------------------------------------------------------------- */

  const addProject =
    useCallback(
      async (
        p: Omit<
          Project,
          | 'id'
          | 'project_id'
          | 'created_at'
          | 'updated_at'
        >
      ) => {
        const projectId =
          `XP-PRJ-${pad(
            projects.length + 1
          )}`

        const {
          data,
          error,
        } = await supabase
          .from('projects')
          .insert({
            id: createUUID(),
            project_id:
              projectId,
            project_name:
              p.project_name,
            client_id:
              p.client_id,
            service_id:
              p.service_id ||
              null,
            description:
              p.description,
            technology:
              p.technology,
            start_date:
              p.start_date,
            expected_completion:
              p.expected_completion,
            actual_completion:
              p.actual_completion,
            project_value:
              p.project_value,
            progress:
              p.progress,
            status:
              p.status,
            notes: p.notes,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating project'
        )

        if (!data) {
          throw new Error(
            'Creating project returned no data.'
          )
        }

        const project =
          mapProject(data)

        setProjects(
          (previous) => [
            project,
            ...previous,
          ]
        )

        await addActivity(
          'Project Created',
          `Project ${project.project_name} created`,
          'project',
          project.id
        )

        return project
      },
      [
        projects.length,
        addActivity,
      ]
    )

  const updateProject =
    useCallback(
      async (
        id: string,
        p: Partial<Project>
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from('projects')
          .update({
            project_name:
              p.project_name,
            client_id:
              p.client_id,
            service_id:
              p.service_id ||
              null,
            description:
              p.description,
            technology:
              p.technology,
            start_date:
              p.start_date,
            expected_completion:
              p.expected_completion,
            actual_completion:
              p.actual_completion,
            project_value:
              p.project_value,
            progress:
              p.progress,
            status:
              p.status,
            notes: p.notes,
          })
          .eq('id', id)
          .select()
          .single()

        throwSupabaseError(
          error,
          'Updating project'
        )

        if (!data) {
          throw new Error(
            'Updating project returned no data.'
          )
        }

        const project =
          mapProject(data)

        setProjects(
          (previous) =>
            previous.map(
              (item) =>
                item.id === id
                  ? project
                  : item
            )
        )

        await addActivity(
          'Project Updated',
          'Project updated',
          'project',
          id
        )
      },
      [addActivity]
    )

  const deleteProject =
    useCallback(
      async (id: string) => {
        const project =
          projects.find(
            (item) =>
              item.id === id
          )

        const {
          error,
        } = await supabase
          .from('projects')
          .delete()
          .eq('id', id)

        throwSupabaseError(
          error,
          'Deleting project'
        )

        setProjects(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        )

        setProjectMilestones(
          (previous) =>
            previous.filter(
              (item) =>
                item.project_id !==
                id
            )
        )

        if (project) {
          await addActivity(
            'Project Deleted',
            `Project ${project.project_name} deleted`,
            'project',
            id
          )
        }
      },
      [
        projects,
        addActivity,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Project Milestones                                                      */
  /* ---------------------------------------------------------------------- */

  const addProjectMilestone =
    useCallback(
      async (
        milestone: Omit<
          ProjectMilestone,
          'id'
        >
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from(
            'project_milestones'
          )
          .insert({
            id: createUUID(),
            project_id:
              milestone.project_id,
            label:
              milestone.label,
            amount:
              milestone.amount,
            due_date:
              milestone.due_date,
            status:
              milestone.status,
            notes:
              milestone.notes,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating project milestone'
        )

        if (!data) {
          throw new Error(
            'Creating project milestone returned no data.'
          )
        }

        const createdMilestone =
          mapProjectMilestone(
            data
          )

        setProjectMilestones(
          (previous) => [
            ...previous,
            createdMilestone,
          ]
        )

        await addActivity(
          'Project Milestone Created',
          `Milestone ${createdMilestone.label} created`,
          'project_milestone',
          createdMilestone.id
        )

        return createdMilestone
      },
      [addActivity]
    )

  const updateProjectMilestone =
    useCallback(
      async (
        id: string,
        milestone: Partial<ProjectMilestone>
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from(
            'project_milestones'
          )
          .update({
            project_id:
              milestone.project_id,
            label:
              milestone.label,
            amount:
              milestone.amount,
            due_date:
              milestone.due_date,
            status:
              milestone.status,
            notes:
              milestone.notes,
          })
          .eq('id', id)
          .select()
          .single()

        throwSupabaseError(
          error,
          'Updating project milestone'
        )

        if (!data) {
          throw new Error(
            'Updating project milestone returned no data.'
          )
        }

        const updatedMilestone =
          mapProjectMilestone(
            data
          )

        setProjectMilestones(
          (previous) =>
            previous.map(
              (item) =>
                item.id === id
                  ? updatedMilestone
                  : item
            )
        )

        await addActivity(
          'Project Milestone Updated',
          `Milestone ${updatedMilestone.label} updated`,
          'project_milestone',
          id
        )
      },
      [addActivity]
    )

  const deleteProjectMilestone =
    useCallback(
      async (id: string) => {
        const milestone =
          projectMilestones.find(
            (item) =>
              item.id === id
          )

        const {
          error,
        } = await supabase
          .from(
            'project_milestones'
          )
          .delete()
          .eq('id', id)

        throwSupabaseError(
          error,
          'Deleting project milestone'
        )

        setProjectMilestones(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        )

        if (milestone) {
          await addActivity(
            'Project Milestone Deleted',
            `Milestone ${milestone.label} deleted`,
            'project_milestone',
            id
          )
        }
      },
      [
        projectMilestones,
        addActivity,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Invoices                                                                */
  /* ---------------------------------------------------------------------- */

  const addInvoice =
    useCallback(
      async (
        inv: Omit<
          Invoice,
          | 'id'
          | 'invoice_number'
          | 'created_at'
          | 'updated_at'
        > & {
          invoice_number?: string
        }
      ) => {
        const invoiceNumber =
          inv.invoice_number?.trim() ||
          nextInvoiceNumber()

        const invoiceId =
          createUUID()

        const {
          items,
          ...invoiceFields
        } = inv

        const {
          data,
          error,
        } = await supabase
          .from('invoices')
          .insert({
            id: invoiceId,
            invoice_number:
              invoiceNumber,
            client_id:
              invoiceFields.client_id,
            project_id:
              invoiceFields.project_id,
            invoice_date:
              invoiceFields.invoice_date,
            due_date:
              invoiceFields.due_date,
            payment_terms:
              invoiceFields.payment_terms,
            subtotal:
              invoiceFields.subtotal,
            discount:
              invoiceFields.discount,
            tax: invoiceFields.tax,
            total:
              invoiceFields.total,
            paid:
              invoiceFields.paid,
            balance:
              invoiceFields.balance,
            payment_type:
              invoiceFields.payment_type,
            status:
              invoiceFields.status,
            notes:
              invoiceFields.notes,
            terms:
              invoiceFields.terms,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating invoice'
        )

        if (!data) {
          throw new Error(
            'Creating invoice returned no data.'
          )
        }

        if (
          items &&
          items.length > 0
        ) {
          const invoiceItems =
            items.map(
              (item) => ({
                id: createUUID(),
                invoice_id:
                  invoiceId,
                description:
                  item.description,
                quantity:
                  item.quantity,
                unit_price:
                  item.unit_price,
                discount:
                  item.discount,
                tax: item.tax,
                total:
                  item.total,
              })
            )

          const {
            error: itemError,
          } = await supabase
            .from(
              'invoice_items'
            )
            .insert(
              invoiceItems
            )

          throwSupabaseError(
            itemError,
            'Creating invoice items'
          )
        }

        const {
          data: savedItems,
          error:
            savedItemsError,
        } =
          await supabase
            .from(
              'invoice_items'
            )
            .select('*')
            .eq(
              'invoice_id',
              invoiceId
            )
            .order(
              'created_at',
              {
                ascending:
                  true,
              }
            )

        throwSupabaseError(
          savedItemsError,
          'Loading created invoice items'
        )

        const invoice =
          mapInvoice(
            data,
            (
              savedItems ?? []
            ).map(
              mapInvoiceItem
            )
          )

        setInvoices(
          (previous) => [
            invoice,
            ...previous,
          ]
        )

        await addActivity(
          'Invoice Created',
          `Invoice ${invoice.invoice_number} created`,
          'invoice',
          invoice.id
        )

        return invoice
      },
      [
        nextInvoiceNumber,
        addActivity,
      ]
    )

  const updateInvoice =
    useCallback(
      async (
        id: string,
        inv: Partial<Invoice>
      ) => {
        const invoiceFields: Record<
          string,
          unknown
        > = {}

        if (
          inv.invoice_number !==
          undefined
        ) {
          invoiceFields.invoice_number =
            inv.invoice_number
        }

        if (
          inv.client_id !==
          undefined
        ) {
          invoiceFields.client_id =
            inv.client_id
        }

        if (
          inv.project_id !==
          undefined
        ) {
          invoiceFields.project_id =
            inv.project_id
        }

        if (
          inv.invoice_date !==
          undefined
        ) {
          invoiceFields.invoice_date =
            inv.invoice_date
        }

        if (
          inv.due_date !==
          undefined
        ) {
          invoiceFields.due_date =
            inv.due_date
        }

        if (
          inv.payment_terms !==
          undefined
        ) {
          invoiceFields.payment_terms =
            inv.payment_terms
        }

        if (
          inv.subtotal !==
          undefined
        ) {
          invoiceFields.subtotal =
            inv.subtotal
        }

        if (
          inv.discount !==
          undefined
        ) {
          invoiceFields.discount =
            inv.discount
        }

        if (
          inv.tax !==
          undefined
        ) {
          invoiceFields.tax =
            inv.tax
        }

        if (
          inv.total !==
          undefined
        ) {
          invoiceFields.total =
            inv.total
        }

        if (
          inv.paid !==
          undefined
        ) {
          invoiceFields.paid =
            inv.paid
        }

        if (
          inv.balance !==
          undefined
        ) {
          invoiceFields.balance =
            inv.balance
        }

        if (
          inv.payment_type !==
          undefined
        ) {
          invoiceFields.payment_type =
            inv.payment_type
        }

        if (
          inv.status !==
          undefined
        ) {
          invoiceFields.status =
            inv.status
        }

        if (
          inv.notes !==
          undefined
        ) {
          invoiceFields.notes =
            inv.notes
        }

        if (
          inv.terms !==
          undefined
        ) {
          invoiceFields.terms =
            inv.terms
        }

        if (
          Object.keys(
            invoiceFields
          ).length > 0
        ) {
          const {
            data,
            error,
          } = await supabase
            .from('invoices')
            .update(
              invoiceFields
            )
            .eq('id', id)
            .select()
            .single()

          throwSupabaseError(
            error,
            'Updating invoice'
          )

          if (!data) {
            throw new Error(
              'Updating invoice returned no data.'
            )
          }

          const {
            data: itemRows,
            error: itemError,
          } =
            await supabase
              .from(
                'invoice_items'
              )
              .select('*')
              .eq(
                'invoice_id',
                id
              )
              .order(
                'created_at',
                {
                  ascending:
                    true,
                }
              )

          throwSupabaseError(
            itemError,
            'Loading invoice items'
          )

          const updatedInvoice =
            mapInvoice(
              data,
              (
                itemRows ?? []
              ).map(
                mapInvoiceItem
              )
            )

          setInvoices(
            (previous) =>
              previous.map(
                (item) =>
                  item.id === id
                    ? updatedInvoice
                    : item
              )
          )
        }

        if (
          inv.items !==
          undefined
        ) {
          const {
            error:
              deleteItemsError,
          } =
            await supabase
              .from(
                'invoice_items'
              )
              .delete()
              .eq(
                'invoice_id',
                id
              )

          throwSupabaseError(
            deleteItemsError,
            'Replacing invoice items'
          )

          if (
            inv.items.length > 0
          ) {
            const newItems =
              inv.items.map(
                (item) => ({
                  id: createUUID(),
                  invoice_id: id,
                  description:
                    item.description,
                  quantity:
                    item.quantity,
                  unit_price:
                    item.unit_price,
                  discount:
                    item.discount,
                  tax: item.tax,
                  total:
                    item.total,
                })
              )

            const {
              error:
                insertItemsError,
            } =
              await supabase
                .from(
                  'invoice_items'
                )
                .insert(
                  newItems
                )

            throwSupabaseError(
              insertItemsError,
              'Saving invoice items'
            )
          }

          await refreshData()
        }

        await addActivity(
          'Invoice Updated',
          'Invoice updated',
          'invoice',
          id
        )
      },
      [
        addActivity,
        refreshData,
      ]
    )

  const deleteInvoice =
    useCallback(
      async (id: string) => {
        const invoice =
          invoices.find(
            (item) =>
              item.id === id
          )

        const {
          error,
        } = await supabase
          .from('invoices')
          .delete()
          .eq('id', id)

        throwSupabaseError(
          error,
          'Deleting invoice'
        )

        setInvoices(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        )

        if (invoice) {
          await addActivity(
            'Invoice Deleted',
            `Invoice ${invoice.invoice_number} deleted`,
            'invoice',
            id
          )
        }
      },
      [
        invoices,
        addActivity,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Payments                                                                */
  /* ---------------------------------------------------------------------- */

  const addPayment =
    useCallback(
      async (
        p: Omit<
          Payment,
          'id' | 'payment_id' | 'created_at'
        >
      ) => {
        const paymentId =
          `XP-PAY-${pad(
            payments.length + 1
          )}`

        const {
          data,
          error,
        } = await supabase
          .from('payments')
          .insert({
            id: createUUID(),
            payment_id:
              paymentId,
            client_id:
              p.client_id,
            invoice_id:
              p.invoice_id,
            project_id:
              p.project_id,
            amount: p.amount,
            payment_type:
              p.payment_type,
            payment_method:
              p.payment_method,
            payment_date:
              p.payment_date,
            reference_number:
              p.reference_number,
            notes: p.notes,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating payment'
        )

        if (!data) {
          throw new Error(
            'Creating payment returned no data.'
          )
        }

        const payment =
          mapPayment(data)

        setPayments(
          (previous) => [
            payment,
            ...previous,
          ]
        )

        await addActivity(
          'Payment Recorded',
          `Payment of ${payment.amount.toLocaleString()} recorded`,
          'payment',
          payment.id
        )

        await refreshData()

        return payment
      },
      [
        payments.length,
        addActivity,
        refreshData,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Expenses                                                                */
  /* ---------------------------------------------------------------------- */

  const addExpense =
    useCallback(
      async (
        e: Omit<
          Expense,
          'id' | 'expense_id' | 'created_at'
        >
      ) => {
        const expenseId =
          `XP-EXP-${pad(
            expenses.length + 1
          )}`

        const {
          data,
          error,
        } = await supabase
          .from('expenses')
          .insert({
            id: createUUID(),
            expense_id:
              expenseId,
            date: e.date,
            category:
              e.category,
            description:
              e.description,
            amount: e.amount,
            payment_method:
              e.payment_method,
            recurring:
              e.recurring,
            frequency:
              e.frequency,
            next_payment:
              e.next_payment,
            last_paid:
              e.last_paid,
            vendor: e.vendor,
            notes: e.notes,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating expense'
        )

        if (!data) {
          throw new Error(
            'Creating expense returned no data.'
          )
        }

        const expense =
          mapExpense(data)

        setExpenses(
          (previous) => [
            expense,
            ...previous,
          ]
        )

        await addActivity(
          'Expense Added',
          `Expense added: ${expense.description}`,
          'expense',
          expense.id
        )

        return expense
      },
      [
        expenses.length,
        addActivity,
      ]
    )

  const updateExpense =
    useCallback(
      async (
        id: string,
        e: Partial<Expense>
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from('expenses')
          .update({
            date: e.date,
            category:
              e.category,
            description:
              e.description,
            amount: e.amount,
            payment_method:
              e.payment_method,
            recurring:
              e.recurring,
            frequency:
              e.frequency,
            next_payment:
              e.next_payment,
            last_paid:
              e.last_paid,
            vendor: e.vendor,
            notes: e.notes,
          })
          .eq('id', id)
          .select()
          .single()

        throwSupabaseError(
          error,
          'Updating expense'
        )

        if (!data) {
          throw new Error(
            'Updating expense returned no data.'
          )
        }

        const expense =
          mapExpense(data)

        setExpenses(
          (previous) =>
            previous.map(
              (item) =>
                item.id === id
                  ? expense
                  : item
            )
        )
      },
      []
    )

  const deleteExpense =
    useCallback(
      async (id: string) => {
        const expense =
          expenses.find(
            (item) =>
              item.id === id
          )

        const {
          error,
        } = await supabase
          .from('expenses')
          .delete()
          .eq('id', id)

        throwSupabaseError(
          error,
          'Deleting expense'
        )

        setExpenses(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        )

        if (expense) {
          await addActivity(
            'Expense Deleted',
            `Expense ${expense.description} deleted`,
            'expense',
            id
          )
        }
      },
      [
        expenses,
        addActivity,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Subscriptions                                                           */
  /* ---------------------------------------------------------------------- */

  const addSubscription =
    useCallback(
      async (
        s: Omit<
          Subscription,
          | 'id'
          | 'subscription_id'
          | 'created_at'
        >
      ) => {
        const subscriptionId =
          `XP-SUB-${pad(
            subscriptions.length + 1
          )}`

        const {
          data,
          error,
        } = await supabase
          .from(
            'subscriptions'
          )
          .insert({
            id: createUUID(),
            subscription_id:
              subscriptionId,
            client_id:
              s.client_id,
            service_id:
              s.service_id,
            amount: s.amount,
            billing_cycle:
              s.billing_cycle,
            start_date:
              s.start_date,
            last_payment:
              s.last_payment,
            next_payment:
              s.next_payment,
            status: s.status,
            notes: s.notes,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating subscription'
        )

        if (!data) {
          throw new Error(
            'Creating subscription returned no data.'
          )
        }

        const subscription =
          mapSubscription(data)

        setSubscriptions(
          (previous) => [
            subscription,
            ...previous,
          ]
        )

        await addActivity(
          'Subscription Created',
          'Subscription created',
          'subscription',
          subscription.id
        )

        return subscription
      },
      [
        subscriptions.length,
        addActivity,
      ]
    )

  const updateSubscription =
    useCallback(
      async (
        id: string,
        s: Partial<Subscription>
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from(
            'subscriptions'
          )
          .update({
            client_id:
              s.client_id,
            service_id:
              s.service_id,
            amount: s.amount,
            billing_cycle:
              s.billing_cycle,
            start_date:
              s.start_date,
            last_payment:
              s.last_payment,
            next_payment:
              s.next_payment,
            status: s.status,
            notes: s.notes,
          })
          .eq('id', id)
          .select()
          .single()

        throwSupabaseError(
          error,
          'Updating subscription'
        )

        if (!data) {
          throw new Error(
            'Updating subscription returned no data.'
          )
        }

        const subscription =
          mapSubscription(data)

        setSubscriptions(
          (previous) =>
            previous.map(
              (item) =>
                item.id === id
                  ? subscription
                  : item
            )
        )
      },
      []
    )

  const deleteSubscription =
    useCallback(
      async (id: string) => {
        const {
          error,
        } = await supabase
          .from(
            'subscriptions'
          )
          .delete()
          .eq('id', id)

        throwSupabaseError(
          error,
          'Deleting subscription'
        )

        setSubscriptions(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        )
      },
      []
    )

  /* ---------------------------------------------------------------------- */
  /* Employees                                                               */
  /* ---------------------------------------------------------------------- */

  const addEmployee =
    useCallback(
      async (
        e: Omit<
          Employee,
          'id' | 'employee_id' | 'created_at'
        >
      ) => {
        const employeeId =
          `XP-EMP-${pad(
            employees.length + 1
          )}`

        const {
          data,
          error,
        } = await supabase
          .from('employees')
          .insert({
            id: createUUID(),
            employee_id:
              employeeId,
            full_name:
              e.full_name,
            role: e.role,
            phone: e.phone,
            whatsapp:
              e.whatsapp,
            email: e.email,
            address:
              e.address,
            joining_date:
              e.joining_date,
            status: e.status,

            /*
             * Preserve the employee R2 object key.
             *
             * For a newly created employee this will
             * normally be null. The r2-employee-upload
             * function updates it after the image upload.
             */
            avatar_url:
              e.avatar_url ??
              null,

            bank_information:
              e.bank_information,
            notes: e.notes,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating employee'
        )

        if (!data) {
          throw new Error(
            'Creating employee returned no data.'
          )
        }

        const employee =
          mapEmployee(data)

        setEmployees(
          (previous) => [
            employee,
            ...previous,
          ]
        )

        await addActivity(
          'Employee Created',
          `Employee ${employee.full_name} added`,
          'employee',
          employee.id
        )

        return employee
      },
      [
        employees.length,
        addActivity,
      ]
    )

  const updateEmployee =
    useCallback(
      async (
        id: string,
        e: Partial<Employee>
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from('employees')
          .update({
            full_name:
              e.full_name,
            role: e.role,
            phone: e.phone,
            whatsapp:
              e.whatsapp,
            email: e.email,
            address:
              e.address,
            joining_date:
              e.joining_date,
            status:
              e.status,

            /*
             * Preserve the existing R2 object key
             * when EmployeesPage sends it.
             *
             * When undefined, Supabase will not replace
             * the existing database value.
             */
            avatar_url:
              e.avatar_url,

            bank_information:
              e.bank_information,
            notes: e.notes,
          })
          .eq('id', id)
          .select()
          .single()

        throwSupabaseError(
          error,
          'Updating employee'
        )

        if (!data) {
          throw new Error(
            'Updating employee returned no data.'
          )
        }

        const employee =
          mapEmployee(data)

        setEmployees(
          (previous) =>
            previous.map(
              (item) =>
                item.id === id
                  ? employee
                  : item
            )
        )

        await addActivity(
          'Employee Updated',
          'Employee record updated',
          'employee',
          id
        )
      },
      [addActivity]
    )

  const deleteEmployee =
    useCallback(
      async (id: string) => {
        const employee =
          employees.find(
            (item) =>
              item.id === id
          )

        const {
          error,
        } = await supabase
          .from('employees')
          .delete()
          .eq('id', id)

        throwSupabaseError(
          error,
          'Deleting employee'
        )

        setEmployees(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        )

        if (employee) {
          await addActivity(
            'Employee Deleted',
            `Employee ${employee.full_name} deleted`,
            'employee',
            id
          )
        }
      },
      [
        employees,
        addActivity,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Salaries                                                                */
  /* ---------------------------------------------------------------------- */

  const addSalary =
    useCallback(
      async (
        s: Omit<
          SalaryRecord,
          'id' | 'created_at'
        >
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from('salaries')
          .insert({
            id: createUUID(),
            employee_id:
              s.employee_id,
            month: s.month,
            base_amount:
              s.base_amount,
            allowances:
              s.allowances,
            bonus: s.bonus,
            commission:
              s.commission,
            overtime:
              s.overtime,
            deductions:
              s.deductions,
            other_adjustments:
              s.other_adjustments,
            payment_date:
              s.payment_date,
            payment_method:
              s.payment_method,
            status: s.status,
            notes: s.notes,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating salary'
        )

        if (!data) {
          throw new Error(
            'Creating salary returned no data.'
          )
        }

        const salary =
          mapSalary(data)

        setSalaries(
          (previous) => [
            salary,
            ...previous,
          ]
        )

        await addActivity(
          'Salary Recorded',
          `Salary recorded for ${salary.month}`,
          'salary',
          salary.id
        )

        return salary
      },
      [addActivity]
    )

  const updateSalary =
    useCallback(
      async (
        id: string,
        s: Partial<SalaryRecord>
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from('salaries')
          .update({
            employee_id:
              s.employee_id,
            month: s.month,
            base_amount:
              s.base_amount,
            allowances:
              s.allowances,
            bonus: s.bonus,
            commission:
              s.commission,
            overtime:
              s.overtime,
            deductions:
              s.deductions,
            other_adjustments:
              s.other_adjustments,
            payment_date:
              s.payment_date,
            payment_method:
              s.payment_method,
            status: s.status,
            notes: s.notes,
          })
          .eq('id', id)
          .select()
          .single()

        throwSupabaseError(
          error,
          'Updating salary'
        )

        if (!data) {
          throw new Error(
            'Updating salary returned no data.'
          )
        }

        const salary =
          mapSalary(data)

        setSalaries(
          (previous) =>
            previous.map(
              (item) =>
                item.id === id
                  ? salary
                  : item
            )
        )
      },
      []
    )

  /* ---------------------------------------------------------------------- */
  /* Documents                                                               */
  /* ---------------------------------------------------------------------- */

  const addDocument =
    useCallback(
      async (
        doc: Omit<
          Document,
          'id' | 'upload_date'
        >
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from('documents')
          .insert({
            id: createUUID(),
            file_name:
              doc.file_name,
            file_type:
              doc.file_type,
            file_size:
              doc.file_size,
            storage_path:
              doc.storage_path,
            related_type:
              doc.related_type,
            related_id:
              doc.related_id,
            notes: doc.notes,
          })
          .select()
          .single()

        throwSupabaseError(
          error,
          'Creating document'
        )

        if (!data) {
          throw new Error(
            'Creating document returned no data.'
          )
        }

        const document =
          mapDocument(data)

        setDocuments(
          (previous) => [
            document,
            ...previous,
          ]
        )

        await addActivity(
          'Document Uploaded',
          `Document ${document.file_name} uploaded`,
          'document',
          document.id
        )

        return document
      },
      [addActivity]
    )

  const deleteDocument =
    useCallback(
      async (id: string) => {
        const document =
          documents.find(
            (item) =>
              item.id === id
          )

        const {
          error,
        } = await supabase
          .from('documents')
          .delete()
          .eq('id', id)

        throwSupabaseError(
          error,
          'Deleting document'
        )

        setDocuments(
          (previous) =>
            previous.filter(
              (item) =>
                item.id !== id
            )
        )

        if (document) {
          await addActivity(
            'Document Deleted',
            `Document ${document.file_name} deleted`,
            'document',
            id
          )
        }
      },
      [
        documents,
        addActivity,
      ]
    )

  /* ---------------------------------------------------------------------- */
  /* Company settings                                                        */
  /* ---------------------------------------------------------------------- */

  const updateSettings =
    useCallback(
      async (
        s: Partial<CompanySettings>
      ) => {
        const {
          data: existing,
          error: findError,
        } =
          await supabase
            .from(
              'company_settings'
            )
            .select('id')
            .limit(1)
            .maybeSingle()

        throwSupabaseError(
          findError,
          'Finding company settings'
        )

        const updatePayload: Record<
          string,
          unknown
        > = {
          company_name:
            s.company_name,
          registration_number:
            s.registration_number,
          address: s.address,
          phone: s.phone,
          email: s.email,
          website: s.website,
          vat_number:
            s.vat_number,
          bank_name:
            s.bank_name,
          bank_account:
            s.bank_account,
          bank_branch:
            s.bank_branch,
          account_holder_name:
            s.account_holder_name,
          invoice_prefix:
            s.invoice_prefix,
          invoice_starting_number:
            s.invoice_starting_number,
          default_payment_terms:
            s.default_payment_terms,
          default_notes:
            s.default_notes,
          terms_and_conditions:
            s.terms_and_conditions,
          invoice_footer:
            s.invoice_footer,
          currency:
            s.currency,
          currency_symbol:
            s.currency_symbol,
          timezone:
            s.timezone,
          date_format:
            s.date_format,
          financial_year_start:
            s.financial_year_start,
          opening_balance:
            s.opening_balance,
          default_vat_rate:
            s.default_vat_rate,
          vat_enabled:
            s.vat_enabled,
        }

        Object.keys(
          updatePayload
        ).forEach(
          (key) => {
            if (
              updatePayload[
                key
              ] === undefined
            ) {
              delete updatePayload[
                key
              ]
            }
          }
        )

        let data

        if (
          existing?.id
        ) {
          const result =
            await supabase
              .from(
                'company_settings'
              )
              .update(
                updatePayload
              )
              .eq(
                'id',
                existing.id
              )
              .select()
              .single()

          throwSupabaseError(
            result.error,
            'Updating company settings'
          )

          data =
            result.data
        } else {
          const result =
            await supabase
              .from(
                'company_settings'
              )
              .insert({
                id: createUUID(),
                ...updatePayload,
              })
              .select()
              .single()

          throwSupabaseError(
            result.error,
            'Creating company settings'
          )

          data =
            result.data
        }

        if (!data) {
          throw new Error(
            'Saving company settings returned no data.'
          )
        }

        const updatedSettings =
          mapSettings(data)

        setSettings(
          updatedSettings
        )

        await addActivity(
          'Settings Updated',
          'Company settings updated',
          'settings'
        )
      },
      [addActivity]
    )

  /* ---------------------------------------------------------------------- */
  /* Settings fallback                                                       */
  /* ---------------------------------------------------------------------- */

  const providerSettings =
    settings ??
    ({
      company_name: '',
      registration_number:
        '',
      address: '',
      phone: '',
      email: '',
      website: '',
      vat_number: '',
      bank_name: '',
      bank_account: '',
      bank_branch: '',
      account_holder_name:
        '',
      invoice_prefix:
        'XP-INV',
      invoice_starting_number: 1,
      default_payment_terms:
        '',
      default_notes: '',
      terms_and_conditions:
        '',
      invoice_footer: '',
      currency: 'LKR',
      currency_symbol:
        'LKR',
      timezone:
        'Asia/Colombo',
      date_format:
        'DD/MM/YYYY',
      financial_year_start:
        '',
      opening_balance: 0,
      default_vat_rate: 0,
      vat_enabled: false,
    } as CompanySettings)

  /* ---------------------------------------------------------------------- */
  /* Provider                                                                */
  /* ---------------------------------------------------------------------- */

  return (
    <DataContext.Provider
      value={{
        clients,
        services,
        projects,
        projectMilestones,
        invoices,
        payments,
        expenses,
        subscriptions,
        employees,
        salaries,
        documents,
        activityLogs,
        settings:
          providerSettings,

        loading,
        refreshData,

        nextInvoiceNumber,

        addClient,
        updateClient,
        deleteClient,

        addService,
        updateService,
        deleteService,

        addProject,
        updateProject,
        deleteProject,

        addProjectMilestone,
        updateProjectMilestone,
        deleteProjectMilestone,

        addInvoice,
        updateInvoice,
        deleteInvoice,

        addPayment,

        addExpense,
        updateExpense,
        deleteExpense,

        addSubscription,
        updateSubscription,
        deleteSubscription,

        addEmployee,
        updateEmployee,
        deleteEmployee,

        addSalary,
        updateSalary,

        addDocument,
        deleteDocument,

        updateSettings,

        addActivity,
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

export const useData = () => {
  const context =
    useContext(DataContext)

  if (!context) {
    throw new Error(
      'useData must be used within DataProvider'
    )
  }

  return context
}
