import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Subheading } from "../components/heading";
import { Text } from "../components/text";
import { useCallTool } from "../shared/use-call-tool";
import { AiInsight } from "../shared/ai-insight";
import { KpiTile } from "../shared/kpi-tile";
import { TrendingUp, TrendingDown, Loader2 } from "@/shared/icons";
import { formatFixed } from "../shared/number-format";

interface Candidate {
  name: string;
  woba: number;
  xwoba: number;
  diff: number;
  pa: number;
}

interface BreakoutsData {
  type: string;
  pos_type: string;
  candidates: Candidate[];
  ai_recommendation?: string | null;
}

export function BreakoutsView({ data, app, navigate }: { data: BreakoutsData; app: any; navigate: (data: any) => void }) {
  var callToolResult = useCallTool(app);
  var callTool = callToolResult.callTool;
  var loading = callToolResult.loading;
  var isBreakouts = data.type === "intel-breakouts";
  var title = isBreakouts ? "Breakout Candidates" : "Bust Candidates";
  var subtitle = isBreakouts
    ? "Players whose expected stats exceed actual -- due for positive regression"
    : "Players whose actual stats exceed expected -- due for negative regression";
  var Icon = isBreakouts ? TrendingUp : TrendingDown;
  var candidates = data.candidates || [];

  var handleTabChange = async function(value: string) {
    var tool = isBreakouts ? "fantasy_breakout_candidates" : "fantasy_bust_candidates";
    var result = await callTool(tool, { pos_type: value, count: 15 });
    if (result) navigate(result.structuredContent);
  };

  return (
    <div className="space-y-2">
      <div>
        <Subheading className="flex items-center gap-2">
          <Icon size={18} />
          {title} - {data.pos_type === "P" ? "Pitchers" : "Hitters"}
        </Subheading>
        <Text className="mt-1">{subtitle}</Text>
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        <KpiTile
          value={candidates.length}
          label={isBreakouts ? "Breakout Candidates" : "Bust Candidates"}
          color={isBreakouts ? "success" : "risk"}
        />
        {candidates.length > 0 && (
          <KpiTile
            value={(isBreakouts ? "+" : "") + formatFixed(candidates[0].diff, 3, "0.000")}
            label={"Top Diff: " + candidates[0].name}
            color={isBreakouts ? "success" : "risk"}
          />
        )}
      </div>

      <AiInsight recommendation={data.ai_recommendation} />

      <Tabs value={data.pos_type || "B"} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="B">Hitters</TabsTrigger>
          <TabsTrigger value="P">Pitchers</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        {loading && (
          <div className="loading-overlay">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="w-full overflow-x-auto mcp-app-scroll-x">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right hidden sm:table-cell">wOBA</TableHead>
              <TableHead className="text-right hidden sm:table-cell">xwOBA</TableHead>
              <TableHead className="text-right">Diff</TableHead>
              <TableHead className="text-right hidden sm:table-cell">PA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map(function(c, i) {
              var diffColor = isBreakouts ? "text-green-600 dark:text-green-400" : "text-red-500";
              return (
                <TableRow key={c.name + "-" + i} className={i < 3 ? (isBreakouts ? "bg-green-500/5" : "bg-red-500/5") : ""}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right font-mono text-xs hidden sm:table-cell">{formatFixed(c.woba, 3, "0.000")}</TableCell>
                  <TableCell className="text-right font-mono text-xs hidden sm:table-cell">{formatFixed(c.xwoba, 3, "0.000")}</TableCell>
                  <TableCell className={"text-right font-mono text-xs font-semibold " + diffColor}>
                    {(isBreakouts ? "+" : "") + formatFixed(c.diff, 3, "0.000")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs hidden sm:table-cell">{c.pa}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </div>
      <Text>
        {isBreakouts
          ? "Higher diff = more unlucky. These players are performing below their expected stats and should improve."
          : "Higher diff = more lucky. These players are performing above their expected stats and may regress."}
      </Text>
    </div>
  );
}
