import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Button } from "@/components/ui/button";
import { useCallTool } from "../shared/use-call-tool";
import { AiInsight } from "../shared/ai-insight";
import { CheckCircle, XCircle, ArrowLeft, Loader2 } from "@/shared/icons";

interface TradeActionData {
  type: string;
  success: boolean;
  message: string;
  transaction_key?: string;
  ai_recommendation?: string | null;
}

export function TradeActionView({ data, app, navigate }: { data: TradeActionData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  const labels: Record<string, string> = {
    "propose-trade": "Trade Proposed",
    "accept-trade": "Trade Accepted",
    "reject-trade": "Trade Rejected",
  };
  const title = labels[data.type] || "Trade Action";

  const handleViewTrades = async () => {
    const result = await callTool("yahoo_pending_trades", {});
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
          <CardTitle>{title}</CardTitle>
          {data.success
            ? <CheckCircle size={20} className="text-sem-success animate-success-pop" />
            : <XCircle size={20} className="text-destructive animate-error-shake" />
          }
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-base">{data.message}</p>
        {data.transaction_key && (
          <p className="text-xs text-muted-foreground mt-2">{"Transaction: " + data.transaction_key}</p>
        )}
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" onClick={handleViewTrades}>
            <ArrowLeft size={14} />
            View Pending Trades
          </Button>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
