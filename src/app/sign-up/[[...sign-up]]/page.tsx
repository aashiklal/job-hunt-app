import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { Briefcase } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign Up: Job Hunt",
  description: "Create your Job Hunt account",
};

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex items-center gap-2">
        <Briefcase className="size-5 text-foreground" strokeWidth={1.75} />
        <span className="text-base font-semibold tracking-tight text-foreground">
          JobHunt
        </span>
      </div>
      <SignUp />
    </main>
  );
}
