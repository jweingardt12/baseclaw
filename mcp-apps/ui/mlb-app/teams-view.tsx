import { Badge } from "@plexui/ui/components/Badge";

import { teamLogoUrl } from "../shared/mlb-images";

interface MlbTeam {
  id: number;
  name: string;
  abbreviation: string;
}

export function TeamsView({ data }: { data: { teams: MlbTeam[] } }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {(data.teams || []).map(function (t) {
          return (
            <div key={t.id} className="surface-card p-3 flex items-center gap-3">
              <img src={teamLogoUrl(t.id)} alt={t.abbreviation} className="w-8 h-8" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{t.name}</p>
                <Badge color="secondary" size="sm" className="font-bold">{t.abbreviation}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
