"use client";

import { useClerk } from "@clerk/nextjs";

export default function SignOutButton() {
  const { signOut } = useClerk();

  return (
    <button
      onClick={() => signOut({ redirectUrl: "/sign-in" })}
      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
    >
      Sign out
    </button>
  );
}
