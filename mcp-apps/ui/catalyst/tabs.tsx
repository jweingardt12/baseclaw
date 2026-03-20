import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'

var TabsContext = createContext<{
  value: string
  onValueChange: (v: string) => void
  values: string[]
  registerValue: (v: string) => void
}>({
  value: '',
  onValueChange: function () {},
  values: [],
  registerValue: function () {},
})

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children: ReactNode
}) {
  var [internal, setInternal] = useState(defaultValue || '')
  var [values, setValues] = useState<string[]>([])
  var current = value !== undefined ? value : internal
  var onChange = onValueChange || setInternal

  function registerValue(v: string) {
    setValues(function (prev) {
      return prev.indexOf(v) === -1 ? prev.concat(v) : prev
    })
  }

  var selectedIndex = values.indexOf(current)
  if (selectedIndex < 0) selectedIndex = 0

  return (
    <TabsContext.Provider value={{ value: current, onValueChange: onChange, values: values, registerValue: registerValue }}>
      <Headless.TabGroup
        selectedIndex={selectedIndex}
        onChange={function (i: number) { if (values[i]) onChange(values[i]) }}
        className={clsx(className, 'flex flex-col gap-2')}
      >
        {children}
      </Headless.TabGroup>
    </TabsContext.Provider>
  )
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Headless.TabList
      className={clsx(
        className,
        'inline-flex h-8 w-fit items-center justify-center rounded-lg bg-zinc-100 p-[3px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
      )}
    >
      {children}
    </Headless.TabList>
  )
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}) {
  var ctx = useContext(TabsContext)

  useEffect(function () {
    ctx.registerValue(value)
  }, [value])

  return (
    <Headless.Tab
      className={clsx(
        className,
        'inline-flex flex-1 items-center justify-center rounded-md px-2 py-1 text-sm font-medium whitespace-nowrap transition-all',
        'data-selected:bg-white data-selected:text-zinc-950 data-selected:shadow-sm dark:data-selected:bg-zinc-700 dark:data-selected:text-white',
        'hover:text-zinc-950 dark:hover:text-white',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'
      )}
    >
      {children}
    </Headless.Tab>
  )
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children: ReactNode
}) {
  var ctx = useContext(TabsContext)

  useEffect(function () {
    ctx.registerValue(value)
  }, [value])

  // Only render content for active tab
  if (ctx.value !== value) return null

  return (
    <div className={clsx(className, 'flex-1 text-sm outline-none')}>
      {children}
    </div>
  )
}
