
import { useEffect, useState } from 'react'
import {
  Building2,
  FileText,
  CreditCard,
  BarChart3,
  Bell,
  Shield,
  Palette,
  Database,
  Save,
} from 'lucide-react'

import { useData } from '../../contexts/DataContext'
import { useToast } from '../../contexts/ToastContext'

import {
  PageHeader,
  Card,
  Button,
  Input,
  Textarea,
  Select,
} from '../../components/ui'

import type { CompanySettings } from '../../types'

type Tab =
  | 'general'
  | 'company'
  | 'invoice'
  | 'payment'
  | 'financial'
  | 'notifications'
  | 'security'
  | 'appearance'
  | 'backup'

type SettingsForm = CompanySettings

const tabs: {
  key: Tab
  label: string
  icon: typeof Building2
}[] = [
  {
    key: 'general',
    label: 'General',
    icon: Building2,
  },
  {
    key: 'company',
    label: 'Company',
    icon: Building2,
  },
  {
    key: 'invoice',
    label: 'Invoice',
    icon: FileText,
  },
  {
    key: 'payment',
    label: 'Payment',
    icon: CreditCard,
  },
  {
    key: 'financial',
    label: 'Financial',
    icon: BarChart3,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: Bell,
  },
  {
    key: 'security',
    label: 'Security',
    icon: Shield,
  },
  {
    key: 'appearance',
    label: 'Appearance',
    icon: Palette,
  },
  {
    key: 'backup',
    label: 'Backup',
    icon: Database,
  },
]

const createEmptySettings = (): SettingsForm => ({
  company_name: '',
  registration_number: '',
  address: '',
  phone: '',
  email: '',
  website: '',

  bank_name: '',
  bank_account: '',
  bank_branch: '',

  invoice_prefix: 'XP-INV',
  invoice_starting_number: 1,
  default_payment_terms: '',
  default_notes: '',
  terms_and_conditions: '',
  invoice_footer: '',

  currency: 'LKR',
  currency_symbol: 'LKR',
  opening_balance: 0,
  financial_year_start: '01-01',

  timezone: 'Asia/Colombo',
  date_format: 'DD MMM YYYY',

  // VAT / Tax
  vat_number: '',
  default_vat_rate: 0,
  vat_enabled: false,
})

const normalize = (
  value: string | null | undefined,
): string => {
  return value?.trim() || ''
}

const isValidEmail = (
  value: string,
): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  )
}

