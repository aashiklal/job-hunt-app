"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { UserButton } from "@clerk/nextjs";
import {
  Briefcase,
  ChevronLeft,
  LogOut,
  ChevronRight,
  ClipboardList,
  Menu,
  FileText,
  Moon,
  ChartColumn,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { DemoExitButton } from "@/components/DemoExitButton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // Keep the server and client markup stable until the theme is resolved.
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

const navItems = [
  { label: "Jobs", href: "/jobs", icon: Briefcase },
  { label: "Resume", href: "/resume", icon: FileText },
  { label: "Tracker", href: "/tracker", icon: ClipboardList },
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
            className={linkClass(
              pathname.startsWith("/admin") && !pathname.startsWith("/admin/usage")
            )}
          >
            <ShieldCheck
              className={iconClass(
                pathname.startsWith("/admin") && !pathname.startsWith("/admin/usage")
              )}
              strokeWidth={1.75}
            />
            {!collapsed && "Admin"}
          </Link>
          <Link
            href="/admin/usage"
            onClick={onNavigate}
            aria-label={collapsed ? "AI usage" : undefined}
            className={linkClass(pathname.startsWith("/admin/usage"))}
          >
            <ChartColumn
              className={iconClass(pathname.startsWith("/admin/usage"))}
              strokeWidth={1.75}
            />
            {!collapsed && "AI usage"}
          </Link>
        </>
      )}
    </nav>
  );
}

/**
 * The JobHunt logo. Always a plain link home, for demo visitors too: the
 * landing page offers a live demo "Back to your demo", so leaving the
 * dashboard no longer has to end it.
 */
function HomeLink({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href="/"
      aria-label="JobHunt home"
      className={`rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * Account control. Real users get Clerk's menu. Demo visitors get a plain exit
 * instead: Clerk's "Manage account" would let them rename the account, change
 * its email or password, or delete it, none of which a demo should offer.
 */
function AccountControl({
  isDemo,
  collapsed,
  compact,
}: {
  isDemo?: boolean;
  collapsed?: boolean;
  /** Mobile header: icon only. */
  compact?: boolean;
}) {
  if (!isDemo) {
    return <UserButton showName={!collapsed && !compact} />;
  }

  const iconOnly = collapsed || compact;
  return (
    <DemoExitButton
      redirectUrl="/"
      intent="exit"
      aria-label={iconOnly ? "Exit demo" : undefined}
      className={`inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)] hover:bg-accent hover:text-accent-foreground ${iconOnly ? "" : "w-full"}`}
    >
      <LogOut className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {!iconOnly && <span>Exit demo</span>}
    </DemoExitButton>
  );
}

function SidebarContent({
  onNavigate,
  isAdmin,
  isDemo,
  usageWidget,
  collapsed,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
  isDemo?: boolean;
  usageWidget?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <div className="flex flex-col h-full px-3 py-4 overflow-hidden">
      <div className={`mb-5 flex items-center px-1 ${collapsed ? "justify-center" : "justify-between"}`}>
        <HomeLink
          className={`flex items-center gap-2 transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-70 ${collapsed ? "justify-center" : ""}`}
        >
          <Briefcase className="size-5 shrink-0 text-foreground" strokeWidth={1.75} />
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight text-foreground">
              JobHunt
            </span>
          )}
        </HomeLink>

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

      <NavLinks onNavigate={onNavigate} isAdmin={isAdmin} collapsed={collapsed} />

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
          <AccountControl isDemo={isDemo} collapsed={collapsed} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardShell({
  children,
  isAdmin,
  isDemo,
  usageWidget,
  demoBanner,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
  isDemo?: boolean;
  usageWidget?: React.ReactNode;
  /** Rendered above the page content for the public demo account only. */
  demoBanner?: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">

      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden shrink-0 flex-col border-r border-border bg-background/80 shadow-[2px_0_12px_rgba(0,0,0,0.04)] backdrop-blur-xl transition-[width] duration-200 ease-[var(--ease-out-expo)] md:flex ${sidebarCollapsed ? "w-16" : "w-60"}`}
      >
        <SidebarContent
          isAdmin={isAdmin}
          isDemo={isDemo}
          usageWidget={usageWidget}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-1.5 rounded-md p-1.5 text-muted-foreground transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)] hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
          >
            <Menu className="size-5" />
          </button>
          <HomeLink
            className="flex items-center gap-2 transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-70"
          >
            <Briefcase className="size-4 text-foreground" strokeWidth={1.75} />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              JobHunt
            </span>
          </HomeLink>
        </div>
        <AccountControl isDemo={isDemo} compact />
      </header>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent
            onNavigate={() => setDrawerOpen(false)}
            isAdmin={isAdmin}
            isDemo={isDemo}
            usageWidget={usageWidget}
          />
        </SheetContent>
      </Sheet>

      <main
        className={`flex-1 transition-[margin] duration-200 ease-[var(--ease-out-expo)] ${sidebarCollapsed ? "md:ml-16" : "md:ml-60"}`}
      >
        {demoBanner}
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
