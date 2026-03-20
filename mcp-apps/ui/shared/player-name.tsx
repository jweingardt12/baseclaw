import * as React from "react";
import { MessageSquare, ExternalLink, Search, FileText } from "@/shared/icons";
import { mlbHeadshotUrl } from "./mlb-images";
import { Avatar } from "../catalyst/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../catalyst/dropdown-menu";

interface PlayerNameProps {
  name: string;
  playerId?: string;
  mlbId?: number;
  app?: any;
  navigate?: (data: any) => void;
  context?: string;
  showHeadshot?: boolean;
}

function getAskPrompt(name: string, context?: string): string {
  if (context === "roster") {
    return "Should I keep starting " + name + "? How's his recent performance and Statcast profile?";
  }
  if (context === "free-agents" || context === "waivers") {
    return "Should I pick up " + name + "? How's his Statcast, trends, and fantasy outlook?";
  }
  if (context === "draft") {
    return "Is " + name + " worth drafting here? What's his Statcast profile and projection?";
  }
  if (context === "trade") {
    return "What's " + name + "'s trade value? Statcast profile and ROS outlook?";
  }
  if (context === "scout") {
    return "How dangerous is " + name + "? What should I know about his matchup tendencies?";
  }
  return "Tell me about " + name + " — Statcast, trends, and fantasy outlook";
}

export function PlayerName({ name, playerId, mlbId, app, navigate, context, showHeadshot }: PlayerNameProps) {
  var headshot = mlbId && showHeadshot !== false
    ? <Avatar src={mlbHeadshotUrl(mlbId)} className="size-7" />
    : null;

  if (!app) {
    if (headshot) {
      return <span className="inline-flex items-center gap-1.5">{headshot}{name}</span>;
    }
    return <span>{name}</span>;
  }

  var fangraphsSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <span className="inline-flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-80">
          {headshot}
          <span className="truncate border-b border-dashed border-muted-foreground/50">{name}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          onClick={function () { app.sendMessage(getAskPrompt(name, context)); }}
        >
          Ask Claude
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {playerId && (
          <DropdownMenuItem
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={function () { app.openLink("https://sports.yahoo.com/mlb/players/" + playerId); }}
          >
            View on Yahoo
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          icon={<ExternalLink className="w-3.5 h-3.5" />}
          onClick={function () { app.openLink("https://www.fangraphs.com/players/" + fangraphsSlug); }}
        >
          View on FanGraphs
        </DropdownMenuItem>

        {mlbId && (
          <DropdownMenuItem
            icon={<ExternalLink className="w-3.5 h-3.5" />}
            onClick={function () { app.openLink("https://baseballsavant.mlb.com/savant-player/" + mlbId); }}
          >
            View on Savant
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          icon={<Search className="w-3.5 h-3.5" />}
          onClick={function () { app.openLink("https://www.reddit.com/r/fantasybaseball/search/?q=" + encodeURIComponent(name)); }}
        >
          Search Reddit
        </DropdownMenuItem>

        {navigate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              icon={<FileText className="w-3.5 h-3.5" />}
              onClick={async function () {
                var result = await app.callServerTool("fantasy_player_report", { player_name: name });
                if (result) {
                  navigate(result.structuredContent);
                }
              }}
            >
              Get Full Report
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
