import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { ReactNode } from 'react'
import AppShell from '../components/layout/AppShell'
import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import ClientsPage from '../pages/clients/ClientsPage'
import ClientDetailPage from '../pages/clients/ClientDetailPage'
import ProjectsPage from '../pages/projects/ProjectsPage'
import ProjectDetailPage from '../pages/projects/ProjectDetailPage'
import ServicesPage from '../pages/services/ServicesPage'
import InvoicesPage from '../pages/invoices/InvoicesPage'
import InvoiceBuilderPage from '../pages/invoices/InvoiceBuilderPage'
import InvoiceDetailPage from '../pages/invoices/InvoiceDetailPage'
import PaymentsPage from '../pages/payments/PaymentsPage'
import IncomePage from '../pages/income/IncomePage'
import ExpensesPage from '../pages/expenses/ExpensesPage'
import SubscriptionsPage from '../pages/subscriptions/SubscriptionsPage'
import EmployeesPage from '../pages/employees/EmployeesPage'
import EmployeeDetailPage from '../pages/employees/EmployeeDetailPage'
import SalariesPage from '../pages/salaries/SalariesPage'
import CalendarPage from '../pages/calendar/CalendarPage'
import DocumentsPage from '../pages/documents/DocumentsPage'
import ReportsPage from '../pages/reports/ReportsPage'
import ProfitLossPage from '../pages/reports/ProfitLossPage'
import ActivityPage from '../pages/activity/ActivityPage'
import ProfilePage from '../pages/profile/ProfilePage'
import SettingsPage from '../pages/settings/SettingsPage'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-xp-purple flex items-center justify-center">
          <span className="text-white font-bold text-sm">XP</span>
        </div>
        <div className="w-5 h-5 border-2 border-xp-purple border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <PublicRoute><LoginPage /></PublicRoute>
  },
  {
    path: '/',
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/new', element: <ClientsPage /> },
      { path: 'clients/:id', element: <ClientDetailPage /> },
      { path: 'projects', element: <ProjectsPage /> },
      { path: 'projects/new', element: <ProjectsPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'invoices/new', element: <InvoiceBuilderPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'income', element: <IncomePage /> },
      { path: 'expenses', element: <ExpensesPage /> },
      { path: 'subscriptions', element: <SubscriptionsPage /> },
      { path: 'employees', element: <EmployeesPage /> },
      { path: 'employees/new', element: <EmployeesPage /> },
      { path: 'employees/:id', element: <EmployeeDetailPage /> },
      { path: 'salaries', element: <SalariesPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'reports/profit-loss', element: <ProfitLossPage /> },
      { path: 'reports/income', element: <IncomePage /> },
      { path: 'reports/expenses', element: <ExpensesPage /> },
      { path: 'reports/cash-flow', element: <ReportsPage /> },
      { path: 'reports/clients', element: <ClientsPage /> },
      { path: 'reports/projects', element: <ProjectsPage /> },
      { path: 'reports/employees', element: <EmployeesPage /> },
      { path: 'activity', element: <ActivityPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/:tab', element: <SettingsPage /> },
    ]
  },
  { path: '*', element: <Navigate to="/login" replace /> }
])
