
import {
  createBrowserRouter,
  Navigate,
  useLocation,
} from 'react-router-dom'

import type { ReactNode } from 'react'

import { useAuth } from '../contexts/AuthContext'

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

/* ============================================================
   AUTHENTICATION LOADING SCREEN
============================================================ */

function AuthLoadingScreen() {
  return (
    <div
      className="
        flex
        min-h-screen
        w-full
        items-center
        justify-center
        bg-white
      "
      role="status"
      aria-label="Checking authentication"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="
            flex
            h-11
            w-11
            items-center
            justify-center
            rounded-xl
            bg-xp-purple
            shadow-lg
          "
        >
          <span className="text-sm font-bold text-white">
            XP
          </span>
        </div>

        <div
          className="
            h-6
            w-6
            animate-spin
            rounded-full
            border-[3px]
            border-xp-purple
            border-t-transparent
          "
        />

        <p className="text-sm font-medium text-gray-500">
          Verifying your session...
        </p>
      </div>
    </div>
  )
}

/* ============================================================
   PROTECTED ROUTE
============================================================ */

/**
 * Protects private management pages.
 *
 * When AuthContext reports a valid session,
 * the requested page is displayed.
 *
 * When authentication expires:
 * - Private pages are no longer rendered.
 * - The user is redirected to /login.
 *
 * AuthContext is responsible for enforcing:
 * - 15-minute inactivity timeout
 * - 4-hour maximum session duration
 * - Session restoration and expiration checks
 */

function ProtectedRoute({
  children,
}: {
  children: ReactNode
}) {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth()

  const location = useLocation()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
        }}
      />
    )
  }

  return <>{children}</>
}

/* ============================================================
   PUBLIC ROUTE
============================================================ */

/**
 * The login page should only be displayed
 * when the user is not authenticated.
 *
 * If the user already has a valid session,
 * redirect them to the dashboard.
 */

function PublicRoute({
  children,
}: {
  children: ReactNode
}) {
  const {
    isAuthenticated,
    isLoading,
  } = useAuth()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    )
  }

  return <>{children}</>
}

/* ============================================================
   APPLICATION ROUTER
============================================================ */

export const router = createBrowserRouter([
  /* ----------------------------------------------------------
     PUBLIC ROUTES
  ---------------------------------------------------------- */

  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },

  /* ----------------------------------------------------------
     PROTECTED MANAGEMENT ROUTES
  ---------------------------------------------------------- */

  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),

    children: [
      /* Default */
      {
        index: true,
        element: (
          <Navigate
            to="/dashboard"
            replace
          />
        ),
      },

      /* Dashboard */
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },

      /* Clients */
      {
        path: 'clients',
        element: <ClientsPage />,
      },
      {
        path: 'clients/new',
        element: <ClientsPage />,
      },
      {
        path: 'clients/:id',
        element: <ClientDetailPage />,
      },

      /* Projects */
      {
        path: 'projects',
        element: <ProjectsPage />,
      },
      {
        path: 'projects/new',
        element: <ProjectsPage />,
      },
      {
        path: 'projects/:id',
        element: <ProjectDetailPage />,
      },

      /* Services */
      {
        path: 'services',
        element: <ServicesPage />,
      },

      /* Invoices */
      {
        path: 'invoices',
        element: <InvoicesPage />,
      },
      {
        path: 'invoices/new',
        element: <InvoiceBuilderPage />,
      },
      {
        path: 'invoices/:id',
        element: <InvoiceDetailPage />,
      },

      /* Payments */
      {
        path: 'payments',
        element: <PaymentsPage />,
      },

      /* Income */
      {
        path: 'income',
        element: <IncomePage />,
      },

      /* Expenses */
      {
        path: 'expenses',
        element: <ExpensesPage />,
      },

      /* Subscriptions */
      {
        path: 'subscriptions',
        element: <SubscriptionsPage />,
      },

      /* Employees */
      {
        path: 'employees',
        element: <EmployeesPage />,
      },
      {
        path: 'employees/new',
        element: <EmployeesPage />,
      },
      {
        path: 'employees/:id',
        element: <EmployeeDetailPage />,
      },

      /* Salaries */
      {
        path: 'salaries',
        element: <SalariesPage />,
      },

      /* Calendar */
      {
        path: 'calendar',
        element: <CalendarPage />,
      },

      /* Documents */
      {
        path: 'documents',
        element: <DocumentsPage />,
      },

      /* Reports */
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'reports/profit-loss',
        element: <ProfitLossPage />,
      },
      {
        path: 'reports/income',
        element: <IncomePage />,
      },
      {
        path: 'reports/expenses',
        element: <ExpensesPage />,
      },
      {
        path: 'reports/cash-flow',
        element: <ReportsPage />,
      },
      {
        path: 'reports/clients',
        element: <ClientsPage />,
      },
      {
        path: 'reports/projects',
        element: <ProjectsPage />,
      },
      {
        path: 'reports/employees',
        element: <EmployeesPage />,
      },

      /* Activity */
      {
        path: 'activity',
        element: <ActivityPage />,
      },

      /* Profile */
      {
        path: 'profile',
        element: <ProfilePage />,
      },

      /* Settings */
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'settings/:tab',
        element: <SettingsPage />,
      },
    ],
  },

  /* ----------------------------------------------------------
     UNKNOWN ROUTES
  ---------------------------------------------------------- */

  {
    path: '*',
    element: (
      <Navigate
        to="/login"
        replace
      />
    ),
  },
])
