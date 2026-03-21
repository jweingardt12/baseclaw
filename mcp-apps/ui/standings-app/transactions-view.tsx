import { Badge } from "@plexui/ui/components/Badge";
import { Card, CardContent } from "../components/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@plexui/ui/components/Table";
import { Subheading } from "../components/heading";
import { mlbHeadshotUrl } from "../shared/mlb-images";
import { TeamLogo } from "../shared/team-logo";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { UserPlus, UserMinus, ArrowRightLeft, HelpCircle } from "@/shared/icons";

interface TransactionEntry {
  type: string;
  player: string;
  team?: string;
  date?: string;
  mlb_id?: number;
  fantasy_team?: string;
}

interface TransactionsData {
  trans_type: string;
  transactions: TransactionEntry[];
  ai_recommendation?: string | null;
}

function TypeIcon({ type }: { type: string }) {
  var cls = "h-3.5 w-3.5 flex-shrink-0";
  if (type === "add") return <UserPlus className={cls + " text-green-600"} />;
  if (type === "drop") return <UserMinus className={cls + " text-sem-risk"} />;
  if (type === "trade") return <ArrowRightLeft className={cls + " text-blue-500"} />;
  return <HelpCircle className={cls + " text-muted-foreground"} />;
}

var typeColors: Record<string, string> = {
  add: "success",
  drop: "danger",
  trade: "secondary",
};

function formatDate(dateStr: string): string {
  try {
    var parts = dateStr.split("-");
    if (parts.length < 3) return dateStr;
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var monthIdx = parseInt(parts[1], 10) - 1;
    var day = parseInt(parts[2], 10);
    if (isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) return dateStr;
    return months[monthIdx] + " " + day;
  } catch (_) {
    return dateStr;
  }
}

function groupByDate(transactions: TransactionEntry[]): Record<string, TransactionEntry[]> {
  var groups: Record<string, TransactionEntry[]> = {};
  (transactions || []).forEach(function (t) {
    var key = t.date || "Unknown";
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(t);
  });
  return groups;
}

function countByType(transactions: TransactionEntry[]): Record<string, number> {
  var counts: Record<string, number> = {};
  (transactions || []).forEach(function (t) {
    var type = t.type || "unknown";
    counts[type] = (counts[type] || 0) + 1;
  });
  return counts;
}

export function TransactionsView({ data }: { data: TransactionsData }) {
  var transactions = data.transactions || [];
  var typeCounts = countByType(transactions);
  var typeKeys = Object.keys(typeCounts);
  var hasDateField = transactions.some(function (t) { return !!t.date; });
  var dateGroups = hasDateField ? groupByDate(transactions) : { "": transactions };
  var dateKeys = Object.keys(dateGroups).sort().reverse();

  return (
    <div className="space-y-4">
      <Subheading>
        {"Recent Transactions" + (data.trans_type ? " (" + data.trans_type + ")" : "")}
      </Subheading>

      <AiInsight recommendation={data.ai_recommendation} />

      <div className="kpi-grid">
        <KpiTile value={transactions.length} label="Total Moves" color="primary" />
        {typeCounts["add"] && <KpiTile value={typeCounts["add"]} label="Adds" color="success" />}
        {typeCounts["drop"] && <KpiTile value={typeCounts["drop"]} label="Drops" color="risk" />}
        {typeCounts["trade"] && <KpiTile value={typeCounts["trade"]} label="Trades" color="info" />}
      </div>

      {/* Transaction count badges */}
      {typeKeys.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {typeKeys.map(function (type) {
            return (
              <Badge key={type} color={typeColors[type] || "secondary"}  size="sm" className="font-bold">
                {typeCounts[type] + " " + type + (typeCounts[type] === 1 ? "" : "s")}
              </Badge>
            );
          })}
        </div>
      )}

      {dateKeys.map(function (dateKey) {
        var group = dateGroups[dateKey];
        return (
          <div key={dateKey || "all"} className="mb-4">
            {hasDateField && dateKey && (
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 mt-2">
                {formatDate(dateKey)}
              </div>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  {!hasDateField && (
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Type</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="hidden sm:table-cell">Team</TableHead>
                      </TableRow>
                    </TableHeader>
                  )}
                  <TableBody>
                    {group.map(function (t, i) {
                      return (
                        <TableRow key={dateKey + "-" + i}>
                          <TableCell className="w-24">
                            <div className="flex items-center gap-1.5">
                              <TypeIcon type={t.type} />
                              <Badge color={typeColors[t.type] || "secondary"}  size="sm" className="font-bold">{t.type}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {t.mlb_id && (
                                <img
                                  src={mlbHeadshotUrl(t.mlb_id)}
                                  alt=""
                                  className="w-7 h-7 rounded-full bg-muted object-cover flex-shrink-0"
                                />
                              )}
                              <div>
                                <div className="font-medium text-sm">{t.player}</div>
                                {t.fantasy_team && (
                                  <div className="text-xs text-muted-foreground">{t.fantasy_team}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <TeamLogo abbrev={t.team} />
                              {t.team || "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground mt-2">{transactions.length + " transactions"}</p>
    </div>
  );
}
