import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resume — Job Hunt",
  description: "Manage and analyze your resume.",
};

export default function ResumePage() {
  return <h1 className="text-2xl font-semibold text-gray-900">Resume</h1>;
}
