import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback, lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDaysIcon,
  UsersIcon,
  TrophyIcon,
  UserPlusIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  LightBulbIcon,
  NewspaperIcon,
} from "@heroicons/react/20/solid";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from "@/catalyst/sidebar";
import { SidebarLayout } from "@/catalyst/sidebar-layout";
import { Navbar, NavbarItem, NavbarSpacer, NavbarSection } from "@/catalyst/navbar";
import { Avatar } from "@/catalyst/avatar";
import * as api from "@/lib/api";

const ChatPanel = lazy(() =>
  import("@/components/chat-panel").then((m) => ({ default: m.ChatPanel }))
);

const navItems = [
  { title: "Today", icon: CalendarDaysIcon, path: "/" },
  { title: "Roster", icon: UsersIcon, path: "/roster" },
  { title: "Matchup", icon: TrophyIcon, path: "/matchup" },
  { title: "Players", icon: UserPlusIcon, path: "/players" },
  { title: "League", icon: ChartBarIcon, path: "/league" },
  { title: "Strategy", icon: LightBulbIcon, path: "/strategy" },
  { title: "Intel", icon: NewspaperIcon, path: "/intel" },
];

// Only the first 5 items show in mobile bottom tab bar
const mobileNavItems = navItems.slice(0, 5);

const prefetchMap: Record<string, { queryKey: string[]; queryFn: () => Promise<unknown> }> = {
  "/": { queryKey: ["briefing"], queryFn: api.getMorningBriefing },
  "/roster": { queryKey: ["roster"], queryFn: api.getRoster },
  "/matchup": { queryKey: ["matchup"], queryFn: api.getMatchup },
  "/players": { queryKey: ["freeAgents"], queryFn: api.getFreeAgents },
  "/league": { queryKey: ["standings"], queryFn: api.getStandings },
  "/strategy": { queryKey: ["categoryCheck"], queryFn: api.getCategoryCheck },
  "/intel": { queryKey: ["newsLatest"], queryFn: api.getNewsLatest },
};

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatEverOpened, setChatEverOpened] = useState(false);

  const handlePrefetch = useCallback(
    (path: string) => {
      const config = prefetchMap[path];
      if (config) {
        queryClient.prefetchQuery({
          queryKey: config.queryKey,
          queryFn: config.queryFn,
          staleTime: 30_000,
        });
      }
    },
    [queryClient]
  );

  return (
    <>
      <SidebarLayout
        navbar={
          <Navbar>
            <NavbarSpacer />
            <NavbarSection>
              <NavbarItem
                onClick={() => {
                  setChatEverOpened(true);
                  setChatOpen(true);
                }}
              >
                <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M3.43 2.524A41.29 41.29 0 0110 2c2.236 0 4.43.184 6.57.524 1.437.228 2.43 1.51 2.43 2.902v5.148c0 1.392-.993 2.674-2.43 2.902a41.102 41.102 0 01-3.55.414c-.28.02-.521.18-.643.413l-1.712 3.293a.75.75 0 01-1.33 0l-1.713-3.293a.783.783 0 00-.642-.413 41.108 41.108 0 01-3.55-.414C1.993 13.248 1 11.966 1 10.574V5.426c0-1.392.993-2.674 2.43-2.902z"
                    clipRule="evenodd"
                  />
                </svg>
              </NavbarItem>
            </NavbarSection>
          </Navbar>
        }
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <SidebarItem href="/">
                <Avatar
                  square
                  initials="BC"
                  className="size-6 bg-emerald-600 text-white"
                />
                <SidebarLabel className="font-semibold tracking-tight">
                  BaseClaw
                </SidebarLabel>
              </SidebarItem>
            </SidebarHeader>

            <SidebarBody>
              <SidebarSection>
                {navItems.map((item) => (
                  <SidebarItem
                    key={item.path}
                    href={item.path}
                    current={location.pathname === item.path}
                    onMouseEnter={() => handlePrefetch(item.path)}
                    onTouchStart={() => handlePrefetch(item.path)}
                  >
                    <item.icon data-slot="icon" />
                    <SidebarLabel>{item.title}</SidebarLabel>
                  </SidebarItem>
                ))}
              </SidebarSection>

              <SidebarSpacer />

              <SidebarSection>
                <SidebarItem
                  href="/settings"
                  current={location.pathname === "/settings"}
                >
                  <Cog6ToothIcon data-slot="icon" />
                  <SidebarLabel>Settings</SidebarLabel>
                </SidebarItem>
              </SidebarSection>
            </SidebarBody>

            <SidebarFooter>
              <SidebarItem href="/league">
                <Avatar square initials="XC" className="size-6" />
                <SidebarLabel>
                  <span className="block text-sm font-medium">Xi Chi Psi Alumni</span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    My Team
                  </span>
                </SidebarLabel>
              </SidebarItem>
            </SidebarFooter>
          </Sidebar>
        }
      >
        <Outlet />
      </SidebarLayout>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden h-16 border-t border-zinc-950/5 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-900/60">
        {mobileNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              onTouchStart={() => handlePrefetch(item.path)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-all duration-150 active:scale-95 ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500 dark:text-zinc-400 active:text-zinc-700 dark:active:text-zinc-300"
              }`}
            >
              <item.icon className="size-5" />
              <span>{item.title}</span>
            </button>
          );
        })}
      </nav>

      {chatEverOpened && (
        <Suspense fallback={null}>
          <ChatPanel open={chatOpen} onOpenChange={setChatOpen} />
        </Suspense>
      )}
    </>
  );
}
