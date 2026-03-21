import { cn } from '../lib/utils'

export function Card({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn(
        'flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-5 text-sm text-card-foreground ring-1 ring-border',
        className,
      )}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('grid auto-rows-min items-start gap-1.5 px-5', className)}
    />
  )
}

export function CardTitle({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('text-base/7 font-semibold text-foreground', className)}
    />
  )
}

export function CardDescription({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('text-sm/6 text-muted-foreground', className)}
    />
  )
}

export function CardContent({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('px-5', className)} />
}

export function CardFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('flex items-center border-t border-border px-5 pt-4', className)}
    />
  )
}
