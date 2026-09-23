import { describe, it, expect } from "vitest";
import { isDemoUser } from "@/lib/demo";
import { DEMO_EMAIL } from "@/lib/demo-constants";

/**
 * The demo guard is the only thing standing between a public, unauthenticated
 * button and real Anthropic spend, so it must fail closed.
 *
 * This regression exists: a dev server started before `isDemo` was added to
 * the User schema kept Mongoose's cached model, returned `undefined` for the
 * field, and the demo account silently made a real API call. Checking the
 * email as well means a missing flag is no longer sufficient to leak spend.
 */

describe("isDemoUser", () => {
  it("recognises the flag", () => {
    expect(isDemoUser({ isDemo: true, email: "someone@example.com" })).toBe(true);
  });

  it("recognises the demo email even when the flag is missing", () => {
    // The exact shape a stale Mongoose model returns.
    expect(isDemoUser({ email: DEMO_EMAIL })).toBe(true);
  });

  it("recognises the demo email even when the flag is explicitly false", () => {
    expect(isDemoUser({ isDemo: false, email: DEMO_EMAIL })).toBe(true);
  });

  it("matches the demo email case-insensitively", () => {
    expect(isDemoUser({ email: DEMO_EMAIL.toUpperCase() })).toBe(true);
  });

  it("does not treat an ordinary user as the demo", () => {
    expect(isDemoUser({ isDemo: false, email: "real@example.com" })).toBe(false);
  });

  it("does not treat a user with no flag and no matching email as the demo", () => {
    expect(isDemoUser({ email: "real@example.com" })).toBe(false);
  });

  it("does not match a lookalike address", () => {
    expect(isDemoUser({ email: `not-${DEMO_EMAIL}` })).toBe(false);
    expect(isDemoUser({ email: `${DEMO_EMAIL}.evil.com` })).toBe(false);
  });

  it("handles null and undefined without throwing", () => {
    expect(isDemoUser(null)).toBe(false);
    expect(isDemoUser(undefined)).toBe(false);
    expect(isDemoUser({})).toBe(false);
  });
});
