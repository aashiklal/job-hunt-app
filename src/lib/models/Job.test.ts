import { describe, expect, it } from "vitest";
import { isValidTransition, type JobStatus } from "@/lib/models/Job";

const ALL: JobStatus[] = [
  "saved", "applied", "screening", "interview", "assessment", "offer", "rejected", "withdrawn",
];

describe("isValidTransition", () => {
  it("allows any non-terminal status to move anywhere", () => {
    for (const from of ["saved", "applied", "screening", "interview", "assessment", "offer"] as JobStatus[]) {
      for (const to of ALL) {
        expect(isValidTransition(from, to)).toBe(true);
      }
    }
  });

  it("only lets terminal statuses restart at saved", () => {
    for (const from of ["rejected", "withdrawn"] as JobStatus[]) {
      expect(isValidTransition(from, "saved")).toBe(true);
      expect(isValidTransition(from, from)).toBe(true);
      for (const to of ALL.filter((s) => s !== "saved" && s !== from)) {
        expect(isValidTransition(from, to)).toBe(false);
      }
    }
  });
});
