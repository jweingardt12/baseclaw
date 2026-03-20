import * as Headless from '@headlessui/react'
import React, { forwardRef } from 'react'
import { Link as RouterLink, type LinkProps as RouterLinkProps } from 'react-router-dom'

export const Link = forwardRef(function Link(
  props: { href: string } & Omit<RouterLinkProps, 'to'> & React.ComponentPropsWithoutRef<'a'>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const { href, ...rest } = props
  return (
    <Headless.DataInteractive>
      <RouterLink {...rest} to={href} ref={ref} />
    </Headless.DataInteractive>
  )
})
