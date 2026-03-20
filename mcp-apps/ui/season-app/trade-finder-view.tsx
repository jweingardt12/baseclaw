import { useState } from "react";
import { Badge } from "../catalyst/badge";
import { Button } from "../catalyst/button";
import { Card, CardHeader, CardTitle, CardContent } from "../catalyst/card";
import { AlertDialog } from "../catalyst/alert-dialog";
import { Subheading } from "../catalyst/heading";
import { useCallTool } from "../shared/use-call-tool";
import { RefreshButton } from "../shared/refresh-button";
import { PlayerCell } from "../shared/player-row";
import { EmptyState } from "../shared/empty-state";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { ArrowRightLeft, BarChart3, Send, Loader2, Search } from "@/shared/icons";
import { formatFixed } from "../shared/number-format";

interface TradePackagePlayer {
  name: string;
  player_id: string;
  positions: string[];
  status?: string;
}

interface TradePackage {
  give: TradePackagePlayer[];
  get: TradePackagePlayer[];
  rationale: string;
}

interface TradePartner {
  team_key: string;
  team_name: string;
  score: number;
  complementary_categories: string[];
  their_hitters: TradePackagePlayer[];
  their_pitchers: TradePackagePlayer[];
  packages: TradePackage[];
}

interface TradeFinderData {
  weak_categories: string[];
  strong_categories: string[];
  partners: TradePartner[];
  ai_recommendation?: string | null;
}

export function TradeFinderView({ data, app, navigate }: { data: TradeFinderData; app: any; navigate: (data: any) => void }) {
  var { callTool, loading } = useCallTool(app);
  var [proposePkg, setProposePkg] = useState<{ partner: TradePartner; pkg: TradePackage } | null>(null);
  var partners = data.partners || [];

  var handleEvaluate = async (pkg: TradePackage) => {
    var giveIds = (pkg.give || []).map((p) => p.player_id).join(",");
    var getIds = (pkg.get || []).map((p) => p.player_id).join(",");
    var result = await callTool("yahoo_trade_eval", { give_ids: giveIds, get_ids: getIds });
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  var handlePropose = async () => {
    if (!proposePkg) return;
    var giveIds = (proposePkg.pkg.give || []).map((p) => p.player_id).join(",");
    var getIds = (proposePkg.pkg.get || []).map((p) => p.player_id).join(",");
    var result = await callTool("yahoo_propose_trade", {
      their_team_key: proposePkg.partner.team_key,
      your_player_ids: giveIds,
      their_player_ids: getIds,
    });
    setProposePkg(null);
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  return (
    <div className="space-y-2">
      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={partners.length} label="Partners" color={partners.length > 0 ? "success" : "neutral"} />
      </div>

      <div className="flex items-center justify-between">
        <Subheading className="flex items-center gap-2">
          <Search size={18} />
          Trade Finder
        </Subheading>
        <RefreshButton app={app} toolName="yahoo_trade_finder" navigate={navigate} />
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Category summary */}
      <div className="space-y-2">
        {data.weak_categories?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Weak:</span>
            {data.weak_categories.map((c) => (
              <Badge key={c} color="red" className="text-xs">{c}</Badge>
            ))}
          </div>
        )}
        {data.strong_categories?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Strong:</span>
            {data.strong_categories.map((c) => (
              <Badge key={c} className="text-xs bg-sem-success">{c}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Trade Partners */}
      {partners.length === 0 && (
        <EmptyState
          icon={ArrowRightLeft}
          title="No complementary trade partners found"
          description="No teams have matching strength/weakness profiles for a mutually beneficial trade."
        />
      )}

      {partners.map((partner) => (
        <Card key={partner.team_key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {partner.team_name}
              <Badge color="zinc" className="text-xs">
                Score: {formatFixed(partner.score, 1, "0.0")}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-1 flex-wrap mt-1">
              <span className="text-xs text-muted-foreground">Complementary:</span>
              {(partner.complementary_categories || []).map((c) => (
                <Badge key={c} color="zinc" className="text-xs">{c}</Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(partner.packages || []).map((pkg, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Give</p>
                    {(pkg.give || []).map((p, j) => (
                      <div key={j} className="text-sm py-0.5">
                        <PlayerCell player={p} app={app} navigate={navigate} context="trade" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Get</p>
                    {(pkg.get || []).map((p, j) => (
                      <div key={j} className="text-sm py-0.5">
                        <PlayerCell player={p} app={app} navigate={navigate} context="trade" />
                      </div>
                    ))}
                  </div>
                </div>
                {pkg.rationale && (
                  <p className="text-xs text-muted-foreground italic">{pkg.rationale}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button outline onClick={() => handleEvaluate(pkg)} disabled={loading}>
                    <BarChart3 size={14} className="mr-1" />
                    Evaluate
                  </Button>
                  <Button onClick={() => setProposePkg({ partner, pkg })} disabled={loading}>
                    <Send size={14} className="mr-1" />
                    Propose
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <AlertDialog
        open={proposePkg !== null}
        onClose={() => setProposePkg(null)}
        onConfirm={handlePropose}
        title="Propose Trade?"
        description={proposePkg ? (
          "Send trade proposal to " + proposePkg.partner.team_name + "? "
          + "Give: " + (proposePkg.pkg.give || []).map((p) => p.name).join(", ")
          + " — Get: " + (proposePkg.pkg.get || []).map((p) => p.name).join(", ")
        ) : ""}
        confirmLabel="Send Proposal"
      />
    </div>
  );
}
