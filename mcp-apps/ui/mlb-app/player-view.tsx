import { Badge } from "@plexui/ui/components/Badge";
import { mlbHeadshotUrl } from "../shared/mlb-images";
import { TeamLogo } from "../shared/team-logo";
import { IntelBadge } from "../shared/intel-badge";
import { IntelPanel } from "../shared/intel-panel";
import { PlayerName } from "../shared/player-name";
import { KpiTile } from "../shared/kpi-tile";

interface MlbPlayerData {
  name: string;
  position: string;
  team: string;
  bats: string;
  throws: string;
  age: number;
  mlb_id: number;
  intel?: any;
}

export function PlayerView({ data, app, navigate }: { data: MlbPlayerData; app?: any; navigate?: (data: any) => void }) {
  return (
    <div className="space-y-4 animate-slide-up">
      <div className="surface-card p-5">
        <div className="flex items-center gap-3 sm:gap-3">
          <img src={mlbHeadshotUrl(data.mlb_id)} alt={data.name} className="w-16 h-16 rounded-full bg-muted object-cover" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold"><PlayerName name={data.name} mlbId={data.mlb_id} app={app} navigate={navigate} context="default" /></span>
              {data.intel && <IntelBadge intel={data.intel} size="sm" />}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className="font-bold">{data.position}</Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1 font-semibold">
                <TeamLogo abbrev={data.team} />
                {data.team}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiTile value={data.age} label="Age" color="neutral" />
        <KpiTile value={data.bats} label="Bats" color="info" />
        <KpiTile value={data.throws} label="Throws" color="info" />
      </div>

      {data.intel && (
        <div className="surface-card p-5">
          <IntelPanel intel={data.intel} />
        </div>
      )}
    </div>
  );
}
