import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jobs — Job Hunt",
  description: "Browse and manage your job listings.",
};

export default function JobsPage() {
  return <h1 className="text-2xl font-semibold text-gray-900">Jobs</h1>;
}
