import { useState, useCallback } from "react";

interface UseCallToolReturn {
  callTool: (name: string, args?: Record<string, any>) => Promise<any>;
  loading: boolean;
  error: string | null;
}

export function useCallTool(app: any): UseCallToolReturn {
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState<string | null>(null);

  var callTool = useCallback(async function (name: string, args?: Record<string, any>) {
    if (!app) {
      setError("App context not available");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      var result = await app.callServerTool({ name, arguments: args || {} });
      return result;
    } catch (err: any) {
      var msg = err && err.message ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [app]);

  return { callTool, loading, error };
}
