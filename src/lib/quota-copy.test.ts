import { describe, expect, it } from "vitest";
import { describeQuotaError } from "@/lib/quota-copy";

describe("describeQuotaError", () => {
  it("points at requesting full access for a lifetime plan", () => {
    const message = describeQuotaError({ budgetScope: "lifetime", used: 0.5, limit: 0.5 });
    expect(message).toContain("Request full access");
    expect(message).not.toContain("resets");
  });

  it("mentions the monthly reset for a monthly plan", () => {
    const message = describeQuotaError({ budgetScope: "monthly", used: 5, limit: 5 });
    expect(message).toContain("$5.00 of $5.00");
    expect(message).toContain("resets soon");
  });

  it("falls back gracefully when used/limit are missing", () => {
    const message = describeQuotaError({});
    expect(message).toContain("your full");
  });
});
