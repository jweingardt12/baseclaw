import { Card, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { Subheading } from "../components/heading";
import { AiInsight } from "../shared/ai-insight";
import { RefreshButton } from "../shared/refresh-button";

interface MatchupTeam {
  name: string;
  team_key?: string;
}

interface Matchup {
  team1: MatchupTeam | string;
  team2: MatchupTeam | string;
  status: string;
  week?: number;
  team1_logo?: string;
  team2_logo?: string;
}

interface MatchupsData {
  type: string;
  week: string;
  matchups: Matchup[];
  ai_recommendation?: string | null;
}

var MY_TEAM = "You Can Clip These Wings";

function getTeamName(team: MatchupTeam | string): string {
  if (typeof team === "string") return team;
  return team.name || "?";
}

export function MatchupsView({ data, app, navigate, toolName }: { data: MatchupsData; app?: any; navigate?: (data: any) => void; toolName?: string }) {
  var isScoreboard = data.type === "scoreboard";
  var refreshToolName = toolName === "scoreboard" ? "yahoo_scoreboard" : "yahoo_matchups";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Subheading>
          {isScoreboard ? "Scoreboard" : "Matchups"} - Week {data.week}
        </Subheading>
        {app && navigate && (
          <RefreshButton app={app} toolName={refreshToolName} navigate={navigate} />
        )}
      </div>

      <AiInsight recommendation={data.ai_recommendation} />

      <div className="grid gap-2">
        {(data.matchups || []).map((m, i) => {
          var name1 = getTeamName(m.team1);
          var name2 = getTeamName(m.team2);
          var isMyMatchup = name1 === MY_TEAM || name2 === MY_TEAM;
          return (
            <Card key={i} className={isMyMatchup ? "border-primary border-2 bg-primary/5" : ""}>
              <CardContent className="py-2 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className={"font-medium flex items-center gap-1.5" + (name1 === MY_TEAM ? " text-primary" : "")}>
                      {m.team1_logo && <img src={m.team1_logo} alt="" width={28} height={28} className="rounded-sm shrink-0" />}
                      <span className="truncate">{name1}</span>
                    </p>
                  </div>
                  <div className="px-3 flex flex-col items-center flex-shrink-0">
                    <Badge variant="secondary" className="text-sm font-bold px-3 py-1">vs</Badge>
                    {m.status && <span className="text-xs text-muted-foreground mt-0.5">{m.status}</span>}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <p className={"font-medium flex items-center justify-end gap-1.5" + (name2 === MY_TEAM ? " text-primary" : "")}>
                      <span className="truncate">{name2}</span>
                      {m.team2_logo && <img src={m.team2_logo} alt="" width={28} height={28} className="rounded-sm shrink-0" />}
                    </p>
                  </div>
                </div>
                {isMyMatchup && (
                  <p className="text-xs text-primary text-center mt-1 font-medium">Your Matchup</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
