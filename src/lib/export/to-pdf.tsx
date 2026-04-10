import "server-only";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { parseMarkdown, type Segment } from "./parse-markdown";
import { DEFAULT_STYLE_HINTS, type StyleHints } from "./types";

// @react-pdf/renderer only ships Helvetica, Times-Roman, and Courier as built-ins.
// Map the document's font family to the closest available PDF font.
function toPdfFont(font: string): string {
  const n = font.toLowerCase();
  if (
    n.includes("times") ||
    n.includes("georgia") ||
    n.includes("garamond") ||
    n.includes("palatino") ||
    n.includes("book antiqua")
  )
    return "Times-Roman";
  if (n.includes("courier") || n.includes("mono") || n.includes("consolas"))
    return "Courier";
  return "Helvetica"; // Calibri, Arial, Verdana, etc. all map here
}

function boldVariant(pdfFont: string): string {
  if (pdfFont === "Times-Roman") return "Times-Bold";
  if (pdfFont === "Courier") return "Courier-Bold";
  return "Helvetica-Bold";
}

function italicVariant(pdfFont: string): string {
  if (pdfFont === "Times-Roman") return "Times-Italic";
  if (pdfFont === "Courier") return "Courier-Oblique";
  return "Helvetica-Oblique";
}

function boldItalicVariant(pdfFont: string): string {
  if (pdfFont === "Times-Roman") return "Times-BoldItalic";
  if (pdfFont === "Courier") return "Courier-BoldOblique";
  return "Helvetica-BoldOblique";
}

function color(hex: string): string {
  return `#${hex.replace(/^#/, "")}`;
}

