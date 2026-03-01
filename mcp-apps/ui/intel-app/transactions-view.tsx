import { Badge } from "../components/ui/badge";
import { useCallTool } from "../shared/use-call-tool";
import { TeamLogo } from "../shared/team-logo";
import { Button } from "../components/ui/button";
import { Loader2 } from "@/shared/icons";

interface Transaction {
  player: string;
  type: string;
  team?: string;
  date?: string;
  description?: string;
}

interface TransactionsData {
  type: string;
  days?: number;
  transactions: Transaction[];
  ai_recommendation?: string | null;
}

function typeColor(type: string): string {
  var t = type.toLowerCase();
  if (t.indexOf("il") >= 0 || t.indexOf("injured") >= 0) return "bg-sem-risk-subtle text-sem-risk font-bold";
  if (t.indexOf("call") >= 0 || t.indexOf("recall") >= 0) return "bg-sem-success-subtle text-sem-success font-bold";
  if (t.indexOf("trade") >= 0) return "bg-purple-500/20 text-purple-700 dark:text-purple-400 font-bold";
  if (t.indexOf("dfa") >= 0 || t.indexOf("release") >= 0) return "bg-sem-warning-subtle text-sem-warning font-bold";
  return "bg-muted text-muted-foreground";
}

function typeBorderColor(type: string): string {
  var t = type.toLowerCase();
  if (t.indexOf("il") >= 0 || t.indexOf("injured") >= 0) return "border-l-[var(--sem-risk)]";
  if (t.indexOf("call") >= 0 || t.indexOf("recall") >= 0) return "border-l-[var(--sem-success)]";
  if (t.indexOf("trade") >= 0) return "border-l-purple-500";
  if (t.indexOf("dfa") >= 0 || t.indexOf("release") >= 0) return "border-l-[var(--sem-warning)]";
  return "border-l-[var(--sem-neutral)]";
}

export function TransactionsView({ data, app, navigate }: { data: TransactionsData; app: any; navigate: (data: any) => void }) {
  var callToolResult = useCallTool(app);
  var callTool = callToolResult.callTool;
  var loading = callToolResult.loading;

  var handleRefresh = async function(days: number) {
    var result = await callTool("fantasy_transactions", { days: days });
    if (result) navigate(result.structuredContent);
  };

  var transactions = data.transactions || [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">MLB Transactions</h2>
          <p className="text-xs text-muted-foreground">{"Last " + (data.days || 7) + " days"}</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={function() { handleRefresh(3); }} disabled={loading}>3d</Button>
          <Button size="sm" variant="outline" onClick={function() { handleRefresh(7); }} disabled={loading}>7d</Button>
          <Button size="sm" variant="outline" onClick={function() { handleRefresh(14); }} disabled={loading}>14d</Button>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions found.</p>
        ) : (
          <div className="space-y-1.5">
            {transactions.map(function(t, i) {
              return (
                <div key={i} className={"rounded-md border bg-card p-3 border-l-4 flex items-center gap-3 " + typeBorderColor(t.type)}>
                  <div className="shrink-0">
                    <TeamLogo abbrev={t.team} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="secondary" className={"text-xs " + typeColor(t.type)}>{t.type}</Badge>
                      <span className="text-xs text-muted-foreground">{t.team || ""}</span>
                    </div>
                    <p className="text-sm font-semibold truncate">{t.player}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
