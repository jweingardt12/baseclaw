import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { LoadingIndicator } from "@/shared/loading-indicator";
import { useCallTool } from "../shared/use-call-tool";

interface ActionData {
  type: string;
  success: boolean;
  message: string;
  player_id?: string;
  add_id?: string;
  drop_id?: string;
  ai_recommendation?: string | null;
}

export function ActionView({ data, app, navigate }: { data: ActionData; app: any; navigate: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);
  var labels: Record<string, string> = { add: "Player Added", drop: "Player Dropped", swap: "Player Swap" };
  var title = labels[data.type] || "Roster Action";

  var handleBackToRoster = async function () {
    var result = await callTool("yahoo_roster", {});
    if (result) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant={data.success ? "default" : "destructive"}>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{data.message}</AlertDescription>
      </Alert>

      {data.player_id && <p className="text-xs text-muted-foreground">{"Player ID: " + data.player_id}</p>}
      {data.add_id && <p className="text-xs text-muted-foreground">{"Added ID: " + data.add_id}</p>}
      {data.drop_id && <p className="text-xs text-muted-foreground">{"Dropped ID: " + data.drop_id}</p>}

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={handleBackToRoster} disabled={loading}>
          Back to Roster
        </Button>
        {loading && <LoadingIndicator size={16} />}
      </div>
    </div>
  );
}
