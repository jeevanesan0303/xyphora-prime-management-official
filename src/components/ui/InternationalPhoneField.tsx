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
  onCountryChange?: (
    country: Country
  ) => void
  error?: string
  disabled?: boolean
  placeholder?: string
  action?: React.ReactNode
  id?: string
  className?: string
}

/* ==========================================================================
   NORMALIZE PHONE VALUE
   ========================================================================== */

/**
 * Converts a phone number into E.164 format.
 *
 * Examples:
 *
 * "+94 757233942"
 * -> "+94757233942"
 *
 * "+94 77 123 4567"
 * -> "+94771234567"
 *
 * "+94771234567"
 * -> "+94771234567"
 *
 * "94771234567"
 * -> "+94771234567"
 *
 * "0771234567" with LK
 * -> "+94771234567"
 */
export function normalizePhoneValue(
  value: string | null | undefined,
  fallbackCountry: Country = 'LK'
): string {
  if (!value) {
    return ''
  }

  const trimmed =
    value.trim()

  if (!trimmed) {
    return ''
  }

  /* ------------------------------------------------------------------------
     Already international
     ------------------------------------------------------------------------ */

  if (trimmed.startsWith('+')) {
    try {
      const parsed =
        parsePhoneNumber(
          trimmed
        )

      if (parsed?.number) {
        return parsed.number
      }
    } catch {
      // Continue with fallback normalization.
    }

    /*
     * Even when parsing fails, remove formatting characters
     * while keeping the international "+" prefix.
     */
    const digits =
      trimmed
        .slice(1)
        .replace(/\D/g, '')

    if (digits) {
      return `+${digits}`
    }

    return ''
  }

  /* ------------------------------------------------------------------------
     Digits containing a country calling code
     ------------------------------------------------------------------------ */

  if (/^\d+$/.test(trimmed)) {
    try {
      const parsed =
        parsePhoneNumber(
          `+${trimmed}`
        )

      if (parsed?.number) {
        return parsed.number
      }
    } catch {
      // Continue below.
    }

    return `+${trimmed}`
  }

  /* ------------------------------------------------------------------------
     Local / national number
     ------------------------------------------------------------------------ */

  try {
    const digits =
      trimmed.replace(
        /\D/g,
        ''
      )

    if (digits) {
      const callingCode =
        getCountryCallingCode(
          fallbackCountry
        )

      /*
       * Remove leading zero(s) from the
       * national number before adding the
       * international calling code.
       */
      const nationalNumber =
        digits.replace(
          /^0+/,
          ''
        )

      if (nationalNumber) {
        return `+${callingCode}${nationalNumber}`
      }
    }
  } catch {
    // Return original value if normalization fails.
  }

  return trimmed
}

/* ==========================================================================
   REPLACE COUNTRY CALLING CODE
   ========================================================================== */

/**
 * Replaces the international calling code when
 * the user changes the selected country.
 *
 * Example:
 *
 * LK +94 + 757233942
 * -> India +91 + 757233942
 *
 * Result:
 * +91757233942
 */
export function replaceCountryCallingCode(
  value:
    | string
    | undefined
    | null,
  fromCountry:
    | Country
    | undefined,
  toCountry:
    | Country
    | undefined
): string {
  if (!toCountry) {
    return value || ''
  }

  let newCallingCode = ''

  try {
    newCallingCode =
      `+${getCountryCallingCode(
        toCountry
      )}`
  } catch {
    return value || ''
  }

  /*
   * No number entered.
   */
  if (
    !value ||
    !value.trim()
  ) {
    return ''
  }

  const trimmed =
    value.trim()

  let oldCallingCode = ''

  if (fromCountry) {
    try {
      oldCallingCode =
        `+${getCountryCallingCode(
          fromCountry
        )}`
    } catch {
      // Ignore country parsing errors.
    }
  }

  /*
   * Remove spaces, brackets, hyphens etc.
   */
  const compact =
    trimmed.replace(
      /[\s\-().]/g,
      ''
    )

  /*
   * Existing E.164 number.
   *
   * Example:
   * +94757233942
   */
  if (
    compact.startsWith('+')
  ) {
    try {
      const parsed =
        parsePhoneNumber(
          compact
        )

      if (
        parsed?.nationalNumber
      ) {
        return `${newCallingCode}${parsed.nationalNumber}`
      }
    } catch {
      // Continue with fallback.
    }

    /*
     * If we know the old calling code,
     * remove it directly.
     */
    if (
      oldCallingCode &&
      compact.startsWith(
        oldCallingCode
      )
    ) {
      const nationalPart =
        compact
          .slice(
            oldCallingCode.length
          )
          .replace(
            /\D/g,
            ''
          )

      return nationalPart
        ? `${newCallingCode}${nationalPart}`
        : ''
    }

    /*
     * Unknown international number.
     *
     * Try parsing the digits without
     * the "+".
     */
    const digitsAfterPlus =
      compact
        .slice(1)
        .replace(
          /\D/g,
          ''
        )

    if (!digitsAfterPlus) {
      return ''
    }

    try {
      const parsed =
        parsePhoneNumber(
          `+${digitsAfterPlus}`
        )

      if (
        parsed?.nationalNumber
      ) {
        return `${newCallingCode}${parsed.nationalNumber}`
      }
    } catch {
      // Ignore.
    }

    return ''
  }

  /*
   * Local / national number.
   *
   * Example:
   * 0771234567
   */
  const nationalDigits =
    compact
      .replace(
        /\D/g,
        ''
      )
      .replace(
        /^0+/,
        ''
      )

  return nationalDigits
    ? `${newCallingCode}${nationalDigits}`
    : ''
}

/* ==========================================================================
   CLEAN PHONE
   ========================================================================== */

