import { Skeleton } from "../catalyst/skeleton";
import { Card, CardHeader, CardContent } from "../catalyst/card";

export function ViewSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPI row */}
      <div className="kpi-grid">
        {[1, 2, 3, 4].map(function (i) {
          return (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-5 w-40" />
      </div>

      {/* Card */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4].map(function (i) {
            return (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-10" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
