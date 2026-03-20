import { Button } from "../catalyst/button";
import { Subheading } from "../catalyst/heading";
import { Text } from "../catalyst/text";
import { useCallTool } from "../shared/use-call-tool";
import { AiInsight } from "../shared/ai-insight";
import { CheckCircle, XCircle, ArrowLeft, Loader2 } from "@/shared/icons";

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
  const { callTool, loading } = useCallTool(app);
  const labels: Record<string, string> = { add: "Player Added", drop: "Player Dropped", swap: "Player Swap" };
  const title = labels[data.type] || "Roster Action";

  const handleBackToRoster = async () => {
    const result = await callTool("yahoo_roster", {});
    if (result) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-3 mt-2 animate-slide-up">
      <div className={"surface-card overflow-hidden"}>
        <div className={"p-4 " + (data.success ? "bg-sem-success-subtle" : "bg-destructive/5")}>
          <div className="flex items-center gap-2">
            <Subheading>{title}</Subheading>
            {data.success
              ? <CheckCircle size={20} className="text-sem-success animate-success-pop" />
              : <XCircle size={20} className="text-destructive animate-error-shake" />
            }
          </div>
        </div>
        <div className="p-4">
          <p className="text-base">{data.message}</p>
          {data.player_id && <Text className="mt-2">{"Player ID: " + data.player_id}</Text>}
          {data.add_id && <Text className="mt-1">{"Added ID: " + data.add_id}</Text>}
          {data.drop_id && <Text className="mt-1">{"Dropped ID: " + data.drop_id}</Text>}
        </div>
      </div>

      <AiInsight recommendation={data.ai_recommendation} />

      <div className="flex items-center gap-2">
        <Button outline onClick={handleBackToRoster}>
          <ArrowLeft size={14} className="mr-1" />
          Back to Roster
        </Button>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
