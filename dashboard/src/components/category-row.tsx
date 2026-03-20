import clsx from "clsx";

interface CategoryRowProps {
  category: string;
  myValue: string;
  oppValue: string;
  result: "win" | "loss" | "tie";
}

export function CategoryRow({ category, myValue, oppValue, result }: CategoryRowProps) {
  const myNum = parseFloat(myValue) || 0;
  const oppNum = parseFloat(oppValue) || 0;
  const total = myNum + oppNum;
  const pct = total > 0 ? (myNum / total) * 100 : 50;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span
          className={clsx(
            "tabular-nums",
            result === "win"
              ? "font-semibold text-green-600 dark:text-green-400"
              : "text-zinc-500 dark:text-zinc-400"
          )}
        >
          {myValue || "–"}
        </span>
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {category}
        </span>
        <span
          className={clsx(
            "tabular-nums",
            result === "loss"
              ? "font-semibold text-red-600 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-400"
          )}
        >
          {oppValue || "–"}
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        <div
          className={clsx(
            "transition-all rounded-full",
            result === "win"
              ? "bg-green-500"
              : result === "tie"
              ? "bg-zinc-400"
              : "bg-red-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
