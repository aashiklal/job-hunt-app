import { describe, expect, it } from "vitest";
import { parse, Allow } from "partial-json";
import {
  generatedDocumentToMarkdown,
  normalizePartialDocument,
  partialDocumentToMarkdown,
  sortExperienceByDate,
  type GeneratedCoverLetter,
  type GeneratedResume,
} from "@/lib/generated-documents";

const resume: GeneratedResume = {
  kind: "resume",
  name: "Jordan Reyes",
  contact: {
    location: "Seattle, WA",
    phone: null,
    email: "jordan@example.com",
    linkedin: null,
    github: "github.com/jreyes",
    website: null,
    workRights: null,
  },
  summary: "Full stack engineer.",
  skills: [{ category: "Frontend", items: ["React", "Next.js"] }],
  experience: [
    {
      jobTitle: "Engineer",
      company: "Pioneer",
      dateRange: "Jun 2020 - Feb 2022",
      subtitle: null,
      bullets: ["Built a map."],
    },
    {
      jobTitle: "Senior Engineer",
      company: "Cascade",
      dateRange: "Mar 2022 - Present",
      subtitle: "Checkout team",
      bullets: ["Rewrote checkout.", "Cut latency."],
    },
  ],
  projects: [{ name: "Shiftwise", techStack: "TypeScript", bullets: ["Scheduler."] }],
  education: [{ degree: "B.S. CS", school: "UW", gradDate: "2020", notes: null }],
  certifications: ["AWS Developer"],
  footer: null,
};

const letter: GeneratedCoverLetter = {
  kind: "cover_letter",
  name: "Jordan Reyes",
  contact: { ...resume.contact },
  date: "1st May 2026",
  recipient: null,
  company: "Northwind",
  role: "Senior Engineer",
  bodyParagraphs: ["Hook paragraph.", "Proof paragraph.", "Close paragraph."],
  closing: "Thank you for your consideration.",
  signoff: "Sincerely,",
};

describe("generatedDocumentToMarkdown", () => {
  it("renders a resume with headings, contact line and bullets", () => {
    const md = generatedDocumentToMarkdown(resume);
    expect(md.startsWith("# Jordan Reyes\n")).toBe(true);
    expect(md).toContain("Seattle, WA | jordan@example.com | github.com/jreyes");
    expect(md).toContain("## Summary\nFull stack engineer.");
    expect(md).toContain("**Frontend:** React, Next.js");
    expect(md).toContain("### Senior Engineer, Cascade Mar 2022 - Present\nCheckout team\n- Rewrote checkout.");
    expect(md).toContain("## Certifications\n- AWS Developer");
  });

  it("omits empty resume sections", () => {
    const md = generatedDocumentToMarkdown({ ...resume, summary: null, projects: [], certifications: [] });
    expect(md).not.toContain("## Summary");
    expect(md).not.toContain("## Projects");
    expect(md).not.toContain("## Certifications");
  });

  it("renders a cover letter addressed to the hiring manager by default", () => {
    const md = generatedDocumentToMarkdown(letter);
    expect(md).toContain("**Jordan Reyes**  \nSeattle, WA  \njordan@example.com");
    expect(md).toContain("Dear Hiring Manager,");
    expect(md).toContain("Hook paragraph.\n\nProof paragraph.\n\nClose paragraph.");
    expect(md.endsWith("Sincerely,\nJordan Reyes")).toBe(true);
  });

  it("uses the recipient name when one was found", () => {
    expect(generatedDocumentToMarkdown({ ...letter, recipient: "Priya" })).toContain("Dear Priya,");
  });
});

describe("sortExperienceByDate", () => {
  it("puts current and most recent roles first", () => {
    const sorted = sortExperienceByDate(resume);
    expect(sorted.experience.map((e) => e.company)).toEqual(["Cascade", "Pioneer"]);
  });

  it("does not mutate the input", () => {
    const before = resume.experience.map((e) => e.company);
    sortExperienceByDate(resume);
    expect(resume.experience.map((e) => e.company)).toEqual(before);
  });
});

describe("normalizePartialDocument", () => {
  it("fills every missing field with a safe default", () => {
    expect(normalizePartialDocument("resume", undefined)).toEqual({
      kind: "resume",
      name: "",
      contact: {
        location: null, phone: null, email: null, linkedin: null, github: null, website: null, workRights: null,
      },
      summary: null,
      skills: [],
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      footer: null,
    });
  });

  it("drops array items until their required keys have arrived", () => {
    const doc = normalizePartialDocument("resume", {
      name: "J",
      skills: [{ category: "Backend", items: ["Node", 42] }, { items: ["x"] }],
      experience: [{ jobTitle: "Engineer" }, { jobTitle: "Engineer", company: "Acme" }],
    }) as GeneratedResume;
    expect(doc.skills).toEqual([{ category: "Backend", items: ["Node"] }]);
    expect(doc.experience).toEqual([
      { jobTitle: "Engineer", company: "Acme", dateRange: "", subtitle: null, bullets: [] },
    ]);
  });

  it("filters non-string body paragraphs from a cover letter", () => {
    const doc = normalizePartialDocument("cover_letter", {
      name: "J",
      bodyParagraphs: ["One", null, "Two"],
    }) as GeneratedCoverLetter;
    expect(doc.bodyParagraphs).toEqual(["One", "Two"]);
    expect(doc.signoff).toBe("");
  });
});

describe("partialDocumentToMarkdown over a streamed JSON prefix", () => {
  const full = JSON.stringify(resume);

  it("returns nothing until the name has arrived", () => {
    expect(partialDocumentToMarkdown("resume", parse(full.slice(0, 12), Allow.ALL))).toBe("");
  });

  it("only ever grows and ends equal to the final render", () => {
    let previousLength = 0;
    for (let cut = 1; cut <= full.length; cut += 7) {
      const md = partialDocumentToMarkdown("resume", parse(full.slice(0, cut), Allow.ALL));
      expect(md.length).toBeGreaterThanOrEqual(previousLength);
      previousLength = md.length;
    }
    const finalMd = partialDocumentToMarkdown("resume", parse(full, Allow.ALL));
    expect(finalMd).toBe(generatedDocumentToMarkdown(resume));
  });

  it("handles a cover letter prefix the same way", () => {
    const text = JSON.stringify(letter);
    const halfway = partialDocumentToMarkdown("cover_letter", parse(text.slice(0, text.length / 2), Allow.ALL));
    expect(halfway).toContain("**Jordan Reyes**");
    const done = partialDocumentToMarkdown("cover_letter", parse(text, Allow.ALL));
    expect(done).toBe(generatedDocumentToMarkdown(letter));
  });
});
