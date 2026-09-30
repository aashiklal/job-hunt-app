import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Sign In: JobHunt",
  description: "Sign in to JobHunt",
};

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <BrandLogo />
      <SignIn />
    </main>
  );
}
