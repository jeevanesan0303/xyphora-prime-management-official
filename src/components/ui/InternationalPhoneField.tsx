import React, { useMemo } from 'react'
import PhoneInput, {
  type Country,
  isValidPhoneNumber,
  parsePhoneNumber,
  getCountryCallingCode,
} from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export type { Country }

export interface InternationalPhoneFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  country?: Country
  defaultCountry?: Country
  onCountryChange?: (country: Country) => void
  error?: string
  disabled?: boolean
  placeholder?: string
  action?: React.ReactNode
  id?: string
  className?: string
}

/**
 * Normalize a phone number into E.164 format before passing it
 * to react-phone-number-input.
 *
 * Examples:
 *   "+94 757233942" -> "+94757233942"
 *   "+94 77 123 4567" -> "+94771234567"
 *   "+94771234567" -> "+94771234567"
 */
export function normalizePhoneValue(
  value: string | null | undefined,
  fallbackCountry: Country = 'LK'
): string {
  if (!value) return ''

  const trimmed = value.trim()

  if (!trimmed) return ''

  // Already a clean E.164-looking number.
  // Still parse it below so formatted international values are normalized.
  try {
    if (trimmed.startsWith('+')) {
      const parsed = parsePhoneNumber(trimmed)

      if (parsed?.number) {
        return parsed.number
      }
    }
  } catch {
    // Continue with fallback normalization.
  }

  /*
   * Handle values without a "+".
   *
   * Example:
   *   "94771234567" -> "+94771234567"
   */
  if (/^\d+$/.test(trimmed)) {
    try {
      const parsed = parsePhoneNumber(`+${trimmed}`)

      if (parsed?.number) {
        return parsed.number
      }
    } catch {
      // Continue below.
    }

    return `+${trimmed}`
  }

  /*
   * Handle local/national numbers.
   *
   * Example for Sri Lanka:
   *   "0771234567" -> "+94771234567"
   */
  try {
    const digits = trimmed.replace(/\D/g, '')

    if (digits) {
      const callingCode = getCountryCallingCode(fallbackCountry)

      // Remove leading zero from national number.
      const nationalNumber = digits.replace(/^0+/, '')

      if (nationalNumber) {
        return `+${callingCode}${nationalNumber}`
      }
    }
  } catch {
    // Return original value if it cannot be normalized.
  }

  return trimmed
}

/**
 * Replaces the international calling code prefix when changing country code,
 * while preserving the user's entered national digits.
 */
export function replaceCountryCallingCode(
  value: string | undefined | null,
  fromCountry: Country | undefined,
  toCountry: Country | undefined
): string {
  if (!toCountry) return value || ''

  let newCallingCode = ''

  try {
    newCallingCode = `+${getCountryCallingCode(toCountry)}`
  } catch {
    return value || ''
  }

  if (!value || !value.trim()) {
    return newCallingCode
  }

  const trimmed = value.trim()

  let oldCallingCode = ''

  if (fromCountry) {
    try {
      oldCallingCode = `+${getCountryCallingCode(fromCountry)}`
    } catch {
      // Ignore country parsing errors.
    }
  }

  // If value is just "+" or "+<oldCode>" with no national digits.
  if (trimmed === '+' || trimmed === oldCallingCode) {
    return newCallingCode
  }

  /*
   * First normalize the existing value and then extract its
   * national number.
   */
  try {
    const parsed = parsePhoneNumber(trimmed)

    if (parsed?.nationalNumber) {
      return `${newCallingCode}${parsed.nationalNumber}`
    }
  } catch {
    // Continue with fallback logic.
  }

  // If starts with the old calling code.
  if (oldCallingCode && trimmed.startsWith(oldCallingCode)) {
    const nationalPart = trimmed
      .slice(oldCallingCode.length)
      .replace(/\D/g, '')

    return nationalPart
      ? `${newCallingCode}${nationalPart}`
      : newCallingCode
  }

  // If starts with any international calling code.
  if (trimmed.startsWith('+')) {
    const digitsAfterPlus = trimmed.slice(1).replace(/\D/g, '')

    if (!digitsAfterPlus) {
      return newCallingCode
    }

    /*
     * Try to determine whether the value contains a valid
     * international number.
     */
    try {
      const parsed = parsePhoneNumber(`+${digitsAfterPlus}`)

      if (parsed?.nationalNumber) {
        return `${newCallingCode}${parsed.nationalNumber}`
      }
    } catch {
      // Ignore and use fallback.
    }

    return newCallingCode
  }

  // Raw/local digits.
  const nationalDigits = trimmed.replace(/\D/g, '').replace(/^0+/, '')

  return nationalDigits
    ? `${newCallingCode}${nationalDigits}`
    : newCallingCode
}

