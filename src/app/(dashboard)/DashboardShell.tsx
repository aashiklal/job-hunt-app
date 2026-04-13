"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { UserButton } from "@clerk/nextjs";
import {
  Briefcase,
  ClipboardList,
  Menu,
  FileText,
  Moon,
  ShieldCheck,
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

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="-mx-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)] hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
    >
      {isDark ? (
        <Sun className="size-4 shrink-0" strokeWidth={1.75} />
      ) : (
        <Moon className="size-4 shrink-0" strokeWidth={1.75} />
      )}
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
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
] as const;

function NavLinks({
  onNavigate,
  isAdmin,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 flex-1">
      {navItems.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`-mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)] active:bg-accent/80 ${
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icon
              className={`size-4 shrink-0 transition-colors duration-200 ease-[var(--ease-out-expo)] ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
              strokeWidth={1.75}
            />
            {label}
          </Link>
        );
      })}

      {isAdmin && (
        <>
          <div className="my-1.5 border-t border-border" />
          <Link
            href="/admin"
            onClick={onNavigate}
            className={`-mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-[color,background-color] duration-200 ease-[var(--ease-out-expo)] active:bg-accent/80 ${
              pathname.startsWith("/admin")
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <ShieldCheck
              className={`size-4 shrink-0 transition-colors duration-200 ease-[var(--ease-out-expo)] ${
                pathname.startsWith("/admin")
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
              strokeWidth={1.75}
            />
            Admin
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
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
  usageWidget?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full px-3 py-4">
      {/* Logo */}
      <Link
        href="/"
        className="mb-5 flex items-center gap-2 px-1 transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-70"
      >
        <Briefcase className="size-5 text-foreground" strokeWidth={1.75} />
        <span className="text-base font-semibold tracking-tight text-foreground">
          Job Hunt
        </span>
      </Link>

      {/* Nav — grows to fill space above footer */}
      <NavLinks onNavigate={onNavigate} isAdmin={isAdmin} />

      {/* Footer — UsageWidget → ThemeToggle → UserButton, each separated */}
      <div className="mt-2 flex flex-col">
        {usageWidget && (
          <div className="border-t border-border pb-1 pt-2">
            {usageWidget}
          </div>
        )}

        <div className="border-t border-border py-1">
          <ThemeToggle />
        </div>

        <div className="border-t border-border pb-1 pt-3">
          <UserButton showName />
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

  return (
    // flex-col on mobile so the sticky header is in normal flow (no pt-14 needed);
    // flex-row on md+ so sidebar and main sit side-by-side.
    <div className="flex min-h-screen flex-col bg-background md:flex-row">

      {/* Desktop sidebar — frosted glass, soft right-cast shadow */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 shrink-0 flex-col border-r border-border bg-background/80 shadow-[2px_0_12px_rgba(0,0,0,0.04)] backdrop-blur-xl md:flex">
        <SidebarContent isAdmin={isAdmin} usageWidget={usageWidget} />
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
      <main className="flex-1 p-6 md:ml-60 md:p-8">
        {children}
      </main>
    </div>
  );
}
