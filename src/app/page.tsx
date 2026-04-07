import { currentUser } from "@clerk/nextjs/server";
import { ClipboardList, FileSearch, FileText, Mail } from "lucide-react";
import Link from "next/link";
import SignOutButton from "@/components/auth/SignOutButton";

const modules = [
  {
    label: "Analyze JD",
    href: "/analyze",
    icon: FileSearch,
    description: "Score your fit against any job description",
  },
  {
    label: "Cover Letter",
    href: "/cover-letter",
    icon: FileText,
    description: "Generate a tailored cover letter in seconds",
  },
  {
    label: "Draft Email",
    href: "/email",
    icon: Mail,
    description: "Follow-ups, cold outreach, thank-you notes",
  },
  {
    label: "Tracker",
    href: "/tracker",
    icon: ClipboardList,
    description: "Track every application in one place",
  },
] as const;

export default async function HomePage() {
  const user = await currentUser();
  const firstName = user?.firstName ?? "Ash";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
        <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Job Hunt App</Link>
        <SignOutButton />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold text-gray-900 mb-10">
          Welcome back, {firstName}
        </h1>

        <div className="grid grid-cols-2 gap-4">
          {modules.map(({ label, href, icon: Icon, description }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 hover:border-gray-400 hover:shadow-sm transition-all"
            >
              <Icon className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
              <div>
                <p className="font-medium text-gray-900">{label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
