import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCurrency, formatDate } from './utils'
import type {
  Invoice,
  InvoiceItem,
  CompanySettings,
  Client,
  Payment,
  SalaryRecord,
  Employee,
  Project,
  ProjectMilestone,
} from '../types'

const PURPLE = [124, 58, 237] as [number, number, number]
const BLACK = [8, 8, 8] as [number, number, number]
const GRAY = [115, 115, 115] as [number, number, number]
const LIGHT = [243, 243, 243] as [number, number, number]

// ─── 1. Tax Invoice PDF ──────────────────────────────────────────────────────

export const generateInvoicePDF = (
  invoice: Invoice,
  client: Client | { company_name: string; contact_person?: string; email?: string; phone?: string; address?: string },
  settings?: Partial<CompanySettings>
) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const W = 210
  const sym = settings?.currency_symbol || settings?.currency || 'LKR'
  const compName = settings?.company_name || 'Xyphora Prime'

  // Header background
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, W, 55, 'F')

  // Company name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(compName, 15, 22)

  // Invoice label
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text('TAX INVOICE', 15, 32)

  // Invoice number (top right)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(invoice.invoice_number, W - 15, 22, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(`Date: ${formatDate(invoice.invoice_date)}`, W - 15, 30, { align: 'right' })
  doc.text(`Due: ${formatDate(invoice.due_date)}`, W - 15, 37, { align: 'right' })

  // Accent line
  doc.setFillColor(...PURPLE)
  doc.rect(0, 55, W, 2, 'F')

  // From / To section
  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('FROM', 15, 68)
  doc.text('BILL TO', 110, 68)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  doc.text(compName, 15, 76)
  doc.text(client.company_name, 110, 76)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  const fromLines = [settings?.address, settings?.phone, settings?.email].filter(Boolean) as string[]
  fromLines.forEach((line, i) => doc.text(line, 15, 83 + i * 6))

  const toLines = [client.contact_person, client.phone, client.email, client.address].filter(Boolean) as string[]
  toLines.forEach((line, i) => doc.text(line, 110, 83 + i * 6))

  // Items table
  const tableTop = 115

  autoTable(doc, {
    startY: tableTop,
    head: [['Description', 'Qty', 'Unit Price', 'Discount', 'Tax', 'Total']],
    body: (invoice.items || []).map((item: InvoiceItem) => [
      item.description,
      item.quantity,
      `${sym} ${Number(item.unit_price || 0).toLocaleString()}`,
      item.discount > 0 ? `${item.discount}%` : '-',
      item.tax > 0 ? `${item.tax}%` : '-',
      `${sym} ${Number(item.total || 0).toLocaleString()}`
    ]),
    headStyles: {
      fillColor: BLACK,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 5
    },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 30], cellPadding: 5 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: 15, right: 15 }
  })

  const afterTable = ((doc as any).lastAutoTable?.finalY || tableTop + 40) + 10

  // Totals
  const totalsX = 130
  const totalsW = 65
  const drawTotal = (label: string, value: string, y: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 10 : 9)
    if (bold) { doc.setTextColor(...BLACK) } else { doc.setTextColor(...GRAY) }
    doc.text(label, totalsX, y)
    doc.text(value, totalsX + totalsW, y, { align: 'right' })
  }

  let ty = afterTable
  drawTotal('Subtotal', formatCurrency(Number(invoice.subtotal || 0), sym), ty)
  ty += 7
  if (Number(invoice.discount || 0) > 0) {
    drawTotal('Discount', `- ${formatCurrency(Number(invoice.discount), sym)}`, ty)
    ty += 7
  }
  if (Number(invoice.tax || 0) > 0) {
    drawTotal('Tax', formatCurrency(Number(invoice.tax), sym), ty)
    ty += 7
  }

  doc.setDrawColor(...LIGHT)
  doc.line(totalsX, ty, totalsX + totalsW, ty)
  ty += 6

  doc.setFillColor(...PURPLE)
  doc.rect(totalsX - 2, ty - 5, totalsW + 4, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Total', totalsX + 2, ty + 3)
  doc.text(formatCurrency(Number(invoice.total || 0), sym), totalsX + totalsW - 2, ty + 3, { align: 'right' })
  ty += 18

  if (Number(invoice.paid || 0) > 0) {
    drawTotal('Paid', `- ${formatCurrency(Number(invoice.paid), sym)}`, ty)
    ty += 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...BLACK)
    doc.text('Balance Due', totalsX, ty)
    doc.text(formatCurrency(Number(invoice.balance || 0), sym), totalsX + totalsW, ty, { align: 'right' })
    ty += 10
  }

  // Bank details
  if (settings?.bank_account) {
    const bankY = afterTable
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...BLACK)
    doc.text('PAYMENT DETAILS', 15, bankY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(`Bank: ${settings.bank_name}`, 15, bankY + 7)
    doc.text(`Account: ${settings.bank_account}`, 15, bankY + 14)
    if (settings.bank_branch) doc.text(`Branch: ${settings.bank_branch}`, 15, bankY + 21)
  }

  // Notes
  if (invoice.notes) {
    const notesY = Math.max(ty + 5, afterTable + 50)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...BLACK)
    doc.text('NOTES', 15, notesY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(invoice.notes, 15, notesY + 7, { maxWidth: 180 })
  }

  // Footer
  const pageH = 297
  doc.setFillColor(...BLACK)
  doc.rect(0, pageH - 20, W, 20, 'F')
  doc.setTextColor(140, 140, 140)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(settings?.invoice_footer || `Thank you for your business. — ${compName}`, W / 2, pageH - 10, { align: 'center' })

  doc.save(`${invoice.invoice_number}.pdf`)
}

