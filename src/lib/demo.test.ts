import { describe, it, expect } from "vitest";
import { isDemoExpired, isDemoUser } from "@/lib/demo";
import { DEMO_EMAIL, buildDemoEmail, isDemoEmail } from "@/lib/demo-constants";

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

describe("isDemoEmail", () => {
  it("matches per-visitor demo addresses", () => {
    expect(isDemoEmail(buildDemoEmail("a1b2c3d4e5f6a1b2c3d4e5f6"))).toBe(true);
    expect(isDemoEmail(buildDemoEmail("a1b2c3d4e5f6a1b2c3d4e5f6").toUpperCase())).toBe(true);
  });

  it("matches the retired shared address", () => {
    expect(isDemoEmail(DEMO_EMAIL)).toBe(true);
  });

  it("rejects lookalikes a real user could register", () => {
    expect(isDemoEmail("demo+abc@jobhunt.app")).toBe(false); // too short
    expect(isDemoEmail("demo+a1b2c3d4e5f6@jobhunt.app.evil.com")).toBe(false);
    expect(isDemoEmail("xdemo+a1b2c3d4e5f6@jobhunt.app")).toBe(false);
    expect(isDemoEmail("demo+a1b2c3d4e5f6@other.app")).toBe(false);
    expect(isDemoEmail("demo+a1b2-c3d4e5f6@jobhunt.app")).toBe(false);
    expect(isDemoEmail(null)).toBe(false);
    expect(isDemoEmail("")).toBe(false);
  });

  it("makes isDemoUser fail closed for a per-visitor address without the flag", () => {
    expect(isDemoUser({ email: buildDemoEmail("a1b2c3d4e5f6a1b2c3d4e5f6") })).toBe(true);
  });
});

describe("isDemoExpired", () => {
  const now = new Date("2026-09-30T12:00:00Z");

  it("is false for real users regardless of fields", () => {
    expect(isDemoExpired({ isDemo: false, email: "real@example.com" }, now)).toBe(false);
    expect(isDemoExpired(null, now)).toBe(false);
  });

  it("is false before the expiry and true at or after it", () => {
    const expiresAt = new Date("2026-09-30T13:00:00Z");
    expect(isDemoExpired({ isDemo: true, demoExpiresAt: expiresAt }, now)).toBe(false);
    expect(isDemoExpired({ isDemo: true, demoExpiresAt: expiresAt }, expiresAt)).toBe(true);
  });

  it("treats a demo with no expiry (the legacy shared account) as expired", () => {
    expect(isDemoExpired({ isDemo: true, demoExpiresAt: null }, now)).toBe(true);
    expect(isDemoExpired({ email: DEMO_EMAIL }, now)).toBe(true);
  });
});
