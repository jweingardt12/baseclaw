import { Badge } from "@/components/ui/badge";
import { Subheading } from "../components/heading";
import { DescriptionList, DescriptionTerm, DescriptionDetails } from "../components/description-list";
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
    <div className="space-y-4">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="surface-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Subheading>{data.name}</Subheading>
          <Badge variant="secondary">{data.season}</Badge>
        </div>
        <DescriptionList>
          {rows.map(function (row) {
            return (
              <div key={row[0]} className="contents">
                <DescriptionTerm>{row[0]}</DescriptionTerm>
                <DescriptionDetails>{row[1]}</DescriptionDetails>
              </div>
            );
          })}
        </DescriptionList>
      </div>

      <div className="surface-card p-5">
        <Subheading level={3} className="mb-2">Your Team</Subheading>
        <p className="font-medium">{data.team_name}</p>
        <p className="text-xs text-muted-foreground">{data.team_id}</p>
      </div>
    </div>
  );
}
