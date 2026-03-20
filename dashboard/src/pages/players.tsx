import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Heading } from "@/catalyst/heading";
import { Text } from "@/catalyst/text";
import { Badge } from "@/catalyst/badge";
import { Button } from "@/catalyst/button";
import { Input, InputGroup } from "@/catalyst/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/catalyst/table";
import { MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/player-avatar";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import * as api from "@/lib/api";
import type { PlayerListEntry } from "@/lib/api";
import clsx from "clsx";

const BATTER_POSITIONS = ["B", "C", "1B", "2B", "SS", "3B", "OF", "Util"];
const PITCHER_POSITIONS = ["P", "SP", "RP"];
const ALL_POSITIONS = [...BATTER_POSITIONS, ...PITCHER_POSITIONS];

const BATTER_STATS = ["R", "H", "HR", "RBI", "K", "TB", "AVG", "OBP", "XBH", "NSB"];
const PITCHER_STATS = ["IP", "W", "L", "ER", "K", "HLD", "ERA", "WHIP", "QS", "NSV"];

const POS_LABELS: Record<string, string> = { B: "All Batters", P: "All Pitchers" };

type SortCol = "name" | "percent_owned" | "percent_started" | "preseason_pick" | "current_pick" | string;
type SortDir = "asc" | "desc";

function getSortValue(p: PlayerListEntry, col: SortCol): number | string {
  if (col === "name") return p.name.toLowerCase();
  if (col === "percent_owned") return p.percent_owned ?? -1;
  if (col === "percent_started") return p.percent_started ?? -1;
  if (col === "preseason_pick") return p.preseason_pick ?? 9999;
  if (col === "current_pick") return p.current_pick ?? 9999;
  if (col.startsWith("stat_")) {
    const key = col.slice(5);
    const val = p.stats?.[key];
    if (val == null) return -99999;
    const num = parseFloat(String(val));
    return isNaN(num) ? -99999 : num;
  }
  return 0;
}

function isBatterPos(pos: string) {
  return BATTER_POSITIONS.includes(pos);
}

const tabs = ["Player List", "Rankings", "Trends", "Breakouts", "Compare"];

export function PlayersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [posType, setPosType] = useState("B");
  const [count, setCount] = useState(50);
  const [status, setStatus] = useState("FA");
  const [sortCol, setSortCol] = useState<SortCol>("percent_owned");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [comparePlayer1, setComparePlayer1] = useState("");
  const [comparePlayer2, setComparePlayer2] = useState("");
  const [compareResult, setCompareResult] = useState<any>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const playerList = useQuery({
    queryKey: ["playerList", posType, count, status],
    queryFn: () => api.getPlayerList(posType, count, status),
    staleTime: 120_000,
  });

  const rankings = useQuery({ queryKey: ["rankings"], queryFn: api.getRankings, staleTime: 300_000 });
  const trends = useQuery({ queryKey: ["transactionTrends"], queryFn: api.getTransactionTrends, staleTime: 300_000 });
  const breakouts = useQuery({ queryKey: ["breakouts"], queryFn: api.getBreakoutCandidates, staleTime: 300_000 });
  const busts = useQuery({ queryKey: ["busts"], queryFn: api.getBustCandidates, staleTime: 300_000 });

  const addMutation = useMutation({
    mutationFn: (name: string) => api.addPlayer(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      queryClient.invalidateQueries({ queryKey: ["playerList"] });
      toast.success(`Added ${name}!`);
    },
    onError: (err: Error) => toast.error("Failed to add: " + err.message),
  });

  const isBatter = isBatterPos(posType);
  const statKeys = isBatter ? BATTER_STATS : PITCHER_STATS;

  const players = useMemo(() => {
    const raw = playerList.data?.players ?? [];
    const filtered = search
      ? raw.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : raw;
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, sortCol);
      const bv = getSortValue(b, sortCol);
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sortDir === "asc") return av < bv ? -1 : 1;
      return av > bv ? -1 : 1;
    });
  }, [playerList.data, search, sortCol, sortDir]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir(col === "name" ? "asc" : "desc");
    }
  }

  function handlePosChange(pos: string) {
    setPosType(pos);
    setCount(50);
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return null;
    return sortDir === "asc"
      ? <ChevronUpIcon className="inline h-3.5 w-3.5 -mt-0.5" />
      : <ChevronDownIcon className="inline h-3.5 w-3.5 -mt-0.5" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Heading>Players</Heading>
        <div className="w-64">
          <InputGroup>
            <MagnifyingGlassIcon data-slot="icon" />
            <Input
              type="search"
              placeholder="Search players…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
          </InputGroup>
        </div>
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
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-px"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                )
              }
            >
              {tab}
            </Tab>
          ))}
        </TabList>

        <TabPanels className="mt-4">
          {/* Player List */}
          <TabPanel>
            {/* Status filter */}
            <div className="flex gap-1.5 mb-3">
              {["FA", "W", "ALL"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setCount(50); }}
                  className={clsx(
                    "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                    status === s
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  )}
                >
                  {s === "FA" ? "Free Agents" : s === "W" ? "Waivers" : "All Players"}
                </button>
              ))}
            </div>

            {/* Position filter pills */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {ALL_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => handlePosChange(pos)}
                  className={clsx(
                    "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                    posType === pos
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  )}
                >
                  {POS_LABELS[pos] || pos}
                </button>
              ))}
            </div>

            {playerList.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table dense>
                    <TableHead>
                      <TableRow>
                        <TableHeader>
                          <SortButton col="name" label="Player" onSort={handleSort}>
                            <SortIcon col="name" />
                          </SortButton>
                        </TableHeader>
                        <TableHeader>Pos</TableHeader>
                        <TableHeader className="hidden md:table-cell">Opp</TableHeader>
                        <TableHeader className="text-right hidden lg:table-cell">
                          <SortButton col="preseason_pick" label="Pre ADP" onSort={handleSort}>
                            <SortIcon col="preseason_pick" />
                          </SortButton>
                        </TableHeader>
                        <TableHeader className="text-right hidden lg:table-cell">
                          <SortButton col="current_pick" label="Curr ADP" onSort={handleSort}>
                            <SortIcon col="current_pick" />
                          </SortButton>
                        </TableHeader>
                        <TableHeader className="text-right">
                          <SortButton col="percent_owned" label="Own%" onSort={handleSort}>
                            <SortIcon col="percent_owned" />
                          </SortButton>
                        </TableHeader>
                        <TableHeader className="text-right hidden md:table-cell">
                          <SortButton col="percent_started" label="Start%" onSort={handleSort}>
                            <SortIcon col="percent_started" />
                          </SortButton>
                        </TableHeader>
                        {statKeys.map((key) => (
                          <TableHeader key={key} className="text-right hidden xl:table-cell">
                            <SortButton col={`stat_${key}`} label={key} onSort={handleSort}>
                              <SortIcon col={`stat_${key}`} />
                            </SortButton>
                          </TableHeader>
                        ))}
                        <TableHeader>Status</TableHeader>
                        <TableHeader className="text-right">Action</TableHeader>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {players.map((p) => {
                        const positions = p.eligible_positions?.join(", ") || "";
                        const isRostered = p.roster_status && p.roster_status !== "FA";
                        return (
                          <TableRow key={p.player_id} className={isRostered ? "opacity-60" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <PlayerAvatar name={p.name} mlbId={p.mlb_id} size="sm" />
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-zinc-950 dark:text-white truncate">{p.name}</p>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{p.team}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-0.5 flex-wrap">
                                {positions.split(",").map((pos) => {
                                  const trimmed = pos.trim();
                                  return trimmed ? (
                                    <Badge key={trimmed} color="zinc" className="text-[10px]">{trimmed}</Badge>
                                  ) : null;
                                })}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-zinc-600 dark:text-zinc-400">
                              {p.opponent || <span className="text-zinc-400 dark:text-zinc-600">OFF</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs hidden lg:table-cell">
                              {p.preseason_pick != null ? p.preseason_pick : "–"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs hidden lg:table-cell">
                              {p.current_pick != null ? p.current_pick : "–"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {p.percent_owned != null ? `${p.percent_owned}%` : "–"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-xs hidden md:table-cell">
                              {p.percent_started != null ? `${p.percent_started}%` : "–"}
                            </TableCell>
                            {statKeys.map((key) => {
                              const val = p.stats?.[key];
                              return (
                                <TableCell key={key} className="text-right tabular-nums text-xs hidden xl:table-cell">
                                  {val != null ? String(val) : "–"}
                                </TableCell>
                              );
                            })}
                            <TableCell>
                              {p.status && p.status !== "Healthy" ? (
                                <Badge color="red" className="text-[10px]">{p.status}</Badge>
                              ) : isRostered ? (
                                <Badge color="zinc" className="text-[10px]">Rostered</Badge>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right">
                              {!isRostered && (
                                <Button
                                  color="emerald"
                                  className="!px-2 !py-1 text-xs"
                                  onClick={() => addMutation.mutate(p.name)}
                                  disabled={addMutation.isPending}
                                >
                                  + Add
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <Text className="text-xs">{players.length} players</Text>
                  {players.length >= 20 && (
                    <Button
                      outline
                      className="text-xs"
                      onClick={() => setCount((c) => c + 50)}
                      disabled={playerList.isFetching}
                    >
                      {playerList.isFetching ? "Loading…" : "Load More"}
                    </Button>
                  )}
                </div>

                {players.length === 0 && !playerList.isLoading && (
                  <Text className="text-center py-8">No players found.</Text>
                )}
              </>
            )}
          </TabPanel>

          {/* Rankings */}
          <TabPanel>
            {rankings.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : rankings.data?.players ? (
              <Table dense>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>Player</TableHeader>
                    <TableHeader>Pos</TableHeader>
                    <TableHeader className="text-right">Value</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rankings.data.players.slice(0, 30).map((p: any) => (
                    <TableRow key={p.name}>
                      <TableCell className="tabular-nums text-sm text-zinc-500">{p.rank}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PlayerAvatar name={p.name} mlbId={p.mlb_id} size="sm" />
                          <div>
                            <p className="font-medium text-sm text-zinc-950 dark:text-white">{p.name}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{p.team}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge color="zinc" className="text-xs">{p.pos || p.position || "–"}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {(p.z_score ?? p.value ?? 0).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Text className="text-center py-8">No rankings data available.</Text>
            )}
          </TabPanel>

          {/* Trends */}
          <TabPanel>
            {trends.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : trends.data ? (
              <div className="space-y-4">
                {renderTrends(trends.data)}
              </div>
            ) : (
              <Text className="text-center py-8">No trend data available.</Text>
            )}
          </TabPanel>

          {/* Breakouts */}
          <TabPanel>
            {breakouts.isLoading ? (
              <LoadingSkeleton lines={8} height="h-12" />
            ) : (
              <div className="space-y-6">
                {breakouts.data && breakouts.data.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                      Breakout Candidates
                    </p>
                    <div className="space-y-2">
                      {breakouts.data.slice(0, 10).map((c: any, i: number) => {
                        const name = c.player?.name || c.name || "Unknown";
                        const mlbId = c.player?.mlb_id || c.mlb_id;
                        const team = c.player?.team || c.team || "";
                        const position = c.player?.position || c.position || "";
                        const conf = c.confidence != null ? (c.confidence * 100).toFixed(0) : c.diff != null ? (c.diff * 100).toFixed(0) : null;
                        return (
                        <div key={i} className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <PlayerAvatar name={name} mlbId={mlbId} size="sm" />
                              <div>
                                <p className="font-medium text-sm text-zinc-950 dark:text-white">{name}</p>
                                {(team || position) && <p className="text-xs text-zinc-500 dark:text-zinc-400">{[team, position].filter(Boolean).join(" · ")}</p>}
                              </div>
                            </div>
                            {conf && <Badge color="green" className="text-xs">{conf}%</Badge>}
                          </div>
                          {c.reason && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{c.reason}</p>}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {busts.data && busts.data.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                      Bust Candidates
                    </p>
                    <div className="space-y-2">
                      {busts.data.slice(0, 10).map((c: any, i: number) => {
                        const name = c.player?.name || c.name || "Unknown";
                        const mlbId = c.player?.mlb_id || c.mlb_id;
                        const team = c.player?.team || c.team || "";
                        const position = c.player?.position || c.position || "";
                        const conf = c.confidence != null ? (c.confidence * 100).toFixed(0) : c.diff != null ? (Math.abs(c.diff) * 100).toFixed(0) : null;
                        return (
                        <div key={i} className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <PlayerAvatar name={name} mlbId={mlbId} size="sm" />
                              <div>
                                <p className="font-medium text-sm text-zinc-950 dark:text-white">{name}</p>
                                {(team || position) && <p className="text-xs text-zinc-500 dark:text-zinc-400">{[team, position].filter(Boolean).join(" · ")}</p>}
                              </div>
                            </div>
                            {conf && <Badge color="red" className="text-xs">{conf}%</Badge>}
                          </div>
                          {c.reason && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{c.reason}</p>}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(!breakouts.data || breakouts.data.length === 0) &&
                  (!busts.data || busts.data.length === 0) && (
                    <Text className="text-center py-8">No breakout/bust data available.</Text>
                  )}
              </div>
            )}
          </TabPanel>

          {/* Compare */}
          <TabPanel>
            <div className="space-y-4">
              <div className="flex gap-3 flex-col sm:flex-row">
                <div className="flex-1">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">Player 1</label>
                  <Input
                    type="text"
                    placeholder="e.g. Mookie Betts"
                    value={comparePlayer1}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComparePlayer1(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1 block">Player 2</label>
                  <Input
                    type="text"
                    placeholder="e.g. Trea Turner"
                    value={comparePlayer2}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComparePlayer2(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    color="blue"
                    disabled={compareLoading || !comparePlayer1.trim() || !comparePlayer2.trim()}
                    onClick={async () => {
                      setCompareLoading(true);
                      try {
                        const result = await api.comparePlayers(comparePlayer1.trim(), comparePlayer2.trim());
                        setCompareResult(result);
                      } catch (err: any) {
                        setCompareResult({ error: err.message || "Comparison failed" });
                      }
                      setCompareLoading(false);
                    }}
                  >
                    {compareLoading ? "Comparing\u2026" : "Compare"}
                  </Button>
                </div>
              </div>
              {compareResult && !compareResult.error && (
                <div className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4">
                  <div className="space-y-2">
                    {Object.entries(compareResult)
                      .filter(([k]) => !["error", "status"].includes(k))
                      .map(([key, val]) => (
                        <div key={key} className="text-sm">
                          <span className="text-xs font-semibold text-zinc-500 uppercase">{key.replace(/_/g, " ")}: </span>
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {compareResult?.error && (
                <div className="rounded-lg border border-red-500/20 bg-red-50 dark:bg-red-950/20 p-3">
                  <Text className="text-red-500 text-sm">{compareResult.error}</Text>
                </div>
              )}
              {!compareResult && (
                <Text className="text-center py-8">Enter two player names to compare them side by side.</Text>
              )}
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}

function SortButton({ col, label, onSort, children }: {
  col: SortCol;
  label: string;
  onSort: (col: SortCol) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="inline-flex items-center gap-0.5 cursor-pointer select-none hover:text-zinc-950 dark:hover:text-white transition-colors"
      onClick={() => onSort(col)}
    >
      {label} {children}
    </button>
  );
}

function renderTrends(data: any) {
  const trending = data.most_added || data.trending_up || data.adds || [];
  const cooling = data.most_dropped || data.trending_down || data.drops || [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Trending Up
        </p>
        {Array.isArray(trending) && trending.length > 0 ? (
          <div className="space-y-1.5">
            {trending.slice(0, 10).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                <PlayerAvatar name={p.name} mlbId={p.mlb_id} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-zinc-950 dark:text-white font-medium">{p.name}</span>
                  <span className="text-xs text-zinc-400 ml-1.5">{p.position} · {p.team}</span>
                </div>
                <Badge color="green" className="text-xs tabular-nums">
                  {p.percent_owned != null ? `${p.percent_owned}%` : "–"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <Text>No trending data</Text>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          Trending Down
        </p>
        {Array.isArray(cooling) && cooling.length > 0 ? (
          <div className="space-y-1.5">
            {cooling.slice(0, 10).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-sm rounded-md bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                <PlayerAvatar name={p.name} mlbId={p.mlb_id} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-zinc-950 dark:text-white font-medium">{p.name}</span>
                  <span className="text-xs text-zinc-400 ml-1.5">{p.position} · {p.team}</span>
                </div>
                <Badge color="red" className="text-xs tabular-nums">
                  {p.percent_owned != null ? `${p.percent_owned}%` : "–"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <Text>No cooling data</Text>
        )}
      </div>
    </div>
  );
}

