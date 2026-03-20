import { Avatar } from "@/catalyst/avatar";
import { teamLogoFromAbbrev, getInitials } from "@/lib/images";
import { cn } from "@/lib/utils";

interface TeamAvatarProps {
  teamName: string;
  teamLogoUrl?: string;
  managerImageUrl?: string;
  abbrev?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  showManager?: boolean;
}

const sizeClasses = {
  sm: "size-6",
  default: "size-8",
  lg: "size-10",
};

export function TeamAvatar({
  teamName,
  teamLogoUrl,
  managerImageUrl,
  abbrev,
  className,
  size = "default",
  showManager = false,
}: TeamAvatarProps) {
  const imgUrl =
    showManager && managerImageUrl
      ? managerImageUrl
      : teamLogoUrl || (abbrev ? teamLogoFromAbbrev(abbrev) ?? undefined : undefined);

  return (
    <Avatar
      square
      src={imgUrl}
      initials={!imgUrl ? getInitials(teamName || "") : undefined}
      alt={teamName || "Team"}
      className={cn(sizeClasses[size], className)}
    />
  );
}
