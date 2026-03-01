import { Badge } from "../components/ui/badge";
import { AiInsight } from "../shared/ai-insight";

interface LeagueInfo {
  name: string;
  draft_status: string;
  season: string;
  start_date: string;
  end_date: string;
  current_week: number;
  num_teams: number;
  num_playoff_teams: number;
  max_weekly_adds: number;
  team_name: string;
  team_id: string;
  ai_recommendation?: string | null;
}

export function InfoView({ data }: { data: LeagueInfo }) {
  var rows = [
    ["Season", data.season],
    ["Draft Status", data.draft_status],
    ["Current Week", String(data.current_week)],
    ["Start Date", data.start_date],
    ["End Date", data.end_date],
    ["Teams", String(data.num_teams)],
    ["Playoff Teams", String(data.num_playoff_teams)],
    ["Max Weekly Adds", String(data.max_weekly_adds)],
  ];

  return (
    <div className="space-y-3">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="rounded-md border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-lg">{data.name}</h3>
          <Badge variant="secondary">{data.season}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {rows.map(function (row) {
            return (
              <div key={row[0]}>
                <p className="text-xs text-muted-foreground">{row[0]}</p>
                <p className="text-sm font-medium">{row[1]}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border bg-card p-4">
        <h3 className="font-semibold text-base mb-2">Your Team</h3>
        <p className="font-medium">{data.team_name}</p>
        <p className="text-xs text-muted-foreground">{data.team_id}</p>
      </div>
    </div>
  );
}
