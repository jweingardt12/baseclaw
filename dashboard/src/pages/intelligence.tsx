import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, LineChart, Line, XAxis, YAxis, BarChart, Bar, Legend } from "recharts";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import * as api from "@/lib/api";

export function IntelligencePage() {
  const [tab, setTab] = useState("report");
  const [searchName, setSearchName] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const report = useQuery({
    queryKey: ["playerReport", selectedName],
    queryFn: () => api.getPlayerReport(selectedName!),
    enabled: !!selectedName,
  });
  const breakouts = useQuery({ queryKey: ["breakouts"], queryFn: api.getBreakoutCandidates });
  const busts = useQuery({ queryKey: ["busts"], queryFn: api.getBustCandidates });
  const news = useQuery({ queryKey: ["news"], queryFn: api.getNewsLatest });
  const rankings = useQuery({ queryKey: ["rankings"], queryFn: api.getRankings });

  const filteredNews = sourceFilter ? news.data?.filter((n) => n.source === sourceFilter) : news.data;
  const newsSources = [...new Set(news.data?.map((n) => n.source) ?? [])];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Intelligence</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="report">Player Report</TabsTrigger>
          <TabsTrigger value="breakout">Breakout Watch</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="news">News Feed</TabsTrigger>
        </TabsList>

        {/* Player Report */}
        <TabsContent value="report" className="mt-4 space-y-4">
          <Command className="border rounded-lg">
            <CommandInput placeholder="Search player name..." value={searchName} onValueChange={setSearchName} />
            <CommandList>
              <CommandEmpty>Type a player name to search</CommandEmpty>
              {searchName.length > 1 && (
                <CommandGroup heading="Players">
                  <CommandItem onSelect={() => { setSelectedName(searchName); setSearchName(""); }}>
                    <Search className="mr-2 size-4" />
                    Search for "{searchName}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>

          {report.isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {report.error && <p className="text-sm text-destructive">Failed to load player report</p>}

          {report.data && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <PlayerAvatar name={report.data.player.name} mlbId={report.data.player.mlb_id} size="lg" />
                    <div>
                      <CardTitle>{report.data.player.name}</CardTitle>
                      <CardDescription>{report.data.player.team} · {report.data.player.position}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4">{report.data.analysis}</p>
                  <p className="text-sm text-muted-foreground">{report.data.outlook}</p>
                </CardContent>
              </Card>

              {report.data.player.statcast && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Statcast Radar</CardTitle></CardHeader>
                  <CardContent>
                    <ChartContainer config={{ value: { color: "var(--chart-1)" } }} className="h-56 w-full">
                      <RadarChart data={Object.entries(report.data.player.statcast).map(([k, v]) => ({ metric: k, value: v }))}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" className="text-xs" />
                        <Radar dataKey="value" fill="var(--color-value)" fillOpacity={0.3} stroke="var(--color-value)" />
                      </RadarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {report.data.player.trends && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Performance Trends</CardTitle></CardHeader>
                  <CardContent>
                    <ChartContainer config={{ value: { color: "var(--chart-2)" } }} className="h-40 w-full">
                      <LineChart data={report.data.player.trends}>
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis />
                        <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              {report.data.comparisons.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Expected vs Actual</CardTitle></CardHeader>
                  <CardContent>
                    <ChartContainer config={{ actual: { color: "var(--chart-1)" }, expected: { color: "var(--chart-3)" } }} className="h-48 w-full">
                      <BarChart data={report.data.comparisons}>
                        <XAxis dataKey="metric" className="text-xs" />
                        <YAxis />
                        <Legend />
                        <Bar dataKey="actual" fill="var(--color-actual)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expected" fill="var(--color-expected)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Breakout Watch */}
        <TabsContent value="breakout" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="size-4 text-green-500" /> Breakout Candidates
              </h3>
              {breakouts.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
              ) : breakouts.error ? (
                <p className="text-sm text-destructive">Failed to load</p>
              ) : (
                breakouts.data?.map((b) => (
                  <Card key={b.player.name}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar name={b.player.name} mlbId={b.player.mlb_id} size="sm" />
                          <p className="font-medium text-sm">{b.player.name}</p>
                        </div>
                        <Badge variant="default">{Math.round(b.confidence * 100)}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{b.player.team} · {b.player.position}</p>
                      <p className="text-xs mt-1">{b.reason}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingDown className="size-4 text-red-500" /> Bust Candidates
              </h3>
              {busts.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
              ) : busts.error ? (
                <p className="text-sm text-destructive">Failed to load</p>
              ) : (
                busts.data?.map((b) => (
                  <Card key={b.player.name}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <PlayerAvatar name={b.player.name} mlbId={b.player.mlb_id} size="sm" />
                          <p className="font-medium text-sm">{b.player.name}</p>
                        </div>
                        <Badge variant="destructive">{Math.round(b.confidence * 100)}%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{b.player.team} · {b.player.position}</p>
                      <p className="text-xs mt-1">{b.reason}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* Rankings */}
        <TabsContent value="rankings" className="mt-4">
          {rankings.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rankings.error ? (
            <p className="text-sm text-destructive">Failed to load rankings</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.data?.players.map((p) => (
                  <TableRow key={p.rank}>
                    <TableCell className="tabular-nums font-medium">{p.rank}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.team}</TableCell>
                    <TableCell><Badge variant="outline">{p.position}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{p.value.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* News Feed */}
        <TabsContent value="news" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={sourceFilter === null ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSourceFilter(null)}
            >
              All
            </Badge>
            {newsSources.map((src) => (
              <Badge
                key={src}
                variant={sourceFilter === src ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSourceFilter(src)}
              >
                {src}
              </Badge>
            ))}
          </div>
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-2">
              {news.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : news.error ? (
                <p className="text-sm text-destructive">Failed to load news</p>
              ) : (
                filteredNews?.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{item.headline}</p>
                          <p className="text-xs text-muted-foreground mt-1">{item.summary}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge variant="outline" className="text-xs">{item.source}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