export async function generatePDF(
  content: string,
  hints: StyleHints = DEFAULT_STYLE_HINTS
): Promise<Buffer> {
  const bodyPdf = toPdfFont(hints.bodyFont);
  const h1Pdf = toPdfFont(hints.h1Font);
  const h2Pdf = toPdfFont(hints.h2Font);
  const h3Pdf = toPdfFont(hints.h3Font);

  const h2BorderColor =
    hints.h2Color === "000000" ? "#444444" : color(hints.h2Color);

  // Detect date ranges at the end of a string (e.g. "Jan 2020 - Dec 2021", "2020 – Present")
  const DATE_RANGE_RE =
    /\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?\d{4}\s*[-–—]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|\d{4})$/i;

  // Split h3 segments into [titleSegments, dateText | null]
  function splitH3Date(
    segments: Segment[]
  ): { titleSegments: Segment[]; dateText: string | null } {
    const fullText = segments.map((s) => s.text).join("");
    const m = DATE_RANGE_RE.exec(fullText);
    if (!m) return { titleSegments: segments, dateText: null };
    const dateText = m[0].trim();
    const titleText = fullText.slice(0, m.index).trimEnd();
    // Rebuild title segments from the original (preserving bold/italic up to the cut)
    const rebuilt: Segment[] = [];
    let remaining = titleText.length;
    for (const seg of segments) {
      if (remaining <= 0) break;
      if (seg.text.length <= remaining) {
        rebuilt.push(seg);
        remaining -= seg.text.length;
      } else {
        rebuilt.push({ ...seg, text: seg.text.slice(0, remaining) });
        remaining = 0;
      }
    }
    return { titleSegments: rebuilt, dateText };
  }

  // For skill text lines: if a bold segment contains ":" (category colon pattern),
  // un-bold everything after the first bold-colon segment.
  function normalizeSkillSegments(segments: Segment[]): Segment[] {
    let passedBoldColon = false;
    return segments.flatMap((seg) => {
      if (passedBoldColon) return [{ ...seg, bold: false }];
      if (seg.bold && seg.text.includes(":")) {
        passedBoldColon = true;
        // The segment itself may be "Category: skills text" — split at first ":"
        const colonIdx = seg.text.indexOf(":");
        const boldPart = seg.text.slice(0, colonIdx + 1);
        const rest = seg.text.slice(colonIdx + 1);
        const out: Segment[] = [{ text: boldPart, bold: true, italic: seg.italic }];
        if (rest) out.push({ text: rest, bold: false, italic: seg.italic });
        return out;
      }
      return [seg];
    });
  }

  const styles = StyleSheet.create({
    page: {
      fontFamily: bodyPdf,
      fontSize: hints.bodyFontSizePt,
      paddingTop: hints.marginTopPt,
      paddingBottom: hints.marginBottomPt,
      paddingLeft: hints.marginLeftPt,
      paddingRight: hints.marginRightPt,
      lineHeight: 1.4,
      color: "#1a1a1a",
    },
    h1: {
      fontFamily: boldVariant(h1Pdf),
      fontSize: hints.h1SizePt,
      color: color(hints.h1Color),
      textAlign: "center",
      marginBottom: 5,
    },
    h2: {
      fontFamily: boldVariant(h2Pdf),
      fontSize: hints.h2SizePt,
      color: color(hints.h2Color),
      marginTop: 11,
      marginBottom: 3,
      paddingBottom: 2,
      borderBottomWidth: 0.75,
      borderBottomColor: h2BorderColor,
    },
    h3: {
      fontFamily: boldVariant(h3Pdf),
      fontSize: hints.h3SizePt,
      color: color(hints.h3Color),
      marginTop: 5,
      marginBottom: 2,
    },
    bulletRow: {
      flexDirection: "row",
      marginBottom: 2,
      marginLeft: 8,
    },
    bulletDot: { width: 10, fontSize: hints.bodyFontSizePt },
    bulletText: { flex: 1, fontSize: hints.bodyFontSizePt },
    text: { fontSize: hints.bodyFontSizePt, marginBottom: 2 },
    blank: { height: 3 },
  });

  function renderSegments(
    segments: Segment[],
    basePdf: string
  ): React.ReactElement[] {
    return segments.map((seg, i) => {
      let fontFamily = basePdf;
      if (seg.bold && seg.italic) fontFamily = boldItalicVariant(basePdf);
      else if (seg.bold) fontFamily = boldVariant(basePdf);
      else if (seg.italic) fontFamily = italicVariant(basePdf);
      return (
        <Text key={i} style={fontFamily !== basePdf ? { fontFamily } : {}}>
          {seg.text}
        </Text>
      );
    });
  }

  const lines = parseMarkdown(content);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        {lines.map((line, i) => {
          if (line.kind === "blank") return <View key={i} style={styles.blank} />;
          if (line.kind === "h1")
            return (
              <Text key={i} style={styles.h1}>
                {renderSegments(line.segments, h1Pdf)}
              </Text>
            );
          if (line.kind === "h2")
            return (
              <Text key={i} style={styles.h2}>
                {renderSegments(line.segments, h2Pdf)}
              </Text>
            );
          if (line.kind === "h3") {
            const { titleSegments, dateText } = splitH3Date(line.segments);
            if (dateText) {
              return (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 5, marginBottom: 2 }}>
                  <Text style={styles.h3}>
                    {renderSegments(titleSegments, h3Pdf)}
                  </Text>
                  <Text style={{ fontFamily: h3Pdf, fontSize: hints.h3SizePt, color: color(hints.h3Color) }}>
                    {dateText}
                  </Text>
                </View>
              );
            }
            return (
              <Text key={i} style={styles.h3}>
                {renderSegments(line.segments, h3Pdf)}
              </Text>
            );
          }
          if (line.kind === "bullet")
            return (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>• </Text>
                <Text style={styles.bulletText}>
                  {renderSegments(line.segments, bodyPdf)}
                </Text>
              </View>
            );
          return (
            <Text key={i} style={styles.text}>
              {renderSegments(normalizeSkillSegments(line.segments), bodyPdf)}
            </Text>
          );
        })}
      </Page>
    </Document>
  );

  return renderToBuffer(doc) as Promise<Buffer>;
}
