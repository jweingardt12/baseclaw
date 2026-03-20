import clsx from 'clsx'

export function Card({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex flex-col gap-4 overflow-hidden rounded-xl bg-white py-4 text-sm text-zinc-950 ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:text-white dark:ring-white/10'
      )}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'grid auto-rows-min items-start gap-1 px-4')}
    />
  )
}

export function CardTitle({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'text-base/7 font-semibold text-zinc-950 dark:text-white')}
    />
  )
}

export function CardDescription({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'text-sm/6 text-zinc-500 dark:text-zinc-400')}
    />
  )
}

export function CardContent({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={clsx(className, 'px-4')} />
}

export function CardFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(className, 'flex items-center border-t border-zinc-950/5 px-4 pt-4 dark:border-white/5')}
    />
  )
}
