import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heading, Subheading } from "@/catalyst/heading";
import { Text } from "@/catalyst/text";
import { Badge } from "@/catalyst/badge";
import { Divider } from "@/catalyst/divider";
import { Fieldset, Legend, Field, Label, Description } from "@/catalyst/fieldset";
import { Switch, SwitchField } from "@/catalyst/switch";
import { Select } from "@/catalyst/select";
import { toast } from "sonner";
import * as api from "@/lib/api";
import type { AutonomyConfig } from "@/lib/api";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["status"], queryFn: api.getSystemStatus, staleTime: 30_000 });
  const autonomy = useQuery({ queryKey: ["autonomy"], queryFn: api.getAutonomyConfig, staleTime: 60_000 });

  const updateAutonomy = useMutation({
    mutationFn: (config: AutonomyConfig) => api.setAutonomyConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autonomy"] });
      toast.success("Settings updated!");
    },
    onError: (err: Error) => toast.error("Failed to update: " + err.message),
  });

  const handleModeChange = (mode: string) => {
    if (!autonomy.data) return;
    updateAutonomy.mutate({ ...autonomy.data, mode: mode as AutonomyConfig["mode"] });
  };

  const handleActionToggle = (action: string, value: boolean) => {
    if (!autonomy.data) return;
    updateAutonomy.mutate({
      ...autonomy.data,
      actions: { ...autonomy.data.actions, [action]: value },
    });
  };

  return (
    <div className="space-y-8">
      <Heading>Settings</Heading>

      {/* System Status */}
      <div className="rounded-lg border border-zinc-950/5 dark:border-white/10 p-4 space-y-3">
        <Subheading>System Status</Subheading>
        {status.isLoading ? (
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        ) : status.data ? (
          <div className="flex items-center gap-3">
            <Badge color={status.data.status === "ok" ? "green" : "red"}>
              {status.data.status === "ok" ? "Connected" : "Offline"}
            </Badge>
            <Text>
              {status.data.status === "ok"
                ? "BaseClaw API is running and Yahoo is connected."
                : "API is not responding. Check the Flask server."}
            </Text>
          </div>
        ) : (
          <Text>Unable to check status.</Text>
        )}
      </div>

      <Divider />

      {/* Autonomy Config */}
      <Fieldset>
        <Legend>Autonomy Mode</Legend>
        <Text>Control how BaseClaw handles lineup decisions and player transactions.</Text>

        <Field className="mt-4">
          <Label>Mode</Label>
          <Description>
            Off = view only, Suggest = recommendations only, Auto = make moves automatically.
          </Description>
          <Select
            value={autonomy.data?.mode || "off"}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleModeChange(e.target.value)}
            disabled={!autonomy.data || updateAutonomy.isPending}
          >
            <option value="off">Off — View Only</option>
            <option value="suggest">Suggest — Recommendations</option>
            <option value="auto">Auto — Full Autonomy</option>
          </Select>
        </Field>

        {autonomy.data?.mode !== "off" && autonomy.data?.actions && (
          <div className="mt-6 space-y-4">
            <Subheading>Allowed Actions</Subheading>
            {Object.entries(autonomy.data.actions).map(([action, enabled]) => (
              <SwitchField key={action}>
                <Label>{formatActionName(action)}</Label>
                <Description>
                  {actionDescriptions[action] || `Allow BaseClaw to ${action.replace(/_/g, " ")}.`}
                </Description>
                <Switch
                  color="blue"
                  checked={enabled}
                  onChange={(val: boolean) => handleActionToggle(action, val)}
                  disabled={updateAutonomy.isPending}
                />
              </SwitchField>
            ))}
          </div>
        )}

        {autonomy.data?.mode === "auto" && (
          <Field className="mt-6">
            <Label>FAAB Limit per Claim</Label>
            <Description>Maximum FAAB budget BaseClaw can spend on a single waiver claim.</Description>
            <Select
              value={String(autonomy.data.faabLimit ?? 10)}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                if (!autonomy.data) return;
                updateAutonomy.mutate({ ...autonomy.data, faabLimit: Number(e.target.value) });
              }}
              disabled={updateAutonomy.isPending}
            >
              <option value="5">$5</option>
              <option value="10">$10</option>
              <option value="25">$25</option>
              <option value="50">$50</option>
            </Select>
          </Field>
        )}
      </Fieldset>
    </div>
  );
}

function formatActionName(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const actionDescriptions: Record<string, string> = {
  optimize_lineup: "Automatically move bench players into active slots when they have games.",
  add_players: "Add free agents from the waiver wire.",
  drop_players: "Drop underperforming players from your roster.",
  make_trades: "Accept or propose trades with other teams.",
  stream_pitchers: "Stream pitchers for the week based on matchups.",
};
