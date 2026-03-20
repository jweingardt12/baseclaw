import { Dialog, DialogTitle, DialogDescription, DialogBody, DialogActions } from './dialog'
import { Button } from './button'
import { Loader2 } from '@/shared/icons'

interface AlertDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}

export function AlertDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
}: AlertDialogProps) {
  return (
    <Dialog open={open} onClose={loading ? function () {} : onClose} size="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <DialogActions>
        <Button plain onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          color={variant === 'destructive' ? 'red' : 'dark/zinc'}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
