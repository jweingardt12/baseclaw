import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { LoadingIndicator } from "@/shared/loading-indicator";
import { useCallTool } from "../shared/use-call-tool";

interface ActionData {
  type: string;
  success: boolean;
  message: string;
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

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" onClick={handleBackToRoster} disabled={loading}>
          Back to Roster
        </Button>
        {data.success && (
          <Button variant="secondary" onClick={async function () {
            var result = await callTool("yahoo_waiver_recommendations", { count: 5 });
            if (result) navigate(result.structuredContent);
          }} disabled={loading}>
            Waiver Analysis
          </Button>
        )}
        {data.success && (
          <Button variant="secondary" onClick={async function () {
            var result = await callTool("yahoo_lineup_optimize", {});
            if (result) navigate(result.structuredContent);
          }} disabled={loading}>
            Check Lineup
          </Button>
        )}
        {loading && <LoadingIndicator size={16} />}
      </div>
    </div>
  );
}
