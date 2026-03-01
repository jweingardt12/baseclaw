import { Badge } from "../components/ui/badge";
import { useCallTool } from "../shared/use-call-tool";
import { Loader2, MessageSquare, ArrowUp } from "@/shared/icons";
import { Button } from "../components/ui/button";

interface RedditPost {
  title: string;
  score: number;
  num_comments: number;
  url?: string;
  flair?: string;
  category?: string;
}

interface RedditData {
  type: string;
  posts: RedditPost[];
  ai_recommendation?: string | null;
}

function flairColor(flair: string | undefined): string {
  if (!flair) return "bg-muted text-muted-foreground";
  var f = flair.toLowerCase();
  if (f.indexOf("hype") >= 0 || f.indexOf("breakout") >= 0) return "bg-sem-success-subtle text-sem-success font-bold";
  if (f.indexOf("injury") >= 0) return "bg-sem-risk-subtle text-sem-risk font-bold";
  if (f.indexOf("waiver") >= 0 || f.indexOf("pickup") >= 0) return "bg-sem-info-subtle text-sem-info font-bold";
  if (f.indexOf("trade") >= 0) return "bg-purple-500/20 text-purple-700 dark:text-purple-400 font-bold";
  if (f.indexOf("prospect") >= 0) return "bg-sem-warning-subtle text-sem-warning font-bold";
  return "bg-muted text-muted-foreground";
}

function scoreColor(score: number): string {
  if (score >= 100) return "text-sem-success";
  if (score >= 50) return "text-sem-info";
  if (score >= 20) return "text-sem-warning";
  return "text-muted-foreground";
}

export function RedditView({ data, app, navigate }: { data: RedditData; app: any; navigate: (data: any) => void }) {
  var callToolResult = useCallTool(app);
  var callTool = callToolResult.callTool;
  var loading = callToolResult.loading;
  var isTrending = data.type === "intel-trending";
  var title = isTrending ? "Trending Players" : "Reddit Fantasy Baseball Buzz";

  var handleRefreshBuzz = async function() {
    var result = await callTool("fantasy_reddit_buzz", {});
    if (result) navigate(result.structuredContent);
  };

  var handleRefreshTrending = async function() {
    var result = await callTool("fantasy_trending_players", {});
    if (result) navigate(result.structuredContent);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleRefreshBuzz} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buzz"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleRefreshTrending} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Trending"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {(data.posts || []).length === 0 && (
          <p className="text-sm text-muted-foreground">No posts found.</p>
        )}
        {(data.posts || []).map(function(post, i) {
          return (
            <div key={i} className="rounded-md border bg-card p-3 space-y-2">
              <div className="flex items-start gap-3">
                {/* Score column */}
                <div className={"flex flex-col items-center shrink-0 pt-0.5 " + scoreColor(post.score)}>
                  <ArrowUp size={16} className="font-bold" />
                  <span className="text-lg font-bold font-mono">{post.score}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {post.flair && (
                    <Badge variant="secondary" className={"text-xs mb-1 " + flairColor(post.flair)}>{post.flair}</Badge>
                  )}
                  <p className="text-sm font-semibold leading-tight">{post.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                    <span className="flex items-center gap-0.5">
                      <MessageSquare size={12} />
                      {post.num_comments + " comments"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
