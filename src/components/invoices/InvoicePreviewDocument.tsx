
import {
  MapPin,
  Mail,
  Phone,
  Globe,
  Building2,
  FileCheck2,
} from 'lucide-react'
import { CompanySettings } from '../../types'
import { formatDate } from '../../lib/utils'
import logoImg from '../../assets/xyphora-logo.png'

export interface InvoicePreviewItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  discount?: number
  tax?: number
  total: number
}

export interface InvoicePreviewProps {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  currency?: string
  logoUrl?: string

  // Company Info
  companyName?: string
  companySubtitle?: string
  companyAddress?: string
  companyEmail?: string
  companyPhone?: string
  companyWebsite?: string

  // Client Info
  client?: {
    company_name: string
    contact_person?: string
    address?: string
    email?: string
    phone?: string
    client_id?: string
  } | null

  clientName?: string
  clientAddress?: string

  // Items & Totals
  items: InvoicePreviewItem[]
  subtotal: number
  discount?: number
  tax?: number
  total: number

  // Payment & Bank Details
  paymentTerms?: string
  paymentType?: string
  accountHolderName?: string
  bankName?: string
  bankBranch?: string
  bankAccount?: string
  bankCountry?: string
  paymentReference?: string

  // Notes & Messages
  notes?: string
  terms?: string
  thankYouHeading?: string
  thankYouMessage?: string
  appreciationMessage?: string

  settings?: Partial<CompanySettings>
  className?: string
}

export function XyphoraLogo({
  className = 'h-24 sm:h-32',
  logoUrl,
}: {
  className?: string
  logoUrl?: string
}) {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src={logoUrl || logoImg}
        alt="XYPHORA PRIME"
        className="
          h-full
          w-auto
          max-h-32
          sm:max-h-40
          object-contain
          mix-blend-multiply
        "
      />
    </div>
  )
}

