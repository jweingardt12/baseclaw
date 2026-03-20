import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppShell } from "@/components/app-shell";

// Lazy-loaded pages
const TodayPage = React.lazy(() => import("./pages/today").then((m) => ({ default: m.TodayPage })));
const RosterPage = React.lazy(() => import("./pages/roster").then((m) => ({ default: m.RosterPage })));
const MatchupPage = React.lazy(() => import("./pages/matchup").then((m) => ({ default: m.MatchupPage })));
const PlayersPage = React.lazy(() => import("./pages/players").then((m) => ({ default: m.PlayersPage })));
const LeaguePage = React.lazy(() => import("./pages/league").then((m) => ({ default: m.LeaguePage })));
const SettingsPage = React.lazy(() => import("./pages/settings").then((m) => ({ default: m.SettingsPage })));
const StrategyPage = React.lazy(() => import("./pages/strategy").then((m) => ({ default: m.StrategyPage })));
const IntelPage = React.lazy(() => import("./pages/intel").then((m) => ({ default: m.IntelPage })));

function PageSkeleton() {
  return (
    <div className="space-y-6 p-4">
      <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
      <div className="h-4 w-72 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        <div className="h-48 w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      </div>
      <div className="h-64 w-full rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/dashboard">
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Suspense fallback={<PageSkeleton />}><TodayPage /></Suspense>} />
            <Route path="roster" element={<Suspense fallback={<PageSkeleton />}><RosterPage /></Suspense>} />
            <Route path="matchup" element={<Suspense fallback={<PageSkeleton />}><MatchupPage /></Suspense>} />
            <Route path="players" element={<Suspense fallback={<PageSkeleton />}><PlayersPage /></Suspense>} />
            <Route path="league" element={<Suspense fallback={<PageSkeleton />}><LeaguePage /></Suspense>} />
            <Route path="strategy" element={<Suspense fallback={<PageSkeleton />}><StrategyPage /></Suspense>} />
            <Route path="intel" element={<Suspense fallback={<PageSkeleton />}><IntelPage /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageSkeleton />}><SettingsPage /></Suspense>} />
          </Route>
        </Routes>
        <Toaster richColors closeButton position="top-right" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
