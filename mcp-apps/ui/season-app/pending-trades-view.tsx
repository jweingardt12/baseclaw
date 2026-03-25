import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Subheading } from "../components/heading";
import { useCallTool } from "../shared/use-call-tool";
import { PlayerName } from "../shared/player-name";
import { EmptyState } from "../shared/empty-state";
import { RefreshButton } from "../shared/refresh-button";
import { AiInsight } from "../shared/ai-insight";
import { ArrowRightLeft, Check, X, Loader2, Inbox } from "@/shared/icons";

interface TradePlayer {
  name: string;
  player_key?: string;
  player_id?: string;
}

interface TradeProposal {
  transaction_key: string;
  status: string;
  trader_team_key: string;
  trader_team_name: string;
  tradee_team_key: string;
  tradee_team_name: string;
  trader_players: TradePlayer[];
  tradee_players: TradePlayer[];
  trade_note: string;
}

interface PendingTradesData {
  trades: TradeProposal[];
  ai_recommendation?: string | null;
}

export function PendingTradesView({ data, app, navigate }: { data: PendingTradesData; app: any; navigate: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);
  var [confirmAction, setConfirmAction] = useState<{ type: "accept" | "reject"; trade: TradeProposal } | null>(null);
  var trades = data.trades || [];

  var handleAction = async () => {
    if (!confirmAction) return;
    var toolName = confirmAction.type === "accept" ? "yahoo_accept_trade" : "yahoo_reject_trade";
    var result = await callTool(toolName, { transaction_key: confirmAction.trade.transaction_key });
    setConfirmAction(null);
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  if (trades.length === 0) {
    return (
      <div className="space-y-2">
        <AiInsight recommendation={data.ai_recommendation} />
        <div className="flex items-center justify-between">
          <Subheading>Pending Trades</Subheading>
          <RefreshButton app={app} toolName="yahoo_pending_trades" navigate={navigate} />
        </div>
        <EmptyState icon={Inbox} title="No pending trade proposals" description="When you or your leaguemates propose trades, they'll appear here." />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="flex items-center justify-between">
        <Subheading className="flex items-center gap-2">
          <ArrowRightLeft size={18} />
          Pending Trades
          <Badge variant="secondary">{trades.length}</Badge>
        </Subheading>
        <RefreshButton app={app} toolName="yahoo_pending_trades" navigate={navigate} />
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {trades.map((trade) => (
        <Card key={trade.transaction_key}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {trade.trader_team_name || trade.trader_team_key}
                <span className="text-muted-foreground mx-2">vs</span>
                {trade.tradee_team_name || trade.tradee_team_key}
              </CardTitle>
              <Badge variant="secondary">{trade.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{trade.trader_team_name || "Trader"} sends:</p>
                {(trade.trader_players || []).map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm py-0.5">
                    <PlayerName name={p.name} playerId={p.player_id || p.player_key} app={app} navigate={navigate} context="trade" />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{trade.tradee_team_name || "Tradee"} sends:</p>
                {(trade.tradee_players || []).map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm py-0.5">
                    <PlayerName name={p.name} playerId={p.player_id || p.player_key} app={app} navigate={navigate} context="trade" />
                  </div>
                ))}
              </div>
            </div>

            {trade.trade_note && (
              <p className="text-xs text-muted-foreground italic">"{trade.trade_note}"</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground font-mono">{trade.transaction_key}</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setConfirmAction({ type: "accept", trade })} disabled={loading}>
                  <Check size={14} />
                  Accept
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setConfirmAction({ type: "reject", trade })} disabled={loading}>
                  <X size={14} />
                  Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={confirmAction !== null} onOpenChange={function (open) { if (!open) setConfirmAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction ? (confirmAction.type === "accept" ? "Accept Trade?" : "Reject Trade?") : ""}</DialogTitle>
            <DialogDescription>{confirmAction ? (
              confirmAction.type === "accept"
                ? "Are you sure you want to accept this trade with " + (confirmAction.trade.trader_team_name || "this team") + "?"
                : "Are you sure you want to reject this trade from " + (confirmAction.trade.trader_team_name || "this team") + "?"
            ) : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button variant={confirmAction && confirmAction.type === "reject" ? "destructive" : "secondary"} onClick={handleAction}>{confirmAction ? (confirmAction.type === "accept" ? "Accept" : "Reject") : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
