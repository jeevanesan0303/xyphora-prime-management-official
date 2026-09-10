import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Phone, Mail, Globe, MapPin, Building2, Edit2, Plus } from 'lucide-react'
import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'
import { formatDate, formatCurrency, exportCSVSimple } from '../../lib/utils'
import { generateClientStatementPDF } from '../../lib/pdf'
import { Card, Badge, Button, ExportDropdown, Table, TableRow, Td, EmptyState } from '../../components/ui'
import type { ClientStatus, InvoiceStatus } from '../../types'

const statusVariant: Record<ClientStatus, any> = {
  Active: 'success', Lead: 'purple', Completed: 'muted', Maintenance: 'warning', Inactive: 'danger'
}
const invStatusVariant: Record<InvoiceStatus, any> = {
  Draft: 'muted', Sent: 'blue', Partial: 'warning', Paid: 'success', Pending: 'muted', Overdue: 'danger', Cancelled: 'danger'
}

type TabKey = 'overview' | 'projects' | 'invoices' | 'payments' | 'subscriptions'

export default function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { success } = useToast()
  const { clients, projects, invoices, payments, subscriptions, settings } = useData()
  const [tab, setTab] = useState<TabKey>('overview')

  const client = clients.find(c => c.id === id)
  if (!client) return (
    <div className="flex flex-col items-center justify-center py-20">
      <p className="text-xp-muted">Client not found.</p>
      <button onClick={() => navigate('/clients')} className="text-xp-purple text-sm mt-2">← Back to clients</button>
    </div>
  )

  const clientProjects = projects.filter(p => p.client_id === id)
  const clientInvoices = invoices.filter(i => i.client_id === id)
  const clientPayments = payments.filter(p => p.client_id === id)
  const clientSubs = subscriptions.filter(s => s.client_id === id)

  const totalInvoiced = clientInvoices.reduce((s, i) => s + Number(i.total || 0), 0)
  const totalPaid = clientInvoices.reduce((s, i) => s + Number(i.paid || 0), 0)
  const outstanding = Math.max(0, totalInvoiced - totalPaid)

  const handleExportStatementPDF = () => {
    generateClientStatementPDF(client, clientInvoices, clientPayments, settings)
    success('Client Statement of Account downloaded.')
  }

  const handleExportStatementCSV = () => {
    exportCSVSimple(
      `Statement_${client.client_id}`,
      ['Record Type', 'ID / Number', 'Date', 'Description / Reference', 'Total Amount', 'Paid Amount', 'Balance / Method', 'Status'],
      [
        ...clientInvoices.map(inv => ({
          type: 'Invoice',
          id: inv.invoice_number,
          date: inv.invoice_date,
          desc: `Due: ${inv.due_date}`,
          total: Number(inv.total || 0),
          paid: Number(inv.paid || 0),
          balance: Number(inv.balance || 0),
          status: inv.status,
        })),
        ...clientPayments.map(pay => ({
          type: 'Payment',
          id: pay.payment_id,
          date: pay.payment_date,
          desc: pay.reference_number || pay.notes || 'Payment',
          total: Number(pay.amount || 0),
          paid: Number(pay.amount || 0),
          balance: pay.payment_method,
          status: pay.payment_type,
        }))
      ]
    )
    success('Client Statement exported as CSV.')
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'projects', label: 'Projects', count: clientProjects.length },
    { key: 'invoices', label: 'Invoices', count: clientInvoices.length },
    { key: 'payments', label: 'Payments', count: clientPayments.length },
    { key: 'subscriptions', label: 'Subscriptions', count: clientSubs.length },
  ]

  return (
    <div>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/clients')} className="p-1.5 rounded-lg text-xp-muted hover:text-[#111] hover:bg-xp-light-gray transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold text-[#111] tracking-tight">{client.company_name}</h1>
            <Badge variant={statusVariant[client.status]}>{client.status}</Badge>
          </div>
          <p className="text-xs text-xp-muted mt-0.5">{client.client_id} · Joined {formatDate(client.date_joined)}</p>
        </div>
        <ExportDropdown
          onExportPDF={handleExportStatementPDF}
          onExportCSV={handleExportStatementCSV}
          label="Statement"
        />
        <Button variant="outline" size="sm" icon={<Edit2 size={13} />} onClick={() => navigate('/clients')}>Edit</Button>
        <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => navigate(`/invoices/new?clientId=${client.id}`)}>New Invoice</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Invoiced', value: formatCurrency(totalInvoiced) },
          { label: 'Total Paid', value: formatCurrency(totalPaid), accent: false },
          { label: 'Outstanding', value: formatCurrency(outstanding), accent: outstanding > 0 },
          { label: 'Active Projects', value: String(clientProjects.filter(p => p.status === 'In Progress').length) },
        ].map((m, i) => (
          <Card key={i} className="p-4">
            <p className="text-[10px] font-bold text-xp-muted uppercase tracking-widest mb-2">{m.label}</p>
            <p className={`text-xl font-semibold tracking-tight ${m.accent ? 'text-xp-purple' : 'text-[#111]'}`}>{m.value}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-xp-border mb-5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-xp-purple text-xp-purple' : 'border-transparent text-xp-muted hover:text-[#111]'}`}>
            {t.label}
            {t.count !== undefined && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-xp-light-purple text-xp-purple' : 'bg-xp-light-gray text-xp-muted'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-4">Contact Information</p>
            <div className="space-y-3">
              {[
                { icon: Building2, label: 'Contact Person', value: client.contact_person },
                { icon: Mail, label: 'Email', value: client.email },
                { icon: Phone, label: 'Phone', value: client.phone },
                { icon: Globe, label: 'Website', value: client.website || '—' },
                { icon: MapPin, label: 'Address', value: client.address || '—' },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={i} className="flex items-start gap-3">
                    <Icon size={14} className="text-xp-muted mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-xp-muted uppercase tracking-wide">{item.label}</p>
                      <p className="text-sm text-[#111]">{item.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-4">Business Details</p>
            <div className="space-y-3">
              {[
                { label: 'Business Type', value: client.business_type || '—' },
                ...(client.registration_number ? [{ label: 'Registration Number', value: client.registration_number }] : []),
                { label: 'Date Joined', value: formatDate(client.date_joined) },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] text-xp-muted uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm text-[#111] mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
            {client.notes && (
              <div className="mt-4 pt-4 border-t border-xp-light-gray">
                <p className="text-[10px] text-xp-muted uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-xp-muted leading-relaxed">{client.notes}</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'projects' && (
        <Card>
          {clientProjects.length === 0 ? <EmptyState title="No projects" description="No projects for this client yet." /> : (
            <Table headers={['Project', 'Service', 'Value', 'Progress', 'Status']}>
              {clientProjects.map(p => (
                <TableRow key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                  <Td><div><p className="font-medium text-[#111]">{p.project_name}</p><p className="text-xs text-xp-muted">{p.project_id}</p></div></Td>
                  <Td><span className="text-sm text-xp-muted">{p.service_id}</span></Td>
                  <Td><span className="text-sm font-medium text-[#111]">LKR {p.project_value.toLocaleString()}</span></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-xp-light-gray rounded-full overflow-hidden">
                        <div className="h-full bg-xp-purple rounded-full" style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-xs text-xp-muted">{p.progress}%</span>
                    </div>
                  </Td>
                  <Td><Badge variant="purple">{p.status}</Badge></Td>
                </TableRow>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === 'invoices' && (
        <Card>
          {clientInvoices.length === 0 ? <EmptyState title="No invoices" description="No invoices for this client yet." /> : (
            <Table headers={['Invoice', 'Date', 'Due', 'Total', 'Paid', 'Balance', 'Status']}>
              {clientInvoices.map(inv => (
                <TableRow key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <Td><span className="font-medium text-[#111]">{inv.invoice_number}</span></Td>
                  <Td><span className="text-sm text-xp-muted">{formatDate(inv.invoice_date)}</span></Td>
                  <Td><span className="text-sm text-xp-muted">{formatDate(inv.due_date)}</span></Td>
                  <Td><span className="text-sm font-medium text-[#111]">LKR {inv.total.toLocaleString()}</span></Td>
                  <Td><span className="text-sm text-[#111]">LKR {inv.paid.toLocaleString()}</span></Td>
                  <Td><span className={`text-sm font-medium ${inv.balance > 0 ? 'text-xp-purple' : 'text-xp-muted'}`}>LKR {inv.balance.toLocaleString()}</span></Td>
                  <Td><Badge variant={invStatusVariant[inv.status]}>{inv.status}</Badge></Td>
                </TableRow>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === 'payments' && (
        <Card>
          {clientPayments.length === 0 ? <EmptyState title="No payments" description="No payments recorded for this client." /> : (
            <Table headers={['Payment ID', 'Amount', 'Type', 'Method', 'Date', 'Reference']}>
              {clientPayments.map(p => (
                <TableRow key={p.id}>
                  <Td><span className="font-medium text-[#111]">{p.payment_id}</span></Td>
                  <Td><span className="text-sm font-semibold text-[#111]">LKR {p.amount.toLocaleString()}</span></Td>
                  <Td><Badge variant="purple">{p.payment_type}</Badge></Td>
                  <Td><span className="text-sm text-xp-muted">{p.payment_method}</span></Td>
                  <Td><span className="text-sm text-xp-muted">{formatDate(p.payment_date)}</span></Td>
                  <Td><span className="text-xs font-mono text-xp-muted">{p.reference_number || '—'}</span></Td>
                </TableRow>
              ))}
            </Table>
          )}
        </Card>
      )}

      {tab === 'subscriptions' && (
        <Card>
          {clientSubs.length === 0 ? <EmptyState title="No subscriptions" description="No subscriptions for this client." /> : (
            <Table headers={['ID', 'Amount', 'Cycle', 'Next Payment', 'Status']}>
              {clientSubs.map(s => (
                <TableRow key={s.id}>
                  <Td><span className="font-medium text-[#111]">{s.subscription_id}</span></Td>
                  <Td><span className="text-sm font-semibold text-[#111]">LKR {s.amount.toLocaleString()}</span></Td>
                  <Td><span className="text-sm text-xp-muted">{s.billing_cycle}</span></Td>
                  <Td><span className="text-sm text-xp-muted">{formatDate(s.next_payment)}</span></Td>
                  <Td><Badge variant={s.status === 'Active' ? 'success' : s.status === 'Due Soon' ? 'warning' : s.status === 'Overdue' ? 'danger' : 'muted'}>{s.status}</Badge></Td>
                </TableRow>
              ))}
            </Table>
          )}
        </Card>
      )}
    </div>
  )
}
