import { format, parseISO, differenceInDays } from 'date-fns'

export const formatCurrency = (amount: number, symbol = 'LKR') =>
  `${symbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const formatDate = (dateStr: string, fmt = 'dd MMM yyyy') => {
  try { return format(parseISO(dateStr), fmt) } catch { return dateStr }
}

export const formatDateTime = (dateStr: string) => {
  try { return format(parseISO(dateStr), 'dd MMM yyyy, HH:mm') } catch { return dateStr }
}

export const daysOverdue = (dueDate: string) => {
  const days = differenceInDays(new Date(), parseISO(dueDate))
  return days > 0 ? days : 0
}

export const daysDue = (dueDate: string) => {
  const days = differenceInDays(parseISO(dueDate), new Date())
  return days
}

export const generateId = (prefix: string, seq: number) =>
  `${prefix}-${String(seq).padStart(3, '0')}`

export const exportCSV = (filename: string, headers: string[], rows: (string | number)[][][]) => {
  const escape = (val: string | number) => {
    const s = String(val ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(cell => escape(cell[0])).join(','))
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const exportCSVSimple = (filename: string, headers: string[], rows: Record<string, string | number>[]) => {
  const escape = (val: string | number) => {
    const s = String(val ?? '')
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => Object.values(row).map(escape).join(','))
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(' ')

export const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

export const truncate = (str: string, len = 40) =>
  str.length > len ? str.slice(0, len) + '…' : str

export const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
