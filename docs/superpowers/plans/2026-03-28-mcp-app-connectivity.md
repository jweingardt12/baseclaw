# MCP App Connectivity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire structuredContent for 3 tools (waiver, streaming, trade analysis) and add cross-view navigation links so the MCP apps feel connected instead of isolated.

**Architecture:** Each tool handler adds `structuredContent: { type: "view-name", ...data }` alongside existing text content. Views already exist. Cross-links use the established `useCallTool` + `navigate` pattern.

**Tech Stack:** TypeScript, Preact (aliased as React), Tailwind v4, MCP SDK ext-apps

---

### Task 1: Wire `yahoo_waiver_recommendations` → `waiver-analyze` view

**Files:**
- Modify: `mcp-apps/src/tools/workflow-tools.ts:232-234`

- [ ] **Step 1: Add structuredContent to the return**

In `mcp-apps/src/tools/workflow-tools.ts`, find the return at line 232:
```typescript
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
```

Replace with:
```typescript
        var waiver_b = data.batters || {};
        var waiver_p = data.pitchers || {};

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: {
            type: "waiver-analyze",
            ...waiver_b,
            ai_recommendation: data.ai_recommendation,
          },
        };
```

Note: The `waiver-analyze` view expects `WaiverAnalyzeResponse` shape: `{ pos_type, weak_categories, recommendations, drop_candidates, season_context }`. The workflow response wraps batters + pitchers — we send the batter data by default.

- [ ] **Step 2: Verify the view is registered in season-app**

Check `mcp-apps/ui/season-app/main.tsx` has `case "waiver-analyze"`. It should already be there.

- [ ] **Step 3: Build and test**

```bash
cd mcp-apps && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/tools/workflow-tools.ts
git commit -m "feat: wire waiver_recommendations → waiver-analyze view"
```

---

### Task 2: Wire `yahoo_streaming` → `streaming` view

**Files:**
- Modify: `mcp-apps/src/tools/season-tools.ts:259-261`

- [ ] **Step 1: Add structuredContent to the return**

In `mcp-apps/src/tools/season-tools.ts`, find the return at line 259:
```typescript
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
```

Replace with:
```typescript
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: { type: "streaming", ...data },
        };
```

- [ ] **Step 2: Build and test**

```bash
cd mcp-apps && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/season-tools.ts
git commit -m "feat: wire streaming → streaming view"
```

---

### Task 3: Wire `yahoo_trade_analysis` → `trade-eval` view

**Files:**
- Modify: `mcp-apps/src/tools/workflow-tools.ts:545-547`

- [ ] **Step 1: Add structuredContent to the return**

The trade analysis handler builds detailed text AND has `data.trade_eval` with the full evaluation. In `mcp-apps/src/tools/workflow-tools.ts`, find the return at line 545:
```typescript
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
```

Replace with:
```typescript
        var te = data.trade_eval || {};
        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
          structuredContent: {
            type: "trade-eval",
            ...te,
            ai_recommendation: data.ai_recommendation,
          },
        };
```

Note: `te` is already defined earlier in the handler (line 312). Use the existing variable instead of re-declaring.

- [ ] **Step 2: Build and test**

```bash
cd mcp-apps && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/workflow-tools.ts
git commit -m "feat: wire trade_analysis → trade-eval view"
```

---

### Task 4: Add "What's Next" buttons to action-view

**Files:**
- Modify: `mcp-apps/ui/roster-app/action-view.tsx`

- [ ] **Step 1: Add navigation buttons after success**

Read the file. Find the "Back to Roster" button. After it, add:

```typescript
import { useCallTool } from "../shared/use-call-tool";

// Inside the component, add:
var { callTool: callNext, loading: nextLoading } = useCallTool(app);

// After the "Back to Roster" button:
{data.success && (
  <div className="flex items-center gap-2 flex-wrap mt-2">
    <Button variant="outline" size="sm" disabled={nextLoading} onClick={async function () {
      var result = await callNext("yahoo_waiver_recommendations", { count: 5 });
      if (result && navigate) navigate(result.structuredContent);
    }}>Waiver Analysis</Button>
    <Button variant="outline" size="sm" disabled={nextLoading} onClick={async function () {
      var result = await callNext("yahoo_lineup_optimize", {});
      if (result && navigate) navigate(result.structuredContent);
    }}>Check Lineup</Button>
  </div>
)}
```

- [ ] **Step 2: Build and test**

```bash
cd mcp-apps && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add ui/roster-app/action-view.tsx
git commit -m "feat: add what's-next buttons to action confirmation"
```

---

### Task 5: Add cross-view navigation links

**Files:**
- Modify: `mcp-apps/ui/season-app/injury-report-view.tsx`
- Modify: `mcp-apps/ui/season-app/waiver-analyze-view.tsx`
- Modify: `mcp-apps/ui/season-app/streaming-view.tsx`
- Modify: `mcp-apps/ui/season-app/trade-eval-view.tsx`

- [ ] **Step 1: injury-report → "Find Replacements"**

Read `injury-report-view.tsx`. Add a "Find Replacements" button when `injured_active.length > 0`:

```typescript
var { callTool: callNav, loading: navLoading } = useCallTool(app);

// At the bottom of the view:
{(data.injured_active || []).length > 0 && (
  <Button variant="secondary" size="sm" disabled={navLoading} onClick={async function () {
    var result = await callNav("yahoo_waiver_recommendations", { count: 10 });
    if (result && navigate) navigate(result.structuredContent);
  }}>Find Replacements</Button>
)}
```

- [ ] **Step 2: waiver-analyze → "Check Category Impact"**

Read `waiver-analyze-view.tsx`. Add at the bottom:

```typescript
<Button variant="outline" size="sm" disabled={loading} onClick={async function () {
  var result = await callTool("yahoo_category_check", {});
  if (result && navigate) navigate(result.structuredContent);
}}>Check Category Impact</Button>
```

Note: `callTool` and `loading` already exist from `useCallTool(app)`.

- [ ] **Step 3: streaming → "Check Categories"**

Same pattern in `streaming-view.tsx`.

- [ ] **Step 4: trade-eval → "Build Another Trade"**

Read `trade-eval-view.tsx`. Add at the bottom:

```typescript
<Button variant="outline" size="sm" disabled={loading} onClick={async function () {
  var result = await callTool("yahoo_trade_builder", {});
  if (result && navigate) navigate(result.structuredContent);
}}>Build Another Trade</Button>
```

- [ ] **Step 5: Build and test**

```bash
cd mcp-apps && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add ui/season-app/injury-report-view.tsx ui/season-app/waiver-analyze-view.tsx ui/season-app/streaming-view.tsx ui/season-app/trade-eval-view.tsx
git commit -m "feat: add cross-view navigation links between related views"
```

---

### Task 6: Build, deploy, and verify

- [ ] **Step 1: Full build**

```bash
cd mcp-apps && npm run build
```

- [ ] **Step 2: Docker deploy**

```bash
cd /Users/jason/Docker/yahoo-fantasy && docker compose up -d --build
```

- [ ] **Step 3: Test waiver recommendations**

```bash
curl -s "http://localhost:8766/api/workflow/waiver-recommendations?count=5" | python3 -c "import json,sys; d=json.load(sys.stdin); print('keys:', sorted(d.keys()))"
```

- [ ] **Step 4: Commit all and push**

```bash
git add -A && git commit -m "feat: MCP app connectivity — wire 3 tools + cross-view navigation" && git push origin main
```