// ─── 2. General Tabular Report PDF ───────────────────────────────────────────

export const generateReportPDF = (
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  totals?: { label: string; value: string }[],
  settings?: Partial<CompanySettings>
) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const W = 210
  const compName = settings?.company_name || 'Xyphora Prime'

  doc.setFillColor(...BLACK)
  doc.rect(0, 0, W, 40, 'F')
  doc.setFillColor(...PURPLE)
  doc.rect(0, 40, W, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(compName, 15, 18)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(title, 15, 28)
  doc.setFontSize(9)
  doc.text(subtitle, 15, 35)

  doc.setTextColor(180, 180, 180)
  doc.text(`Generated: ${formatDate(new Date().toISOString())}`, W - 15, 35, { align: 'right' })

  autoTable(doc, {
    startY: 52,
    head: [headers],
    body: rows,
    headStyles: { fillColor: BLACK, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 5 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 30, 30], cellPadding: 4 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 15, right: 15 }
  })

  if (totals && totals.length > 0) {
    const y = ((doc as any).lastAutoTable?.finalY || 100) + 10
    totals.forEach((t, i) => {
      doc.setFont('helvetica', i === totals.length - 1 ? 'bold' : 'normal')
      doc.setFontSize(i === totals.length - 1 ? 11 : 9)
      if (i === totals.length - 1) { doc.setTextColor(...BLACK) } else { doc.setTextColor(...GRAY) }
      doc.text(t.label, W - 80, y + i * 8)
      doc.text(t.value, W - 15, y + i * 8, { align: 'right' })
    })
  }

  const pageH = 297
  doc.setFillColor(...BLACK)
  doc.rect(0, pageH - 15, W, 15, 'F')
  doc.setTextColor(140, 140, 140)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`${compName} — Confidential Business Document`, W / 2, pageH - 6, { align: 'center' })

  doc.save(`${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`)
}

// ─── 3. Payment Receipt PDF ──────────────────────────────────────────────────

