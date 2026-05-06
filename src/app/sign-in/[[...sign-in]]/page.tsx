import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { Briefcase } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign In: Job Hunt",
  description: "Sign in to Job Hunt",
};

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex items-center gap-2">
        <Briefcase className="size-5 text-foreground" strokeWidth={1.75} />
        <span className="text-base font-semibold tracking-tight text-foreground">
          JobHunt
        </span>
      </div>
      <SignIn />
    </main>
  );
}
