import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from 'react'
import Swal from 'sweetalert2'

type ToastType =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'

interface ToastContextType {
  toast: (
    message: string,
    type?: ToastType,
  ) => void

  success: (
    message: string,
  ) => void

  error: (
    message: string,
  ) => void

  warning: (
    message: string,
  ) => void

  info: (
    message: string,
  ) => void
}

const ToastContext =
  createContext<ToastContextType | null>(
    null,
  )

/* ============================================================
   XYPHORA ALERT CONFIGURATION
   ============================================================ */

const alertConfig: Record<
  ToastType,
  {
    label: string
    titleFirst: string
    titleAccent: string
    icon: string
    accent: string
    accentDark: string
    glow: string
  }
> = {
  success: {
    label: 'SUCCESS',
    titleFirst: 'Action',
    titleAccent: 'completed',
    icon: '✓',
    accent: '#7C3AED',
    accentDark: '#4C1D95',
    glow: 'rgba(124, 58, 237, 0.32)',
  },

  error: {
    label: 'ERROR',
    titleFirst: 'Action',
    titleAccent: 'failed',
    icon: '×',
    accent: '#EF4444',
    accentDark: '#991B1B',
    glow: 'rgba(239, 68, 68, 0.25)',
  },

  warning: {
    label: 'WARNING',
    titleFirst: 'Action',
    titleAccent: 'needs attention',
    icon: '!',
    accent: '#F59E0B',
    accentDark: '#92400E',
    glow: 'rgba(245, 158, 11, 0.25)',
  },

  info: {
    label: 'INFORMATION',
    titleFirst: 'Here is',
    titleAccent: 'an update',
    icon: 'i',
    accent: '#7C3AED',
    accentDark: '#4C1D95',
    glow: 'rgba(124, 58, 237, 0.28)',
  },
}

/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHtml(
  value: string,
): string {
  return value
    .replace(
      /&/g,
      '&amp;',
    )
    .replace(
      /</g,
      '&lt;',
    )
    .replace(
      />/g,
      '&gt;',
    )
    .replace(
      /"/g,
      '&quot;',
    )
    .replace(
      /'/g,
      '&#039;',
    )
}

/* ============================================================
   SHOW XYPHORA ALERT
   ============================================================ */

