"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { UserButton } from "@clerk/nextjs";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Menu,
  FileText,
  Moon,
  Scale,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// ---------------------------------------------------------------------------
// ThemeToggle — styled as a full-width nav-item button so it sits naturally
// in the stacked sidebar footer. Shows the icon + label for the *next* state
// (Vercel convention: "Dark mode" when light, "Light mode" when dark).
// ---------------------------------------------------------------------------

function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // Render a stable placeholder until the client knows the resolved theme,
  // preventing a server/client HTML mismatch (hydration error).
  if (!mounted) {
    return (
      <div
        className={`flex w-full items-center rounded-md py-2 text-sm text-muted-foreground ${collapsed ? "justify-center px-0" : "-mx-2 gap-3 px-3"}`}
      >
        <Moon className="size-4 shrink-0" strokeWidth={1.75} />
        {!collapsed && <span>Dark mode</span>}
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex w-full items-center rounded-md py-2 text-sm text-muted-foreground transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)] hover:bg-accent hover:text-accent-foreground active:bg-accent/80 ${collapsed ? "justify-center px-0" : "-mx-2 gap-3 px-3"}`}
    >
      {isDark ? (
        <Sun className="size-4 shrink-0" strokeWidth={1.75} />
      ) : (
        <Moon className="size-4 shrink-0" strokeWidth={1.75} />
      )}
      {!collapsed && <span>{isDark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------

const navItems = [
  { label: "Jobs", href: "/jobs", icon: Briefcase },
  { label: "Resume", href: "/resume", icon: FileText },
  { label: "Tracker", href: "/tracker", icon: ClipboardList },
  { label: "STAR stories", href: "/star-stories", icon: Sparkles },
  { label: "Offers", href: "/offers", icon: Scale },
] as const;

function NavLinks({
  onNavigate,
  isAdmin,
  collapsed,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  const linkClass = (active: boolean) =>
    `flex items-center rounded-md py-2 text-sm transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)] active:bg-accent/80 ${collapsed ? "justify-center px-0" : "-mx-2 gap-3 px-3"} ${
      active
        ? "bg-accent text-accent-foreground font-medium"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    }`;

  const iconClass = (active: boolean) =>
    `size-4 shrink-0 transition-colors duration-200 ease-[var(--ease-out-expo)] ${
      active ? "text-foreground" : "text-muted-foreground"
    }`;

  return (
    <nav className="flex flex-col gap-0.5 flex-1">
      {navItems.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-label={collapsed ? label : undefined}
            className={linkClass(active)}
          >
            <Icon className={iconClass(active)} strokeWidth={1.75} />
            {!collapsed && label}
          </Link>
        );
      })}

      {isAdmin && (
        <>
          <div className="my-1.5 border-t border-border" />
          <Link
            href="/admin"
            onClick={onNavigate}
            aria-label={collapsed ? "Admin" : undefined}
            className={linkClass(pathname.startsWith("/admin"))}
          >
            <ShieldCheck
              className={iconClass(pathname.startsWith("/admin"))}
              strokeWidth={1.75}
            />
            {!collapsed && "Admin"}
          </Link>
        </>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// SidebarContent — shared between the fixed desktop sidebar and mobile Sheet
// ---------------------------------------------------------------------------

function SidebarContent({
  onNavigate,
  isAdmin,
  usageWidget,
  collapsed,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
  usageWidget?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="flex flex-col h-full px-3 py-4 overflow-hidden">
      {/* Logo row + collapse toggle */}
      <div className={`mb-5 flex items-center px-1 ${collapsed ? "justify-center" : "justify-between"}`}>
        <Link
          href="/"
          className={`flex items-center gap-2 transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-70 ${collapsed ? "justify-center" : ""}`}
        >
          <Briefcase className="size-5 shrink-0 text-foreground" strokeWidth={1.75} />
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight text-foreground">
              Job Hunt
            </span>
          )}
        </Link>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`rounded-md p-1 text-muted-foreground transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)] hover:bg-accent hover:text-accent-foreground active:bg-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${collapsed ? "mt-0.5" : ""}`}
          >
            {collapsed ? (
              <ChevronRight className="size-4" strokeWidth={1.75} />
            ) : (
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>

      {/* Nav — grows to fill space above footer */}
      <NavLinks onNavigate={onNavigate} isAdmin={isAdmin} collapsed={collapsed} />

      {/* Footer — UsageWidget -> ThemeToggle -> UserButton */}
      <div className="mt-2 flex flex-col">
        {usageWidget && !collapsed && (
          <div className="border-t border-border pb-1 pt-2">
            {usageWidget}
          </div>
        )}

        <div className="border-t border-border py-1">
          <ThemeToggle collapsed={collapsed} />
        </div>

        <div className={`border-t border-border pb-1 pt-3 ${collapsed ? "flex justify-center" : ""}`}>
          <UserButton showName={!collapsed} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export default function DashboardShell({
  children,
  isAdmin,
  usageWidget,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
  usageWidget?: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    // flex-col on mobile so the sticky header is in normal flow (no pt-14 needed);
    // flex-row on md+ so sidebar and main sit side-by-side.
    <div className="flex min-h-screen flex-col bg-background md:flex-row">

      {/* Desktop sidebar — frosted glass, soft right-cast shadow */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden shrink-0 flex-col border-r border-border bg-background/80 shadow-[2px_0_12px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-[width] duration-200 ease-[var(--ease-out-expo)] md:flex ${sidebarCollapsed ? "w-16" : "w-60"}`}
      >
        <SidebarContent
          isAdmin={isAdmin}
          usageWidget={usageWidget}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile top bar — sticky (in flow), frosted glass */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-1.5 rounded-md p-1.5 text-muted-foreground transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)] hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
          >
            <Menu className="size-5" />
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-70"
          >
            <Briefcase className="size-4 text-foreground" strokeWidth={1.75} />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Job Hunt
            </span>
          </Link>
        </div>
        <UserButton />
      </header>

      {/* Mobile drawer — Sheet behaviour unchanged */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent
            onNavigate={() => setDrawerOpen(false)}
            isAdmin={isAdmin}
            usageWidget={usageWidget}
          />
        </SheetContent>
      </Sheet>

      {/* Main content — offset by sidebar width on desktop */}
      <main
        className={`flex-1 p-6 md:p-8 transition-[margin] duration-200 ease-[var(--ease-out-expo)] ${sidebarCollapsed ? "md:ml-16" : "md:ml-60"}`}
      >
        {children}
      </main>
    </div>
  );
}
