import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Shield, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import * as api from "@/lib/api";
import type { AutonomyConfig } from "@/lib/api";

const modes: { value: AutonomyConfig["mode"]; label: string; description: string; icon: React.ElementType }[] = [
  { value: "off", label: "Off", description: "All actions require manual confirmation", icon: Shield },
  { value: "suggest", label: "Suggest", description: "AI suggests, you confirm", icon: ShieldCheck },
  { value: "auto", label: "Auto", description: "AI acts autonomously within limits", icon: ShieldAlert },
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ["autonomy"], queryFn: api.getAutonomyConfig });
  const status = useQuery({ queryKey: ["status"], queryFn: api.getSystemStatus });

  const [localConfig, setLocalConfig] = useState<AutonomyConfig | null>(null);
  const [dangerOpen, setDangerOpen] = useState(false);

  useEffect(() => {
    if (config.data && !localConfig) {
      setLocalConfig(config.data);
    }
  }, [config.data, localConfig]);

  const mutation = useMutation({
    mutationFn: (cfg: AutonomyConfig) => api.setAutonomyConfig(cfg),
    onSuccess: (data) => {
      queryClient.setQueryData(["autonomy"], data);
      setLocalConfig(data);
    },
  });

  function updateConfig(partial: Partial<AutonomyConfig>) {
    if (!localConfig) return;
    const updated = { ...localConfig, ...partial };
    setLocalConfig(updated);
    mutation.mutate(updated);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {/* Autonomy Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Autonomy Mode</CardTitle>
          <CardDescription>Control how BaseClaw manages your team</CardDescription>
        </CardHeader>
        <CardContent>
          {config.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : localConfig ? (
            <ToggleGroup
              type="single"
              value={localConfig.mode}
              onValueChange={(v) => v && updateConfig({ mode: v as AutonomyConfig["mode"] })}
              className="w-full"
            >
              {modes.map((m) => (
                <ToggleGroupItem key={m.value} value={m.value} className="flex-1 flex-col h-auto py-3 gap-1">
                  <m.icon className="size-5" />
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs font-normal opacity-70">{m.description}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </CardContent>
      </Card>

      {/* Action Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Action Permissions</CardTitle>
          <CardDescription>Enable or disable specific automated actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : localConfig ? (
            Object.entries(localConfig.actions).map(([key, enabled]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={key} className="capitalize">{key.replace(/_/g, " ")}</Label>
                <Switch
                  id={key}
                  checked={enabled}
                  onCheckedChange={(checked) => updateConfig({ actions: { ...localConfig.actions, [key]: checked } })}
                />
              </div>
            ))
          ) : null}
        </CardContent>
      </Card>

      {/* FAAB Limit */}
      <Card>
        <CardHeader>
          <CardTitle>FAAB Limit</CardTitle>
          <CardDescription>Maximum FAAB bid for automated pickups</CardDescription>
        </CardHeader>
        <CardContent>
          {localConfig ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">${localConfig.faabLimit}</span>
              </div>
              <Slider
                value={[localConfig.faabLimit]}
                onValueChange={(v) => updateConfig({ faabLimit: Array.isArray(v) ? v[0] : v })}
                max={100}
                step={1}
              />
            </div>
          ) : (
            <Skeleton className="h-8 w-full" />
          )}
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          {status.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : status.error ? (
            <p className="text-sm text-destructive">Cannot reach API</p>
          ) : status.data ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={status.data.status === "healthy" ? "default" : "destructive"}>
                  {status.data.status}
                </Badge>
                <span className="text-xs text-muted-foreground">Uptime: {status.data.uptime}</span>
                <span className="text-xs text-muted-foreground">v{status.data.version}</span>
              </div>
              <Separator />
              <div className="grid gap-2 grid-cols-2">
                {status.data.components.map((c) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <Badge variant={c.status === "ok" ? "outline" : "destructive"} className="text-xs">{c.status}</Badge>
                    <span className="text-xs">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Collapsible open={dangerOpen} onOpenChange={setDangerOpen}>
        <Card className="border-destructive/50">
          <CollapsibleTrigger className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                </div>
                <ChevronDown className={`size-4 transition-transform ${dangerOpen ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                These actions can have significant impact on your team. Use with caution.
              </p>
              <Button variant="destructive" size="sm">Reset All Settings</Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
