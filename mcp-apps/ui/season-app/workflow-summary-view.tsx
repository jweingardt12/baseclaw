import { Card, CardHeader, CardTitle, CardContent } from "../components/card";
import { Badge } from "@/components/ui/badge";
import { AiInsight } from "../shared/ai-insight";
import { EmptyState } from "../shared/empty-state";
import { FileText } from "@/shared/icons";

interface WorkflowSummaryData {
  type?: string;
  ai_recommendation?: string | null;
  summary?: string;
  action_items?: Array<{ priority?: number; message?: string; type?: string }>;
  [key: string]: any;
}

function titleFromType(typeName?: string): string {
  if (!typeName) return "Workflow Summary";
  return typeName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function isScalar(value: unknown): boolean {
  return ["string", "number", "boolean"].includes(typeof value);
}

export function WorkflowSummaryView({ data }: { data: WorkflowSummaryData }) {
  var title = titleFromType(data.type);
  var actionItems = data.action_items || [];

  var scalarEntries = Object.entries(data)
    .filter(([k, v]) => !["type", "ai_recommendation", "action_items"].includes(k) && isScalar(v))
    .slice(0, 8);

  var listEntries = Object.entries(data)
    .filter(([k, v]) => !["action_items"].includes(k) && Array.isArray(v) && (v as any[]).length > 0)
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <AiInsight recommendation={data.ai_recommendation || data.summary || null} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {scalarEntries.length === 0 && actionItems.length === 0 && listEntries.length === 0 ? (
            <EmptyState title="No workflow details available" description="Run the workflow again to refresh details." />
          ) : null}

          {scalarEntries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {scalarEntries.map(([key, value]) => (
                <div key={key} className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">{key.replace(/_/g, " ")}</p>
                  <p className="text-sm font-medium break-words">{String(value)}</p>
                </div>
              ))}
            </div>
          )}

          {actionItems.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-semibold">Action Items</p>
              {actionItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Badge variant="secondary">P{item.priority || 3}</Badge>
                  <span className="text-sm">{item.message || item.type || "Action"}</span>
                </div>
              ))}
            </div>
          )}

          {listEntries.length > 0 && (
            <div className="space-y-2">
              {listEntries.map(([key, value]) => (
                <div key={key} className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground mb-1">{key.replace(/_/g, " ")}</p>
                  <p className="text-sm">{(value as any[]).length} item(s)</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
