import * as React from "react";
import { cn } from "../../lib/utils";

interface TabsContextValue { value: string; onValueChange: (v: string) => void; }
const TabsContext = React.createContext<TabsContextValue>({ value: "", onValueChange: () => {} });
type TabsListBehavior = "scroll" | "wrap";

function Tabs({ value, onValueChange, children, className }: {
  value: string; onValueChange: (v: string) => void; children: React.ReactNode; className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({
  children,
  className,
  behavior = "scroll",
}: { children: React.ReactNode; className?: string; behavior?: TabsListBehavior }) {
  const base = behavior === "wrap"
    ? "inline-flex min-h-11 flex-wrap items-center rounded-lg bg-muted/80 p-1.5 text-muted-foreground gap-1"
    : "flex min-h-11 w-full items-center rounded-lg bg-muted/80 p-1.5 text-muted-foreground gap-1 overflow-x-auto overflow-y-hidden no-scrollbar mcp-app-scroll-x";
  return (
    <div className={cn(base, "touch-pan-x", className)}>
      {children}
    </div>
  );
}

function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsContext);
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-semibold transition-all shrink-0",
        ctx.value === value ? "bg-background text-primary shadow-sm" : "hover:text-foreground/80",
        className
      )}
      onClick={() => ctx.onValueChange(value)}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn("mt-2", className)}>{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
