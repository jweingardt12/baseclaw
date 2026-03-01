# MCP Apps UI/UX Improvement Research

## Scope and method

This review focused on the `mcp-apps` front-end codebase, with emphasis on shared shell patterns, view architecture, responsiveness, accessibility, and interaction consistency.

## Executive summary

The project already has a strong foundation (shared shell, semantic tokens, reusable cards/KPIs, and broad view coverage), but UX quality is constrained by three major issues:

1. **Information density and navigation scalability** across dozens of tools/views.
2. **Interaction consistency gaps** (refresh actions, empty states, progressive disclosure, and feedback loops).
3. **Accessibility and trust gaps** (limited keyboard/screen reader affordances, missing explicit loading semantics, and fragile hardcoded assumptions).

A phased roadmap can materially improve usability without a full rewrite.

---

## What is working well (keep these)

- **Host-aware layout support** is thoughtfully implemented (safe areas, width buckets, fullscreen support) and should remain the base architecture.  
- **Shared design tokens and semantic utility classes** already establish a coherent visual language and make theme-level refinements tractable.  
- **Reusable UI primitives** (`KpiTile`, `AiInsight`, `EmptyState`, etc.) reduce duplication and make systematic improvements possible.

---

## Key UX findings and recommendations

## 1) Reduce cognitive load in high-density views

### Findings
- The UI surface has become very broad: the preview registry wires a large number of views across many groups (Season, Standings, Draft, Roster, MLB, History, Intel), increasing discovery and orientation burden.  
- Some views (e.g., morning briefing) stack many cards and sections in one long scroll, which is powerful but mentally expensive in daily use.

### Recommendations
- Add a **“priority-first” mode** at the top of complex views (show top 3 actions + critical warnings first, collapse the rest).
- Standardize **section collapse/expand** behavior with persisted state (e.g., remember user preferences per view).
- Introduce **progressive disclosure** defaults:
  - show only top N rows for secondary tables,
  - reveal full detail on user intent (“Show all”, “View details”).
- Add a **cross-view command palette** (tool/view jump + quick actions), especially useful as view count grows.

### Expected impact
- Faster daily task completion and lower “where do I start?” friction, especially for morning workflows.

---

## 2) Create a consistent action + feedback model

### Findings
- Tool calls are centralized in `useCallTool`, but error state is local and not surfaced as a consistent app-level toast/banner.
- Refresh interactions are not fully standardized; a shared `RefreshButton` exists but many views still hand-roll refresh buttons.
- App shell loading/error states are clear initially, but there is limited inline status feedback for per-section background refreshes.

### Recommendations
- Add a **global feedback layer** (toast/inline status region) for:
  - tool success confirmations,
  - recoverable failures,
  - partial-data warnings.
- Enforce a **single refresh pattern**:
  - all refresh actions use `RefreshButton` or a shared wrapper,
  - include consistent labels/tooltips and disabled/loading semantics.
- Add **last-updated timestamps** and stale-data indicators in high-frequency views (morning briefing, lineup, waivers).
- Add **optimistic UI for safe idempotent actions** (e.g., auto lineup), with rollback messaging on failures.

### Expected impact
- Better trust and predictability; users know what happened after every action.

---

## 3) Improve accessibility and inclusive interaction

### Findings
- There are very few explicit accessibility patterns in current code (no obvious `aria-live` status regions, no a11y test tooling references).
- Custom interactive elements in preview/navigation patterns rely heavily on visual affordances and may be less robust for keyboard/screen-reader users.
- Semantic colors are strong, but some states rely on color + small badge text only.

### Recommendations
- Add an **accessibility baseline**:
  - `aria-live="polite"` for async tool status and result updates,
  - visible focus styles on all interactive controls,
  - icon-only buttons get `aria-label`s,
  - table wrappers include captions/summaries where needed.
- Introduce **automated a11y checks** in CI for representative views (axe-based tests with Testing Library).
- Add **non-color reinforcement** for status chips (icons/text labels already partly present; make mandatory for all critical statuses).

### Expected impact
- Better usability for keyboard/screen reader users and fewer regressions as view count grows.

---

## 4) Strengthen information architecture and wayfinding

### Findings
- Season app routing is a large switch by tool result type, which works technically but does little to aid user orientation between related workflows.
- App shell knows tool labels but offers limited built-in context aids (e.g., breadcrumb/history/recent tools).

### Recommendations
- Add a **context header contract** for every view:
  - where you are,
  - why this view appeared (triggered tool),
  - next best action.
- Add **lightweight navigation memory**:
  - recently visited tools,
  - “back to previous result” where meaningful.
- Introduce **workflow bundles** in UI (Daily, Weekly, Trade Desk, Injury Response) to map tool complexity to user goals.

### Expected impact
- Better discoverability and reduced context switching.

---

## 5) Mobile ergonomics and data table responsiveness

### Findings
- Base layout includes touch-target and safe-area handling, which is excellent.
- Several data-dense tables still require heavy horizontal compression/hiding columns at small sizes.

### Recommendations
- Provide **card/list fallbacks** for key tables under narrow breakpoints, not just hidden columns.
- For tables that remain tabular, add sticky first column and explicit horizontal scroll hint.
- Add a **compact summary strip** above dense tables (so users can act without full table parsing).

### Expected impact
- Better mobile scannability and fewer missed insights on small displays.

---

## 6) Data confidence and model transparency

### Findings
- AI recommendations are presented as a highlighted block, but confidence, data freshness, and action risk are not always explicit.

### Recommendations
- Standardize an **insight metadata row**:
  - confidence level,
  - data timestamp,
  - risk tag (safe/medium/high impact).
- Separate **“recommended” vs “auto-executed”** actions more visibly.
- Add inline **“why this recommendation”** expansion for complex calls (trade eval, category strategy).

### Expected impact
- Higher user trust and easier decision validation.

---

## Prioritized implementation roadmap

## Phase 1 (1-2 sprints, highest ROI)

1. Standardize refresh + async feedback (shared status/toast contract).
2. Add accessibility minimums (`aria-live`, labels, focus visibility) + baseline a11y tests.
3. Add top-of-view “priority actions” block for Morning Briefing and similar dense views.

## Phase 2 (2-4 sprints)

1. Introduce collapsible section primitives with persisted state.
2. Add mobile table-to-card fallbacks for top 5 most-used dense views.
3. Add data freshness/confidence metadata to `AiInsight` and KPI header rows.

## Phase 3 (strategic)

1. Command palette + recent-tools navigation.
2. Workflow-oriented navigation overlays (Daily/Weekly/Trade).
3. UX telemetry loop (time-to-first-action, action completion, retries, abandonment).

---

## Suggested success metrics

- **Time-to-first-action** in Morning Briefing (target: down 25%).
- **Tool retry rate** after user actions (target: down 20%).
- **Critical action completion rate** (injury/lineup fixes done in-session; target: up 15%).
- **A11y score / violation count** on key views (target: zero serious violations).
- **Mobile engagement parity** (reduced drop-off on narrow widths).

---

## Technical implementation notes

- Favor **shared primitives over one-off view fixes** to keep >50 views maintainable.
- Add a **view contract checklist** (header, empty state, loading state, error state, action feedback, a11y labels).
- Use preview app groups as a **UX QA harness** once standardized interaction patterns are introduced.

