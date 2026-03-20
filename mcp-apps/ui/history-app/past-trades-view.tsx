import { Badge } from "../catalyst/badge";
import { Button } from "../catalyst/button";
import { useCallTool } from "../shared/use-call-tool";

import { ChevronLeft, ChevronRight, Loader2, ArrowRightLeft } from "@/shared/icons";

interface PastTrade {
  team1: string;
  team2: string;
  players1: string[];
  players2: string[];
}

interface PastTradesData {
  year: number;
  trades: PastTrade[];
}

export function PastTradesView({ data, app, navigate }: { data: PastTradesData; app: any; navigate: (data: any) => void }) {
  const { callTool, loading } = useCallTool(app);

  const changeYear = async (year: number) => {
    const result = await callTool("yahoo_past_trades", { year });
    if (result) {
      navigate(result.structuredContent);
    }
  };

  var trades = data.trades || [];

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <Button outline disabled={data.year <= 2011 || loading} onClick={() => changeYear(data.year - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-bold">{"Trades - " + data.year}</span>
        <Button outline disabled={data.year >= 2026 || loading} onClick={() => changeYear(data.year + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {trades.length === 0 ? (
          <div className="surface-card p-4 text-center">
            <p className="text-sm text-muted-foreground font-semibold">No trades for this season.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trades.map(function (t, i) {
              return (
                <div key={i} className="surface-card p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-start">
                    <div>
                      <p className="text-sm font-bold mb-2">{t.team1 + " sends:"}</p>
                      <div className="flex flex-wrap gap-1">
                        {(t.players1 || []).map(function (p) {
                          return <Badge key={p} color="zinc" className="text-xs font-semibold">{p}</Badge>;
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRightLeft size={16} className="text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-bold mb-2">{t.team2 + " sends:"}</p>
                      <div className="flex flex-wrap gap-1">
                        {(t.players2 || []).map(function (p) {
                          return <Badge key={p} color="zinc" className="text-xs font-semibold">{p}</Badge>;
                        })}
                      </div>
                    </div>
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
