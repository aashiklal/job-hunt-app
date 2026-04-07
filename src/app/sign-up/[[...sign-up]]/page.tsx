import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign Up — Job Hunt App",
  description: "Create your Job Hunt App account",
};

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        Job Hunt App
      </h1>
      <SignUp />
    </main>
  );
}
