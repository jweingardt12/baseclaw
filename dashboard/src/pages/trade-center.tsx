import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Check, X, Search, Loader2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { TeamAvatar } from "@/components/team-avatar";
import * as api from "@/lib/api";

export function TradeCenterPage() {
  const queryClient = useQueryClient();
  const trades = useQuery({ queryKey: ["trades"], queryFn: api.getPendingTrades });
  const roster = useQuery({ queryKey: ["roster"], queryFn: api.getRoster });
  const autonomy = useQuery({ queryKey: ["autonomy"], queryFn: api.getAutonomyConfig });
  const isWriteEnabled = autonomy.data?.mode !== "off";

  const [tab, setTab] = useState("pending");
  const [builderSend, setBuilderSend] = useState<string[]>([]);
  const [builderReceive, setBuilderReceive] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.acceptTrade(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trades"] }); toast.success("Trade accepted"); },
    onError: () => toast.error("Failed to accept trade"),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectTrade(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["trades"] }); toast.success("Trade rejected"); },
    onError: () => toast.error("Failed to reject trade"),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Trade Center</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {trades.data && trades.data.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{trades.data.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="finder">Finder</TabsTrigger>
        </TabsList>

        {/* Pending Trades */}
        <TabsContent value="pending" className="mt-4 space-y-3">
          {trades.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : trades.error ? (
            <p className="text-sm text-destructive">Failed to load trades</p>
          ) : trades.data?.length === 0 ? (
            <Empty className="py-8">
              <EmptyMedia variant="icon"><ArrowLeftRight className="size-4" /></EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No pending trades</EmptyTitle>
                <EmptyDescription>Use the Builder or Finder tabs to initiate a trade.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            trades.data?.map((trade) => (
              <Card key={trade.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TeamAvatar teamName={trade.partner} size="sm" />
                      Trade with {trade.partner}
                    </CardTitle>
                    <Badge variant={
                      trade.grade.startsWith("A") ? "default" :
                      trade.grade.startsWith("B") ? "secondary" :
                      "destructive"
                    }>
                      {trade.grade}
                    </Badge>
                  </div>
                  <CardDescription>{trade.analysis}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Sending</p>
                      {trade.sending.map((p) => (
                        <Badge key={p.name} variant="outline" className="mr-1 mb-1">{p.name}</Badge>
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Receiving</p>
                      {trade.receiving.map((p) => (
                        <Badge key={p.name} variant="outline" className="mr-1 mb-1">{p.name}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!isWriteEnabled || rejectMutation.isPending}
                            onClick={() => rejectMutation.mutate(trade.id)}
                          >
                            <X className="mr-1 size-3.5" /> Reject
                          </Button>
                        }
                      />
                      {!isWriteEnabled && <TooltipContent>Write operations disabled</TooltipContent>}
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="sm"
                            disabled={!isWriteEnabled || acceptMutation.isPending}
                            onClick={() => acceptMutation.mutate(trade.id)}
                          >
                            <Check className="mr-1 size-3.5" /> Accept
                          </Button>
                        }
                      />
                      {!isWriteEnabled && <TooltipContent>Write operations disabled</TooltipContent>}
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Trade Builder */}
        <TabsContent value="builder" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">You Send</CardTitle></CardHeader>
              <CardContent>
                <Command>
                  <CommandInput placeholder="Search your roster..." />
                  <CommandList>
                    <CommandEmpty>No players found.</CommandEmpty>
                    <CommandGroup>
                      {roster.data?.map((p) => (
                        <CommandItem
                          key={p.name}
                          onSelect={() => setBuilderSend((prev) =>
                            prev.includes(p.name) ? prev.filter((n) => n !== p.name) : [...prev, p.name]
                          )}
                        >
                          <div className={`mr-2 size-4 rounded border ${builderSend.includes(p.name) ? "bg-primary border-primary" : ""}`}>
                            {builderSend.includes(p.name) && <Check className="size-4 text-primary-foreground" />}
                          </div>
                          {p.name}
                          <span className="ml-auto text-xs text-muted-foreground">{p.position}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <div className="mt-2 flex flex-wrap gap-1">
                  {builderSend.map((name) => (
                    <Badge key={name} variant="secondary" className="cursor-pointer" onClick={() => setBuilderSend((p) => p.filter((n) => n !== name))}>
                      {name} ×
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">You Receive</CardTitle></CardHeader>
              <CardContent>
                <Command>
                  <CommandInput placeholder="Search players..." />
                  <CommandList>
                    <CommandEmpty>No players found.</CommandEmpty>
                    <CommandGroup>
                      {roster.data?.slice(0, 10).map((p) => (
                        <CommandItem
                          key={p.name}
                          onSelect={() => setBuilderReceive((prev) =>
                            prev.includes(p.name) ? prev.filter((n) => n !== p.name) : [...prev, p.name]
                          )}
                        >
                          <div className={`mr-2 size-4 rounded border ${builderReceive.includes(p.name) ? "bg-primary border-primary" : ""}`}>
                            {builderReceive.includes(p.name) && <Check className="size-4 text-primary-foreground" />}
                          </div>
                          {p.name}
                          <span className="ml-auto text-xs text-muted-foreground">{p.position}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <div className="mt-2 flex flex-wrap gap-1">
                  {builderReceive.map((name) => (
                    <Badge key={name} variant="secondary" className="cursor-pointer" onClick={() => setBuilderReceive((p) => p.filter((n) => n !== name))}>
                      {name} ×
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {builderSend.length > 0 && builderReceive.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Impact Analysis</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    before: { label: "Before", color: "hsl(var(--chart-2))" },
                    after: { label: "After", color: "hsl(var(--chart-1))" },
                  }}
                  className="h-48 w-full"
                >
                  <BarChart accessibilityLayer data={[
                    { cat: "HR", before: 85, after: 92 },
                    { cat: "RBI", before: 78, after: 88 },
                    { cat: "AVG", before: 90, after: 82 },
                    { cat: "SB", before: 65, after: 70 },
                    { cat: "W", before: 72, after: 75 },
                  ]}>
                    <XAxis dataKey="cat" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={30} />
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <Bar dataKey="before" fill="var(--color-before)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="after" fill="var(--color-after)" radius={[4, 4, 0, 0]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trade Finder */}
        <TabsContent value="finder" className="mt-4 space-y-4">
          <div className="flex justify-center">
            <Button onClick={() => { setScanning(true); setTimeout(() => setScanning(false), 2000); }} disabled={scanning}>
              {scanning ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Search className="mr-2 size-4" />}
              {scanning ? "Scanning League..." : "Scan for Trades"}
            </Button>
          </div>
          {!scanning && (
            <div className="space-y-2">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground text-center">Click scan to find potential trade partners based on category needs</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