function showAlert(
  message: string,
  type: ToastType,
) {
  const config =
    alertConfig[type]

  const safeMessage =
    escapeHtml(message)

  const isSuccess =
    type === 'success'

  return Swal.fire({
    width: '500px',

    padding: '0',

    background: '#ffffff',

    color: '#111111',

    backdrop:
      'rgba(20, 12, 35, 0.62)',

    showConfirmButton: true,

    confirmButtonText: `
      <span class="xp-alert-button-text">
        ${
          isSuccess
            ? 'Done'
            : type === 'error'
              ? 'Close'
              : 'Continue'
        }
      </span>

      <span class="xp-alert-arrow">
        →
      </span>
    `,

    showCloseButton: true,

    buttonsStyling: false,

    allowOutsideClick: true,

    allowEscapeKey: true,

    focusConfirm: false,

    customClass: {
      popup:
        'xp-premium-alert',
      confirmButton:
        'xp-premium-alert-button',
      closeButton:
        'xp-premium-alert-close',
    },

    html: `
      <div
        class="xp-alert-content"
        style="
          --xp-accent: ${config.accent};
          --xp-dark-accent: ${config.accentDark};
          --xp-glow: ${config.glow};
        "
      >

        <!-- =================================================
             TOP PURPLE GLOW
        ================================================== -->

        <div class="xp-alert-top-glow"></div>

        <!-- =================================================
             DECORATIVE PARTICLES
        ================================================== -->

        <div class="xp-particle xp-particle-1">
          ✦
        </div>

        <div class="xp-particle xp-particle-2">
          ◆
        </div>

        <div class="xp-particle xp-particle-3">
          ✦
        </div>

        <div class="xp-particle xp-particle-4">
          ◆
        </div>

        <div class="xp-particle xp-particle-5">
          ✦
        </div>

        <div class="xp-particle xp-particle-6">
          ◆
        </div>

        <div class="xp-particle xp-particle-7">
          ✦
        </div>

        <!-- =================================================
             SUCCESS ICON
        ================================================== -->

        <div class="xp-alert-icon-area">

          <div class="xp-alert-icon-ring-outer"></div>

          <div class="xp-alert-icon-ring-middle"></div>

          <div class="xp-alert-icon-ring-inner">

            <div class="xp-alert-icon">
              ${config.icon}
            </div>

          </div>

        </div>

        <!-- =================================================
             STATUS PILL
        ================================================== -->

        <div class="xp-alert-status">
          ${config.label}
        </div>

        <!-- =================================================
             TITLE
        ================================================== -->

        <div class="xp-alert-title">

          <span>
            ${config.titleFirst}
          </span>

          <span class="xp-alert-title-accent">
            ${config.titleAccent}
          </span>

        </div>

        <!-- =================================================
             MESSAGE
        ================================================== -->

        <div class="xp-alert-message">
          ${safeMessage}
        </div>

        <!-- =================================================
             BRAND ACCENT
        ================================================== -->

        <div class="xp-alert-mini-line"></div>

        <!-- =================================================
             BUTTON
        ================================================== -->

        <div class="xp-alert-button-space"></div>

        <!-- =================================================
             BOTTOM WAVES
        ================================================== -->

        <div class="xp-alert-wave xp-alert-wave-1"></div>

        <div class="xp-alert-wave xp-alert-wave-2"></div>

        <div class="xp-alert-wave xp-alert-wave-3"></div>

      </div>
    `,

    showClass: {
      popup:
        'xp-alert-show',
    },

    hideClass: {
      popup:
        'xp-alert-hide',
    },

    didOpen: (popup) => {
      /* ======================================================
         POPUP
      ======================================================= */

      popup.style.borderRadius =
        '28px'

      popup.style.border =
        '1px solid rgba(124, 58, 237, 0.22)'

      popup.style.overflow =
        'hidden'

      popup.style.boxShadow =
        `
          0 35px 100px rgba(32, 15, 60, 0.24),
          0 10px 40px rgba(124, 58, 237, 0.12)
        `

      /* ======================================================
         CLOSE BUTTON
      ======================================================= */

      const closeButton =
        popup.querySelector(
          '.xp-premium-alert-close',
        ) as HTMLElement | null

      if (closeButton) {
        closeButton.innerHTML =
          '×'

        closeButton.style.position =
          'absolute'

        closeButton.style.top =
          '18px'

        closeButton.style.right =
          '18px'

        closeButton.style.zIndex =
          '20'

        closeButton.style.width =
          '42px'

        closeButton.style.height =
          '42px'

        closeButton.style.padding =
          '0'

        closeButton.style.margin =
          '0'

        closeButton.style.border =
          '0'

        closeButton.style.borderRadius =
          '50%'

        closeButton.style.background =
          '#F3F0FF'

        closeButton.style.color =
          '#32166B'

        closeButton.style.fontSize =
          '31px'

        closeButton.style.fontWeight =
          '300'

        closeButton.style.lineHeight =
          '38px'

        closeButton.style.cursor =
          'pointer'

        closeButton.style.transition =
          'all 0.2s ease'

        closeButton.onmouseenter =
          () => {
            closeButton.style.background =
              '#E9DEFF'

            closeButton.style.color =
              '#6D28D9'

            closeButton.style.transform =
              'rotate(90deg)'
          }

        closeButton.onmouseleave =
          () => {
            closeButton.style.background =
              '#F3F0FF'

            closeButton.style.color =
              '#32166B'

            closeButton.style.transform =
              'rotate(0deg)'
          }
      }

      /* ======================================================
         CONFIRM BUTTON
      ======================================================= */

      const confirmButton =
        popup.querySelector(
          '.xp-premium-alert-button',
        ) as HTMLElement | null

      if (confirmButton) {
        confirmButton.style.position =
          'relative'

        confirmButton.style.zIndex =
          '10'

        confirmButton.style.display =
          'flex'

        confirmButton.style.alignItems =
          'center'

        confirmButton.style.justifyContent =
          'center'

        confirmButton.style.gap =
          '17px'

        confirmButton.style.width =
          '280px'

        confirmButton.style.height =
          '64px'

        confirmButton.style.margin =
          '0 auto 74px'

        confirmButton.style.padding =
          '0 25px'

        confirmButton.style.border =
          '0'

        confirmButton.style.borderRadius =
          '34px'

        confirmButton.style.background =
          `
            linear-gradient(
              135deg,
              #17131F 0%,
              #08060D 100%
            )
          `

        confirmButton.style.color =
          '#ffffff'

        confirmButton.style.fontSize =
          '18px'

        confirmButton.style.fontWeight =
          '700'

        confirmButton.style.cursor =
          'pointer'

        confirmButton.style.boxShadow =
          `
            0 0 0 8px rgba(124,58,237,0.10),
            0 12px 30px rgba(38,12,72,0.24)
          `

        confirmButton.style.transition =
          'all 0.22s ease'

        confirmButton.onmouseenter =
          () => {
            confirmButton.style.transform =
              'translateY(-2px)'

            confirmButton.style.background =
              `
                linear-gradient(
                  135deg,
                  #241536 0%,
                  #0A0710 100%
                )
              `

            confirmButton.style.boxShadow =
              `
                0 0 0 8px rgba(124,58,237,0.16),
                0 16px 35px rgba(38,12,72,0.30)
              `
          }

        confirmButton.onmouseleave =
          () => {
            confirmButton.style.transform =
              'translateY(0)'

            confirmButton.style.background =
              `
                linear-gradient(
                  135deg,
                  #17131F 0%,
                  #08060D 100%
                )
              `

            confirmButton.style.boxShadow =
              `
                0 0 0 8px rgba(124,58,237,0.10),
                0 12px 30px rgba(38,12,72,0.24)
              `
          }
      }
    },
  })
}

