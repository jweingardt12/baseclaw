import { Button } from "@/components/ui/button";
import { EmptyMessage } from "@/shared/empty-message";
import { cn } from "../lib/utils";
import type { AppIcon } from "@/shared/icons";

interface EmptyStateProps {
  icon?: AppIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <EmptyMessage className={cn("py-6", className)}>
      {Icon && (
        <EmptyMessage.Icon>
          <Icon className="h-8 w-8" />
        </EmptyMessage.Icon>
      )}
      <EmptyMessage.Title>{title}</EmptyMessage.Title>
      {description && <EmptyMessage.Description>{description}</EmptyMessage.Description>}
      {action && (
        <EmptyMessage.ActionRow>
          <Button variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        </EmptyMessage.ActionRow>
      )}
    </EmptyMessage>
  );
}
