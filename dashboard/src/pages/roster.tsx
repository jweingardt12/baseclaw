import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, LineChart, Line, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/player-avatar";
import * as api from "@/lib/api";
import type { RosterPlayer } from "@/lib/api";

const positionGroups = {
  All: null,
  Hitters: ["C", "1B", "2B", "3B", "SS", "OF", "DH", "UTIL"],
  Pitchers: ["SP", "RP", "P"],
  Bench: ["BN"],
  IL: ["IL", "IL+", "NA"],
};

export function RosterPage() {
  const queryClient = useQueryClient();
  const roster = useQuery({ queryKey: ["roster"], queryFn: api.getRoster });
  const autonomy = useQuery({ queryKey: ["autonomy"], queryFn: api.getAutonomyConfig });
  const [selectedPlayer, setSelectedPlayer] = useState<RosterPlayer | null>(null);
  const [tab, setTab] = useState("All");
  const [dropTarget, setDropTarget] = useState<RosterPlayer | null>(null);
  const isWriteEnabled = autonomy.data?.mode !== "off";

  const dropMutation = useMutation({
    mutationFn: (name: string) => api.dropPlayer(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      toast.success(`Dropped ${dropTarget?.name}`);
      setDropTarget(null);
    },
    onError: () => {
      toast.error("Failed to drop player");
    },
  });

  const filtered = roster.data?.filter((p) => {
    const group = positionGroups[tab as keyof typeof positionGroups];
    if (!group) return true;
    return group.includes(p.slot);
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Roster</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {Object.keys(positionGroups).map((key) => (
            <TabsTrigger key={key} value={key}>{key}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {roster.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : roster.error ? (
            <p className="text-sm text-destructive">Failed to load roster</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Slot</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="hidden lg:table-cell">Team</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered?.map((player) => (
                      <TableRow key={player.name} className="cursor-pointer" onClick={() => setSelectedPlayer(player)}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{player.slot}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PlayerAvatar name={player.name} mlbId={player.mlb_id} size="sm" />
                            <div>
                              <p className="font-medium">{player.name}</p>
                              <p className="text-xs text-muted-foreground">{player.position}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{player.team}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              player.status === "active" ? "default" :
                              player.status === "IL" ? "destructive" :
                              "secondary"
                            }
                          >
                            {player.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!isWriteEnabled}
                                  onClick={() => setDropTarget(player)}
                                >
                                  Drop
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!isWriteEnabled && (
                              <TooltipContent>
                                Write operations disabled. Enable in Settings.
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card stack */}
              <div className="md:hidden space-y-2">
                {filtered?.map((player) => (
                  <Card key={player.name} className="cursor-pointer" onClick={() => setSelectedPlayer(player)}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{player.slot}</Badge>
                        <PlayerAvatar name={player.name} mlbId={player.mlb_id} size="sm" />
                        <div>
                          <p className="font-medium text-sm">{player.name}</p>
                          <p className="text-xs text-muted-foreground">{player.team} · {player.position}</p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          player.status === "active" ? "default" :
                          player.status === "IL" ? "destructive" :
                          "secondary"
                        }
                      >
                        {player.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Player Detail Sheet */}
      <Sheet open={!!selectedPlayer} onOpenChange={(v) => !v && setSelectedPlayer(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedPlayer?.name}</SheetTitle>
          </SheetHeader>
          {selectedPlayer && (
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-3">
                <PlayerAvatar name={selectedPlayer.name} mlbId={selectedPlayer.mlb_id} size="lg" />
                <div className="flex flex-wrap gap-2">
                  <Badge>{selectedPlayer.position}</Badge>
                  <Badge variant="outline">{selectedPlayer.team}</Badge>
                  <Badge variant={selectedPlayer.status === "active" ? "default" : "destructive"}>
                    {selectedPlayer.status}
                  </Badge>
                </div>
              </div>

              <Accordion type="single" collapsible>
                {/* Statcast Radar */}
                {selectedPlayer.statcast && (
                  <AccordionItem value="statcast">
                    <AccordionTrigger className="text-sm font-medium">Statcast Profile</AccordionTrigger>
                    <AccordionContent>
                      <ChartContainer config={{ value: { color: "hsl(var(--chart-1))" } }} className="h-56 w-full">
                        <RadarChart
                          accessibilityLayer
                          data={Object.entries(selectedPlayer.statcast).map(([key, value]) => ({ metric: key, value }))}
                        >
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                          <Radar dataKey="value" fill="var(--color-value)" fillOpacity={0.3} stroke="var(--color-value)" strokeWidth={2} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </RadarChart>
                      </ChartContainer>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Trends */}
                {selectedPlayer.trends && selectedPlayer.trends.length > 0 && (
                  <AccordionItem value="trends">
                    <AccordionTrigger className="text-sm font-medium">Performance Trend</AccordionTrigger>
                    <AccordionContent>
                      <ChartContainer config={{ value: { color: "hsl(var(--chart-2))" } }} className="h-40 w-full">
                        <LineChart accessibilityLayer data={selectedPlayer.trends}>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={30} />
                          <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </LineChart>
                      </ChartContainer>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Splits */}
                {selectedPlayer.splits && selectedPlayer.splits.length > 0 && (
                  <AccordionItem value="splits">
                    <AccordionTrigger className="text-sm font-medium">Splits</AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Split</TableHead>
                            {Object.keys(selectedPlayer.splits[0].stats).map((k) => (
                              <TableHead key={k} className="text-right">{k}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedPlayer.splits.map((split) => (
                            <TableRow key={split.split}>
                              <TableCell className="font-medium">{split.split}</TableCell>
                              {Object.values(split.stats).map((v, i) => (
                                <TableCell key={i} className="text-right">{typeof v === "number" ? v.toFixed(3) : v}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Drop Player Confirmation */}
      <AlertDialog open={!!dropTarget} onOpenChange={(v) => !v && setDropTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop {dropTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove them from your roster. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => dropTarget && dropMutation.mutate(dropTarget.name)}
              disabled={dropMutation.isPending}
            >
              Drop Player
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
