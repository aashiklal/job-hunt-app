import type { Metadata } from "next";
import SignOutButton from "@/components/auth/SignOutButton";

export const metadata: Metadata = {
  title: "Access Denied — Job Hunt App",
  description: "You are not authorised to access this application.",
};

export default function UnauthorisedPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-2xl font-semibold text-gray-900">Access denied</h1>
      <p className="text-gray-600 max-w-sm">
        This app is private. If you believe this is an error, contact the owner.
      </p>
      <SignOutButton />
    </main>
  );
}