function formatAmount(
  value: number | undefined | null
): string {
  const amount = Number(value ?? 0)

  if (!Number.isFinite(amount)) {
    return '0.00'
  }

  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function safeNumber(
  value: number | undefined | null
): number {
  const number = Number(value ?? 0)

  return Number.isFinite(number) ? number : 0
}

export default function InvoicePreviewDocument({
  invoiceNumber,
  invoiceDate,
  dueDate,
  currency,
  logoUrl,

  companyName,
  companySubtitle,
  companyAddress,
  companyEmail,
  companyPhone,
  companyWebsite,

  client,
  clientName,
  clientAddress,

  items = [],
  subtotal = 0,
  discount = 0,
  tax = 0,
  total = 0,

  paymentTerms,
  paymentType,
  settings,

  accountHolderName,
  bankName,
  bankBranch,
  bankAccount,
  bankCountry,
  paymentReference,

  notes,
  terms,
  thankYouHeading,
  thankYouMessage,
  appreciationMessage,

  className = '',
}: InvoicePreviewProps) {
  /*
   * ------------------------------------------------------------
   * Company information
   * ------------------------------------------------------------
   *
   * Settings are the primary source.
   * Props override settings when explicitly supplied.
   *
   * We intentionally avoid fake company/account details here.
   */
  const compName =
    companyName ||
    settings?.company_name ||
    ''

  const compSubtitle =
    companySubtitle ||
    'Software & Digital Solutions'

  const compAddress =
    companyAddress ||
    settings?.address ||
    ''

  const compEmail =
    companyEmail ||
    settings?.email ||
    ''

  const compPhone =
    companyPhone ||
    settings?.phone ||
    ''

  const compWebsite =
    companyWebsite ||
    settings?.website ||
    ''

  /*
   * ------------------------------------------------------------
   * Currency
   * ------------------------------------------------------------
   */
  const displayCurrency =
    currency ||
    settings?.currency_symbol ||
    settings?.currency ||
    ''

  /*
   * ------------------------------------------------------------
   * Bank information
   * ------------------------------------------------------------
   */
  const bName =
    bankName ||
    settings?.bank_name ||
    ''

  const bBranch =
    bankBranch ||
    settings?.bank_branch ||
    ''

  const bAccount =
    bankAccount ||
    settings?.bank_account ||
    ''

  const bHolder =
    accountHolderName ||
    settings?.account_holder_name ||
    compName

  const bCountry =
    bankCountry ||
    ''

  /*
   * ------------------------------------------------------------
   * Dates
   * ------------------------------------------------------------
   */
  const formattedInvoiceDate = invoiceDate
    ? formatDate(invoiceDate, 'dd MMMM yyyy')
    : ''

  const formattedDueDate = dueDate
    ? formatDate(dueDate, 'dd MMMM yyyy')
    : ''

  /*
   * ------------------------------------------------------------
   * Payment information
   * ------------------------------------------------------------
   */
  const formattedTerms =
    paymentTerms ||
    settings?.default_payment_terms ||
    'Payment due upon receipt of invoice.'

  const refCode =
    paymentReference ||
    client?.client_id ||
    invoiceNumber ||
    'REF'

  /*
   * ------------------------------------------------------------
   * Client information
   * ------------------------------------------------------------
   */
  const displayClientName =
    clientName ||
    client?.company_name ||
    ''

  const displayClientAddress =
    clientAddress ||
    client?.address ||
    ''

  /*
   * ------------------------------------------------------------
   * Messages
   * ------------------------------------------------------------
   */
  const tHeading =
    thankYouHeading ||
    'THANK YOU!'

  const tMessage =
    thankYouMessage ||
    (compName
      ? `Thank you for choosing\n${compName}.`
      : 'Thank you for choosing us.')

  const appMsg =
    appreciationMessage ||
    'We appreciate your business and support.'

  /*
   * ------------------------------------------------------------
   * Totals
   * ------------------------------------------------------------
   */
  const safeSubtotal = safeNumber(subtotal)
  const safeDiscount = safeNumber(discount)
  const safeTax = safeNumber(tax)
  const safeTotal = safeNumber(total)

  const hasDiscount = safeDiscount > 0
  const hasTax = safeTax > 0

  /*
   * Only show the placeholder row when the builder has not
   * supplied a meaningful line item yet.
   */
  const hasRealItems =
    items.length > 0 &&
    items.some(
      (item) =>
        item.description?.trim() ||
        safeNumber(item.unit_price) > 0
    )

  return (
    <div
      className={`
        invoice-document
        bg-white
        text-[#111]
        font-sans
        w-full
        max-w-190
        mx-auto
        shadow-2xl
        rounded-sm
        border
        border-gray-200/80
        overflow-hidden
        flex
        flex-col
        justify-between
        min-h-240
        print:min-h-0
        print:shadow-none
        print:border-none
        print:rounded-none
        print:max-w-none
        print:w-full
        print:h-full
        print:m-0
        print:p-0
        ${className}
      `}
      style={{
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      <div
        className="
          p-7
          sm:p-9
          pb-3
          print:px-8
          print:pt-6
          print:pb-2
          flex-1
          flex
          flex-col
          justify-between
        "
      >
        <div>
          {/* =====================================================
              1. HEADER
          ====================================================== */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <XyphoraLogo
              className="h-16 sm:h-20 print:h-16"
              logoUrl={logoUrl}
            />

            <div className="text-right flex flex-col items-end pt-1">
              <h1
                className="
                  text-3xl
                  sm:text-[36px]
                  font-sans
                  font-black
                  tracking-wider
                  text-[#09090b]
                  leading-none
                  uppercase
                "
              >
                INVOICE
              </h1>

              <div
                className="
                  h-1.5
                  w-36
                  sm:w-44
                  bg-linear-to-r
                  from-[#4f46e5]
                  via-[#6366f1]
                  to-[#9333ea]
                  mt-1.5
                  rounded-full
                "
              />
            </div>
          </div>

          {/* =====================================================
              2. COMPANY + INVOICE INFORMATION
          ====================================================== */}
          <div className="grid grid-cols-2 gap-6 items-start mb-3">
            {/* Company */}
            <div>
              {compName && (
                <h2 className="text-sm sm:text-base font-bold text-[#3730a3] tracking-tight font-sans">
                  {compName}
                </h2>
              )}

              {compSubtitle && (
                <p className="text-[11px] sm:text-xs text-[#111827] font-medium mt-0.5 mb-2 font-sans">
                  {compSubtitle}
                </p>
              )}

              <div className="space-y-1 text-[11px] sm:text-xs text-[#374151] font-sans">
                {compAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin
                      size={12}
                      className="text-[#4f46e5] shrink-0"
                    />
                    <span>{compAddress}</span>
                  </div>
                )}

                {compEmail && (
                  <div className="flex items-center gap-2">
                    <Mail
                      size={12}
                      className="text-[#4f46e5] shrink-0"
                    />
                    <span>{compEmail}</span>
                  </div>
                )}

                {compPhone && (
                  <div className="flex items-center gap-2">
                    <Phone
                      size={12}
                      className="text-[#4f46e5] shrink-0"
                    />
                    <span>{compPhone}</span>
                  </div>
                )}

                {compWebsite && (
                  <div className="flex items-center gap-2">
                    <Globe
                      size={12}
                      className="text-[#4f46e5] shrink-0"
                    />
                    <span>{compWebsite}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Meta */}
            <div className="pl-4 flex flex-col justify-start">
              <table className="w-full text-[11px] sm:text-xs text-[#111827] font-sans">
                <tbody>
                  <tr className="h-5.5">
                    <td className="font-semibold text-[#374151] w-28 whitespace-nowrap">
                      Invoice No
                    </td>
                    <td className="text-center w-4 font-bold text-[#374151]">
                      :
                    </td>
                    <td className="font-semibold text-[#09090b] pl-2.5 whitespace-nowrap">
                      {invoiceNumber || '—'}
                    </td>
                  </tr>

                  <tr className="h-5.5">
                    <td className="font-semibold text-[#374151] whitespace-nowrap">
                      Invoice Date
                    </td>
                    <td className="text-center font-bold text-[#374151]">
                      :
                    </td>
                    <td className="font-semibold text-[#09090b] pl-2.5 whitespace-nowrap">
                      {formattedInvoiceDate || '—'}
                    </td>
                  </tr>

                  <tr className="h-5.5">
                    <td className="font-semibold text-[#374151] whitespace-nowrap">
                      Due Date
                    </td>
                    <td className="text-center font-bold text-[#374151]">
                      :
                    </td>
                    <td className="font-semibold text-[#09090b] pl-2.5 whitespace-nowrap">
                      {formattedDueDate || '—'}
                    </td>
                  </tr>

                  <tr className="h-5.5">
                    <td className="font-semibold text-[#374151] whitespace-nowrap">
                      Currency
                    </td>
                    <td className="text-center font-bold text-[#374151]">
                      :
                    </td>
                    <td className="font-semibold text-[#09090b] pl-2.5 whitespace-nowrap">
                      {displayCurrency || '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* =====================================================
              3. DIVIDER
          ====================================================== */}
          <div className="h-[1.5px] bg-[#6366f1] w-full my-3" />

          {/* =====================================================
              4. BILL TO
          ====================================================== */}
          <div className="mb-3 font-sans">
            <p className="text-[11px] font-bold text-[#3730a3] uppercase tracking-wider mb-0.5">
              BILL TO:
            </p>

            <p
              className={`
                text-xs
                sm:text-sm
                font-bold
                ${
                  displayClientName
                    ? 'text-[#09090b]'
                    : 'text-gray-400 italic'
                }
              `}
            >
              {displayClientName || 'Client / Company Name'}
            </p>

            {displayClientAddress ? (
              <p className="text-[11px] sm:text-xs text-[#374151] mt-0.5 whitespace-pre-line">
                {displayClientAddress}
              </p>
            ) : (
              <p className="text-[11px] sm:text-xs text-gray-400 italic mt-0.5">
                Address / Location
              </p>
            )}
          </div>

          {/* =====================================================
              5. ITEMS TABLE
          ====================================================== */}
          <div
            className="
              rounded-xl
              overflow-hidden
              border
              border-[#c4b5fd]
              bg-white
              mb-3
              shadow-xs
              font-sans
            "
          >
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr
                  className="
                    text-white
                    text-[10px]
                    sm:text-[11px]
                    font-bold
                    uppercase
                    tracking-wider
                    font-sans
                  "
                  style={{
                    backgroundColor: '#12072b',
                    color: '#ffffff',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                >
                  <th className="py-2.5 px-4 text-left border-r border-white/20 w-[46%]">
                    DESCRIPTION
                  </th>

                  <th className="py-2.5 px-2.5 text-center border-r border-white/20 w-[12%]">
                    QTY
                  </th>

                  <th className="py-2.5 px-4 text-right border-r border-white/20 w-[21%]">
                    UNIT PRICE ({displayCurrency})
                  </th>

                  <th className="py-2.5 px-4 text-right w-[21%]">
                    AMOUNT ({displayCurrency})
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#e9d5ff]/50 font-sans">
                {!hasRealItems ? (
                  <tr>
                    <td className="py-3 px-4 text-left border-r border-[#e9d5ff]/60 text-gray-400 italic">
                      {items[0]?.description ||
                        'Enter line item description...'}
                    </td>

                    <td className="py-3 px-2.5 text-center border-r border-[#e9d5ff]/60 text-gray-400">
                      {items[0]?.quantity || 1}
                    </td>

                    <td className="py-3 px-4 text-right border-r border-[#e9d5ff]/60 text-gray-400">
                      {formatAmount(
                        items[0]?.unit_price
                      )}
                    </td>

                    <td className="py-3 px-4 text-right text-gray-400 font-medium">
                      {formatAmount(
                        items[0]?.total
                      )}
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr
                      key={
                        item.id ||
                        `invoice-item-${index}`
                      }
                      className="
                        hover:bg-purple-50/20
                        transition-colors
                        break-inside-avoid
                      "
                    >
                      <td className="py-2.5 px-4 text-left border-r border-[#e9d5ff]/60 text-[#111827] font-normal align-top">
                        {item.description?.trim() ? (
                          item.description
                        ) : (
                          <span className="text-gray-400 italic">
                            Item {index + 1}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-2.5 text-center border-r border-[#e9d5ff]/60 text-[#111827] font-normal align-top">
                        {safeNumber(item.quantity)}
                      </td>

                      <td className="py-2.5 px-4 text-right border-r border-[#e9d5ff]/60 text-[#111827] font-normal align-top">
                        {formatAmount(
                          item.unit_price
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right text-[#111827] font-medium align-top">
                        {formatAmount(
                          item.total
                        )}
                      </td>
                    </tr>
                  ))
                )}

                {/* Small visual breathing space for very short invoices */}
                {!hasRealItems && (
                  <tr>
                    <td className="h-10 border-r border-[#e9d5ff]/50" />
                    <td className="h-10 border-r border-[#e9d5ff]/50" />
                    <td className="h-10 border-r border-[#e9d5ff]/50" />
                    <td className="h-10" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* =====================================================
              6. TOTALS
          ====================================================== */}
          <div className="flex justify-end mb-3 font-sans">
            <div className="w-[42%] min-w-70 space-y-1.5 font-sans">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-xs py-0.5">
                <span className="font-bold tracking-wider uppercase text-xs text-[#374151]">
                  SUBTOTAL
                </span>

                <span className="font-bold text-xs sm:text-sm text-[#09090b]">
                  {displayCurrency}{' '}
                  {formatAmount(safeSubtotal)}
                </span>
              </div>

              {/* Discount */}
              {hasDiscount && (
                <div className="flex items-center justify-between text-xs py-0.5">
                  <span className="font-semibold uppercase text-[#374151]">
                    DISCOUNT
                  </span>

                  <span className="font-semibold text-[#09090b]">
                    - {displayCurrency}{' '}
                    {formatAmount(safeDiscount)}
                  </span>
                </div>
              )}

              {/* Tax */}
              {hasTax && (
                <div className="flex items-center justify-between text-xs py-0.5">
                  <span className="font-semibold uppercase text-[#374151]">
                    TAX
                  </span>

                  <span className="font-semibold text-[#09090b]">
                    {displayCurrency}{' '}
                    {formatAmount(safeTax)}
                  </span>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between pt-1 gap-2">
                <span className="text-xs sm:text-sm font-bold text-[#3730a3] uppercase tracking-wider whitespace-nowrap">
                  TOTAL AMOUNT DUE
                </span>

                <div
                  className="
                    border-2
                    border-[#4338ca]
                    bg-white
                    px-3.5
                    py-1
                    text-right
                    shadow-xs
                    rounded-none
                    shrink-0
                  "
                  style={{
                    borderColor: '#4338ca',
                    backgroundColor: '#ffffff',
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                >
                  <span className="text-sm sm:text-base font-bold text-[#4338ca] tracking-normal whitespace-nowrap">
                    {displayCurrency}{' '}
                    {formatAmount(safeTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================
              7. NOTES / TERMS
          ====================================================== */}
          {(notes || terms || paymentType) && (
            <div className="grid grid-cols-2 gap-5 mb-3 font-sans">
              {notes && (
                <div>
                  <p className="text-[10px] font-bold text-[#3730a3] uppercase tracking-wider mb-1">
                    NOTES
                  </p>

                  <p className="text-[10px] text-[#4b5563] leading-relaxed whitespace-pre-line">
                    {notes}
                  </p>
                </div>
              )}

              {terms && (
                <div>
                  <p className="text-[10px] font-bold text-[#3730a3] uppercase tracking-wider mb-1">
                    TERMS & CONDITIONS
                  </p>

                  <p className="text-[10px] text-[#4b5563] leading-relaxed whitespace-pre-line">
                    {terms}
                  </p>
                </div>
              )}

              {paymentType && (
                <div>
                  <p className="text-[10px] font-bold text-[#3730a3] uppercase tracking-wider mb-1">
                    PAYMENT TYPE
                  </p>

                  <p className="text-[10px] text-[#374151] font-semibold">
                    {paymentType}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* =====================================================
            8. PAYMENT + BANK + THANK YOU
        ====================================================== */}
        <div
          className="
            grid
            grid-cols-12
            gap-5
            items-stretch
            mt-auto
            pt-3
            border-t
            border-gray-100
            font-sans
          "
        >
          {/* LEFT */}
          <div className="col-span-7 flex flex-col justify-between">
            {/* Payment Information */}
            <div className="mb-2 text-xs font-sans">
              <p className="font-bold text-[#3730a3] uppercase tracking-wider mb-1 text-xs">
                PAYMENT INFORMATION:
              </p>

              <div className="space-y-0.5 text-xs">
                <div className="flex items-start">
                  <span className="w-30 text-[#374151] font-semibold">
                    Payment Amount
                  </span>

                  <span className="w-4 text-center font-bold text-[#374151]">
                    :
                  </span>

                  <span className="font-bold text-[#09090b] pl-1.5">
                    {displayCurrency}{' '}
                    {formatAmount(safeTotal)}
                  </span>
                </div>

                <div className="flex items-start">
                  <span className="w-30 text-[#374151] font-semibold">
                    Payment Terms
                  </span>

                  <span className="w-4 text-center font-bold text-[#374151]">
                    :
                  </span>

                  <span className="text-[#374151] font-normal pl-1.5">
                    {formattedTerms}
                  </span>
                </div>

                {paymentType && (
                  <div className="flex items-start">
                    <span className="w-30 text-[#374151] font-semibold">
                      Payment Type
                    </span>

                    <span className="w-4 text-center font-bold text-[#374151]">
                      :
                    </span>

                    <span className="text-[#374151] font-normal pl-1.5">
                      {paymentType}
                    </span>
                  </div>
                )}
              </div>

              {compName && (
                <p className="text-[10px] text-[#4b5563] mt-1 leading-tight">
                  Please make the payment to the bank account provided by{' '}
                  {compName}.
                </p>
              )}
            </div>

            {/* Bank Details */}
            {(bName || bBranch || bAccount || bHolder || bCountry) && (
              <div
                className="
                  rounded-xl
                  border
                  border-[#c4b5fd]
                  p-3
                  bg-white
                  shadow-xs
                  font-sans
                "
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div
                    className="
                      w-4.5
                      h-4.5
                      rounded-full
                      text-white
                      flex
                      items-center
                      justify-center
                      shrink-0
                      shadow-xs
                    "
                    style={{
                      backgroundColor: '#4338ca',
                      color: '#ffffff',
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact',
                    }}
                  >
                    <Building2 size={11} />
                  </div>

                  <span className="text-[11px] font-bold text-[#4338ca] uppercase tracking-wider">
                    BANK DETAILS
                  </span>
                </div>

                <table className="w-full text-[10px] sm:text-[11px] text-[#111827] font-sans">
                  <tbody className="divide-y divide-purple-100">
                    {bHolder && (
                      <tr className="h-4.5">
                        <td className="text-[#4b5563] font-medium w-34 whitespace-nowrap">
                          Account Holder Name
                        </td>

                        <td className="w-4 text-center font-bold text-[#4b5563]">
                          :
                        </td>

                        <td className="font-semibold text-[#09090b] pl-2">
                          {bHolder}
                        </td>
                      </tr>
                    )}

                    {bName && (
                      <tr className="h-4.5">
                        <td className="text-[#4b5563] font-medium whitespace-nowrap">
                          Bank Name
                        </td>

                        <td className="w-4 text-center font-bold text-[#4b5563]">
                          :
                        </td>

                        <td className="font-semibold text-[#09090b] pl-2">
                          {bName}
                        </td>
                      </tr>
                    )}

                    {bBranch && (
                      <tr className="h-4.5">
                        <td className="text-[#4b5563] font-medium whitespace-nowrap">
                          Branch
                        </td>

                        <td className="w-4 text-center font-bold text-[#4b5563]">
                          :
                        </td>

                        <td className="font-semibold text-[#09090b] pl-2">
                          {bBranch}
                        </td>
                      </tr>
                    )}

                    {bAccount && (
                      <tr className="h-4.5">
                        <td className="text-[#4b5563] font-medium whitespace-nowrap">
                          Account Number
                        </td>

                        <td className="w-4 text-center font-bold text-[#4b5563]">
                          :
                        </td>

                        <td className="font-bold text-[#09090b] pl-2 font-mono">
                          {bAccount}
                        </td>
                      </tr>
                    )}

                    {bCountry && (
                      <tr className="h-4.5">
                        <td className="text-[#4b5563] font-medium whitespace-nowrap">
                          Country
                        </td>

                        <td className="w-4 text-center font-bold text-[#4b5563]">
                          :
                        </td>

                        <td className="font-semibold text-[#09090b] pl-2">
                          {bCountry}
                        </td>
                      </tr>
                    )}

                    <tr className="h-4.5">
                      <td className="text-[#4b5563] font-medium whitespace-nowrap">
                        Payment Reference
                      </td>

                      <td className="w-4 text-center font-bold text-[#4b5563]">
                        :
                      </td>

                      <td className="font-bold text-[#09090b] pl-2 font-mono">
                        {refCode}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div
            className="
              col-span-5
              border-l
              border-[#e5e7eb]
              pl-4
              flex
              flex-col
              items-center
              justify-center
              text-center
              py-1
              my-auto
              font-sans
            "
          >
            <div
              className="
                w-11
                h-11
                rounded-full
                border-2
                border-[#4338ca]
                text-[#4338ca]
                flex
                items-center
                justify-center
                mb-1.5
                shadow-inner
              "
              style={{
                backgroundColor: '#f5f3ff',
                borderColor: '#4338ca',
                color: '#4338ca',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
              }}
            >
              <FileCheck2
                size={22}
                strokeWidth={2.2}
              />
            </div>

            <h3 className="text-sm font-black text-[#4338ca] uppercase tracking-wide mb-1">
              {tHeading}
            </h3>

            <p className="text-[11px] text-[#374151] font-medium leading-relaxed max-w-48 whitespace-pre-line">
              {tMessage}
            </p>

            <p className="text-[10px] text-[#4b5563] leading-relaxed mt-1 max-w-48">
              {appMsg}
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================
          9. BRANDED FOOTER
      ========================================================== */}
      <footer
        className="
          w-full
          text-white
          py-3
          px-8
          relative
          overflow-hidden
          shrink-0
          font-sans
        "
        style={{
          backgroundColor: '#0a0318',
          color: '#ffffff',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        {/* Left accent */}
        <div
          className="
            absolute
            left-0
            top-0
            bottom-0
            w-32
            bg-linear-to-r
            from-[#4f46e5]/40
            to-transparent
            pointer-events-none
          "
        />

        {/* Right accent */}
        <div
          className="
            absolute
            right-0
            top-0
            bottom-0
            w-48
            bg-[radial-gradient(ellipse_at_right,var(--tw-gradient-stops))]
            from-purple-600/40
            via-transparent
            to-transparent
            pointer-events-none
          "
        />

        {/* Decorative lines */}
        <div
          className="
            absolute
            right-8
            top-1/2
            -translate-y-1/2
            flex
            items-center
            gap-1.5
            opacity-60
          "
        >
          <div className="w-8 h-0.5 bg-[#a855f7]" />
          <div className="w-12 h-0.5 bg-[#6366f1]" />
          <div className="w-6 h-0.5 bg-[#38bdf8]" />
        </div>

        <div className="relative text-center z-10 font-sans">
          {compName && (
            <p className="text-xs font-bold tracking-wider text-white uppercase">
              {compName}
            </p>
          )}

          {compSubtitle && (
            <p className="text-[10px] font-medium text-purple-200 tracking-widest uppercase mt-0.5">
              {compSubtitle}
            </p>
          )}
        </div>
      </footer>
    </div>
  )
}
