import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../catalyst/card";
import { Badge } from "../catalyst/badge";
import { Button } from "../catalyst/button";
import { Subheading } from "../catalyst/heading";
import { KpiTile } from "../shared/kpi-tile";
import { Copy, Check, MessageSquare } from "@/shared/icons";

interface TrashTalkContext {
  your_rank: number | string;
  their_rank: number | string;
  score: string;
}

interface TrashTalkResponse {
  opponent: string;
  intensity: string;
  week: number | string;
  context: TrashTalkContext;
  lines: string[];
  featured_line: string;
}

function intensityColor(intensity: string): string {
  if (intensity === "savage" || intensity === "high") return "bg-sem-risk";
  if (intensity === "medium" || intensity === "moderate") return "bg-sem-warning";
  return "bg-sem-success";
}

export function TrashTalkView({ data, app, navigate }: { data: TrashTalkResponse; app?: any; navigate?: (data: any) => void }) {
  var [copied, setCopied] = useState(false);

  var ctx = data.context || { your_rank: "?", their_rank: "?", score: "" };

  var handleCopy = function () {
    navigator.clipboard.writeText(data.featured_line || "").then(function () {
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 2000);
    });
  };

  return (
    <div className="space-y-2">
      <div className="kpi-grid">
        <KpiTile value={String(ctx.your_rank)} label="Your Rank" color="success" />
        <KpiTile value={String(ctx.their_rank)} label="Their Rank" color="risk" />
        <KpiTile value={(data.lines || []).length} label="Lines" color="info" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <Subheading>Trash Talk</Subheading>
      </div>

      {/* Opponent + Week */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Week {data.week}</p>
          <p className="font-semibold">vs. {data.opponent}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={intensityColor(data.intensity) + " text-xs"}>{data.intensity}</Badge>
          {ctx.score && <Badge color="zinc" className="text-xs">{ctx.score}</Badge>}
        </div>
      </div>

      {/* Featured Line */}
      <Card>
        <CardContent className="p-4">
          <p className="text-lg italic leading-relaxed text-center">"{data.featured_line}"</p>
          <div className="flex justify-center mt-3">
            <Button outline onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-sem-success" />
                  <span className="text-sem-success">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Context Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge color="zinc" className="text-xs">Your Rank: {ctx.your_rank}</Badge>
        <Badge color="zinc" className="text-xs">Their Rank: {ctx.their_rank}</Badge>
        {ctx.score && <Badge color="zinc" className="text-xs">Score: {ctx.score}</Badge>}
      </div>

      {/* Additional Lines */}
      {(data.lines || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">More Lines</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {(data.lines || []).map(function (line, idx) {
                return (
                  <li key={idx} className="flex gap-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground mt-0.5">{idx + 1}.</span>
                    <span>{line}</span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
