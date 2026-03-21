import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Heading, Subheading } from "@/catalyst/heading";
import { Text } from "@/catalyst/text";
import { Badge } from "@/catalyst/badge";
import { Button } from "@/catalyst/button";
import { Input } from "@/catalyst/input";
import { TeamAvatar } from "@/components/team-avatar";
import { CategorySimResult, useCategorySim } from "@/components/category-sim";
import clsx from "clsx";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import * as api from "@/lib/api";

const tabs = ["Trade Finder", "Trade Evaluator", "Category Tracker", "Playoff Planner"];

export function StrategyPage() {
  return (
    <div className="space-y-6">
      <Heading>Strategy</Heading>

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
          <TradeFinderPanel />
          <TradeEvalPanel />
          <CategoryTrackerPanel />
          <PlayoffPlannerPanel />
        </TabPanels>
      </TabGroup>
    </div>
  );
}

// === Trade Finder ===
function TradeFinderPanel() {
  const tradeFinder = useQuery({ queryKey: ["tradeFinder"], queryFn: api.getTradeFinder, staleTime: 300_000 });
  const positionalRanks = useQuery({ queryKey: ["positionalRanks"], queryFn: api.getPositionalRanks, staleTime: 300_000 });

  return (
    <TabPanel className="space-y-6">
      {/* Positional strengths overview */}
      {positionalRanks.data?.teams && (
        <div>
          <Subheading className="mb-3">League Positional Strengths</Subheading>
          <div className="overflow-x-auto">
            <div className="space-y-2">
              {positionalRanks.data.teams.slice(0, 12).map((team) => (
                <div key={team.team_key || team.name} className="flex items-center gap-3">
                  <div className="w-36 shrink-0 flex items-center gap-2">
                    <TeamAvatar teamName={team.name} teamLogoUrl={team.team_logo} size="sm" />
                    <span className="text-xs font-medium text-zinc-900 dark:text-white truncate">{team.name}</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {(team.positional_ranks || []).map((pr) => (
                      <Badge
                        key={pr.position}
                        color={pr.grade === "strong" ? "green" : pr.grade === "weak" ? "red" : "zinc"}
                        className="text-[10px]"
                      >
                        {pr.position} #{pr.rank}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trade recommendations */}
      <div>
        <Subheading className="mb-3">Recommended Trades</Subheading>
        {tradeFinder.isLoading ? (
          <LoadingSkeleton lines={6} height="h-10" />
        ) : tradeFinder.data?.recommendations && tradeFinder.data.recommendations.length > 0 ? (
          <div className="space-y-3">
            {tradeFinder.data.recommendations.map((rec, i) => (
              <div key={i} className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">Trade with {rec.partner}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold text-red-500 uppercase mb-1">You Send</p>
                    {rec.give.map((name, j) => (
                      <p key={j} className="text-sm text-zinc-700 dark:text-zinc-300">{name}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-green-500 uppercase mb-1">You Get</p>
                    {rec.get.map((name, j) => (
                      <p key={j} className="text-sm text-zinc-700 dark:text-zinc-300">{name}</p>
                    ))}
                  </div>
                </div>
                <Text className="text-xs">{rec.rationale}</Text>
              </div>
            ))}
          </div>
        ) : (
          <Text className="text-center py-8">No trade recommendations available. Check back when the season is underway.</Text>
        )}
      </div>
    </TabPanel>
  );
}

// === Trade Evaluator ===
function TradeEvalPanel() {
  const [giveIds, setGiveIds] = useState("");
  const [getIds, setGetIds] = useState("");
  const [evalResult, setEvalResult] = useState<any>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [simName, setSimName] = useState("");
  const { simResult, simLoading, simulate: runSim } = useCategorySim();

  return (
    <TabPanel className="space-y-6">
      <div className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-4">
        <Subheading>Evaluate a Trade</Subheading>
        <Text className="text-xs">Enter player IDs or names (comma-separated) for each side.</Text>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">You Give</label>
            <Input
              type="text"
              placeholder="Player IDs (comma-sep)"
              value={giveIds}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGiveIds(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 mb-1 block">You Get</label>
            <Input
              type="text"
              placeholder="Player IDs (comma-sep)"
              value={getIds}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGetIds(e.target.value)}
            />
          </div>
        </div>
        <Button
          color="emerald"
          disabled={evalLoading || !giveIds.trim() || !getIds.trim()}
          onClick={async () => {
            setEvalLoading(true);
            try {
              const result = await api.tradeEval(giveIds.trim(), getIds.trim());
              setEvalResult(result);
            } catch (err: any) {
              setEvalResult({ error: err.message || "Evaluation failed" });
            }
            setEvalLoading(false);
          }}
        >
          {evalLoading ? "Evaluating…" : "Evaluate Trade"}
        </Button>

        {evalResult && !evalResult.error && (
          <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              {evalResult.grade && (
                <Badge
                  color={evalResult.grade.includes("A") ? "green" : evalResult.grade.includes("B") ? "amber" : "red"}
                  className="text-lg px-3 py-1"
                >
                  {evalResult.grade}
                </Badge>
              )}
              <div>
                {evalResult.give_value != null && (
                  <p className="text-xs text-zinc-500">Give: {Number(evalResult.give_value).toFixed(1)} | Get: {Number(evalResult.get_value).toFixed(1)}</p>
                )}
              </div>
            </div>
            {evalResult.analysis && <Text>{evalResult.analysis}</Text>}
            {/* Render additional fields */}
            {Object.entries(evalResult)
              .filter(([k]) => !["grade", "analysis", "give_value", "get_value", "error", "status"].includes(k))
              .map(([key, val]) => (
                <div key={key} className="text-sm">
                  <span className="text-xs font-semibold text-zinc-500 uppercase">{key.replace(/_/g, " ")}: </span>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {typeof val === "object" ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              ))}
          </div>
        )}
        {evalResult?.error && <Text className="text-red-500 text-sm">{evalResult.error}</Text>}
      </div>

      {/* Category Impact Simulator */}
      <div className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-3">
        <Subheading>Category Impact</Subheading>
        <Text className="text-xs">Simulate how adding a player affects your category standings.</Text>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (simName.trim()) runSim(simName.trim());
          }}
          className="flex gap-2"
        >
          <Input
            type="text"
            placeholder="Player name"
            value={simName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSimName(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" outline disabled={simLoading || !simName.trim()}>
            {simLoading ? "…" : "Simulate"}
          </Button>
        </form>
        <CategorySimResult result={simResult} />
      </div>
    </TabPanel>
  );
}

// === Category Tracker ===
function CategoryTrackerPanel() {
  const categoryCheck = useQuery({ queryKey: ["categoryCheck"], queryFn: api.getCategoryCheck, staleTime: 120_000 });
  const categoryTrends = useQuery({ queryKey: ["categoryTrends"], queryFn: api.getCategoryTrends, staleTime: 300_000 });
  const puntAdvisor = useQuery({ queryKey: ["puntAdvisor"], queryFn: api.getPuntAdvisor, staleTime: 300_000 });

  return (
    <TabPanel className="space-y-6">
      {/* Category performance gauges */}
      <div>
        <Subheading className="mb-3">Category Performance</Subheading>
        {categoryCheck.isLoading ? (
          <LoadingSkeleton lines={6} height="h-10" />
        ) : Array.isArray(categoryCheck.data) && categoryCheck.data.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {categoryCheck.data.map((cat) => {
              const pct = cat.target > 0 ? Math.min((cat.value / cat.target) * 100, 100) : 0;
              return (
                <div key={cat.category} className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{cat.category}</span>
                    <div className="flex items-center gap-2">
                      <Badge
                        color={cat.rank <= 3 ? "green" : cat.rank <= 6 ? "amber" : "red"}
                        className="text-[10px]"
                      >
                        #{cat.rank}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className={clsx(
                          "h-full rounded-full transition-all",
                          cat.rank <= 3 ? "bg-green-500" : cat.rank <= 6 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-zinc-500 w-20 text-right">
                      {typeof cat.value === "number" ? cat.value.toFixed(cat.value % 1 !== 0 ? 3 : 0) : cat.value}
                      {cat.target > 0 && <span className="text-zinc-400"> / {cat.target.toFixed(cat.target % 1 !== 0 ? 3 : 0)}</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Text className="text-center py-8">No category data available yet.</Text>
        )}
      </div>

      {/* Category Trends */}
      {Array.isArray(categoryTrends.data) && categoryTrends.data.length > 0 && (
        <div>
          <Subheading className="mb-3">Category Trends</Subheading>
          <div className="space-y-2">
            {categoryTrends.data.slice(0, 10).map((trend) => (
              <div key={trend.category} className="text-sm">
                <span className="font-medium text-zinc-900 dark:text-white">{trend.category}: </span>
                <span className="text-zinc-500">
                  {(trend.values || []).slice(-5).map((v) => v.value.toFixed(1)).join(" → ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Punt Advisor */}
      {puntAdvisor.data && (
        <div className="rounded-lg border border-purple-500/10 bg-purple-50/50 dark:bg-purple-950/10 p-4 space-y-2">
          <Subheading>Punt Advisor</Subheading>
          {puntAdvisor.data.recommended_punts && puntAdvisor.data.recommended_punts.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {puntAdvisor.data.recommended_punts.map((cat) => (
                  <Badge key={cat} color="purple" className="text-xs">{cat}</Badge>
                ))}
              </div>
              {puntAdvisor.data.analysis && <Text className="text-xs">{puntAdvisor.data.analysis}</Text>}
            </>
          ) : (
            <Text className="text-xs">No punt recommendations — you're competitive across all categories.</Text>
          )}
        </div>
      )}
    </TabPanel>
  );
}

// === Playoff Planner ===
function PlayoffPlannerPanel() {
  const playoffPlanner = useQuery({ queryKey: ["playoffPlanner"], queryFn: api.getPlayoffPlanner, staleTime: 300_000 });
  const seasonPace = useQuery({ queryKey: ["seasonPace"], queryFn: api.getSeasonPace, staleTime: 300_000 });
  const scheduleAnalysis = useQuery({ queryKey: ["scheduleAnalysis"], queryFn: api.getScheduleAnalysis, staleTime: 300_000 });

  return (
    <TabPanel className="space-y-6">
      {/* Playoff probability */}
      <div className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-3">
        <Subheading>Playoff Outlook</Subheading>
        {playoffPlanner.isLoading ? (
          <LoadingSkeleton lines={6} height="h-10" />
        ) : playoffPlanner.data ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              {playoffPlanner.data.playoff_probability != null && (
                <div className="text-center">
                  <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {(playoffPlanner.data.playoff_probability * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-zinc-500">Playoff Prob.</p>
                </div>
              )}
              {playoffPlanner.data.current_seed != null && (
                <div className="text-center">
                  <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    #{playoffPlanner.data.current_seed}
                  </p>
                  <p className="text-xs text-zinc-500">Current Seed</p>
                </div>
              )}
              {playoffPlanner.data.schedule_strength != null && (
                <div className="text-center">
                  <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">
                    {playoffPlanner.data.schedule_strength.toFixed(1)}
                  </p>
                  <p className="text-xs text-zinc-500">SOS</p>
                </div>
              )}
            </div>
            {playoffPlanner.data.recommendations && (
              <ul className="space-y-1">
                {playoffPlanner.data.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300">• {rec}</li>
                ))}
              </ul>
            )}
            {/* Render other fields */}
            {Object.entries(playoffPlanner.data)
              .filter(([k]) => !["playoff_probability", "current_seed", "schedule_strength", "recommendations"].includes(k))
              .map(([key, val]) => (
                <div key={key} className="text-sm">
                  <span className="text-xs font-semibold text-zinc-500 uppercase">{key.replace(/_/g, " ")}: </span>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {typeof val === "object" ? JSON.stringify(val) : String(val)}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <Text className="text-center py-4">No playoff data available yet.</Text>
        )}
      </div>

      {/* Season Pace */}
      {seasonPace.data?.categories && seasonPace.data.categories.length > 0 && (
        <div>
          <Subheading className="mb-3">Season Pace</Subheading>
          <div className="space-y-2">
            {seasonPace.data.categories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-3 text-sm">
                <span className="w-12 text-zinc-500 text-xs">{cat.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={clsx(
                      "h-full rounded-full",
                      cat.on_track ? "bg-green-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min((cat.current / (cat.target || 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums w-16 text-right text-zinc-700 dark:text-zinc-300">
                  {cat.pace.toFixed(1)}
                </span>
                <Badge color={cat.on_track ? "green" : "red"} className="text-[10px]">
                  {cat.on_track ? "On Pace" : "Behind"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Analysis */}
      {scheduleAnalysis.data?.weeks && scheduleAnalysis.data.weeks.length > 0 && (
        <div>
          <Subheading className="mb-3">Schedule Ahead</Subheading>
          <div className="space-y-1.5">
            {scheduleAnalysis.data.weeks.slice(0, 8).map((w) => (
              <div key={w.week} className="flex items-center gap-3 text-sm">
                <span className="w-14 text-zinc-500 text-xs">Wk {w.week}</span>
                <span className="flex-1 text-zinc-900 dark:text-white font-medium">{w.opponent}</span>
                <Badge
                  color={w.difficulty === "easy" ? "green" : w.difficulty === "hard" ? "red" : "zinc"}
                  className="text-[10px]"
                >
                  {w.difficulty}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </TabPanel>
  );
}

