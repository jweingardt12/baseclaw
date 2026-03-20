import { cn } from "../lib/utils";
import { Button } from "../catalyst/button";
import { Loader2 } from "@/shared/icons";

var URGENCY_BORDER: Record<string, string> = {
  urgent: "border-l-[var(--sem-risk)]",
  opportunity: "border-l-[var(--sem-success)]",
  info: "border-l-[var(--sem-info)]",
};

interface ActionCardProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  buttonText?: string;
  onClick?: () => void;
  urgency?: "urgent" | "opportunity" | "info";
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function ActionCard({ icon, title, description, buttonText, onClick, urgency = "info", loading, className, children }: ActionCardProps) {
  return (
    <div className={cn("surface-card p-3 border-l-4", URGENCY_BORDER[urgency] || URGENCY_BORDER.info, className)}>
      <div className="flex items-center gap-3">
        {icon && <div className="shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{title}</div>
          {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
          {children}
        </div>
        {buttonText && onClick && (
          <Button onClick={onClick} disabled={loading} className="shrink-0">
            {loading && <Loader2 size={14} className="animate-spin mr-1" />}
            {buttonText}
          </Button>
        )}
      </div>
    </div>
  );
}
