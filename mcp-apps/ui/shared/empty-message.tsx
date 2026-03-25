import type { ReactNode } from "react";

/* ── Sub-components (compound pattern matching PlexUI EmptyMessage) ── */

function EmptyIcon({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={"text-muted-foreground mb-2" + (className ? " " + className : "")}>
      {children}
    </div>
  );
}

function EmptyTitle({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <h3 className={"text-sm font-semibold text-foreground" + (className ? " " + className : "")}>
      {children}
    </h3>
  );
}

function EmptyDescription({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <p className={"text-xs text-muted-foreground mt-1" + (className ? " " + className : "")}>
      {children}
    </p>
  );
}

function EmptyActionRow({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={"mt-3 flex items-center justify-center gap-2" + (className ? " " + className : "")}>
      {children}
    </div>
  );
}

/* ── Main EmptyMessage ────────────────────────────────── */

interface EmptyMessageProps {
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}

function EmptyMessage({ title, description, className, children }: EmptyMessageProps) {
  var hasCompound = children != null;

  return (
    <div
      className={
        "flex flex-col items-center justify-center text-center py-8 px-4" +
        (className ? " " + className : "")
      }
    >
      {hasCompound ? (
        children
      ) : (
        <>
          {title && <EmptyTitle>{title}</EmptyTitle>}
          {description && <EmptyDescription>{description}</EmptyDescription>}
        </>
      )}
    </div>
  );
}

EmptyMessage.Icon = EmptyIcon;
EmptyMessage.Title = EmptyTitle;
EmptyMessage.Description = EmptyDescription;
EmptyMessage.ActionRow = EmptyActionRow;

export { EmptyMessage };
