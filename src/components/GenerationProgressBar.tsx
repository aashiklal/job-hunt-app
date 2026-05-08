"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  isLoading: boolean;
  durationMs: number;
};

export function GenerationProgressBar({ isLoading, durationMs }: Props) {
  const [wide, setWide] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const id = requestAnimationFrame(() => {
      setWide(isLoading);
      rafRef.current = null;
    });
    rafRef.current = id;
    return () => {
      cancelAnimationFrame(id);
      rafRef.current = null;
    };
  }, [isLoading]);

  if (!isLoading && !wide) return null;

  return (
    <div className="w-full rounded-full bg-muted h-1 overflow-hidden">
      <div
        className="h-full bg-primary rounded-full"
        style={{
          width: wide ? "88%" : "0%",
          transition: wide
            ? `width ${durationMs}ms cubic-bezier(0, 0, 0.2, 1)`
            : "none",
        }}
      />
    </div>
  );
}