export const generateReceiptPDF = (
  payment: Payment,
  options: {
    clientName?: string
    invoiceNumber?: string
    projectName?: string
    settings?: Partial<CompanySettings>
  }
) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const W = 210
  const sym = options.settings?.currency_symbol || options.settings?.currency || 'LKR'
  const compName = options.settings?.company_name || 'Xyphora Prime'

  // Header
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, W, 48, 'F')
  doc.setFillColor(...PURPLE)
  doc.rect(0, 48, W, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(compName, 15, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text('OFFICIAL PAYMENT RECEIPT', 15, 30)
  doc.text(`Receipt ID: ${payment.payment_id}`, 15, 38)

  doc.text(`Date: ${formatDate(payment.payment_date)}`, W - 15, 30, { align: 'right' })
  doc.text(`Ref: ${payment.reference_number || '—'}`, W - 15, 38, { align: 'right' })

  // Amount Highlight Box
  doc.setFillColor(245, 243, 255)
  doc.setDrawColor(...PURPLE)
  doc.rect(15, 60, W - 30, 24, 'FD')

  doc.setTextColor(...PURPLE)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('AMOUNT RECEIVED', 22, 69)

  doc.setFontSize(16)
  doc.text(formatCurrency(Number(payment.amount || 0), sym), 22, 78)

  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Payment Method: ${payment.payment_method}`, W - 22, 69, { align: 'right' })
  doc.text(`Payment Type: ${payment.payment_type}`, W - 22, 78, { align: 'right' })

  // Payment Details Table
  const details = [
    ['Received From', options.clientName || 'Valued Client'],
    ['Invoice Number', options.invoiceNumber || '—'],
    ['Project Allocation', options.projectName || '—'],
    ['Payment Date', formatDate(payment.payment_date)],
    ['Payment Type', payment.payment_type],
    ['Payment Method', payment.payment_method],
    ['Reference Number', payment.reference_number || '—'],
    ['Notes / Remarks', payment.notes || 'Payment recorded successfully.'],
  ]

  autoTable(doc, {
    startY: 95,
    head: [['Detail', 'Information']],
    body: details,
    headStyles: { fillColor: BLACK, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 5 },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 30], cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 130 },
    },
    margin: { left: 15, right: 15 },
  })

  // Signatures
  const signY = 220
  doc.setDrawColor(...GRAY)
  doc.line(15, signY, 80, signY)
  doc.line(W - 80, signY, W - 15, signY)

  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text('Authorized Signature', 15, signY + 6)
  doc.text('Client Signature / Acknowledgment', W - 80, signY + 6)

  // Footer
  const pageH = 297
  doc.setFillColor(...BLACK)
  doc.rect(0, pageH - 15, W, 15, 'F')
  doc.setTextColor(140, 140, 140)
  doc.setFontSize(7.5)
  doc.text(`${compName} — Payment Confirmation Receipt`, W / 2, pageH - 6, { align: 'center' })

  doc.save(`Receipt_${payment.payment_id}.pdf`)
}

// ─── 4. Salary Payslip PDF ───────────────────────────────────────────────────

export const generatePayslipPDF = (
  salary: SalaryRecord,
  employee: Employee | undefined,
  settings?: Partial<CompanySettings>
) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const W = 210
  const sym = settings?.currency_symbol || settings?.currency || 'LKR'
  const compName = settings?.company_name || 'Xyphora Prime'

  // Header
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, W, 48, 'F')
  doc.setFillColor(...PURPLE)
  doc.rect(0, 48, W, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(compName, 15, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text('MONTHLY SALARY PAYSLIP', 15, 30)
  doc.text(`Salary Month: ${salary.month}`, 15, 38)

  doc.text(`Status: ${salary.status}`, W - 15, 30, { align: 'right' })
  doc.text(`Payment Date: ${salary.payment_date ? formatDate(salary.payment_date) : 'Pending'}`, W - 15, 38, { align: 'right' })

  // Employee Information
  doc.setTextColor(...GRAY)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('EMPLOYEE DETAILS', 15, 60)

  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  doc.text(`Name: ${employee?.full_name || 'Employee'}`, 15, 68)
  doc.text(`Employee ID: ${employee?.employee_id || '—'}`, 15, 75)
  doc.text(`Role: ${employee?.role || '—'}`, 15, 82)

  doc.text(`Payment Method: ${salary.payment_method}`, 110, 68)
  doc.text(`Bank Info: ${employee?.bank_information || '—'}`, 110, 75)
  doc.text(`Joining Date: ${employee?.joining_date ? formatDate(employee.joining_date) : '—'}`, 110, 82)

  // Salary Breakdown Table
  const rows = [
    ['Basic Salary', `${sym} ${Number(salary.base_amount || 0).toLocaleString()}`, '—'],
    ['Allowances', `${sym} ${Number(salary.allowances || 0).toLocaleString()}`, '—'],
    ['Bonus', `${sym} ${Number(salary.bonus || 0).toLocaleString()}`, '—'],
    ['Commission', `${sym} ${Number(salary.commission || 0).toLocaleString()}`, '—'],
    ['Overtime', `${sym} ${Number(salary.overtime || 0).toLocaleString()}`, '—'],
    ['Deductions', '—', `- ${sym} ${Number(salary.deductions || 0).toLocaleString()}`],
    ['Other Adjustments', `${sym} ${Number(salary.other_adjustments || 0).toLocaleString()}`, '—'],
  ]

  autoTable(doc, {
    startY: 92,
    head: [['Earnings & Adjustments Component', 'Earnings', 'Deductions']],
    body: rows,
    headStyles: { fillColor: BLACK, textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', cellPadding: 5 },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 30], cellPadding: 4.5 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 45, halign: 'right' },
      2: { cellWidth: 45, halign: 'right' },
    },
    margin: { left: 15, right: 15 },
  })

  const afterTable = ((doc as any).lastAutoTable?.finalY || 160) + 10

  // Net Salary Box
  doc.setFillColor(...PURPLE)
  doc.rect(W - 95, afterTable, 80, 16, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('NET SALARY PAYABLE', W - 90, afterTable + 6)

  doc.setFontSize(13)
  doc.text(formatCurrency(Number(salary.net_salary || 0), sym), W - 90, afterTable + 12)

  // Signatures
  const signY = 240
  doc.setDrawColor(...GRAY)
  doc.line(15, signY, 75, signY)
  doc.line(W - 75, signY, W - 15, signY)

  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text('Authorized Signature / HR', 15, signY + 5)
  doc.text('Employee Signature', W - 75, signY + 5)

  // Footer
  const pageH = 297
  doc.setFillColor(...BLACK)
  doc.rect(0, pageH - 15, W, 15, 'F')
  doc.setTextColor(140, 140, 140)
  doc.setFontSize(7.5)
  doc.text(`${compName} — Confidential Salary Payslip`, W / 2, pageH - 6, { align: 'center' })

  doc.save(`Payslip_${employee?.employee_id || 'Staff'}_${salary.month}.pdf`)
}

// ─── 5. Client Statement of Account PDF ───────────────────────────────────────

export const generateClientStatementPDF = (
  client: Client,
  invoices: Invoice[],
  payments: Payment[],
  settings?: Partial<CompanySettings>
) => {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const W = 210
  const sym = settings?.currency_symbol || settings?.currency || 'LKR'
  const compName = settings?.company_name || 'Xyphora Prime'

  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
  const totalPaid = payments.reduce((sum, pay) => sum + Number(pay.amount || 0), 0)
  const outstanding = Math.max(0, totalInvoiced - totalPaid)

  // Header
  doc.setFillColor(...BLACK)
  doc.rect(0, 0, W, 48, 'F')
  doc.setFillColor(...PURPLE)
  doc.rect(0, 48, W, 2, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(compName, 15, 20)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text('STATEMENT OF ACCOUNT', 15, 30)
  doc.text(`Client: ${client.company_name} (${client.client_id})`, 15, 38)

  doc.text(`Statement Date: ${formatDate(new Date().toISOString())}`, W - 15, 30, { align: 'right' })

  // Summary Metrics
  const summaryX = 15
  const summaryW = (W - 40) / 3

  const drawCard = (x: number, label: string, value: string, color: [number, number, number]) => {
    doc.setFillColor(250, 250, 250)
    doc.setDrawColor(...LIGHT)
    doc.rect(x, 58, summaryW, 20, 'FD')
    doc.setTextColor(...GRAY)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(label, x + 5, 65)
    doc.setTextColor(...color)
    doc.setFontSize(11)
    doc.text(value, x + 5, 73)
  }

  drawCard(summaryX, 'TOTAL INVOICED', formatCurrency(totalInvoiced, sym), BLACK)
  drawCard(summaryX + summaryW + 5, 'TOTAL RECEIVED', formatCurrency(totalPaid, sym), [16, 185, 129])
  drawCard(summaryX + (summaryW + 5) * 2, 'BALANCE OUTSTANDING', formatCurrency(outstanding, sym), PURPLE)

  // Invoices Table
  doc.setTextColor(...BLACK)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE HISTORY', 15, 88)

  autoTable(doc, {
    startY: 92,
    head: [['Invoice #', 'Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Status']],
    body: invoices.map((inv) => [
      inv.invoice_number,
      formatDate(inv.invoice_date),
      formatDate(inv.due_date),
      `${sym} ${Number(inv.total || 0).toLocaleString()}`,
      `${sym} ${Number(inv.paid || 0).toLocaleString()}`,
      `${sym} ${Number(inv.balance || 0).toLocaleString()}`,
      inv.status,
    ]),
    headStyles: { fillColor: BLACK, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold', cellPadding: 4 },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30], cellPadding: 3.5 },
    margin: { left: 15, right: 15 },
  })

  // Payments Table
  const payStartY = ((doc as any).lastAutoTable?.finalY || 150) + 10
  doc.setTextColor(...BLACK)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('PAYMENT TRANSACTIONS', 15, payStartY - 4)

  autoTable(doc, {
    startY: payStartY,
    head: [['Payment ID', 'Date', 'Type', 'Method', 'Reference', 'Amount']],
    body: payments.map((pay) => [
      pay.payment_id,
      formatDate(pay.payment_date),
      pay.payment_type,
      pay.payment_method,
      pay.reference_number || '—',
      `${sym} ${Number(pay.amount || 0).toLocaleString()}`,
    ]),
    headStyles: { fillColor: PURPLE, textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold', cellPadding: 4 },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30], cellPadding: 3.5 },
    margin: { left: 15, right: 15 },
  })

  // Footer
  const pageH = 297
  doc.setFillColor(...BLACK)
  doc.rect(0, pageH - 15, W, 15, 'F')
  doc.setTextColor(140, 140, 140)
  doc.setFontSize(7.5)
  doc.text(`${compName} — Client Account Statement`, W / 2, pageH - 6, { align: 'center' })

  doc.save(`Statement_${client.client_id}.pdf`)
}
