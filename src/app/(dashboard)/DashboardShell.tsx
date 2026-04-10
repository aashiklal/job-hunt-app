"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Briefcase,
  ClipboardList,
  Menu,
  FileText,
  ShieldCheck,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
    <nav className="flex flex-col gap-1 flex-1">
      {navItems.map(({ label, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? "bg-gray-100 text-gray-900 font-medium"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
      {isAdmin && (
        <>
          <div className="my-2 border-t border-gray-100" />
          <Link
            href="/admin"
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname.startsWith("/admin")
                ? "bg-gray-100 text-gray-900 font-medium"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            Admin
          </Link>
        </>
      )}
    </nav>
  );
}

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
      <Link
        href="/"
        className="flex items-center gap-2 px-3 mb-6 hover:opacity-75 transition-opacity"
      >
        <Briefcase className="w-5 h-5 text-gray-800" strokeWidth={1.75} />
        <span className="font-semibold text-gray-900 text-base">Job Hunt</span>
      </Link>
      <NavLinks onNavigate={onNavigate} isAdmin={isAdmin} />
      {usageWidget && (
        <div className="mt-2 mb-1 border-t border-gray-100 pt-2">
          {usageWidget}
        </div>
      )}
      <div className="pt-4 border-t border-gray-200 px-1">
        <UserButton showName />
      </div>
    </div>
  );
}

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
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-gray-200 fixed inset-y-0 left-0">
        <SidebarContent isAdmin={isAdmin} usageWidget={usageWidget} />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-75 transition-opacity"
          >
            <Briefcase className="w-4 h-4 text-gray-800" strokeWidth={1.75} />
            <span className="font-semibold text-gray-900 text-sm">
              Job Hunt
            </span>
          </Link>
        </div>
        <UserButton />
      </div>

      {/* Mobile drawer (shadcn Sheet) */}
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

      {/* Main content */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
