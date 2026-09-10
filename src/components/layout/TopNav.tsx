import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Bell, ChevronDown, Menu, User, Settings, LogOut, Plus, Users, Briefcase, FileText, CreditCard, Receipt, UserRound, RefreshCcw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { getInitials, cn } from '../../lib/utils'

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  clients: 'Clients', projects: 'Projects', services: 'Services',
  invoices: 'Invoices', payments: 'Payments', income: 'Income',
  expenses: 'Expenses', subscriptions: 'Subscriptions',
  employees: 'Employees', salaries: 'Salaries',
  reports: 'Reports', calendar: 'Calendar', documents: 'Documents',
  activity: 'Activity Log', profile: 'Profile', settings: 'Settings', new: 'New'
}

const quickCreate = [
  { label: 'New Client', icon: Users, to: '/clients/new' },
  { label: 'New Project', icon: Briefcase, to: '/projects/new' },
  { label: 'New Invoice', icon: FileText, to: '/invoices/new' },
  { label: 'Add Payment', icon: CreditCard, to: '/payments?new=1' },
  { label: 'Add Expense', icon: Receipt, to: '/expenses?new=1' },
  { label: 'Add Employee', icon: UserRound, to: '/employees/new' },
  { label: 'Add Subscription', icon: RefreshCcw, to: '/subscriptions?new=1' },
]

export default function TopNav({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { admin, logout } = useAuth()
  const { clients, projects, invoices, employees } = useData()
  const navigate = useNavigate()
  const location = useLocation()

  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const createRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const segments = location.pathname.split('/').filter(Boolean)
  const breadcrumb = segments.map(s => breadcrumbMap[s] || s).join(' / ')

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false)
      if (createRef.current && !createRef.current.contains(e.target as Node)) setShowCreate(false)
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Global search results
  const searchResults = search.length > 1 ? [
    ...clients.filter(c => c.company_name.toLowerCase().includes(search.toLowerCase())).slice(0, 3).map(c => ({ type: 'Client', label: c.company_name, to: `/clients/${c.id}` })),
    ...projects.filter(p => p.project_name.toLowerCase().includes(search.toLowerCase())).slice(0, 3).map(p => ({ type: 'Project', label: p.project_name, to: `/projects/${p.id}` })),
    ...invoices.filter(i => i.invoice_number.toLowerCase().includes(search.toLowerCase())).slice(0, 3).map(i => ({ type: 'Invoice', label: i.invoice_number, to: `/invoices/${i.id}` })),
    ...employees.filter(e => e.full_name.toLowerCase().includes(search.toLowerCase())).slice(0, 2).map(e => ({ type: 'Employee', label: e.full_name, to: `/employees/${e.id}` })),
  ] : []

  return (
    <header className="h-14 bg-white border-b border-xp-border flex items-center px-4 gap-3 sticky top-0 z-30">
      {/* Mobile menu */}
      <button onClick={onMenuToggle} className="lg:hidden p-1.5 rounded-md text-xp-muted hover:bg-xp-light-gray">
        <Menu size={18} />
      </button>

      {/* Breadcrumb */}
      <div className="flex-1">
        <p className="text-[13px] font-medium text-xp-muted capitalize">{breadcrumb || 'Dashboard'}</p>
      </div>

      {/* Global search */}
      <div ref={searchRef} className="relative">
        <button
          onClick={() => setShowSearch(v => !v)}
          className="flex items-center gap-2 h-8 px-3 rounded-lg border border-xp-border text-xp-muted text-sm hover:border-[#c4c4c4] transition-colors"
        >
          <Search size={13} />
          <span className="hidden sm:inline text-xs">Search...</span>
          <kbd className="hidden md:inline text-[10px] bg-xp-light-gray px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 w-80 bg-white rounded-xl border border-xp-border shadow-lg overflow-hidden"
            >
              <div className="p-3 border-b border-xp-light-gray">
                <div className="flex items-center gap-2">
                  <Search size={14} className="text-xp-muted" />
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search clients, projects, invoices..."
                    className="flex-1 text-sm outline-none text-[#111] placeholder:text-xp-dark-muted"
                  />
                </div>
              </div>
              {searchResults.length > 0 ? (
                <div className="py-1">
                  {searchResults.map((r, i) => (
                    <button key={i} onClick={() => { navigate(r.to); setShowSearch(false); setSearch('') }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-xp-off-white text-left transition-colors">
                      <span className="text-[10px] font-semibold text-xp-purple bg-xp-light-purple px-1.5 py-0.5 rounded w-16 text-center shrink-0">{r.type}</span>
                      <span className="text-sm text-[#111] truncate">{r.label}</span>
                    </button>
                  ))}
                </div>
              ) : search.length > 1 ? (
                <p className="text-sm text-xp-muted px-4 py-6 text-center">No results found</p>
              ) : (
                <p className="text-sm text-xp-dark-muted px-4 py-4 text-center">Start typing to search</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick create */}
      <div ref={createRef} className="relative">
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 h-8 px-3 bg-[#111] text-white text-xs font-medium rounded-lg hover:bg-xp-black transition-colors"
        >
          <Plus size={13} />
          <span className="hidden sm:inline">Create</span>
        </button>
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 w-48 bg-white rounded-xl border border-xp-border shadow-lg py-1 overflow-hidden"
            >
              {quickCreate.map(item => {
                const Icon = item.icon
                return (
                  <button key={item.to} onClick={() => { navigate(item.to); setShowCreate(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-xp-off-white text-sm text-[#111] transition-colors">
                    <Icon size={14} className="text-xp-muted" />
                    {item.label}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notifications */}
      <button className="relative p-1.5 rounded-lg text-xp-muted hover:bg-xp-light-gray transition-colors">
        <Bell size={16} />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-xp-purple rounded-full" />
      </button>

      {/* Admin */}
      <div ref={profileRef} className="relative">
        <button onClick={() => setShowProfile(v => !v)}
          className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-lg hover:bg-xp-light-gray transition-colors">
          <div className="w-6 h-6 rounded-full bg-xp-purple flex items-center justify-center text-[10px] font-bold text-white">
            {admin ? getInitials(admin.name) : 'A'}
          </div>
          <span className="hidden sm:inline text-xs font-medium text-[#111]">{admin?.name || 'Admin'}</span>
          <ChevronDown size={12} className={cn('text-xp-muted transition-transform', showProfile && 'rotate-180')} />
        </button>
        <AnimatePresence>
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-10 w-48 bg-white rounded-xl border border-xp-border shadow-lg overflow-hidden"
            >
              <div className="px-3 py-3 border-b border-xp-light-gray">
                <p className="text-xs font-semibold text-[#111]">{admin?.name}</p>
                <p className="text-[11px] text-xp-muted truncate">{admin?.email}</p>
              </div>
              {[
                { label: 'Profile', icon: User, to: '/profile' },
                { label: 'Settings', icon: Settings, to: '/settings' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <button key={item.to} onClick={() => { navigate(item.to); setShowProfile(false) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-[#111] hover:bg-xp-off-white transition-colors">
                    <Icon size={14} className="text-xp-muted" />
                    {item.label}
                  </button>
                )
              })}
              <div className="border-t border-xp-light-gray">
                <button onClick={() => { logout(); navigate('/login') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}
