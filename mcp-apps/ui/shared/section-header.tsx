import { cn } from "../lib/utils";
import { Badge } from "@/components/ui/badge";
import { Subheading } from "../components/heading";
import type { AppIcon } from "@/shared/icons";

interface SectionHeaderProps {
  icon?: AppIcon;
  title: string;
  count?: number;
  children?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ icon: Icon, title, count, children, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center gap-2 mb-2", className)}>
      {Icon && <Icon className="h-5 w-5 text-primary" />}
      <Subheading>{title}</Subheading>
      {count !== undefined && <Badge variant="secondary">{count}</Badge>}
      <div className="flex-1" />
      {children}
    </div>
  );
}
