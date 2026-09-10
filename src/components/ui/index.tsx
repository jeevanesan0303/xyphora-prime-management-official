import { useState, useRef, useEffect, forwardRef, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertCircle, FolderOpen, Plus, Search, ChevronDown, Download, FileText, FileSpreadsheet } from 'lucide-react'
import { cn } from '../../lib/utils'

// ─── Button ──────────────────────────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'purple'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props
}, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xp-purple focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none'
  const variants = {
    primary: 'bg-xp-near-black text-white hover:bg-xp-black active:scale-[0.98]',
    secondary: 'bg-xp-light-gray text-[#111] hover:bg-xp-border active:scale-[0.98]',
    ghost: 'bg-transparent text-xp-muted hover:bg-xp-light-gray hover:text-[#111]',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]',
    outline: 'border border-xp-border bg-white text-[#111] hover:border-[#111] hover:bg-xp-off-white',
    purple: 'bg-xp-purple text-white hover:bg-xp-deep-purple active:scale-[0.98]'
  }
  const sizes = { sm: 'h-8 px-3 text-xs', md: 'h-9 px-4 text-sm', lg: 'h-11 px-6 text-sm' }

  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {children}
    </button>
  )
})
Button.displayName = 'Button'

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  error?: string
  prefix?: ReactNode
  suffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, prefix, suffix, className, id, ...props
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className="text-xs font-medium text-xp-muted uppercase tracking-wide">{label}</label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-xp-muted text-sm">{prefix}</span>}
        <input
          ref={ref} id={inputId}
          className={cn(
            'w-full h-9 rounded-lg border text-sm bg-white text-[#111] transition-colors',
            'placeholder:text-xp-dark-muted focus:outline-none focus:ring-2 focus:ring-xp-purple/20 focus:border-xp-purple',
            error ? 'border-red-400' : 'border-xp-border hover:border-[#c4c4c4]',
            prefix ? 'pl-9' : 'pl-3',
            suffix ? 'pr-9' : 'pr-3',
            className
          )}
          {...props}
        />
        {suffix && <span className="absolute right-3 text-xp-muted text-sm">{suffix}</span>}
      </div>
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /><span className="text-xs">{error}</span></p>}
    </div>
  )
})
Input.displayName = 'Input'

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, error, className, id, ...props }, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className="text-xs font-medium text-xp-muted uppercase tracking-wide">{label}</label>}
      <textarea
        ref={ref} id={inputId}
        className={cn(
          'w-full rounded-lg border text-sm bg-white text-[#111] px-3 py-2 min-h-20 resize-y transition-colors',
          'placeholder:text-xp-dark-muted focus:outline-none focus:ring-2 focus:ring-xp-purple/20 focus:border-xp-purple',
          error ? 'border-red-400' : 'border-xp-border hover:border-[#c4c4c4]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /><span className="text-xs">{error}</span></p>}
    </div>
  )
})
Textarea.displayName = 'Textarea'

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, error, options, placeholder, className, id, ...props }, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className="text-xs font-medium text-xp-muted uppercase tracking-wide">{label}</label>}
      <div className="relative">
        <select
          ref={ref} id={inputId}
          className={cn(
            'w-full h-9 rounded-lg border text-sm bg-white text-[#111] pl-3 pr-8 transition-colors appearance-none cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-xp-purple/20 focus:border-xp-purple',
            error ? 'border-red-400' : 'border-xp-border hover:border-[#c4c4c4]',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xp-muted pointer-events-none" />
      </div>
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /><span className="text-xs">{error}</span></p>}
    </div>
  )
})
Select.displayName = 'Select'

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'purple' | 'muted' | 'blue'

const badgeStyles: Record<BadgeVariant, string> = {
  default: 'bg-xp-light-gray text-xp-muted',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-600',
  purple: 'bg-xp-light-purple text-xp-purple',
  muted: 'bg-xp-light-gray text-xp-muted',
  blue: 'bg-blue-50 text-blue-700'
}

export const Badge = ({ children, variant = 'default', className }: { children: ReactNode; variant?: BadgeVariant; className?: string }) => (
  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide', badgeStyles[variant], className)}>
    {children}
  </span>
)

// ─── Card ─────────────────────────────────────────────────────────────────────

export const Card = ({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={cn('bg-white border border-xp-border rounded-xl transition-shadow', onClick && 'cursor-pointer hover:shadow-sm', className)}
  >
    {children}
  </div>
)

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
  footer?: ReactNode
}

export const Modal = ({ open, onClose, title, children, width = 'max-w-lg', footer }: ModalProps) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.18 }}
          className={cn('relative bg-white rounded-[14px] shadow-2xl w-full', width)}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-xp-border">
            <h2 className="text-base font-semibold text-[#111]">{title}</h2>
            <button onClick={onClose} className="text-xp-muted hover:text-[#111] p-1 rounded-lg hover:bg-xp-light-gray transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto max-h-[75vh]">{children}</div>
          {footer && <div className="px-6 py-4 border-t border-xp-border flex justify-end gap-2">{footer}</div>}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
)

// ─── Empty State ──────────────────────────────────────────────────────────────