export default function SettingsPage() {
  const {
    settings,
    updateSettings,
  } = useData()

  const {
    success,
    error,
  } = useToast()

  const [tab, setTab] =
    useState<Tab>('company')

  const [form, setForm] =
    useState<SettingsForm>(
      createEmptySettings(),
    )

  const [saving, setSaving] =
    useState(false)

  /*
   * Synchronize local form with the
   * actual company_settings data.
   */
  useEffect(() => {
    if (!settings) {
      return
    }

    setForm({
      ...createEmptySettings(),
      ...settings,
    })
  }, [settings])

  /*
   * Fully typed form updater.
   */
  const updateForm = <
    K extends keyof SettingsForm,
  >(
    key: K,
    value: SettingsForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  /*
   * Save settings through DataContext.
   */
  const handleSave = async () => {
    const companyName =
      normalize(form.company_name)

    const registrationNumber =
      normalize(
        form.registration_number,
      )

    const address =
      normalize(form.address)

    const phone =
      normalize(form.phone)

    const email =
      normalize(form.email)

    const website =
      normalize(form.website)

    const bankName =
      normalize(form.bank_name)

    const bankAccount =
      normalize(form.bank_account)

    const bankBranch =
      normalize(form.bank_branch)

    const invoicePrefix =
      normalize(form.invoice_prefix)

    const defaultPaymentTerms =
      normalize(
        form.default_payment_terms,
      )

    const defaultNotes =
      normalize(form.default_notes)

    const termsAndConditions =
      normalize(
        form.terms_and_conditions,
      )

    const invoiceFooter =
      normalize(form.invoice_footer)

    const currency =
      normalize(form.currency)

    const currencySymbol =
      normalize(
        form.currency_symbol,
      )

    const financialYearStart =
      normalize(
        form.financial_year_start,
      )

    const timezone =
      normalize(form.timezone)

    const dateFormat =
      normalize(form.date_format)

    /*
     * Required company information.
     */
    if (!companyName) {
      error(
        'Company name is required.',
      )
      return
    }

    /*
     * Optional email validation.
     */
    if (
      email &&
      !isValidEmail(email)
    ) {
      error(
        'Please enter a valid company email address.',
      )
      return
    }

    /*
     * Invoice validation.
     */
    if (!invoicePrefix) {
      error(
        'Invoice prefix is required.',
      )
      return
    }

    const startingNumber = Number(
      form.invoice_starting_number,
    )

    if (
      !Number.isInteger(
        startingNumber,
      ) ||
      startingNumber < 1
    ) {
      error(
        'Invoice starting number must be a whole number greater than zero.',
      )
      return
    }

    /*
     * Financial validation.
     */
    const openingBalance = Number(
      form.opening_balance,
    )

    if (
      !Number.isFinite(
        openingBalance,
      )
    ) {
      error(
        'Opening balance must be a valid number.',
      )
      return
    }

    if (!currency) {
      error(
        'Currency is required.',
      )
      return
    }

    if (!currencySymbol) {
      error(
        'Currency symbol is required.',
      )
      return
    }

    /*
     * General preferences validation.
     */
    if (!timezone) {
      error(
        'Timezone is required.',
      )
      return
    }

    if (!dateFormat) {
      error(
        'Date format is required.',
      )
      return
    }

    /*
     * Financial year start uses MM-DD.
     */
    if (
      !/^\d{2}-\d{2}$/.test(
        financialYearStart,
      )
    ) {
      error(
        'Financial year start must use MM-DD format, for example 01-01.',
      )
      return
    }

    const [
      month,
      day,
    ] = financialYearStart
      .split('-')
      .map(Number)

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      error(
        'Financial year start is invalid.',
      )
      return
    }

    /*
     * Clean payload using ONLY fields
     * supported by CompanySettings.
     */
    const cleanSettings: SettingsForm = {
      ...form,

      company_name:
        companyName,

      registration_number:
        registrationNumber,

      address,

      phone,

      email,

      website,

      bank_name:
        bankName,

      bank_account:
        bankAccount,

      bank_branch:
        bankBranch,

      invoice_prefix:
        invoicePrefix,

      invoice_starting_number:
        startingNumber,

      default_payment_terms:
        defaultPaymentTerms,

      default_notes:
        defaultNotes,

      terms_and_conditions:
        termsAndConditions,

      invoice_footer:
        invoiceFooter,

      currency,

      currency_symbol:
        currencySymbol,

      opening_balance:
        openingBalance,

      financial_year_start:
        financialYearStart,

      timezone,

      date_format:
        dateFormat,
    }

    setSaving(true)

    try {
      await updateSettings(
        cleanSettings,
      )

      setForm(cleanSettings)

      success(
        'Settings updated successfully.',
      )
    } catch (err) {
      console.error(
        'Failed to update settings:',
        err,
      )

      error(
        err instanceof Error
          ? err.message
          : 'Failed to update settings. Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * Reusable save button.
   */
  const SaveButton = () => (
    <Button
      variant="primary"
      size="sm"
      icon={<Save size={13} />}
      onClick={handleSave}
      loading={saving}
    >
      Save
    </Button>
  )

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure your Xyphora Prime Business OS"
      />

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 shrink-0">
          <nav className="space-y-0.5">
            {tabs.map((item) => {
              const Icon = item.icon

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setTab(item.key)
                  }
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                    tab === item.key
                      ? 'bg-xp-light-purple text-xp-purple font-medium'
                      : 'text-xp-muted hover:bg-xp-light-gray hover:text-[#111]'
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* General */}
          {tab === 'general' && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111]">
                  General Preferences
                </p>

                <SaveButton />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Timezone"
                  value={form.timezone}
                  onChange={(event) =>
                    updateForm(
                      'timezone',
                      event.target
                        .value,
                    )
                  }
                  options={[
                    'Asia/Colombo',
                    'Asia/Singapore',
                    'Europe/London',
                    'America/New_York',
                    'Australia/Sydney',
                    'Asia/Dubai',
                  ].map(
                    (value) => ({
                      value,
                      label: value,
                    }),
                  )}
                />

                <Select
                  label="Date Format"
                  value={form.date_format}
                  onChange={(event) =>
                    updateForm(
                      'date_format',
                      event.target
                        .value,
                    )
                  }
                  options={[
                    'DD MMM YYYY',
                    'YYYY-MM-DD',
                    'MM/DD/YYYY',
                  ].map(
                    (value) => ({
                      value,
                      label: value,
                    }),
                  )}
                />
              </div>

              <div className="p-4 rounded-lg bg-xp-off-white border border-xp-border">
                <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-2">
                  Current Configuration
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-xp-muted">
                      Currency
                    </p>

                    <p className="text-sm font-medium text-[#111]">
                      {form.currency}{' '}
                      (
                      {
                        form.currency_symbol
                      }
                      )
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-xp-muted">
                      Timezone
                    </p>

                    <p className="text-sm font-medium text-[#111]">
                      {form.timezone}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Company */}
          {tab === 'company' && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111]">
                  Company Profile
                </p>

                <SaveButton />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Input
                    label="Company Name"
                    value={
                      form.company_name
                    }
                    onChange={(event) =>
                      updateForm(
                        'company_name',
                        event.target
                          .value,
                      )
                    }
                  />
                </div>

                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(event) =>
                    updateForm(
                      'phone',
                      event.target
                        .value,
                    )
                  }
                />

                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateForm(
                      'email',
                      event.target
                        .value,
                    )
                  }
                />

                <div className="col-span-2">
                  <Input
                    label="Website"
                    value={form.website}
                    onChange={(event) =>
                      updateForm(
                        'website',
                        event.target
                          .value,
                      )
                    }
                  />
                </div>
              </div>

              <Textarea
                label="Address"
                value={form.address}
                onChange={(event) =>
                  updateForm(
                    'address',
                    event.target
                      .value,
                  )
                }
              />

              <div>
                <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-3">
                  Banking Information
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Bank Name"
                    value={
                      form.bank_name
                    }
                    onChange={(event) =>
                      updateForm(
                        'bank_name',
                        event.target
                          .value,
                      )
                    }
                  />

                  <Input
                    label="Account Number"
                    value={
                      form.bank_account
                    }
                    onChange={(event) =>
                      updateForm(
                        'bank_account',
                        event.target
                          .value,
                      )
                    }
                  />

                  <Input
                    label="Branch"
                    value={
                      form.bank_branch
                    }
                    onChange={(event) =>
                      updateForm(
                        'bank_branch',
                        event.target
                          .value,
                      )
                    }
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Invoice */}
          {tab === 'invoice' && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111]">
                  Invoice Settings
                </p>

                <SaveButton />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Invoice Prefix"
                  value={
                    form.invoice_prefix
                  }
                  onChange={(event) =>
                    updateForm(
                      'invoice_prefix',
                      event.target
                        .value,
                    )
                  }
                  placeholder="XP-INV"
                />

                <Input
                  label="Starting Number"
                  type="number"
                  min="1"
                  step="1"
                  value={
                    form.invoice_starting_number
                  }
                  onChange={(event) =>
                    updateForm(
                      'invoice_starting_number',
                      Number(
                        event.target
                          .value,
                      ),
                    )
                  }
                />

                <div className="col-span-2">
                  <Input
                    label="Default Payment Terms"
                    value={
                      form.default_payment_terms
                    }
                    onChange={(event) =>
                      updateForm(
                        'default_payment_terms',
                        event.target
                          .value,
                      )
                    }
                  />
                </div>
              </div>

              <Textarea
                label="Default Notes"
                value={
                  form.default_notes
                }
                onChange={(event) =>
                  updateForm(
                    'default_notes',
                    event.target
                      .value,
                  )
                }
              />

              <Textarea
                label="Terms & Conditions"
                value={
                  form.terms_and_conditions
                }
                onChange={(event) =>
                  updateForm(
                    'terms_and_conditions',
                    event.target
                      .value,
                  )
                }
              />

              <Input
                label="Invoice Footer"
                value={
                  form.invoice_footer
                }
                onChange={(event) =>
                  updateForm(
                    'invoice_footer',
                    event.target
                      .value,
                  )
                }
              />

              <div className="p-3 bg-xp-light-purple rounded-lg border border-[#e9d5ff]">
                <p className="text-xs text-xp-purple">
                  Next invoice will be:{' '}
                  <strong>
                    {form.invoice_prefix ||
                      'XP-INV'}
                    -
                    {String(
                      Number(
                        form.invoice_starting_number ||
                          1,
                      ),
                    ).padStart(
                      3,
                      '0',
                    )}
                  </strong>
                </p>
              </div>
            </Card>
          )}

          {/* Payment */}
          {tab === 'payment' && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111]">
                  Payment Configuration
                </p>

                <SaveButton />
              </div>

              <div className="p-4 rounded-lg bg-xp-off-white border border-xp-border">
                <p className="text-sm font-medium text-[#111] mb-1">
                  Payment Methods
                </p>

                <p className="text-xs text-xp-muted leading-relaxed">
                  Payment records support Bank
                  Transfer, Cash, Card, Online
                  Payment and Other through the
                  Payments module.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Currency"
                  value={
                    form.currency
                  }
                  onChange={(event) =>
                    updateForm(
                      'currency',
                      event.target
                        .value,
                    )
                  }
                />

                <Input
                  label="Currency Symbol"
                  value={
                    form.currency_symbol
                  }
                  onChange={(event) =>
                    updateForm(
                      'currency_symbol',
                      event.target
                        .value,
                    )
                  }
                />
              </div>
            </Card>
          )}

          {/* Financial */}
          {tab === 'financial' && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#111]">
                  Financial Settings
                </p>

                <SaveButton />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Currency"
                  value={
                    form.currency
                  }
                  onChange={(event) =>
                    updateForm(
                      'currency',
                      event.target
                        .value,
                    )
                  }
                  placeholder="LKR"
                />

                <Input
                  label="Currency Symbol"
                  value={
                    form.currency_symbol
                  }
                  onChange={(event) =>
                    updateForm(
                      'currency_symbol',
                      event.target
                        .value,
                    )
                  }
                  placeholder="LKR"
                />

                <Input
                  label="Opening Balance"
                  type="number"
                  step="0.01"
                  value={
                    form.opening_balance
                  }
                  onChange={(event) =>
                    updateForm(
                      'opening_balance',
                      Number(
                        event.target
                          .value,
                      ),
                    )
                  }
                />

                <Input
                  label="Financial Year Start"
                  value={
                    form.financial_year_start
                  }
                  onChange={(event) =>
                    updateForm(
                      'financial_year_start',
                      event.target
                        .value,
                    )
                  }
                  placeholder="01-01"
                />
              </div>

              <div className="p-4 rounded-lg bg-xp-off-white border border-xp-border">
                <p className="text-xs font-bold text-xp-muted uppercase tracking-widest mb-2">
                  Opening Balance
                </p>

                <p className="text-lg font-semibold text-[#111]">
                  {form.currency_symbol}{' '}
                  {Number(
                    form.opening_balance ||
                      0,
                  ).toLocaleString()}
                </p>
              </div>
            </Card>
          )}

          {/* Notifications */}
          {tab === 'notifications' && (
            <Card className="p-6">
              <p className="text-sm font-semibold text-[#111] mb-4">
                Notifications
              </p>

              <div className="p-4 rounded-lg bg-xp-off-white border border-xp-border">
                <p className="text-sm font-medium text-[#111] mb-1">
                  Notification Configuration
                </p>

                <p className="text-xs text-xp-muted leading-relaxed">
                  Notification delivery is handled
                  by the application's backend
                  services. Your current
                  company_settings model does not
                  contain notification preference
                  fields, so no unsupported or fake
                  settings are stored here.
                </p>
              </div>
            </Card>
          )}

          {/* Security */}
          {tab === 'security' && (
            <Card className="p-6">
              <p className="text-sm font-semibold text-[#111] mb-4">
                Security
              </p>

              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-xp-off-white border border-xp-border">
                  <p className="text-sm font-medium text-[#111] mb-1">
                    Authentication
                  </p>

                  <p className="text-xs text-xp-muted leading-relaxed">
                    User authentication and password
                    management are handled by
                    Supabase Authentication.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-xp-off-white border border-xp-border">
                  <p className="text-sm font-medium text-[#111] mb-1">
                    Database Security
                  </p>

                  <p className="text-xs text-xp-muted leading-relaxed">
                    Application data is protected
                    using authenticated Supabase
                    access and Row Level Security
                    policies.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Appearance */}
          {tab === 'appearance' && (
            <Card className="p-6">
              <p className="text-sm font-semibold text-[#111] mb-4">
                Appearance
              </p>

              <div className="p-4 rounded-lg bg-xp-off-white border border-xp-border">
                <p className="text-sm font-medium text-[#111] mb-1">
                  Interface
                </p>

                <p className="text-xs text-xp-muted leading-relaxed">
                  The current Xyphora Prime
                  interface uses the configured
                  application theme. Appearance
                  preferences are not stored in
                  company_settings.
                </p>
              </div>
            </Card>
          )}

          {/* Backup */}
          {tab === 'backup' && (
            <Card className="p-6">
              <p className="text-sm font-semibold text-[#111] mb-4">
                Backup
              </p>

              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-xp-off-white border border-xp-border">
                  <p className="text-sm font-medium text-[#111] mb-1">
                    Database
                  </p>

                  <p className="text-xs text-xp-muted leading-relaxed">
                    Application records are stored
                    in Supabase. Database backup and
                    recovery are managed through the
                    Supabase project configuration.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-xp-off-white border border-xp-border">
                  <p className="text-sm font-medium text-[#111] mb-1">
                    Documents
                  </p>

                  <p className="text-xs text-xp-muted leading-relaxed">
                    Business documents are stored
                    using the configured Cloudflare
                    R2 document storage workflow.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
