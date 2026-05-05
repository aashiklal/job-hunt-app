"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

export function UserFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set("q", next);
      } else {
        params.delete("q");
      }
      params.set("page", "1");
      router.push("?" + params.toString());
    }, 300);
  }

  return (
    <div className="w-full sm:max-w-xs">
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder="Search by email or name..."
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="Search users"
      />
    </div>
  );
}
