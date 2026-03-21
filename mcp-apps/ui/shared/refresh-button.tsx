import { Button } from "@plexui/ui/components/Button";
import { useCallTool } from "./use-call-tool";
import { RefreshCw } from "@/shared/icons";

interface RefreshButtonProps {
  app: any;
  toolName: string;
  toolArgs?: Record<string, any>;
  navigate: (data: any) => void;
}

export function RefreshButton({ app, toolName, toolArgs, navigate }: RefreshButtonProps) {
  var { callTool, loading } = useCallTool(app);

  var handleRefresh = async function () {
    var result = await callTool(toolName, toolArgs || {});
    if (result && result.structuredContent) {
      navigate(result.structuredContent);
    }
  };

  return (
    <Button variant="ghost" color="secondary" onClick={handleRefresh} disabled={loading} uniform size="sm">
      <RefreshCw className={"h-3.5 w-3.5" + (loading ? " animate-spin" : "")} />
    </Button>
  );
}
