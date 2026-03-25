import { Badge } from "@/components/ui/badge";
import { Subheading } from "../components/heading";
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
      <div className="surface-card p-5">
        <Subheading level={3} className={"mb-3 " + colorClass}>{title}</Subheading>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <Badge key={c.display_name} variant="secondary" className="text-sm py-1 px-3 font-bold">
              {c.display_name}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Subheading>Stat Categories</Subheading>

      <AiInsight recommendation={data.ai_recommendation} />

      {renderGroup("Batting", batting, "text-sem-success")}
      {renderGroup("Pitching", pitching, "text-sem-info")}
      {renderGroup("Other", other, "text-muted-foreground")}
    </div>
  );
}
