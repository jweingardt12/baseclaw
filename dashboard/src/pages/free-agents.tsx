import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { UserPlus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/player-avatar";
import * as api from "@/lib/api";
import type { FreeAgent } from "@/lib/api";

export function FreeAgentsPage() {
  const queryClient = useQueryClient();
  const freeAgents = useQuery({ queryKey: ["freeAgents"], queryFn: api.getFreeAgents });
  const autonomy = useQuery({ queryKey: ["autonomy"], queryFn: api.getAutonomyConfig });
  const isWriteEnabled = autonomy.data?.mode !== "off";

  const [tab, setTab] = useState("all");
  const [position, setPosition] = useState("all");
  const [minOwnership, setMinOwnership] = useState([0]);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmPlayer, setConfirmPlayer] = useState<FreeAgent | null>(null);
  const [faabBid, setFaabBid] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const addMutation = useMutation({
    mutationFn: ({ name, faab }: { name: string; faab?: number }) => api.addPlayer(name, faab),
    onSuccess: () => {
      toast.success("Added " + confirmPlayer?.name);
      queryClient.invalidateQueries({ queryKey: ["freeAgents"] });
      queryClient.invalidateQueries({ queryKey: ["roster"] });
      setConfirmPlayer(null);
      setFaabBid("");
    },
    onError: () => {
      toast.error("Failed to add player");
    },
  });

  const filtered = freeAgents.data?.filter((p) => {
    if (tab !== "all" && p.type !== tab) return false;
    if (position !== "all" && !p.position.includes(position)) return false;
    if (p.ownership < minOwnership[0]) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Free Agents</h1>
        <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
          <Search className="mr-2 size-3.5" />
          Quick Search
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="hitter">Hitters</TabsTrigger>
          <TabsTrigger value="pitcher">Pitchers</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Position</Label>
            <Select value={position} onValueChange={(v) => setPosition(v ?? "all")}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {["C", "1B", "2B", "3B", "SS", "OF", "SP", "RP"].map((pos) => (
                  <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-40">
            <Label className="text-xs">Min Ownership: {minOwnership[0]}%</Label>
            <Slider value={minOwnership} onValueChange={(v: number | readonly number[]) => setMinOwnership(typeof v === "number" ? [v] : Array.from(v))} max={100} step={5} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={availableOnly} onCheckedChange={setAvailableOnly} id="available" />
            <Label htmlFor="available" className="text-xs">Available only</Label>
          </div>
        </div>

        <TabsContent value={tab} className="mt-4">
          {freeAgents.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : freeAgents.error ? (
            <p className="text-sm text-destructive">Failed to load free agents</p>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2">
                {filtered?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((player) => (
                  <Card key={player.name}>
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar name={player.name} mlbId={player.mlb_id} size="sm" />
                        <div>
                          <p className="font-medium text-sm">{player.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.team} · {player.position} · {player.ownership}% owned
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Score: {player.addScore.toFixed(1)}
                        </Badge>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                size="sm"
                                disabled={!isWriteEnabled}
                                onClick={() => setConfirmPlayer(player)}
                              >
                                <UserPlus className="mr-1 size-3.5" />
                                Add
                              </Button>
                            }
                          />
                          {!isWriteEnabled && (
                            <TooltipContent>Write operations disabled</TooltipContent>
                          )}
                        </Tooltip>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filtered?.length === 0 && (
                  <Empty className="py-8">
                    <EmptyMedia variant="icon"><Users className="size-4" /></EmptyMedia>
                    <EmptyHeader>
                      <EmptyTitle>No free agents match filters</EmptyTitle>
                      <EmptyDescription>Try adjusting your position or ownership filters.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </ScrollArea>
            {filtered && filtered.length > PAGE_SIZE && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setPage((p) => Math.min(Math.ceil(filtered!.length / PAGE_SIZE), p + 1))}
                      className={page >= Math.ceil(filtered.length / PAGE_SIZE) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          )}
        </TabsContent>
      </Tabs>

      {/* Command search */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="p-0">
          <Command>
            <CommandInput placeholder="Search free agents..." />
            <CommandList>
              <CommandEmpty>No players found.</CommandEmpty>
              <CommandGroup heading="Free Agents">
                {freeAgents.data?.slice(0, 20).map((p) => (
                  <CommandItem key={p.name} onSelect={() => { setSearchOpen(false); setConfirmPlayer(p); }}>
                    <span>{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{p.position} · {p.team}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Add confirmation dialog */}
      <Dialog open={!!confirmPlayer} onOpenChange={(v) => !v && setConfirmPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {confirmPlayer?.name}?</DialogTitle>
            <DialogDescription>
              {confirmPlayer?.team} · {confirmPlayer?.position} · {confirmPlayer?.ownership}% owned
            </DialogDescription>
          </DialogHeader>
          {confirmPlayer && (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stat</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(confirmPlayer.stats).slice(0, 8).map(([key, val]) => (
                    <TableRow key={key}>
                      <TableCell>{key}</TableCell>
                      <TableCell className="text-right">{typeof val === "number" ? val.toFixed(3) : val}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="space-y-1.5">
                <Label>FAAB Bid (suggested: ${confirmPlayer.faabSuggested})</Label>
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <InputGroupText>$</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    type="number"
                    placeholder={String(confirmPlayer.faabSuggested)}
                    value={faabBid}
                    onChange={(e) => setFaabBid(e.target.value)}
                  />
                </InputGroup>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPlayer(null)}>Cancel</Button>
            <Button
              onClick={() => confirmPlayer && addMutation.mutate({ name: confirmPlayer.name, faab: faabBid ? Number(faabBid) : undefined })}
              disabled={addMutation.isPending}
            >
              Confirm Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
