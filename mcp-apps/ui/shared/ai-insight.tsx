import { Sparkles } from "@/shared/icons";
import { Text } from "../catalyst/text";

interface AiInsightProps {
  recommendation: string | null | undefined;
}

export function AiInsight({ recommendation }: AiInsightProps) {
  if (!recommendation) return null;

  return (
    <div className="rounded-md border border-blue-200 dark:border-blue-800 border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={14} className="text-blue-500" />
        <span className="text-xs font-semibold text-muted-foreground">AI Insight</span>
      </div>
      <Text>{recommendation}</Text>
    </div>
  );
}
