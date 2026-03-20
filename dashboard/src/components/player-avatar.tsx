import { memo } from "react";
import { Avatar } from "@/catalyst/avatar";
import { mlbHeadshotUrl, getInitials } from "@/lib/images";
import { cn } from "@/lib/utils";

interface PlayerAvatarProps {
  name: string;
  mlbId?: number | string | null;
  className?: string;
  size?: "sm" | "default" | "lg";
}

const sizeClasses = {
  sm: "size-6",
  default: "size-8",
  lg: "size-10",
};

export const PlayerAvatar = memo(function PlayerAvatar({
  name,
  mlbId,
  className,
  size = "default",
}: PlayerAvatarProps) {
  const headshotUrl = mlbId ? mlbHeadshotUrl(mlbId) : undefined;
  return (
    <Avatar
      src={headshotUrl}
      initials={!headshotUrl ? getInitials(name) : undefined}
      alt={name}
      className={cn(sizeClasses[size], className)}
    />
  );
});
