import { Badge } from "../components/ui/badge";
import { AiInsight } from "../shared/ai-insight";

interface StatCategory {
  display_name: string;
  name?: string;
  position_type?: string;
}

export function StatCategoriesView({ data }: { data: { categories: StatCategory[]; ai_recommendation?: string | null } }) {
  var batting = (data.categories || []).filter((c) => c.position_type === "B");
  var pitching = (data.categories || []).filter((c) => c.position_type === "P");
  var other = (data.categories || []).filter((c) => !c.position_type);

  var renderGroup = function (title: string, cats: StatCategory[], colorClass: string) {
    if (cats.length === 0) return null;
    return (
      <div className="rounded-md border bg-card p-4">
        <h3 className={"text-base font-semibold mb-3 " + colorClass}>{title}</h3>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <Badge key={c.display_name} variant="outline" className="text-sm py-1 px-3 font-bold">
              {c.display_name}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Stat Categories</h2>

      <AiInsight recommendation={data.ai_recommendation} />

      {renderGroup("Batting", batting, "text-sem-success")}
      {renderGroup("Pitching", pitching, "text-sem-info")}
      {renderGroup("Other", other, "text-muted-foreground")}
    </div>
  );
}
