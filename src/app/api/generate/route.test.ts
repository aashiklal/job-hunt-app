import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/repositories/users", () => ({ getByClerkId: vi.fn() }));
vi.mock("@/lib/job-ai-generation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/job-ai-generation")>(
    "@/lib/job-ai-generation"
  );
  return {
    ...actual,
    generateForJob: vi.fn(),
  };
});

import { auth } from "@clerk/nextjs/server";
import * as users from "@/lib/repositories/users";
import { generateForJob, JobGenerationError } from "@/lib/job-ai-generation";
import { QuotaExceededError } from "@/lib/usage";
import { POST } from "./route";

const JOB_ID = "64f000000000000000000010";
const user = { _id: "64f000000000000000000001", email: "j@example.com" };

function request(body: unknown) {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function readLines(res: Response) {
  const text = await res.text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue({ userId: "clerk_1" } as never);
  vi.mocked(users.getByClerkId).mockResolvedValue(user as never);
});

describe("POST /api/generate", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const res = await POST(request({ jobId: JOB_ID, type: "jd_analysis" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed body", async () => {
    const res = await POST(request("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 with field details for an unknown type", async () => {
    const res = await POST(request({ jobId: JOB_ID, type: "haiku" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
    expect(body.details.fieldErrors.type).toBeDefined();
  });

  it("returns 404 when the session has no user record", async () => {
    vi.mocked(users.getByClerkId).mockResolvedValue(null);
    const res = await POST(request({ jobId: JOB_ID, type: "jd_analysis" }));
    expect(res.status).toBe(404);
  });

  it("returns JSON for non-streaming types", async () => {
    vi.mocked(generateForJob).mockResolvedValue({
      kind: "jd_analysis",
      analysis: { requiredSkills: ["React"] },
    } as never);

    const res = await POST(request({ jobId: JOB_ID, type: "jd_analysis" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ analysis: { requiredSkills: ["React"] } });
    expect(vi.mocked(generateForJob).mock.calls[0][2]).toBeUndefined();
  });

  it("maps a quota error to 429 with the budget details", async () => {
    vi.mocked(generateForJob).mockRejectedValue(
      new QuotaExceededError({
        kind: "aiGeneration",
        used: 5.2,
        limit: 5,
        periodEndsAt: new Date("2026-10-01T00:00:00.000Z"),
      })
    );

    const res = await POST(request({ jobId: JOB_ID, type: "jd_analysis" }));

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "QUOTA_EXCEEDED", used: 5.2, limit: 5 });
  });

  it("maps a generation error to its own status", async () => {
    vi.mocked(generateForJob).mockRejectedValue(
      new JobGenerationError("NO_JOB_DESCRIPTION", "Add a description first.", 400)
    );
    const res = await POST(request({ jobId: JOB_ID, type: "jd_analysis" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "NO_JOB_DESCRIPTION", message: "Add a description first." });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(generateForJob).mockRejectedValue(new Error("mongo connection string leaked"));
    const res = await POST(request({ jobId: JOB_ID, type: "jd_analysis" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Generation failed." });
    errorSpy.mockRestore();
  });

  it("streams partial previews then a done event for a resume", async () => {
    vi.mocked(generateForJob).mockImplementation(async (_user, _input, options) => {
      options?.onPartial?.("# Jordan");
      options?.onPartial?.("# Jordan Reyes\n\n## Summary");
      return {
        kind: "structured_document",
        documentId: "doc_1",
        content: "# Jordan Reyes\n\n## Summary\nDone.",
        structuredContent: { kind: "resume", name: "Jordan Reyes" },
      } as never;
    });

    const res = await POST(request({ jobId: JOB_ID, type: "resume" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/x-ndjson");
    const events = await readLines(res);
    expect(events.map((e) => e.type)).toEqual(["partial", "partial", "done"]);
    expect(events[1]).toEqual({ type: "partial", markdown: "# Jordan Reyes\n\n## Summary" });
    expect(events[2]).toMatchObject({ type: "done", documentId: "doc_1" });
  });

  it("sends errors in-band once a stream has opened", async () => {
    vi.mocked(generateForJob).mockRejectedValue(
      new JobGenerationError("NO_RESUME", "Save a base resume first.", 400)
    );

    const res = await POST(request({ jobId: JOB_ID, type: "cover_letter" }));

    expect(res.status).toBe(200);
    const events = await readLines(res);
    expect(events).toEqual([
      { type: "error", status: 400, error: "NO_RESUME", message: "Save a base resume first." },
    ]);
  });
});
