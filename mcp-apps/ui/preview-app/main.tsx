import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { fetchViewData, createLiveApp } from "./live-data";
import { createMockApp } from "./mock-app";
import { VIEW_GROUPS, type ViewDef } from "./view-registry";
import { ViewSkeleton } from "../shared/view-skeleton";

import "./preview.css";

const IS_PUBLIC_PREVIEW = Boolean(import.meta.env.VITE_PUBLIC_PREVIEW);

class ViewErrorBoundary extends React.Component<
  { viewId: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { viewId: string }) {
    if (prev.viewId !== this.props.viewId) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <div className="text-destructive text-base font-semibold mb-2">View crashed</div>
          <p className="text-muted-foreground text-sm mb-1">{this.state.error.message}</p>
          <pre className="text-xs text-muted-foreground bg-muted rounded p-3 max-w-full overflow-x-auto mb-4 text-left">
            {this.state.error.stack}
          </pre>
          <Button size="sm" onClick={() => this.setState({ error: null })}>
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function DarkModeToggle({ darkMode, setDarkMode }: { darkMode: boolean; setDarkMode: (v: boolean) => void }) {
  return (
    <Button
      size="icon-sm"
      variant="outline"
      onClick={() => setDarkMode(!darkMode)}
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}

function PreviewApp() {
  const [activeView, setActiveView] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("view") || "morning-briefing";
    } catch {
      return "morning-briefing";
    }
  });
  const [dataSource, setDataSourceRaw] = useState<"mock" | "live">("mock");
  const [liveData, setLiveData] = useState<any>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveApp] = useState(() => createLiveApp());
  const [mockData, setMockData] = useState<Record<string, any> | null>(null);
  const [overlayData, setOverlayData] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const value = localStorage.getItem("preview-dark");
      return value === null ? true : value === "1";
    } catch {
      return true;
    }
  });
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [sortMode, setSortMode] = useState<"featured" | "alpha" | "recent">("featured");
  const [recentViews, setRecentViews] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("preview-recent-views");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const mockDataRef = useRef<Record<string, any> | null>(null);
  const [mockApp] = useState(() => createMockApp(() => mockDataRef.current));
  const previewSectionRef = useRef<HTMLElement | null>(null);

  const effectiveDataSource = IS_PUBLIC_PREVIEW ? "mock" : dataSource;

  const { allViews, viewById, groupByViewId } = useMemo(() => {
    const all = VIEW_GROUPS.flatMap((group) => group.views);
    const byId = new Map<string, ViewDef>();
    const byGroup = new Map<string, string>();
    for (const group of VIEW_GROUPS) {
      for (const view of group.views) {
        byId.set(view.id, view);
        byGroup.set(view.id, group.name);
      }
    }
    return { allViews: all, viewById: byId, groupByViewId: byGroup };
  }, []);

  const groupNames = useMemo(() => ["All", ...VIEW_GROUPS.map((group) => group.name)], []);
  const featuredViews = useMemo(() => allViews.filter((entry) => entry.featured).slice(0, 8), [allViews]);

  useEffect(() => {
    if (!viewById.has(activeView)) setActiveView(allViews[0]?.id || "");
  }, [activeView, allViews, viewById]);

  useEffect(() => {
    if (!activeView) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("view", activeView);
      window.history.replaceState({}, "", url.toString());
    } catch {
      // no-op
    }
  }, [activeView]);

  useEffect(() => {
    if (effectiveDataSource !== "mock" || mockData) return;
    import("./mock-data").then((module) => {
      setMockData(module.MOCK_DATA);
      mockDataRef.current = module.MOCK_DATA;
    });
  }, [effectiveDataSource, mockData]);

  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.add("dark");
      html.style.colorScheme = "dark";
    } else {
      html.classList.remove("dark");
      html.style.colorScheme = "light";
    }
    try {
      localStorage.setItem("preview-dark", darkMode ? "1" : "0");
      localStorage.setItem("preview-recent-views", JSON.stringify(recentViews.slice(0, 25)));
    } catch {
      // no-op
    }
  }, [darkMode, recentViews]);

  useEffect(() => {
    if (effectiveDataSource !== "live") return;
    setLiveLoading(true);
    setLiveError(null);
    setLiveData(null);
    fetchViewData(activeView)
      .then((data) => {
        setLiveData(data);
        setLiveLoading(false);
      })
      .catch((error) => {
        setLiveError(error.message);
        setLiveLoading(false);
      });
  }, [activeView, effectiveDataSource]);

  const activeViewDef = viewById.get(activeView);
  const activeGroup = activeViewDef ? groupByViewId.get(activeViewDef.id) : undefined;

  const filteredViews = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = allViews.filter((entry) => {
      if (groupFilter !== "All" && groupByViewId.get(entry.id) !== groupFilter) return false;
      if (!term) return true;
      const haystack = [entry.label, entry.id, entry.description || "", groupByViewId.get(entry.id) || ""].join(" ").toLowerCase();
      return haystack.includes(term);
    });

    const sorted = [...filtered];
    if (sortMode === "alpha") return sorted.sort((a, b) => a.label.localeCompare(b.label));

    if (sortMode === "recent") {
      const order = new Map<string, number>();
      recentViews.forEach((id, i) => order.set(id, i));
      return sorted.sort((a, b) => {
        const ai = order.has(a.id) ? order.get(a.id)! : Number.POSITIVE_INFINITY;
        const bi = order.has(b.id) ? order.get(b.id)! : Number.POSITIVE_INFINITY;
        if (ai !== bi) return ai - bi;
        return a.label.localeCompare(b.label);
      });
    }

    return sorted.sort((a, b) => {
      const af = a.featured ? 1 : 0;
      const bf = b.featured ? 1 : 0;
      if (af !== bf) return bf - af;
      return a.label.localeCompare(b.label);
    });
  }, [allViews, groupByViewId, groupFilter, recentViews, search, sortMode]);

  const groupedFilteredViews = useMemo(() => {
    const buckets = new Map<string, ViewDef[]>();
    for (const group of VIEW_GROUPS) buckets.set(group.name, []);
    for (const view of filteredViews) {
      const group = groupByViewId.get(view.id) || "Other";
      if (!buckets.has(group)) buckets.set(group, []);
      buckets.get(group)!.push(view);
    }
    return [...buckets.entries()].filter(([, views]) => views.length > 0);
  }, [filteredViews, groupByViewId]);

  const baseData = effectiveDataSource === "live" ? liveData : (mockData ? mockData[activeView] : null);
  const currentData = overlayData || baseData;

  const handleNavigate = useCallback((newData: any) => {
    if (effectiveDataSource === "live") {
      setLiveData(newData);
    } else {
      setOverlayData(newData);
    }
  }, [effectiveDataSource]);

  const handleSelectView = useCallback((viewId: string) => {
    setActiveView(viewId);
    setOverlayData(null);
    setRecentViews((prev) => [viewId, ...prev.filter((entry) => entry !== viewId)].slice(0, 25));
    if (window.innerWidth < 1024 && previewSectionRef.current) {
      previewSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="min-h-[100dvh] -m-3 bg-background text-foreground">
      <SidebarProvider defaultOpen>
        <Sidebar variant="inset" collapsible="icon" className="border-r">
          <SidebarHeader className="gap-3">
            <div className="space-y-1 px-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">BaseClaw</p>
              <h1 className="text-base font-semibold leading-tight">MCP App Showcase</h1>
              <p className="text-xs text-muted-foreground">Find tools faster and preview them instantly.</p>
            </div>

            <Input
              type="search"
              placeholder="Search tools..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="flex flex-wrap gap-1 px-1">
              {groupNames.map((name) => (
                <Button
                  key={name}
                  size="xs"
                  variant={groupFilter === name ? "default" : "outline"}
                  onClick={() => setGroupFilter(name)}
                >
                  {name}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-1 px-1">
              <Button size="xs" variant={sortMode === "featured" ? "default" : "outline"} onClick={() => setSortMode("featured")}>Featured</Button>
              <Button size="xs" variant={sortMode === "alpha" ? "default" : "outline"} onClick={() => setSortMode("alpha")}>A-Z</Button>
              <Button size="xs" variant={sortMode === "recent" ? "default" : "outline"} onClick={() => setSortMode("recent")}>Recent</Button>
            </div>

            {featuredViews.length > 0 && (
              <div className="flex flex-wrap gap-1 px-1">
                {featuredViews.map((entry) => (
                  <Button
                    key={entry.id}
                    size="xs"
                    variant={activeView === entry.id ? "default" : "ghost"}
                    onClick={() => handleSelectView(entry.id)}
                  >
                    {entry.label}
                  </Button>
                ))}
              </div>
            )}
          </SidebarHeader>

          <SidebarContent>
            {groupedFilteredViews.map(([group, views]) => (
              <SidebarGroup key={group}>
                <SidebarGroupLabel>{group}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {views.map((view) => (
                      <SidebarMenuItem key={view.id}>
                        <SidebarMenuButton
                          isActive={activeView === view.id}
                          onClick={() => handleSelectView(view.id)}
                          className="h-auto items-start py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{view.label}</div>
                            <div className="line-clamp-2 text-xs text-muted-foreground">{view.description || "No description."}</div>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-center justify-between gap-2 px-4 py-3 lg:px-6">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger />
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold lg:text-base">{activeViewDef?.label || "Choose a tool"}</h2>
                  <p className="truncate text-xs text-muted-foreground">{activeGroup || "MCP App"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!IS_PUBLIC_PREVIEW && (
                  <div className="flex items-center gap-1">
                    <Button size="xs" variant={effectiveDataSource === "mock" ? "default" : "outline"} onClick={() => { setDataSourceRaw("mock"); setOverlayData(null); }}>
                      Mock
                    </Button>
                    <Button size="xs" variant={effectiveDataSource === "live" ? "default" : "outline"} onClick={() => { setDataSourceRaw("live"); setOverlayData(null); }}>
                      Live
                    </Button>
                  </div>
                )}
                <DarkModeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
              </div>
            </div>
          </header>

          <main ref={previewSectionRef} className="p-4 lg:p-6">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle>{activeViewDef?.label || "Live Preview"}</CardTitle>
                      <CardDescription>{activeViewDef?.description || "Select a tool from the sidebar to preview it here."}</CardDescription>
                    </div>
                    <Badge variant="outline">{effectiveDataSource === "live" ? "Live data" : "Demo data"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    Preview canvas renders the actual MCP app component directly, without extra shell styling.
                  </p>
                </CardContent>
              </Card>

              <section className="rounded-xl border bg-background">
                <div className="mcp-preview-canvas p-4 lg:p-5">
                  {effectiveDataSource === "live" && liveLoading ? (
                    <ViewSkeleton />
                  ) : effectiveDataSource === "live" && liveError ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      <p className="text-destructive text-sm font-medium">Failed to load live data</p>
                      <p className="text-muted-foreground text-xs mt-1">{liveError}</p>
                    </div>
                  ) : effectiveDataSource === "mock" && !mockData ? (
                    <ViewSkeleton />
                  ) : activeViewDef && currentData ? (
                    <ViewErrorBoundary key={activeView} viewId={activeView}>
                      <Suspense fallback={<ViewSkeleton />}>
                        <ViewRenderer
                          view={activeViewDef}
                          data={currentData}
                          app={effectiveDataSource === "live" ? liveApp : mockApp}
                          navigate={handleNavigate}
                        />
                      </Suspense>
                    </ViewErrorBoundary>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      <p className="text-muted-foreground text-sm">This tool does not have demo preview data yet.</p>
                      <p className="text-muted-foreground text-xs mt-1">{activeViewDef ? "View: " + activeViewDef.id : "Select a tool card."}</p>
                    </div>
                  )}
                </div>
              </section>

              {IS_PUBLIC_PREVIEW && (
                <p className="text-xs text-muted-foreground">Public demo uses mock league data for stable, repeatable previews.</p>
              )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

function ViewRenderer({ view, data, app, navigate }: { view: ViewDef; data: any; app: any; navigate: (d: any) => void }) {
  const Component = view.component;
  const extraProps = { ...(view.props || {}), app, navigate };
  return (
    <div className="mcp-app-root">
      <Component data={data} {...extraProps} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>
);
