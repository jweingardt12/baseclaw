import clsx from 'clsx'
import { forwardRef } from 'react'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  indicatorClassName?: string
}

export var Progress = forwardRef<HTMLDivElement, ProgressProps>(
  function Progress({ className, value = 0, max = 100, indicatorClassName, ...props }, ref) {
    var pct = Math.min(100, Math.max(0, (value / max) * 100))
    return (
      <div
        ref={ref}
        className={clsx('relative h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800', className)}
        {...props}
      >
        <div
          className={clsx('h-full rounded-full bg-blue-500 transition-all duration-500 ease-out', indicatorClassName)}
          style={{ width: pct + '%' }}
        />
      </div>
    )
  }
)
