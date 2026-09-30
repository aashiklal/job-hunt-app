import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Sign Up: JobHunt",
  description: "Create your JobHunt account",
};

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <BrandLogo />
      <SignUp />
    </main>
  );
}