export const EmptyState = ({ title, description, action, icon: Icon = FolderOpen }: {
  title: string; description?: string; action?: { label: string; onClick: () => void }; icon?: typeof FolderOpen
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-14 h-14 rounded-full bg-xp-light-purple flex items-center justify-center mb-4">
      <Icon size={22} className="text-xp-purple" />
    </div>
    <h3 className="text-base font-semibold text-[#111] mb-1">{title}</h3>
    {description && <p className="text-sm text-xp-muted max-w-xs mb-4">{description}</p>}
    {action && (
      <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
)

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('bg-xp-light-gray animate-pulse rounded-md', className)} />
)

// ─── Section Header ───────────────────────────────────────────────────────────

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="flex items-start justify-between mb-6">
    <div>
      <h1 className="text-[22px] font-semibold text-[#111] tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-xp-muted mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
)

// ─── Stat Card ────────────────────────────────────────────────────────────────

export const StatCard = ({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) => (
  <Card className="p-5">
    <p className="text-xs font-semibold text-xp-muted uppercase tracking-wider mb-3">{label}</p>
    <p className={cn('text-2xl font-semibold tracking-tight', accent ? 'text-xp-purple' : 'text-[#111]')}>{value}</p>
    {sub && <p className="text-xs text-xp-muted mt-1">{sub}</p>}
  </Card>
)

// ─── Table ────────────────────────────────────────────────────────────────────

export const Table = ({ headers, children, className }: { headers: (string | ReactNode)[]; children: ReactNode; className?: string }) => (
  <div className={cn('overflow-x-auto', className)}>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-xp-border">
          {headers.map((h, i) => (
            <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-xp-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
)

export const TableRow = ({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) => (
  <tr
    onClick={onClick}
    className={cn('border-b border-xp-light-gray transition-colors', onClick && 'cursor-pointer hover:bg-xp-off-white', className)}
  >
    {children}
  </tr>
)

export const Td = ({ children, className }: { children: ReactNode; className?: string }) => (
  <td className={cn('px-4 py-3 text-[#111]', className)}>{children}</td>
)

// ─── Search Input ─────────────────────────────────────────────────────────────

export const SearchInput = ({ value, onChange, placeholder = 'Search...', className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) => (
  <div className={cn('relative', className)}>
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-xp-muted" />
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 pl-9 pr-3 rounded-lg border border-xp-border text-sm bg-white text-[#111] placeholder:text-xp-dark-muted focus:outline-none focus:ring-2 focus:ring-xp-purple/20 focus:border-xp-purple transition-colors hover:border-[#c4c4c4]"
    />
  </div>
)

// ─── Progress Bar ─────────────────────────────────────────────────────────────

export const ProgressBar = ({ value, className }: { value: number; className?: string }) => (
  <div className={cn('h-1.5 bg-xp-light-gray rounded-full overflow-hidden', className)}>
    <div
      className="h-full bg-xp-purple rounded-full transition-all"
      style={{ width: `${Math.min(100, value)}%` }}
    />
  </div>
)

// ─── Divider ──────────────────────────────────────────────────────────────────

export const Divider = ({ className }: { className?: string }) => (
  <hr className={cn('border-xp-border', className)} />
)

// ─── Section Label ────────────────────────────────────────────────────────────

export const SectionLabel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-[10px] font-semibold text-xp-dark-muted uppercase tracking-widest mb-2', className)}>{children}</p>
)

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export const Checkbox = ({ label, checked, onChange }: { label?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none group">
    <div
      onClick={() => onChange(!checked)}
      className={cn(
        'w-4 h-4 rounded flex items-center justify-center border transition-colors',
        checked ? 'bg-xp-purple border-xp-purple' : 'border-xp-border group-hover:border-xp-purple'
      )}
    >
      {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </div>
    {label && <span className="text-sm text-[#111]">{label}</span>}
  </label>
)

// ─── Export Dropdown ──────────────────────────────────────────────────────────

export function ExportDropdown({
  onExportPDF,
  onExportCSV,
  disabled,
  label = 'Export',
  size = 'sm',
  className,
}: {
  onExportPDF?: () => void
  onExportCSV?: () => void
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn('relative inline-block text-left', className)} ref={ref}>
      <Button
        type="button"
        variant="outline"
        size={size}
        icon={<Download size={13} />}
        onClick={() => setOpen(!open)}
        disabled={disabled}
      >
        <span>{label}</span>
        <ChevronDown size={12} className={cn('transition-transform duration-150', open && 'rotate-180')} />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -2 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -2 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 mt-1 w-44 rounded-xl bg-white shadow-xl border border-xp-border py-1.5 z-50 overflow-hidden"
          >
            {onExportPDF && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onExportPDF()
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#111] hover:bg-xp-light-gray transition-colors text-left"
              >
                <FileText size={14} className="text-red-500 shrink-0" />
                <span>Download as PDF</span>
              </button>
            )}
            {onExportCSV && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onExportCSV()
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#111] hover:bg-xp-light-gray transition-colors text-left"
              >
                <FileSpreadsheet size={14} className="text-emerald-600 shrink-0" />
                <span>Download as CSV</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export * from './InternationalPhoneField'
