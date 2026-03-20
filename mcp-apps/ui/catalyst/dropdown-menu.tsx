import {
  Dropdown,
  DropdownButton,
  DropdownMenu as CatalystDropdownMenu,
  DropdownItem as CatalystDropdownItem,
  DropdownDivider,
} from './dropdown'

export { Dropdown as DropdownMenu }
export { DropdownButton as DropdownMenuTrigger }
export { CatalystDropdownMenu as DropdownMenuContent }
export { DropdownDivider as DropdownMenuSeparator }

export function DropdownMenuItem({
  icon,
  children,
  onClick,
  className,
  ...props
}: {
  icon?: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
  className?: string
} & Record<string, any>) {
  return (
    <CatalystDropdownItem className={className} onClick={onClick} {...props}>
      {icon && <span data-slot="icon">{icon}</span>}
      {children}
    </CatalystDropdownItem>
  )
}
