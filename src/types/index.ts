export type ClientStatus =
  | 'Lead'
  | 'Active'
  | 'Completed'
  | 'Maintenance'
  | 'Inactive'

export type ProjectStatus =
  | 'Planning'
  | 'Proposal'
  | 'Approved'
  | 'In Progress'
  | 'Testing'
  | 'Completed'
  | 'Delivered'
  | 'Maintenance'
  | 'Cancelled'

export type InvoiceStatus =
  | 'Draft'
  | 'Sent'
  | 'Partial'
  | 'Paid'
  | 'Pending'
  | 'Overdue'
  | 'Cancelled'

export type PaymentType =
  | 'Advance'
  | 'Partial'
  | 'Milestone'
  | 'Full'
  | 'Final'
  | 'Subscription'
  | 'Renewal'
  | 'Other'

export type PaymentMethod =
  | 'Bank Transfer'
  | 'Cash'
  | 'Card'
  | 'Online Payment'
  | 'Other'

export type SubscriptionStatus =
  | 'Active'
  | 'Due Soon'
  | 'Overdue'
  | 'Cancelled'

export type EmployeeStatus =
  | 'Active'
  | 'Inactive'

export type SalaryStatus =
  | 'Pending'
  | 'Paid'

export type BillingCycle =
  | 'Monthly'
  | 'Quarterly'
  | 'Yearly'
  | 'Custom'

export type ExpenseFrequency =
  | 'Monthly'
  | 'Quarterly'
  | 'Yearly'
  | 'Custom'


export interface Client {
  id: string
  client_id: string
  company_name: string
  contact_person: string
  phone: string
  whatsapp: string
  email: string
  address: string
  business_type: string
  website: string
  registration_number: string
  date_joined: string
  status: ClientStatus
  notes: string
  created_at: string
  updated_at: string
}


export interface Service {
  id: string
  name: string
  description: string
  default_price: number | null
  created_at: string
}


export interface Project {
  id: string
  project_id: string
  project_name: string
  client_id: string
  service_id: string
  description: string
  technology: string
  start_date: string
  expected_completion: string
  actual_completion: string | null
  project_value: number
  progress: number
  status: ProjectStatus
  notes: string
  created_at: string
  updated_at: string
}


export interface ProjectMilestone {
  id: string
  project_id: string
  label: string
  amount: number
  due_date: string
  status: 'Pending' | 'Paid' | 'Upcoming'
  notes: string
}


export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  total: number
}


export interface Invoice {
  id: string
  invoice_number: string
  client_id: string
  project_id: string | null
  invoice_date: string
  due_date: string
  payment_terms: string
  items: InvoiceItem[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  balance: number
  payment_type: PaymentType
  status: InvoiceStatus
  notes: string
  terms: string
  created_at: string
  updated_at: string
}


export interface Payment {
  id: string
  payment_id: string
  client_id: string
  invoice_id: string
  project_id: string | null
  amount: number
  payment_type: PaymentType
  payment_method: PaymentMethod
  payment_date: string
  reference_number: string
  notes: string
  created_at: string
}


export interface Expense {
  id: string
  expense_id: string
  date: string
  category: string
  description: string
  amount: number
  payment_method: PaymentMethod
  recurring: boolean
  frequency: ExpenseFrequency | null
  next_payment: string | null
  last_paid: string | null
  vendor: string
  notes: string
  created_at: string
}


export interface Subscription {
  id: string
  subscription_id: string
  client_id: string
  service_id: string
  amount: number
  billing_cycle: BillingCycle
  start_date: string
  last_payment: string | null
  next_payment: string
  status: SubscriptionStatus
  notes: string
  created_at: string
}


/* =========================================================
   EMPLOYEE
   ========================================================= */

export interface Employee {
  id: string
  employee_id: string
  full_name: string
  role: string
  phone: string
  whatsapp: string
  email: string
  address: string
  joining_date: string
  status: EmployeeStatus

  /**
   * Private Cloudflare R2 object key for the employee
   * profile image.
   *
   * Example:
   * organizations/default/employees/<employee-id>/avatar-xxxx.webp
   *
   * This is NOT the public image URL.
   * The frontend obtains a temporary signed URL
   * through the r2-employee-url Edge Function.
   */
  avatar_url: string | null

  bank_information: string
  notes: string
  created_at: string
}


export interface SalaryRecord {
  id: string
  employee_id: string
  month: string
  base_amount: number
  allowances: number
  bonus: number
  commission: number
  overtime: number
  deductions: number
  other_adjustments: number
  net_salary: number
  payment_date: string | null
  payment_method: PaymentMethod
  status: SalaryStatus
  notes: string
  created_at: string
}


export interface Document {
  id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  related_type:
    | 'client'
    | 'project'
    | 'invoice'
    | 'expense'
    | 'employee'
    | 'company'
  related_id: string | null
  upload_date: string
  notes: string
}


export interface ActivityLog {
  id: string
  action: string
  description: string
  entity_type: string
  entity_id: string | null
  created_at: string
}


export interface CompanySettings {
  company_name: string
  registration_number: string
  address: string
  phone: string
  email: string
  website: string
  vat_number: string
  bank_name: string
  bank_account: string
  bank_branch: string
  account_holder_name?: string
  invoice_prefix: string
  invoice_starting_number: number
  default_payment_terms: string
  default_notes: string
  terms_and_conditions: string
  invoice_footer: string
  currency: string
  currency_symbol: string
  timezone: string
  date_format: string
  financial_year_start: string
  opening_balance: number
  default_vat_rate: number
  vat_enabled: boolean
}


export interface DashboardMetrics {
  total_revenue: number
  total_expenses: number
  net_profit: number
  outstanding: number
  this_month_revenue: number
  this_month_expenses: number
  expected_income: number
  upcoming_expenses: number
  mrr: number
  arr: number
}