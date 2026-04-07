import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign In — Job Hunt App",
  description: "Sign in to Job Hunt App",
};

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        Job Hunt App
      </h1>
      <SignIn />
    </main>
  );
}
