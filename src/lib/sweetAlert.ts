import Swal from 'sweetalert2'

const xpAlert = Swal.mixin({
  background: '#ffffff',
  color: '#111111',
  confirmButtonColor: '#111111',
  cancelButtonColor: '#f3f3f3',
  buttonsStyling: true,
  customClass: {
    popup: 'xp-swal-popup',
    title: 'xp-swal-title',
    htmlContainer: 'xp-swal-text',
    confirmButton: 'xp-swal-confirm',
    cancelButton: 'xp-swal-cancel',
  },
})

export const showSuccessAlert = (
  title: string,
  message: string,
) => {
  return xpAlert.fire({
    icon: 'success',
    title,
    text: message,
    confirmButtonText: 'Done',
  })
}

export const showErrorAlert = (
  title: string,
  message: string,
) => {
  return xpAlert.fire({
    icon: 'error',
    title,
    text: message,
    confirmButtonText: 'Close',
  })
}

export const showWarningAlert = (
  title: string,
  message: string,
) => {
  return xpAlert.fire({
    icon: 'warning',
    title,
    text: message,
    confirmButtonText: 'Okay',
  })
}