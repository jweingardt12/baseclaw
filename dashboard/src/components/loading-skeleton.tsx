export function LoadingSkeleton({ lines = 4, height = "h-4" }: { lines?: number; height?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`${height} rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse`}
          style={{ width: `${100 - i * 10}%` }}
        />
      ))}
    </div>
  );
}
