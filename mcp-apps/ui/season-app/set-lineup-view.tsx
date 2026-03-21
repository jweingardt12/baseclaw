import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Button } from "@plexui/ui/components/Button";
import { useCallTool } from "../shared/use-call-tool";
import { AiInsight } from "../shared/ai-insight";
import { CheckCircle, XCircle, ArrowLeft, Loader2 } from "@/shared/icons";

interface SetLineupMove {
  player_id: string;
  position: string;
  success: boolean;
  error?: string;
}

interface SetLineupData {
  success: boolean;
  moves: SetLineupMove[];
  message: string;
  ai_recommendation?: string | null;
}

export function SetLineupView({ data, app, navigate }: { data: SetLineupData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  const handleViewRoster = async () => {
    const result = await callTool("yahoo_roster", {});
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-2">
    <AiInsight recommendation={data.ai_recommendation} />
    <Card className="w-full animate-slide-up overflow-hidden">
      <CardHeader className={data.success ? "bg-sem-success-subtle" : "bg-destructive/5"}>
        <div className="flex items-center gap-2">
          <CardTitle>Set Lineup</CardTitle>
          {data.success
            ? <CheckCircle size={20} className="text-sem-success animate-success-pop" />
            : <XCircle size={20} className="text-destructive animate-error-shake" />
          }
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="animate-stagger space-y-2">
          {(data.moves || []).map((m, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {m.success
                ? <CheckCircle size={14} className="text-sem-success flex-shrink-0" />
                : <XCircle size={14} className="text-destructive flex-shrink-0" />
              }
              <span>
                {m.success
                  ? "Moved " + m.player_id + " to " + m.position
                  : "Error: " + (m.error || "Failed to move " + m.player_id)
                }
              </span>
            </div>
          ))}
        </div>
        {data.message && <p className="text-xs text-muted-foreground">{data.message}</p>}
        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" color="secondary" onClick={handleViewRoster}>
            <ArrowLeft size={14} />
            View Roster
          </Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
