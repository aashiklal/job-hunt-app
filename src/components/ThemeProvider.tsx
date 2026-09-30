"use client";

import type { ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// next-themes renders an inline script that sets the theme class before paint.
// It only needs to run from the server HTML; on the client React 19 warns about
// rendering a script tag, so give it a non-executable type there.
const scriptProps =
  typeof window === "undefined"
    ? undefined
    : ({ type: "application/json" } as const);

export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>
) {
  return <NextThemesProvider {...props} scriptProps={scriptProps} />;
}
