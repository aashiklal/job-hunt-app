export type Segment = { text: string; bold: boolean; italic: boolean };

export type ParsedLine =
  | { kind: "h1"; segments: Segment[] }
  | { kind: "h2"; segments: Segment[] }
  | { kind: "h3"; segments: Segment[] }
  | { kind: "bullet"; segments: Segment[] }
  | { kind: "text"; segments: Segment[] }
  | { kind: "blank" };

export function parseInline(text: string): Segment[] {
  const result: Segment[] = [];
  // **bold** must be checked before *italic* to avoid mis-parsing ** as two *
  const re = /\*\*(.+?)\*\*|\*([^*\n]+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      result.push({ text: text.slice(last, m.index), bold: false, italic: false });
    if (m[1] !== undefined) {
      result.push({ text: m[1], bold: true, italic: false });
    } else {
      result.push({ text: m[2], bold: false, italic: true });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length)
    result.push({ text: text.slice(last), bold: false, italic: false });
  return result.length ? result : [{ text, bold: false, italic: false }];
}

export function parseMarkdown(content: string): ParsedLine[] {
  return content.split("\n").map((line): ParsedLine => {
    const t = line.trim();
    if (!t) return { kind: "blank" };
    if (t.startsWith("### ")) return { kind: "h3", segments: parseInline(t.slice(4)) };
    if (t.startsWith("## ")) return { kind: "h2", segments: parseInline(t.slice(3)) };
    if (t.startsWith("# ")) return { kind: "h1", segments: parseInline(t.slice(2)) };
    if (t.startsWith("- ") || t.startsWith("* "))
      return { kind: "bullet", segments: parseInline(t.slice(2)) };
    return { kind: "text", segments: parseInline(t) };
  });
}
