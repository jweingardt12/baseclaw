import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Heading, Subheading } from "@/catalyst/heading";
import { Text } from "@/catalyst/text";
import { Badge } from "@/catalyst/badge";
import { Button } from "@/catalyst/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/catalyst/table";
import { TeamAvatar } from "@/components/team-avatar";
import { toast } from "sonner";
import clsx from "clsx";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import * as api from "@/lib/api";

const tabs = ["Standings", "Power Rankings", "Positional Ranks", "Transactions", "Trades", "History"];

export function LeaguePage() {
  const queryClient = useQueryClient();
  const standings = useQuery({ queryKey: ["standings"], queryFn: api.getStandings, staleTime: 120_000, refetchInterval: 120_000 });
  const transactions = useQuery({ queryKey: ["transactions"], queryFn: () => api.getTransactions("all", "25"), staleTime: 120_000 });
  const trades = useQuery({ queryKey: ["pendingTrades"], queryFn: api.getPendingTrades, staleTime: 120_000 });
  const history = useQuery({ queryKey: ["leagueHistory"], queryFn: api.getLeagueHistory, staleTime: 600_000 });
  const powerRankings = useQuery({ queryKey: ["powerRankings"], queryFn: api.getPowerRankings, staleTime: 300_000 });
  const positionalRanks = useQuery({ queryKey: ["positionalRanks"], queryFn: api.getPositionalRanks, staleTime: 300_000 });
  const leagueCtx = useQuery({ queryKey: ["leagueContext"], queryFn: api.getLeagueContext, staleTime: 600_000 });

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const acceptTrade = useMutation({
    mutationFn: (id: string) => api.acceptTrade(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pendingTrades"] }); toast.success("Trade accepted!"); },
    onError: (err: Error) => toast.error("Failed: " + err.message),
  });

  const rejectTrade = useMutation({
    mutationFn: (id: string) => api.rejectTrade(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["pendingTrades"] }); toast.success("Trade rejected."); },
    onError: (err: Error) => toast.error("Failed: " + err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <Heading>League</Heading>
        {leagueCtx.data && (
          <Text>
            {leagueCtx.data.num_teams} teams · {leagueCtx.data.scoring_type} ·{" "}
            {leagueCtx.data.uses_faab ? `FAAB ($${leagueCtx.data.faab_balance ?? 0})` : leagueCtx.data.waiver_type}
          </Text>
        )}
      </div>

      <TabGroup>
        <TabList className="flex gap-1 border-b border-zinc-950/10 dark:border-white/10 pb-px">
          {tabs.map((tab) => (
            <Tab
              key={tab}
              className={({ selected }) =>
                clsx(
                  "px-3 py-2 text-sm font-medium rounded-t-lg transition-colors outline-none",
                  selected
                    ? "text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400 -mb-px"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                )
              }
            >
              {tab}
            </Tab>
          ))}
        </TabList>

        <TabPanels className="mt-4">
          {/* Standings */}
          <TabPanel>
            {standings.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : standings.data && standings.data.length > 0 ? (
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>Team</TableHeader>
                    <TableHeader className="text-right">W-L</TableHeader>
                    <TableHeader className="text-right">GB</TableHeader>
                    <TableHeader className="text-right hidden sm:table-cell">Playoff%</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {standings.data.map((s) => (
                    <>
                    <TableRow key={s.team} onClick={() => setExpandedTeam(expandedTeam === s.team ? null : s.team)} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <TableCell className="tabular-nums text-sm font-medium text-zinc-500">{s.rank}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TeamAvatar teamName={s.team} teamLogoUrl={s.team_logo} size="sm" />
                          <span className="font-medium text-sm text-zinc-950 dark:text-white">{s.team}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {s.wins}-{s.losses}
                        {s.ties > 0 && `-${s.ties}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-zinc-500">
                        {s.gb === 0 ? "–" : s.gb.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm hidden sm:table-cell">
                        {s.playoffPct > 0 ? (
                          <Badge color={s.playoffPct >= 50 ? "green" : s.playoffPct >= 25 ? "amber" : "red"} className="text-xs">
                            {s.playoffPct.toFixed(0)}%
                          </Badge>
                        ) : (
                          <span className="text-zinc-400">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedTeam === s.team && Object.keys(s.categories).length > 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="!p-0">
                          <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30">
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2">
                              {Object.entries(s.categories).map(([cat, data]) => (
                                <div key={cat} className="text-center">
                                  <p className="text-[10px] text-zinc-400 uppercase">{cat}</p>
                                  <p className="text-xs font-medium text-zinc-900 dark:text-white tabular-nums">{typeof data.value === "number" ? data.value.toFixed(data.value % 1 !== 0 ? 3 : 0) : data.value}</p>
                                  <Badge color={data.rank <= 3 ? "green" : data.rank >= 10 ? "red" : "zinc"} className="text-[9px]">#{data.rank}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Text className="text-center py-8">No standings data available.</Text>
            )}
          </TabPanel>

          {/* Power Rankings */}
          <TabPanel>
            {powerRankings.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : Array.isArray(powerRankings.data) && powerRankings.data.length > 0 ? (
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>Team</TableHeader>
                    <TableHeader className="text-right">Score</TableHeader>
                    <TableHeader className="text-right hidden sm:table-cell">Record</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {powerRankings.data.map((pr: any) => (
                    <TableRow key={pr.team || pr.rank}>
                      <TableCell className="tabular-nums text-sm font-medium text-zinc-500">{pr.rank}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TeamAvatar teamName={pr.team} teamLogoUrl={pr.team_logo} size="sm" />
                          <span className="font-medium text-sm text-zinc-950 dark:text-white">{pr.team}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {pr.score != null ? Number(pr.score).toFixed(1) : "–"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-zinc-500 hidden sm:table-cell">
                        {pr.record || "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Text className="text-center py-8">No power rankings data available.</Text>
            )}
          </TabPanel>

          {/* Positional Ranks */}
          <TabPanel>
            {positionalRanks.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : positionalRanks.data?.teams && positionalRanks.data.teams.length > 0 ? (
              <div className="space-y-6">
                {positionalRanks.data.teams.map((team: any) => (
                  <div key={team.team_key || team.name} className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TeamAvatar teamName={team.name} teamLogoUrl={team.team_logo} size="sm" />
                      <span className="font-medium text-sm text-zinc-950 dark:text-white">{team.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(team.positional_ranks || []).map((pr: any) => (
                        <Badge
                          key={pr.position}
                          color={pr.grade === "strong" ? "green" : pr.grade === "weak" ? "red" : "zinc"}
                          className="text-xs"
                        >
                          {pr.position}: #{pr.rank}
                        </Badge>
                      ))}
                    </div>
                    {team.recommended_trade_partners && team.recommended_trade_partners.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-2">
                        Trade targets: {team.recommended_trade_partners.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Text className="text-center py-8">No positional rank data available.</Text>
            )}
          </TabPanel>

          {/* Transactions */}
          <TabPanel>
            {transactions.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : (
              <div className="space-y-2">
                {(Array.isArray(transactions.data) ? transactions.data : []).map((tx: any, i: number) => {
                  const players = tx.players || [];
                  const timestamp = tx.timestamp ? new Date(Number(tx.timestamp) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
                  const txType = tx.type || "?";

                  return (
                    <div key={i} className="rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <Badge color={txType.includes("trade") ? "purple" : "zinc"} className="text-xs">{txType}</Badge>
                        {timestamp && <span className="text-xs text-zinc-400 dark:text-zinc-500">{timestamp}</span>}
                      </div>
                      <div className="space-y-0.5">
                        {players.length > 0 ? players.map((p: any, j: number) => (
                          <div key={j} className="flex items-center gap-1.5 text-sm">
                            <span className={`text-xs font-medium ${p.move_type === "add" ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                              {p.move_type === "add" ? "+" : "−"}
                            </span>
                            <span className="text-zinc-900 dark:text-zinc-100 font-medium">{p.name}</span>
                            <span className="text-xs text-zinc-500">{p.team_abbr} · {p.position}</span>
                            {p.dest_team && <span className="text-xs text-zinc-400">→ {p.dest_team}</span>}
                          </div>
                        )) : (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">{tx.player || "Unknown transaction"}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!transactions.data || (Array.isArray(transactions.data) && transactions.data.length === 0)) && (
                  <Text className="text-center py-8">No recent transactions.</Text>
                )}
              </div>
            )}
          </TabPanel>

          {/* Trades */}
          <TabPanel>
            {trades.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : trades.data && trades.data.length > 0 ? (
              <div className="space-y-4">
                {trades.data.map((trade) => (
                  <div key={trade.id} className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Subheading>Trade with {trade.partner}</Subheading>
                      <Badge color={trade.status === "pending" ? "amber" : trade.status === "accepted" ? "green" : "red"}>
                        {trade.status}
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">You Send</p>
                        {trade.sending.map((p) => (
                          <p key={p.name} className="text-sm text-zinc-950 dark:text-white">{p.name} ({p.position})</p>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">You Receive</p>
                        {trade.receiving.map((p) => (
                          <p key={p.name} className="text-sm text-zinc-950 dark:text-white">{p.name} ({p.position})</p>
                        ))}
                      </div>
                    </div>
                    {trade.analysis && <Text>{trade.analysis}</Text>}
                    {trade.grade && (
                      <Badge color={trade.grade.includes("A") ? "green" : trade.grade.includes("B") ? "amber" : "red"}>
                        Grade: {trade.grade}
                      </Badge>
                    )}
                    {trade.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          color="emerald"
                          onClick={() => acceptTrade.mutate(trade.id)}
                          disabled={acceptTrade.isPending}
                        >
                          Accept
                        </Button>
                        <Button
                          color="red"
                          onClick={() => rejectTrade.mutate(trade.id)}
                          disabled={rejectTrade.isPending}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Text className="text-center py-8">No pending trades.</Text>
            )}
          </TabPanel>

          {/* History */}
          <TabPanel>
            {history.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : history.data && history.data.length > 0 ? (
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>Season</TableHeader>
                    <TableHeader>Record</TableHeader>
                    <TableHeader>Finish</TableHeader>
                    <TableHeader>Champion</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.data.map((season) => (
                    <TableRow key={season.season}>
                      <TableCell className="tabular-nums font-medium">{season.season}</TableCell>
                      <TableCell className="tabular-nums">
                        {season.wins}-{season.losses}
                      </TableCell>
                      <TableCell>
                        {season.rank > 0 ? (
                          <Badge color={season.rank <= 3 ? "green" : "zinc"}>
                            #{season.rank}
                          </Badge>
                        ) : (
                          "–"
                        )}
                      </TableCell>
                      <TableCell className="text-zinc-500 dark:text-zinc-400">
                        {season.champion || "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Text className="text-center py-8">No league history available.</Text>
            )}
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}

