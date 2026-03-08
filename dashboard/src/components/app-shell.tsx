import { Outlet, useLocation, Link } from "react-router-dom";
import { useState } from "react";
import {
  Home,
  Users,
  UserPlus,
  Trophy,
  ArrowLeftRight,
  Brain,
  CalendarDays,
  History,
  MessageSquare,
  Settings,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Claw,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/components/chat-panel";
import { useTheme } from "@/components/theme-provider";

const navItems = [
  { title: "Home", icon: Home, path: "/" },
  { title: "Roster", icon: Users, path: "/roster" },
  { title: "Free Agents", icon: UserPlus, path: "/free-agents" },
  { title: "Standings", icon: Trophy, path: "/standings" },
  { title: "Trade Center", icon: ArrowLeftRight, path: "/trade-center" },
  { title: "Intelligence", icon: Brain, path: "/intelligence" },
  { title: "Week Planner", icon: CalendarDays, path: "/week-planner" },
  { title: "League History", icon: History, path: "/league-history" },
];

const mobileNav = [
  { title: "Home", icon: Home, path: "/" },
  { title: "Roster", icon: Users, path: "/roster" },
  { title: "FAs", icon: UserPlus, path: "/free-agents" },
  { title: "Trades", icon: ArrowLeftRight, path: "/trade-center" },
  { title: "Settings", icon: Settings, path: "/settings" },
];

function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 size-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 size-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 size-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/roster": "Roster",
  "/free-agents": "Free Agents",
  "/standings": "Standings",
  "/trade-center": "Trade Center",
  "/intelligence": "Intelligence",
  "/week-planner": "Week Planner",
  "/league-history": "League History",
  "/settings": "Settings",
};

export function AppShell() {
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);
  const currentPageName = pageNames[location.pathname] ?? location.pathname.replace("/", "").replace("-", " ");

  return (
    <SidebarProvider>
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:flex border-r">
        <SidebarHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Claw className="size-4" />
            </div>
            <span className="font-semibold tracking-tight">BaseClaw</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <ScrollArea className="flex-1">
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={location.pathname === item.path}>
                        <Link to={item.path}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname === "/settings"}>
                      <Link to="/settings">
                        <Settings className="size-4" />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setChatOpen(true)}>
                      <MessageSquare className="size-4" />
                      <span>Chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </ScrollArea>
        </SidebarContent>

        <SidebarFooter className="border-t p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">BaseClaw Dashboard</span>
            <ThemeToggle />
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Top header bar (desktop) */}
        <header className="hidden md:flex h-14 items-center gap-3 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{currentPageName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* Mobile top bar */}
        <header className="flex md:hidden h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Claw className="size-4" />
            </div>
            <span className="font-semibold text-sm">BaseClaw</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setChatOpen(true)}>
              <MessageSquare className="size-4" />
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-20 md:pb-6">
          <Outlet />
        </main>
      </SidebarInset>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden h-16 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {mobileNav.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors ${
              location.pathname === item.path
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="size-5" />
            <span>{item.title}</span>
          </Link>
        ))}
        <button
          onClick={() => setChatOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquare className="size-5" />
          <span>Chat</span>
        </button>
      </nav>

      <ChatPanel open={chatOpen} onOpenChange={setChatOpen} />
    </SidebarProvider>
  );
}