/* ============================================================
   PROVIDER
   ============================================================ */

export function ToastProvider({
  children,
}: {
  children: ReactNode
}) {
  const toast = useCallback(
    (
      message: string,
      type: ToastType = 'info',
    ) => {
      const cleanMessage =
        message.trim()

      if (!cleanMessage) {
        return
      }

      void showAlert(
        cleanMessage,
        type,
      )
    },
    [],
  )

  const success = useCallback(
    (message: string) => {
      const cleanMessage =
        message.trim()

      if (!cleanMessage) {
        return
      }

      void showAlert(
        cleanMessage,
        'success',
      )
    },
    [],
  )

  const error = useCallback(
    (message: string) => {
      const cleanMessage =
        message.trim()

      if (!cleanMessage) {
        return
      }

      void showAlert(
        cleanMessage,
        'error',
      )
    },
    [],
  )

  const warning = useCallback(
    (message: string) => {
      const cleanMessage =
        message.trim()

      if (!cleanMessage) {
        return
      }

      void showAlert(
        cleanMessage,
        'warning',
      )
    },
    [],
  )

  const info = useCallback(
    (message: string) => {
      const cleanMessage =
        message.trim()

      if (!cleanMessage) {
        return
      }

      void showAlert(
        cleanMessage,
        'info',
      )
    },
    [],
  )

  return (
    <ToastContext.Provider
      value={{
        toast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
    </ToastContext.Provider>
  )
}

/* ============================================================
   HOOK
   ============================================================ */

export const useToast = () => {
  const context =
    useContext(
      ToastContext,
    )

  if (!context) {
    throw new Error(
      'useToast must be used within ToastProvider',
    )
  }

  return context
}