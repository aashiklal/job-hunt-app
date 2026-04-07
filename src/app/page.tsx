import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export const metadata: Metadata = {
  title: "JobHunt — Land your next role",
  description: "AI-powered job application tracker. Analyze job descriptions, generate cover letters, and track every application in one place.",
};

export default async function LandingPage() {
  const { userId } = await auth();

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-gray-900 mb-3">
        JobHunt
      </h1>
      <p className="text-lg text-gray-500 mb-8 max-w-sm">
        Track applications, analyze job descriptions, and generate tailored cover letters — all in one place.
      </p>
      {userId ? (
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Go to dashboard
        </Link>
      ) : (
        <Link
          href="/sign-in"
          className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Sign in
        </Link>
      )}
    </main>
  );
}
