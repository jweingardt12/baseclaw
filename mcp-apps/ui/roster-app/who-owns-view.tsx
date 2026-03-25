import { Badge } from "@plexui/ui/components/Badge";
import { Button } from "@plexui/ui/components/Button";
import { LoadingIndicator } from "@plexui/ui/components/Indicator";
import { useCallTool } from "../shared/use-call-tool";

interface WhoOwnsData {
  player_key: string;
  ownership_type: string;
  owner: string;
  ai_recommendation?: string | null;
}

function ownershipBadge(type: string) {
  if (type === "team") return <Badge size="sm">Owned</Badge>;
  if (type === "freeagents") return <Badge color="success" size="sm">Free Agent</Badge>;
  if (type === "waivers") return <Badge color="warning" size="sm">Waivers</Badge>;
  return <Badge color="secondary" size="sm">{type}</Badge>;
}

export function WhoOwnsView({ data, app, navigate }: { data: WhoOwnsData; app: any; navigate: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);

  var handleSearch = async function () {
    var result = await callTool("yahoo_free_agents", { pos_type: "B" });
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-4">
      <div className="surface-card p-5">
        <h2 className="text-lg font-semibold mb-3">Player Ownership</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {ownershipBadge(data.ownership_type)}
          {data.ownership_type === "team" && data.owner && (
            <span className="text-sm font-medium">{data.owner}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" color="secondary" onClick={handleSearch} disabled={loading}>
          Search Players
        </Button>
        {loading && <LoadingIndicator size={16} />}
      </div>
    </div>
  );
}
