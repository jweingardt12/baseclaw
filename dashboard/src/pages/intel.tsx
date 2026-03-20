import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Heading, Subheading } from "@/catalyst/heading";
import { Text } from "@/catalyst/text";
import { Badge } from "@/catalyst/badge";
import { Button } from "@/catalyst/button";
import { Input, InputGroup } from "@/catalyst/input";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { PlayerAvatar } from "@/components/player-avatar";
import { CategorySimResult, useCategorySim } from "@/components/category-sim";
import { toast } from "sonner";
import clsx from "clsx";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import * as api from "@/lib/api";

const tabs = ["News Feed", "Streaming Pitchers", "Waiver Wire Lab", "Closer Monitor"];

export function IntelPage() {
  return (
    <div className="space-y-6">
      <Heading>Intel</Heading>

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
          <NewsFeedPanel />
          <StreamingPanel />
          <WaiverLabPanel />
          <CloserMonitorPanel />
        </TabPanels>
      </TabGroup>
    </div>
  );
}

// === News Feed ===
function NewsFeedPanel() {
  const [filter, setFilter] = useState("");
  const news = useQuery({ queryKey: ["newsLatest"], queryFn: api.getNewsLatest, staleTime: 300_000 });

  const filteredNews = (news.data ?? []).filter((item) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      item.headline?.toLowerCase().includes(q) ||
      item.playerName?.toLowerCase().includes(q) ||
      item.summary?.toLowerCase().includes(q)
    );
  });

  return (
    <TabPanel className="space-y-4">
      <div className="w-full max-w-sm">
        <InputGroup>
          <MagnifyingGlassIcon data-slot="icon" />
          <Input
            type="search"
            placeholder="Filter news…"
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilter(e.target.value)}
          />
        </InputGroup>
      </div>

      {news.isLoading ? (
        <LoadingSkeleton lines={6} height="h-10" />
      ) : filteredNews.length > 0 ? (
        <div className="space-y-3">
          {filteredNews.map((item, i) => (
            <div key={i} className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-white leading-snug">{item.headline}</p>
                {item.timestamp && (
                  <span className="text-[10px] text-zinc-400 shrink-0 whitespace-nowrap">
                    {new Date(item.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
              {item.summary && (
                <Text className="text-xs leading-relaxed">{item.summary}</Text>
              )}
              <div className="flex items-center gap-2">
                {item.playerName && (
                  <Badge color="blue" className="text-[10px]">{item.playerName}</Badge>
                )}
                {item.source && (
                  <span className="text-[10px] text-zinc-400">{item.source}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Text className="text-center py-8">No news available.</Text>
      )}
    </TabPanel>
  );
}

// === Streaming Pitchers ===
function StreamingPanel() {
  const streaming = useQuery({ queryKey: ["streaming"], queryFn: () => api.getStreaming(), staleTime: 300_000 });
  const probables = useQuery({ queryKey: ["probablePitchers"], queryFn: api.getProbablePitchers, staleTime: 300_000 });

  return (
    <TabPanel className="space-y-6">
      {/* Streaming Recommendations */}
      <div>
        <Subheading className="mb-3">Streaming Recommendations</Subheading>
        {streaming.isLoading ? (
          <LoadingSkeleton lines={6} height="h-10" />
        ) : streaming.data?.recommendations && streaming.data.recommendations.length > 0 ? (
          <div className="space-y-2">
            {streaming.data.recommendations.map((rec, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-950/5 dark:border-white/10 p-3">
                <PlayerAvatar name={rec.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{rec.name}</p>
                  <p className="text-xs text-zinc-500">{rec.team}{rec.games ? ` · ${rec.games} starts` : ""}</p>
                </div>
                {rec.z_score != null && (
                  <Badge color={rec.z_score > 0 ? "green" : "zinc"} className="text-xs tabular-nums">
                    {rec.z_score > 0 ? "+" : ""}{rec.z_score.toFixed(1)}
                  </Badge>
                )}
                {rec["matchup"] != null && (
                  <span className="text-xs text-zinc-500">{String(rec["matchup"])}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Text className="text-center py-4">No streaming recommendations available.</Text>
        )}
        {streaming.data?.team_games && Object.keys(streaming.data.team_games).length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Team Game Counts</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(streaming.data.team_games)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 15)
                .map(([team, count]) => (
                  <Badge key={team} color="zinc" className="text-[10px] tabular-nums">
                    {team}: {String(count)}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Probable Pitchers */}
      <div>
        <Subheading className="mb-3">Probable Pitchers</Subheading>
        {probables.isLoading ? (
          <LoadingSkeleton lines={6} height="h-10" />
        ) : Array.isArray(probables.data) && probables.data.length > 0 ? (
          <div className="space-y-1.5">
            {probables.data.map((p, i) => (
              <div key={i} className="flex items-center gap-3 text-sm py-1.5">
                <PlayerAvatar name={p.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-zinc-900 dark:text-white">{p.name}</span>
                  <span className="text-xs text-zinc-500 ml-1.5">{p.team}</span>
                </div>
                {p.opponent && (
                  <span className="text-xs text-zinc-500">vs {p.opponent}</span>
                )}
                {p.game_time && (
                  <span className="text-[10px] text-zinc-400">{p.game_time}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Text className="text-center py-4">No probable pitchers data.</Text>
        )}
      </div>
    </TabPanel>
  );
}

// === Waiver Wire Lab ===
function WaiverLabPanel() {
  const queryClient = useQueryClient();
  const [posType, setPosType] = useState("B");
  const waivers = useQuery({
    queryKey: ["waiverAnalysis", posType],
    queryFn: () => api.getWaiverAnalysis(posType),
    staleTime: 300_000,
  });
  const ilStash = useQuery({ queryKey: ["ilStash"], queryFn: api.getIlStashAdvisor, staleTime: 300_000 });

  const [simName, setSimName] = useState("");
  const { simResult, simulate: runSim } = useCategorySim();

  const addMutation = useMutation({
    mutationFn: (name: string) => api.addPlayer(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      queryClient.invalidateQueries({ queryKey: ["waiverAnalysis"] });
      toast.success("Added " + name + "!");
    },
    onError: (err: Error) => toast.error("Failed: " + err.message),
  });

  return (
    <TabPanel className="space-y-6">
      {/* Position type toggle */}
      <div className="flex gap-1.5">
        {["B", "P"].map((t) => (
          <button
            key={t}
            onClick={() => setPosType(t)}
            className={clsx(
              "px-3 py-1 text-xs font-medium rounded-full transition-colors",
              posType === t
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
            )}
          >
            {t === "B" ? "Batters" : "Pitchers"}
          </button>
        ))}
      </div>

      {/* Weak categories */}
      {waivers.data?.weak_categories && waivers.data.weak_categories.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Weak Categories</p>
          <div className="flex flex-wrap gap-1.5">
            {waivers.data.weak_categories.map((cat) => (
              <Badge key={cat} color="red" className="text-xs">{cat}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Waiver recommendations */}
      <div>
        <Subheading className="mb-3">Recommendations</Subheading>
        {waivers.isLoading ? (
          <LoadingSkeleton lines={6} height="h-10" />
        ) : waivers.data?.recommendations && waivers.data.recommendations.length > 0 ? (
          <div className="space-y-2">
            {waivers.data.recommendations.map((rec, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-950/5 dark:border-white/10 p-3">
                <PlayerAvatar name={rec.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">{rec.name}</p>
                  <p className="text-xs text-zinc-500">
                    {rec.positions || ""}{rec.pct != null ? ` · ${rec.pct}% owned` : ""}
                  </p>
                  {rec.intel && <p className="text-xs text-zinc-400 mt-0.5">{rec.intel}</p>}
                </div>
                {rec.tier && <Badge color="zinc" className="text-[10px]">{rec.tier}</Badge>}
                <div className="flex gap-1.5">
                  <Button
                    plain
                    className="text-xs"
                    onClick={() => { setSimName(rec.name); runSim(rec.name); }}
                  >
                    Sim
                  </Button>
                  <Button
                    color="emerald"
                    className="!px-2 !py-1 text-xs"
                    onClick={() => addMutation.mutate(rec.name)}
                    disabled={addMutation.isPending}
                  >
                    + Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Text className="text-center py-4">No waiver recommendations available.</Text>
        )}
      </div>

      {/* Simulation result */}
      {simResult && (
        <div className="rounded-lg border border-blue-500/10 bg-blue-50/50 dark:bg-blue-950/10 p-3 space-y-1">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">Simulating: {simName}</p>
          <CategorySimResult result={simResult} />
        </div>
      )}

      {/* Drop candidates */}
      {waivers.data?.drop_candidates && waivers.data.drop_candidates.length > 0 && (
        <div>
          <Subheading className="mb-2">Drop Candidates</Subheading>
          <div className="space-y-1.5">
            {waivers.data.drop_candidates.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-red-500 text-xs font-medium">DROP</span>
                <span className="text-zinc-700 dark:text-zinc-300">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IL Stash */}
      {Array.isArray(ilStash.data) && ilStash.data.length > 0 && (
        <div>
          <Subheading className="mb-2">IL Stash Candidates</Subheading>
          <div className="space-y-1.5">
            {ilStash.data.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-zinc-900 dark:text-white font-medium">{p.name}</span>
                <div className="flex items-center gap-2">
                  {p.return_date && <span className="text-xs text-zinc-500">ETA: {p.return_date}</span>}
                  {p.value != null && <Badge color="zinc" className="text-[10px] tabular-nums">{Number(p.value).toFixed(1)}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </TabPanel>
  );
}

// === Closer Monitor ===
function CloserMonitorPanel() {
  const closers = useQuery({ queryKey: ["closerMonitor"], queryFn: api.getCloserMonitor, staleTime: 300_000 });

  const statusColor = (status: string): "green" | "amber" | "red" | "zinc" => {
    const s = status.toLowerCase();
    if (s.includes("safe") || s.includes("locked")) return "green";
    if (s.includes("shaky") || s.includes("committee")) return "amber";
    if (s.includes("new") || s.includes("change")) return "red";
    return "zinc";
  };

  return (
    <TabPanel className="space-y-4">
      <Subheading>Closer Situations</Subheading>
      {closers.isLoading ? (
        <LoadingSkeleton lines={6} height="h-10" />
      ) : Array.isArray(closers.data) && closers.data.length > 0 ? (
        <div className="space-y-2">
          {closers.data.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-950/5 dark:border-white/10 p-3">
              <div className="w-10 text-center">
                <span className="text-xs font-bold text-zinc-500">{entry.team}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {entry.closer || "Unknown"}
                </p>
                {entry.handcuff && (
                  <p className="text-xs text-zinc-500">Handcuff: {entry.handcuff}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {entry.saves != null && (
                  <span className="text-xs tabular-nums text-zinc-500">{entry.saves} SV</span>
                )}
                <Badge color={statusColor(entry.status)} className="text-[10px]">
                  {entry.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Text className="text-center py-8">No closer monitoring data available.</Text>
      )}
    </TabPanel>
  );
}
