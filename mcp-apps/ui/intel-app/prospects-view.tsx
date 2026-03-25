import { Badge } from "@/components/ui/badge";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { TeamLogo } from "../shared/team-logo";
import { KpiTile } from "../shared/kpi-tile";

interface Transaction {
  player: string;
  type: string;
  team?: string;
  date?: string;
  description?: string;
}

interface ProspectsData {
  type: string;
  transactions: Transaction[];
  ai_recommendation?: string | null;
}

function typeColor(type: string): string {
  var t = type.toLowerCase();
  if (t.indexOf("call") >= 0 || t.indexOf("recall") >= 0) return "bg-sem-success-subtle text-sem-success font-bold";
  if (t.indexOf("option") >= 0 || t.indexOf("assign") >= 0) return "bg-sem-warning-subtle text-sem-warning font-bold";
  if (t.indexOf("dfa") >= 0 || t.indexOf("release") >= 0) return "bg-sem-risk-subtle text-sem-risk font-bold";
  return "bg-muted text-muted-foreground";
}

export function ProspectsView({ data, app, navigate }: { data: ProspectsData; app: any; navigate: (data: any) => void }) {
  var transactions = data.transactions || [];
  var callups = transactions.filter(function (t) {
    var type = t.type.toLowerCase();
    return type.indexOf("call") >= 0 || type.indexOf("recall") >= 0;
  });

  return (
    <div className="space-y-2">
      <Subheading>Prospect Watch</Subheading>
      <Text>Recent call-ups and roster moves that could impact fantasy</Text>

      {/* KPI */}
      <div className="kpi-grid">
        <KpiTile value={callups.length} label="Call-Ups" color="success" />
        <KpiTile value={transactions.length} label="Total Moves" color="info" />
      </div>

      {transactions.length === 0 ? (
        <Text>No recent prospect moves found.</Text>
      ) : (
        <div className="space-y-1.5">
          {transactions.map(function(t, i) {
            return (
              <div key={i} className="surface-card p-4 flex items-center gap-3">
                <div className="shrink-0">
                  <TeamLogo abbrev={t.team} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="secondary" className={typeColor(t.type)}>{t.type}</Badge>
                    <span className="text-xs text-muted-foreground">{t.team || ""}</span>
                  </div>
                  <p className="text-sm font-semibold truncate">{t.player}</p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
