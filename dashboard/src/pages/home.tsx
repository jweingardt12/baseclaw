import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line } from "recharts";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, CheckCircle, Info, Zap } from "lucide-react";
import { toast } from "sonner";
import { TeamAvatar } from "@/components/team-avatar";
import * as api from "@/lib/api";

export function HomePage() {
  const [optimizing, setOptimizing] = useState(false);

  const status = useQuery({ queryKey: ["status"], queryFn: api.getSystemStatus });
  const briefing = useQuery({ queryKey: ["briefing"], queryFn: api.getMorningBriefing });
  const roster = useQuery({ queryKey: ["roster"], queryFn: api.getRoster });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.getCategoryCheck });
  const matchup = useQuery({ queryKey: ["matchup"], queryFn: api.getMatchup });
  const scoreboard = useQuery({ queryKey: ["scoreboard"], queryFn: api.getScoreboard });
  const autonomy = useQuery({ queryKey: ["autonomy"], queryFn: api.getAutonomyConfig });

  const isWriteEnabled = autonomy.data?.mode !== "off";

  const optimizeMutation = useMutation({
    mutationFn: api.autoOptimizeLineup,
    onMutate: () => setOptimizing(true),
    onSuccess: (data) => {
      if (data.changes?.length > 0) {
        toast.success("Lineup optimized: " + data.changes.join(", "));
      } else {
        toast.success("Lineup already optimal — no changes needed");
      }
      setOptimizing(false);
    },
    onError: () => {
      toast.error("Failed to optimize lineup");
      setOptimizing(false);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your daily fantasy command center</p>
        </div>
        <div className="flex items-center gap-2">
          {status.data && (
            <Badge variant={status.data.ok ? "default" : "destructive"} className="gap-1">
              {status.data.ok
                ? <CheckCircle className="size-3" />
                : <AlertTriangle className="size-3" />}
              {status.data.ok ? "Connected" : "Offline"}
            </Badge>
          )}
          <Separator orientation="vertical" className="h-6" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  onClick={() => optimizeMutation.mutate()}
                  disabled={!isWriteEnabled || optimizing}
                >
                  {optimizing
                    ? <Loader2 className="mr-2 size-3.5 animate-spin" />
                    : <Zap className="mr-2 size-3.5" />}
                  Auto-Optimize
                </Button>
              </span>
            </TooltipTrigger>
            {!isWriteEnabled && (
              <TooltipContent>
                Write operations disabled. Enable in Settings → Autonomy Mode.
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>

      {/* Morning Briefing */}
      <Card>
        <CardHeader>
          <CardTitle>Morning Briefing</CardTitle>
          <CardDescription>
            {briefing.data?.date ?? "Loading today's summary…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {briefing.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : briefing.error ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>Failed to load briefing. Is the Flask API running?</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">{briefing.data?.summary}</p>
              {briefing.data?.alerts && briefing.data.alerts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {briefing.data.alerts.map((alert, i) => (
                    <Badge
                      key={i}
                      variant={
                        alert.type === "critical" ? "destructive" :
                        alert.type === "warning" ? "secondary" : "outline"
                      }
                      className="gap-1"
                    >
                      {alert.type === "critical"
                        ? <AlertTriangle className="size-3" />
                        : <Info className="size-3" />}
                      {alert.message}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Lineup */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Lineup</CardTitle>
          <CardDescription>Active slots — green plays today, gray is off, red is injured</CardDescription>
        </CardHeader>
        <CardContent>
          {roster.isLoading ? (
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          ) : roster.error ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>Failed to load roster</AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
              {roster.data?.filter(p => !["BN", "NA"].includes(p.slot)).map((player) => (
                <div
                  key={player.name}
                  className={`flex items-center gap-2 rounded-md border p-2.5 transition-colors ${
                    player.status === "IL" ? "border-destructive/50 bg-destructive/5" :
                    player.status === "bench" ? "bg-muted/50" : "bg-card"
                  }`}
                >
                  <Badge
                    variant={
                      player.status === "active" ? "default" :
                      player.status === "IL" ? "destructive" : "secondary"
                    }
                    className="text-xs shrink-0 w-10 justify-center"
                  >
                    {player.slot}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{player.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {player.team} · {player.position}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Category Sparklines */}
        <Card>
          <CardHeader>
            <CardTitle>Category Rankings</CardTitle>
            <CardDescription>Your rank in each scoring category</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : categories.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>Failed to load categories</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {categories.data?.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div className="w-10 shrink-0 text-sm font-medium tabular-nums">{cat.category}</div>
                    <div className="flex-1">
                      <ChartContainer
                        config={{ value: { color: "hsl(var(--chart-1))" } }}
                        className="h-8 w-full"
                      >
                        <LineChart data={cat.trend ?? []}>
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="var(--color-value)"
                            strokeWidth={1.5}
                            dot={false}
                          />
                          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                        </LineChart>
                      </ChartContainer>
                    </div>
                    <Badge
                      variant={cat.rank <= 3 ? "default" : cat.rank >= 9 ? "destructive" : "secondary"}
                      className="text-xs w-8 justify-center tabular-nums"
                    >
                      #{cat.rank}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Matchup */}
        <Card>
          <CardHeader>
            <CardTitle>Current Matchup</CardTitle>
            <CardDescription>
              {matchup.data ? (
                <span className="flex items-center gap-2">
                  <TeamAvatar teamName={matchup.data.opponent} size="sm" />
                  vs {matchup.data.opponent}
                </span>
              ) : "This week's head-to-head"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matchup.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : matchup.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>Failed to load matchup</AlertDescription>
              </Alert>
            ) : matchup.data ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-2xl font-bold tabular-nums">
                  <span className="text-green-500">{matchup.data.score.wins}</span>
                  <span className="text-muted-foreground text-base">–</span>
                  <span className="text-red-500">{matchup.data.score.losses}</span>
                  <span className="text-muted-foreground text-base">–</span>
                  <span className="text-base font-normal text-muted-foreground">
                    {matchup.data.score.ties} T
                  </span>
                </div>
                <Separator />
                <div className="space-y-2.5">
                  {matchup.data.categories.map((cat) => {
                    const total = cat.yours + cat.theirs;
                    const pct = total > 0 ? (cat.yours / total) * 100 : 50;
                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={cat.winning ? "font-semibold text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                            {cat.yours}
                          </span>
                          <span className="font-medium">{cat.name}</span>
                          <span className="text-muted-foreground">{cat.theirs}</span>
                        </div>
                        <Progress
                          value={pct}
                          className={`h-1.5 ${cat.winning ? "[&>div]:bg-green-500" : "[&>div]:bg-red-500"}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* League Scoreboard */}
      <Card>
        <CardHeader>
          <CardTitle>League Scoreboard</CardTitle>
          <CardDescription>All matchups across the league</CardDescription>
        </CardHeader>
        <CardContent>
          {scoreboard.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : scoreboard.error ? (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>Failed to load scoreboard</AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableBody>
                {scoreboard.data?.matchups.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.team1}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.score1}</TableCell>
                    <TableCell className="text-center text-muted-foreground">vs</TableCell>
                    <TableCell className="tabular-nums">{m.score2}</TableCell>
                    <TableCell className="text-right font-medium">{m.team2}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
