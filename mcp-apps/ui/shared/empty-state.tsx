import { cn } from "../lib/utils";
import { Button } from "../catalyst/button";
import { Subheading } from "../catalyst/heading";
import { Text } from "../catalyst/text";
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
    <div className={cn("flex flex-col items-center justify-center py-6 text-center", className)}>
      {Icon && <div className="rounded-md border bg-muted p-2.5 mb-2.5"><Icon className="h-8 w-8 text-muted-foreground/55" /></div>}
      <Subheading level={3}>{title}</Subheading>
      {description && <Text className="mt-1 max-w-xs">{description}</Text>}
      {action && (
        <Button outline onClick={action.onClick} className="mt-2.5">
          {action.label}
        </Button>
      )}
    </div>
  );
}