/**
 * Strips bare calling codes such as:
 *   "+"
 *   "+94"
 *   "+44"
 *
 * when no national digits have been entered.
 */
export function cleanPhone(
  val: string | null | undefined
): string {
  if (!val) return ''

  const trimmed = val.trim()

  if (trimmed === '+' || /^\+\d{1,4}$/.test(trimmed)) {
    return ''
  }

  return trimmed
}

/**
 * Validates an international phone number.
 *
 * Empty or bare calling code values are treated as valid so the
 * parent component can decide whether the field itself is required.
 */
export function validateInternationalPhone(
  value: string | null | undefined
): boolean {
  const cleaned = cleanPhone(value)

  if (!cleaned) return true

  const normalized = normalizePhoneValue(cleaned)

  try {
    return isValidPhoneNumber(normalized)
  } catch {
    return false
  }
}

/**
 * Parses the country from an international phone number.
 */
export function getCountryFromPhone(
  phone: string | null | undefined,
  fallback: Country = 'LK'
): Country {
  const cleaned = cleanPhone(phone)

  if (!cleaned) return fallback

  try {
    const normalized = normalizePhoneValue(cleaned, fallback)
    const parsed = parsePhoneNumber(normalized)

    if (parsed?.country) {
      return parsed.country
    }
  } catch {
    // Ignore parsing errors.
  }

  return fallback
}

export function InternationalPhoneField({
  label,
  value,
  onChange,
  country,
  defaultCountry = 'LK',
  onCountryChange,
  error,
  disabled = false,
  placeholder = '+94 77 234 5678',
  action,
  id,
  className,
}: InternationalPhoneFieldProps) {
  /*
   * IMPORTANT:
   *
   * react-phone-number-input expects its value to be E.164.
   *
   * Database values may contain formatting such as:
   *   +94 757233942
   *
   * We normalize them here before passing them to PhoneInput.
   */
  const normalizedValue = useMemo(() => {
    return normalizePhoneValue(value, country || defaultCountry)
  }, [value, country, defaultCountry])

  return (
    <div
      className={cn(
        'w-full flex flex-col gap-1.5',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-xs font-medium text-xp-muted uppercase tracking-wide"
        >
          {label}
        </label>

        {action && <div>{action}</div>}
      </div>

      <div
        className={cn(
          'w-full h-9 rounded-lg border bg-white transition-colors overflow-hidden flex items-center',
          error
            ? 'border-red-400 focus-within:border-red-500'
            : 'border-xp-border focus-within:border-xp-purple focus-within:ring-2 focus-within:ring-xp-purple/20',
          disabled && 'bg-gray-50 opacity-60 cursor-not-allowed'
        )}
      >
        <PhoneInput
          id={id}
          international
          country={country || undefined}
          defaultCountry={defaultCountry}
          countrySelectProps={{
            unicodeFlags: true,
          }}
          value={normalizedValue || undefined}
          onChange={(nextValue) => {
            /*
             * PhoneInput already returns E.164 values.
             *
             * Normalize once more to guarantee the parent state
             * always receives a clean value.
             */
            const normalized = normalizePhoneValue(
              nextValue || '',
              country || defaultCountry
            )

            onChange(normalized)
          }}
          onCountryChange={(nextCountry) => {
            if (nextCountry && onCountryChange) {
              onCountryChange(nextCountry)
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="client-phone-input"
        />
      </div>

      {error ? (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={12} />
          <span>{error}</span>
        </p>
      ) : cleanPhone(value) ? (
        <p className="text-[10px] text-xp-muted">
          Stored internationally as{' '}
          <span className="font-mono font-medium text-[#111]">
            {normalizedValue || value}
          </span>
        </p>
      ) : null}
    </div>
  )
}

export default InternationalPhoneField