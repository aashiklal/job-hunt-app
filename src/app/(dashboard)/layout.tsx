"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  ClipboardList,
  FileSearch,
  FileText,
  Mail,
  Menu,
  X,
} from "lucide-react";
import SignOutButton from "@/components/auth/SignOutButton";

const navItems = [
  { label: "Analyze JD", href: "/analyze", icon: FileSearch },
  { label: "Cover Letter", href: "/cover-letter", icon: FileText },
  { label: "Draft Email", href: "/email", icon: Mail },
  { label: "Tracker", href: "/tracker", icon: ClipboardList },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
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
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full px-3 py-4">
      <div className="flex items-center gap-2 px-3 mb-6">
        <Briefcase className="w-5 h-5 text-gray-800" strokeWidth={1.75} />
        <span className="font-semibold text-gray-900 text-base">Job Hunt</span>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="pt-4 border-t border-gray-200 px-3">
        <SignOutButton />
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-gray-200 fixed inset-y-0 left-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-20 flex items-center gap-3 px-4 h-14 bg-white border-b border-gray-200">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-gray-800" strokeWidth={1.75} />
          <span className="font-semibold text-gray-900 text-sm">Job Hunt</span>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-end px-4 h-14 border-b border-gray-200">
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent onNavigate={() => setDrawerOpen(false)} />
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
