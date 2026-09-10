import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Briefcase, Wrench, FileText, CreditCard, TrendingUp,
  Receipt, RefreshCcw, UserRound, DollarSign, BarChart3, CalendarDays, FolderOpen,
  Settings, LogOut, ChevronRight, X, Activity, FileBarChart
} from 'lucide-react'
import logoImg from '../../assets/xyphora-logo.png'
import { useAuth } from '../../contexts/AuthContext'
import { getInitials } from '../../lib/utils'
import { cn } from '../../lib/utils'

const nav = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { type: 'section', label: 'BUSINESS' },
  { label: 'Clients', to: '/clients', icon: Users },
  { label: 'Projects', to: '/projects', icon: Briefcase },
  { label: 'Services', to: '/services', icon: Wrench },
  { type: 'section', label: 'FINANCE' },
  { label: 'Invoices', to: '/invoices', icon: FileText },
  { label: 'Payments', to: '/payments', icon: CreditCard },
  { label: 'Income', to: '/income', icon: TrendingUp },
  { label: 'Expenses', to: '/expenses', icon: Receipt },
  { label: 'Subscriptions', to: '/subscriptions', icon: RefreshCcw },
  { type: 'section', label: 'TEAM' },
  { label: 'Employees', to: '/employees', icon: UserRound },
  { label: 'Salaries', to: '/salaries', icon: DollarSign },
  { type: 'section', label: 'INSIGHTS' },
  { label: 'Reports', to: '/reports', icon: FileBarChart },
  { label: 'Calendar', to: '/calendar', icon: CalendarDays },
  { label: 'Documents', to: '/documents', icon: FolderOpen },
  { label: 'Activity', to: '/activity', icon: Activity },
  { type: 'divider' },
  { label: 'Settings', to: '/settings', icon: Settings },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white select-none">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center p-1 shrink-0">
            <img src={logoImg} alt="Xyphora Prime" className="w-full h-full object-contain brightness-110" />
          </div>
          <div>
            <p className="text-[13px] font-brand font-bold text-white tracking-wider leading-none">XYPHORA PRIME</p>
            <p className="text-[9px] font-medium text-purple-300/80 uppercase tracking-widest leading-none mt-1">Innovate • Build • Elevate</p>
          </div>
        </div>
        {/* Mobile close */}
        <button className="lg:hidden text-white/40 hover:text-white p-1" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {nav.map((item, i) => {
          if (item.type === 'section') return (
            <p key={i} className="text-[9px] font-bold text-white/25 uppercase tracking-[0.15em] px-2 pt-4 pb-1">{item.label}</p>
          )
          if (item.type === 'divider') return <div key={i} className="border-t border-white/6 my-2" />
          const Icon = item.icon!
          return (
            <NavLink
              key={item.to}
              to={item.to!}
              onClick={onClose}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-100 group',
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/50 hover:text-white/90 hover:bg-white/5'
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} className={isActive ? 'text-xp-soft-purple' : 'text-white/40 group-hover:text-white/70'} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <div className="w-1 h-1 rounded-full bg-xp-purple" />}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Admin profile */}
      <div className="px-3 pb-4 pt-2 border-t border-white/6">
        <div className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors"
          onClick={() => { navigate('/profile'); onClose() }}>
          <div className="w-8 h-8 rounded-full bg-xp-purple flex items-center justify-center text-[11px] font-bold text-white shrink-0">
            {admin ? getInitials(admin.name) : 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-white truncate">{admin?.name || 'Administrator'}</p>
            <p className="text-[10px] text-white/30 truncate">{admin?.email}</p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); handleLogout() }}
            className="text-white/25 hover:text-white/70 transition-colors p-1"
            title="Logout"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="fixed inset-y-0 left-0 w-60 z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
