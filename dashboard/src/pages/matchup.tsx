import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heading, Subheading } from "@/catalyst/heading";
import { Text } from "@/catalyst/text";
import { Button } from "@/catalyst/button";
import { Badge } from "@/catalyst/badge";
import { Input, InputGroup } from "@/catalyst/input";
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import { TeamAvatar } from "@/components/team-avatar";
import { CategoryRow } from "@/components/category-row";
import { CategorySimResult, useCategorySim } from "@/components/category-sim";
import * as api from "@/lib/api";

export function MatchupPage() {
  const matchup = useQuery({ queryKey: ["matchup"], queryFn: api.getMatchup, staleTime: 30_000, refetchInterval: 30_000 });
  const scout = useQuery({ queryKey: ["scoutOpponent"], queryFn: api.scoutOpponent, staleTime: 600_000, enabled: !!matchup.data });
  const [showOpponent, setShowOpponent] = useState(false);
  const [simPlayer, setSimPlayer] = useState("");
  const { simResult, simLoading, simulate } = useCategorySim();

  return (
    <div className="space-y-6">
      <Heading>Matchup</Heading>

      {matchup.isLoading ? (
        <div className="space-y-4">
          <div className="h-24 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-64 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        </div>
      ) : matchup.error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-50 dark:bg-red-950/20 p-4">
          <Text className="text-red-600 dark:text-red-400">
            Failed to load matchup. Connect Yahoo to see matchup data.
          </Text>
        </div>
      ) : matchup.data ? (
        <>
          {/* Score header */}
          <div className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TeamAvatar
                  teamName={matchup.data.my_team}
                  teamLogoUrl={matchup.data.my_team_logo}
                  size="lg"
                />
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate max-w-[140px]">
                    {matchup.data.my_team}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">You</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-3xl font-bold tabular-nums">
                <span className="text-green-500">{matchup.data.score.wins}</span>
                <span className="text-zinc-300 dark:text-zinc-600 text-xl">–</span>
                <span className="text-red-500">{matchup.data.score.losses}</span>
                {matchup.data.score.ties > 0 && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-600 text-xl">–</span>
                    <span className="text-zinc-400 text-lg">{matchup.data.score.ties}T</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white truncate max-w-[140px]">
                    {matchup.data.opponent}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Opponent</p>
                </div>
                <TeamAvatar
                  teamName={matchup.data.opponent}
                  teamLogoUrl={matchup.data.opp_team_logo}
                  size="lg"
                />
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-4">
            <Subheading>Category Breakdown</Subheading>
            <div className="space-y-3">
              {matchup.data.categories.map((cat) => (
                <CategoryRow
                  key={cat.name}
                  category={cat.name}
                  myValue={cat.my_value}
                  oppValue={cat.opp_value}
                  result={cat.result}
                />
              ))}
            </div>
          </div>

          {/* AI Strategy */}
          {scout.data && (
            <div className="rounded-lg border border-blue-500/10 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
              <Subheading>🤖 AI Strategy</Subheading>
              {Array.isArray(scout.data.strategy) && scout.data.strategy.length > 0 ? (
                <ul className="space-y-1">
                  {scout.data.strategy.slice(0, 5).map((s: string, i: number) => (
                    <li key={i} className="text-sm text-zinc-700 dark:text-zinc-300">• {s}</li>
                  ))}
                </ul>
              ) : (
                <Text>Scout data loaded</Text>
              )}
              {scout.data.opp_strengths && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    Opponent Strengths
                  </p>
                  <Text>{Array.isArray(scout.data.opp_strengths) ? scout.data.opp_strengths.join(", ") : String(scout.data.opp_strengths)}</Text>
                </div>
              )}
              {scout.data.opp_weaknesses && (
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                    Opponent Weaknesses
                  </p>
                  <Text>{Array.isArray(scout.data.opp_weaknesses) ? scout.data.opp_weaknesses.join(", ") : String(scout.data.opp_weaknesses)}</Text>
                </div>
              )}
            </div>
          )}

          {/* Opponent Roster */}
          <div>
            <Button outline onClick={() => setShowOpponent(!showOpponent)}>
              {showOpponent ? "Hide" : "Show"} Opponent Roster
            </Button>
            {showOpponent && scout.data && (
              <div className="mt-3 rounded-lg border border-zinc-950/5 dark:border-white/10 p-4">
                <Subheading className="mb-3">Opponent's Roster</Subheading>
                {scout.data.roster && Array.isArray(scout.data.roster) ? (
                  <div className="space-y-1.5">
                    {scout.data.roster.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge color="zinc" className="text-[10px] font-mono w-7 justify-center">{p.slot || p.position || "?"}</Badge>
                          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{p.name || "Unknown"}</span>
                          <span className="text-xs text-zinc-500">{p.team || ""}</span>
                        </div>
                        {p.status && p.status !== "active" && p.status !== "Healthy" && (
                          <Badge color="red" className="text-[10px]">{p.status}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : scout.data.opp_roster && typeof scout.data.opp_roster === "object" ? (
                  <div className="space-y-1.5">
                    {Object.entries(scout.data.opp_roster).map(([pos, players]: [string, any]) => (
                      <div key={pos}>
                        <p className="text-xs font-semibold text-zinc-500 uppercase mb-1">{pos}</p>
                        {Array.isArray(players) ? players.map((p: any, i: number) => (
                          <p key={i} className="text-sm text-zinc-700 dark:text-zinc-300 ml-2">{typeof p === "string" ? p : p.name || JSON.stringify(p)}</p>
                        )) : (
                          <p className="text-sm text-zinc-700 dark:text-zinc-300 ml-2">{String(players)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Render any key-value data from scout report that looks like roster/player info */}
                    {Object.entries(scout.data).filter(([k]) => !["strategy", "opp_strengths", "opp_weaknesses"].includes(k)).slice(0, 10).map(([key, val]) => (
                      <div key={key} className="text-sm">
                        <span className="text-xs font-semibold text-zinc-500 uppercase">{key.replace(/_/g, " ")}: </span>
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {Array.isArray(val) ? val.map((v: any) => typeof v === "string" ? v : v.name || JSON.stringify(v)).join(", ") : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Category Simulate */}
          <div className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-3">
            <Subheading>Category Simulator</Subheading>
            <Text className="text-xs">See how adding a player would impact your matchup categories.</Text>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (simPlayer.trim()) simulate(simPlayer.trim());
              }}
              className="flex gap-2"
            >
              <div className="flex-1">
                <InputGroup>
                  <MagnifyingGlassIcon data-slot="icon" />
                  <Input
                    type="text"
                    placeholder="Player name…"
                    value={simPlayer}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSimPlayer(e.target.value)}
                  />
                </InputGroup>
              </div>
              <Button type="submit" outline disabled={simLoading || !simPlayer.trim()}>
                {simLoading ? "Simulating…" : "Simulate"}
              </Button>
            </form>
            <CategorySimResult result={simResult} />
          </div>
        </>
      ) : null}
    </div>
  );
}
