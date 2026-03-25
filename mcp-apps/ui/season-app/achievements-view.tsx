import { Card, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { EmptyState } from "../shared/empty-state";
import { KpiTile } from "../shared/kpi-tile";
import { Trophy, Award } from "@/shared/icons";

interface Achievement {
  name: string;
  description: string;
  earned: boolean;
  value: string | null;
  icon: string;
}

interface AchievementsResponse {
  total_earned: number;
  total_available: number;
  team_name: string;
  record: string;
  current_rank: number;
  current_streak: number;
  longest_streak: number;
  achievements: Achievement[];
}

export function AchievementsView({ data, app, navigate }: { data: AchievementsResponse; app?: any; navigate?: (data: any) => void }) {
  var earned = (data.achievements || []).filter(function (a) { return a.earned; });
  var unearned = (data.achievements || []).filter(function (a) { return !a.earned; });

  return (
    <div className="space-y-2">
      <div className="kpi-grid">
        <KpiTile value={data.total_earned + "/" + data.total_available} label="Earned" color="success" />
        <KpiTile value={data.current_rank} label="Rank" color="primary" />
        <KpiTile value={data.current_streak} label="Streak" color={data.current_streak > 0 ? "success" : "risk"} />
        <KpiTile value={data.longest_streak} label="Best Streak" color="info" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <Subheading>Achievements</Subheading>
      </div>

      {/* Team Info */}
      <div className="flex items-center justify-between">
        <p className="font-semibold">{data.team_name}</p>
        {data.record && <Badge variant="secondary">{data.record}</Badge>}
      </div>

      {/* Earned Achievements */}
      {earned.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Earned</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {earned.map(function (a, idx) {
              return (
                <Card key={a.name + "-" + idx} className="border-green-500/30 bg-sem-success-subtle">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{a.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm">{a.name}</p>
                          {a.value && <Badge className="bg-sem-success">{a.value}</Badge>}
                        </div>
                        <Text className="mt-0.5">{a.description}</Text>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Unearned Achievements */}
      {unearned.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Locked</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {unearned.map(function (a, idx) {
              return (
                <Card key={a.name + "-locked-" + idx} className="opacity-60">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0 grayscale">{a.icon}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-muted-foreground">{a.name}</p>
                        <Text className="mt-0.5">{a.description}</Text>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Empty state */}
      {(data.achievements || []).length === 0 && (
        <EmptyState icon={Award} title="No achievements data available" />
      )}
    </div>
  );
}
