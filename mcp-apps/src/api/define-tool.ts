/**
 * define-tool.ts — Thin wrapper around registerAppTool that eliminates
 * per-tool boilerplate: try/catch, toolError, content wrapping, and
 * shouldRegister gating.
 *
 * BEFORE (each tool ~40 lines):
 *   if (shouldRegister("yahoo_foo")) {
 *     registerAppTool(server, "yahoo_foo", { ... }, async (args) => {
 *       try {
 *         ...
 *         return { content: [{ type: "text", text }], structuredContent: { type: "foo", ...data } };
 *       } catch (e) { return toolError(e); }
 *     });
 *   }
 *
 * AFTER (~15 lines):
 *   defineTool(server, "yahoo_foo", { ... }, async (args) => {
 *     ...
 *     return { text, structured: { type: "foo", ...data } };
 *   }, enabledTools);
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpUiAppToolConfig } from "@modelcontextprotocol/ext-apps/server";
import type { AnySchema, ZodRawShapeCompat } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { toolError } from "./python-client.js";
import { shouldRegister as _shouldRegister } from "../toolsets.js";

export interface ToolResult {
  text: string;
  structured?: Record<string, unknown>;
}

/**
 * Register an MCP tool with automatic try/catch, content wrapping, and
 * shouldRegister gating.
 *
 * The handler only needs to return { text, structured? } — this wrapper
 * handles the MCP response envelope and error formatting.
 */
export function defineTool<InputArgs extends undefined | ZodRawShapeCompat | AnySchema = undefined>(
  server: McpServer,
  name: string,
  config: McpUiAppToolConfig & { inputSchema?: InputArgs },
  handler: (args: InputArgs extends undefined ? Record<string, never> : { [K in keyof InputArgs]: unknown }) => Promise<ToolResult>,
  enabledTools?: Set<string>,
): void {
  if (!_shouldRegister(enabledTools, name)) return;
  registerAppTool(
    server,
    name,
    config,
    async function (args: any) {
      try {
        var result = await handler(args);
        var response: any = {
          content: [{ type: "text" as const, text: result.text }],
        };
        if (result.structured) {
          response.structuredContent = result.structured;
        }
        return response;
      } catch (e) {
        return toolError(e);
      }
    } as any,
  );
}