/**
 * Removes empty/bare calling-code values.
 *
 * Examples:
 *
 * "+"
 * "+94"
 * "+44"
 *
 * become:
 *
 * ""
 */
export function cleanPhone(
  val:
    | string
    | null
    | undefined
): string {
  if (!val) {
    return ''
  }

  const trimmed =
    val.trim()

  if (
    trimmed === '+' ||
    /^\+\d{1,4}$/.test(
      trimmed
    )
  ) {
    return ''
  }

  return trimmed
}

/* ==========================================================================
   VALIDATE INTERNATIONAL PHONE
   ========================================================================== */

/**
 * Validates an international phone number.
 *
 * Empty values are considered valid because
 * the parent component decides whether a field
 * is required.
 */
export function validateInternationalPhone(
  value:
    | string
    | null
    | undefined
): boolean {
  const cleaned =
    cleanPhone(value)

  if (!cleaned) {
    return true
  }

  const normalized =
    normalizePhoneValue(
      cleaned
    )

  try {
    return isValidPhoneNumber(
      normalized
    )
  } catch {
    return false
  }
}

/* ==========================================================================
   GET COUNTRY FROM PHONE
   ========================================================================== */

/**
 * Determines the country from an international
 * phone number.
 *
 * Example:
 *
 * +94757233942
 * -> LK
 */
export function getCountryFromPhone(
  phone:
    | string
    | null
    | undefined,
  fallback: Country = 'LK'
): Country {
  const cleaned =
    cleanPhone(phone)

  if (!cleaned) {
    return fallback
  }

  try {
    const normalized =
      normalizePhoneValue(
        cleaned,
        fallback
      )

    const parsed =
      parsePhoneNumber(
        normalized
      )

    if (parsed?.country) {
      return parsed.country
    }
  } catch {
    // Ignore parsing errors.
  }

  return fallback
}

/* ==========================================================================
   INTERNATIONAL PHONE FIELD
   ========================================================================== */

export function InternationalPhoneField({
  label,
  value,
  onChange,
  country,
  defaultCountry = 'LK',
  onCountryChange,
  error,
  disabled = false,
  placeholder = '77 234 5678',
  action,
  id,
  className,
}: InternationalPhoneFieldProps) {
  /*
   * Normalize the value before giving it to
   * react-phone-number-input.
   *
   * Database:
   *
   * +94 757233942
   *
   * becomes:
   *
   * +94757233942
   */
  const normalizedValue =
    useMemo(
      () =>
        normalizePhoneValue(
          value,
          country ||
            defaultCountry
        ),
      [
        value,
        country,
        defaultCountry,
      ]
    )

  /*
   * The displayed country.
   */
  const selectedCountry =
    country ||
    defaultCountry

  return (
    <div
      className={cn(
        'w-full flex flex-col gap-1.5',
        className
      )}
    >
      {/* ================================================================
          LABEL
      ================================================================= */}

      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="text-xs font-medium text-xp-muted uppercase tracking-wide"
        >
          {label}
        </label>

        {action && (
          <div>
            {action}
          </div>
        )}
      </div>

      {/* ================================================================
          PHONE INPUT
      ================================================================= */}

      <div
        className={cn(
          'w-full h-9 rounded-lg border bg-white transition-colors overflow-hidden flex items-center',

          error
            ? 'border-red-400 focus-within:border-red-500'
            : 'border-xp-border focus-within:border-xp-purple focus-within:ring-2 focus-within:ring-xp-purple/20',

          disabled &&
            'bg-gray-50 opacity-60 cursor-not-allowed'
        )}
      >
        <PhoneInput
          id={id}

          /*
           * IMPORTANT:
           *
           * Do NOT use `international` here.
           *
           * The country selector already displays:
           *
           * LK +94
           *
           * Therefore the input itself should display
           * only the national number:
           *
           * 757233942
           *
           * while PhoneInput still returns:
           *
           * +94757233942
           *
           * internally.
           */
          country={
            selectedCountry
          }

          defaultCountry={
            defaultCountry
          }

          /*
           * This prevents the country calling code
           * from being duplicated inside the number field.
           */
          withCountryCallingCode={
            false
          }

          countrySelectProps={{
            unicodeFlags: true,
          }}

          /*
           * Give PhoneInput the normalized E.164 value.
           */
          value={
            normalizedValue ||
            undefined
          }

          /*
           * PhoneInput returns E.164 values.
           */
          onChange={(
            nextValue
          ) => {
            if (!nextValue) {
              onChange('')
              return
            }

            const normalized =
              normalizePhoneValue(
                nextValue,
                selectedCountry
              )

            onChange(
              normalized
            )
          }}

          /*
           * Country changed.
           */
          onCountryChange={(
            nextCountry
          ) => {
            if (
              nextCountry &&
              onCountryChange
            ) {
              onCountryChange(
                nextCountry
              )
            }
          }}

          disabled={
            disabled
          }

          /*
           * Since the calling code is displayed
           * by the country selector, the placeholder
           * should NOT contain +94.
           */
          placeholder={
            placeholder
          }

          className="client-phone-input"
        />
      </div>

      {/* ================================================================
          ERROR
      ================================================================= */}

      {error ? (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle
            size={12}
          />

          <span>
            {error}
          </span>
        </p>
      ) : cleanPhone(
          value
        ) ? (
        /* ==============================================================
           STORED VALUE
        ============================================================== */

        <p className="text-[10px] text-xp-muted">
          Stored internationally{' '}
          as{' '}
          <span className="font-mono font-medium text-[#111]">
            {normalizedValue ||
              value}
          </span>
        </p>
      ) : null}
    </div>
  )
}

export default InternationalPhoneField