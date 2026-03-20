import { useState } from "react";
import { Text } from "@/catalyst/text";
import * as api from "@/lib/api";

interface CategorySimResultProps {
  result: Record<string, unknown> | null;
}

export function CategorySimResult({ result }: CategorySimResultProps) {
  if (!result) return null;
  if ((result as any).error) return <Text className="text-xs text-red-500">{String((result as any).error)}</Text>;

  return (
    <div className="space-y-1.5">
      {Object.entries(result)
        .filter(([k]) => !["error", "status"].includes(k))
        .slice(0, 20)
        .map(([key, val]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">{key.replace(/_/g, " ")}</span>
            <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
              {typeof val === "number" ? (val > 0 ? "+" : "") + val.toFixed(2) : String(val)}
            </span>
          </div>
        ))}
    </div>
  );
}

export function useCategorySim() {
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const simulate = async (playerName: string) => {
    setSimLoading(true);
    try {
      const result = await api.categorySimulate(playerName);
      setSimResult(result);
    } catch (err: any) {
      setSimResult({ error: err.message || "Simulation failed" });
    }
    setSimLoading(false);
  };

  return { simResult, simLoading, simulate, setSimResult };
}
