interface AiInsightProps {
  recommendation: string | null | undefined;
}

// Disabled — these banners add no value in MCP app context since Claude
// already provides analysis in the chat. Returns null to avoid breaking
// any existing imports/usage across ~45 view files.
export function AiInsight(_props: AiInsightProps) {
  return null;
}
