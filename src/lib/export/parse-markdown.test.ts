import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "@/lib/export/parse-markdown";

describe("parseInline", () => {
  it("returns a single plain segment for plain text", () => {
    expect(parseInline("hello")).toEqual([{ text: "hello", bold: false, italic: false }]);
  });

  it("splits bold and italic runs while preserving surrounding text", () => {
    expect(parseInline("a **b** c *d* e")).toEqual([
      { text: "a ", bold: false, italic: false },
      { text: "b", bold: true, italic: false },
      { text: " c ", bold: false, italic: false },
      { text: "d", bold: false, italic: true },
      { text: " e", bold: false, italic: false },
    ]);
  });

  it("does not mistake a bold marker for two italics", () => {
    expect(parseInline("**Skills:** React")).toEqual([
      { text: "Skills:", bold: true, italic: false },
      { text: " React", bold: false, italic: false },
    ]);
  });
});

describe("parseMarkdown", () => {
  it("classifies headings, bullets, text and blanks by line", () => {
    const lines = parseMarkdown("# Name\n\n## Skills\n- React\n* Node\n### Role\nplain");
    expect(lines.map((l) => l.kind)).toEqual([
      "h1", "blank", "h2", "bullet", "bullet", "h3", "text",
    ]);
  });

  it("strips the heading marker from the segment text", () => {
    const [h1] = parseMarkdown("# Jordan Reyes");
    expect(h1).toEqual({ kind: "h1", segments: [{ text: "Jordan Reyes", bold: false, italic: false }] });
  });
});
