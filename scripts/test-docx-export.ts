import Module from "module";
import JSZip from "jszip";
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";
import type { GeneratedDocument } from "../src/lib/generated-documents";
import type { PixelThemeMap } from "../src/lib/export/map-pixel-theme";
import type { StyleRoleMap } from "../src/lib/export/map-styles-to-roles";

const moduleWithLoad = Module as unknown as {
  _load: (request: string, parent?: unknown, isMain?: boolean) => unknown;
};
const originalLoad = moduleWithLoad._load;
moduleWithLoad._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};

const fixtureDir = process.argv[2];

async function runFixtureHarness(fixturePath: string) {
  const [{ exportDocument }] = await Promise.all([
    import("../src/lib/export"),
  ]);

  const templateBuf = await readFile(resolve(fixturePath, "template.docx"));
  const docJson = JSON.parse(
    await readFile(resolve(fixturePath, "document.json"), "utf8")
  );
  const meta = JSON.parse(
    await readFile(resolve(fixturePath, "template-meta.json"), "utf8")
  );

  const result = await exportDocument({
    content: docJson.content,
    type: docJson.type,
    structuredContent: docJson.structuredContent,
    adminTemplate: {
      _id: meta._id,
      fileData: templateBuf,
      uploadedAt: new Date(meta.uploadedAt),
      themeAnalysis: meta.themeAnalysis,
      pixelThemeMap: meta.pixelThemeMap,
      styleRoleMap: meta.styleRoleMap,
    },
  });

  await writeFile(resolve(fixturePath, "output.docx"), result.buffer);

  const outZip = await JSZip.loadAsync(result.buffer);
  const outXml = (await outZip.file("word/document.xml")?.async("string")) ?? "";
  await writeFile(resolve(fixturePath, "output-document.xml"), outXml);

  console.log(`Export ran: usedTheme=${result.usedTheme}, bytes=${result.buffer.length}`);
  console.log(`  ${fixturePath}/output.docx`);
  console.log(`  ${fixturePath}/output-document.xml`);

  runStructuralAssertions(outXml, docJson);
}

function runStructuralAssertions(
  xml: string,
  docJson: { type: "resume" | "cover_letter"; structuredContent?: GeneratedDocument | null }
) {
  const findings: string[] = [];

  const emptyBulletRe = /<w:p\b[^>]*>(?:(?!<w:t\b)[\s\S])*<w:numPr\b[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  let emptyBulletCount = 0;
  while ((match = emptyBulletRe.exec(xml)) !== null) {
    if (!/<w:t[^>]*>[^<]/.test(match[0])) emptyBulletCount++;
  }
  if (emptyBulletCount > 0) {
    findings.push(`FAIL: ${emptyBulletCount} empty bullet/numbered paragraph(s) in output`);
  }

  if (docJson.type === "cover_letter" && docJson.structuredContent) {
    const cl = docJson.structuredContent as Extract<GeneratedDocument, { kind: "cover_letter" }>;
    const positions = {
      salutation: -1,
      firstBody: -1,
      lastBody: -1,
      signoff: -1,
    };
    const sal = `Dear ${cl.recipient ?? "Hiring Manager"}`;
    positions.salutation = xml.indexOf(sal);
    for (const p of cl.bodyParagraphs ?? []) {
      const head = p.slice(0, 30);
      const idx = xml.indexOf(head);
      if (idx >= 0) {
        if (positions.firstBody < 0) positions.firstBody = idx;
        positions.lastBody = idx;
      }
    }
    const signoffPiece = (cl.signoff ?? "").split("\n")[0];
    if (signoffPiece) positions.signoff = xml.indexOf(signoffPiece);

    if (positions.salutation >= 0 && positions.firstBody >= 0) {
      if (positions.firstBody < positions.salutation) {
        findings.push(
          `FAIL: cover letter body paragraph appears BEFORE salutation (body@${positions.firstBody}, salutation@${positions.salutation})`
        );
      }
    }
    if (positions.lastBody >= 0 && positions.signoff >= 0) {
      if (positions.signoff < positions.lastBody) {
        findings.push(
          `FAIL: cover letter signoff appears BEFORE last body paragraph (signoff@${positions.signoff}, lastBody@${positions.lastBody})`
        );
      }
    }
  }

  if (docJson.type === "resume" && docJson.structuredContent) {
    const expected = ["Professional Summary", "Technical Skills", "Professional Experience", "Projects", "Education", "Certifications"];
    const seen: { heading: string; pos: number }[] = [];
    for (const heading of expected) {
      const pos = xml.indexOf(heading);
      if (pos >= 0) seen.push({ heading, pos });
    }
    for (let i = 1; i < seen.length; i++) {
      if (seen[i].pos <= seen[i - 1].pos) {
        findings.push(
          `FAIL: resume section "${seen[i].heading}" appears at/before "${seen[i - 1].heading}"`
        );
      }
    }

    const r = docJson.structuredContent as Extract<GeneratedDocument, { kind: "resume" }>;
    const summaryHeadingIdx = xml.indexOf("Professional Summary");
    const skillsHeadingIdx = xml.indexOf("Technical Skills");
    if (r.summary && summaryHeadingIdx >= 0 && skillsHeadingIdx > summaryHeadingIdx) {
      const between = xml.slice(summaryHeadingIdx + "Professional Summary".length, skillsHeadingIdx);
      const summaryHead = r.summary.slice(0, 30);
      if (!between.includes(summaryHead)) {
        findings.push(
          `FAIL: resume summary text not found between "Professional Summary" and "Technical Skills" headings`
        );
      }
    }
  }

  if (findings.length === 0) {
    console.log("Structural assertions: OK");
    return;
  }

  for (const f of findings) console.log(f);
  console.log(`Structural assertions: ${findings.length} failure(s)`);
}

async function runSyntheticHarness() {
  const [{ buildDOCXFromStyles }, { generatedDocumentBlocks }, { buildPixelThemeContract }] =
    await Promise.all([
      import("../src/lib/export/build-from-styles"),
      import("../src/lib/generated-document-blocks"),
      import("../src/lib/export/pixel-theme-contract"),
    ]);

  const templateZip = new JSZip();
  templateZip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:drawing/></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="NameStyle"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0070C0"/></w:rPr><w:t>Jane Example</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="ContactStyle"/></w:pPr><w:r><w:rPr><w:color w:val="666666"/></w:rPr><w:t>Melbourne</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="BodyStyle"/><w:jc w:val="both"/><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:color w:val="222222"/></w:rPr><w:t>Sample paragraph text</w:t></w:r></w:p>
    <w:p><w:r><w:pict/></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`
  );

  const template = await templateZip.generateAsync({ type: "nodebuffer" });
  const doc: GeneratedDocument = {
    kind: "cover_letter",
    name: "Alex Applicant",
    contact: {
      location: "Melbourne",
      phone: "0400 000 000",
      email: "alex@example.com",
      linkedin: "https://linkedin.com/in/alex",
      github: "https://github.com/alex",
      website: "https://alex.dev",
      workRights: "Australian citizen",
    },
    date: "2nd May 2026",
    recipient: null,
    company: "Acme",
    role: "Developer",
    bodyParagraphs: ["Generated paragraph one.", "Generated paragraph two."],
    closing: null,
    signoff: "Sincerely,",
  };

  const pixelThemeMap: PixelThemeMap = {
    version: 1,
    docType: "cover_letter",
    regions: [
      { id: "word/document.xml#1", role: "applicant_name", repeatable: false },
      { id: "word/document.xml#2", role: "applicant_contact", repeatable: true },
      { id: "word/document.xml#3", role: "body_paragraph", repeatable: true },
    ],
    warnings: [],
  };

  const styleRoleMap: StyleRoleMap = {
    version: 1,
    docType: "cover_letter",
    sectionHeadingCase: "preserve",
    warnings: [],
    roleStyles: {
      applicant_name: "NameStyle",
      applicant_contact: "ContactStyle",
      date: "BodyStyle",
      recipient: "BodyStyle",
      company: "BodyStyle",
      role: "BodyStyle",
      salutation: "BodyStyle",
      summary: "BodyStyle",
      section_heading: "BodyStyle",
      experience_heading: "BodyStyle",
      project_heading: "BodyStyle",
      education_heading: "BodyStyle",
      skill_line: "BodyStyle",
      bullet: "BodyStyle",
      body_paragraph: "BodyStyle",
      closing: "BodyStyle",
      signoff: "BodyStyle",
      footer: "BodyStyle",
    },
  };

  const blocks = generatedDocumentBlocks(doc);
  const contactBlocks = blocks.filter((block) => block.role === "applicant_contact");
  assert(contactBlocks.length === 3, "cover letter header must only expose location, phone, email");
  assert(
    !blocks.some((block) => /linkedin|github|alex\.dev|citizen/i.test(block.text)),
    "cover letter blocks must not include social links, website, or work rights"
  );

  const contract = buildPixelThemeContract({
    docType: "cover_letter",
    themeAnalysis: {
      version: 1,
      docType: "cover_letter",
      textParagraphCount: 3,
      hasTables: false,
      hasDrawings: true,
      hasTextBoxes: false,
      hasMarkers: false,
      warnings: [],
    },
    pixelThemeMap,
    styleRoleMap,
  });
  assert(contract !== null, "contract should be built from matching maps");
  assert(contract.capacity.level === "compact", "small template should be compact");

  const result = await buildDOCXFromStyles(template, doc, contract);
  const outputZip = await JSZip.loadAsync(result.buffer);
  const xml = await outputZip.file("word/document.xml")!.async("string");

  assert(result.usedTheme, "style renderer should report usedTheme");
  assert(xml.includes("<w:jc w:val=\"both\"/>"), "body paragraph justification should be cloned");
  assert(xml.includes("<w:spacing w:after=\"240\"/>"), "body paragraph spacing should be cloned");
  assert(xml.includes("<w:drawing/>"), "top decorative drawing should be preserved");
  assert(xml.includes("<w:pict/>"), "bottom decorative drawing should be preserved");
  assert(xml.includes("Generated paragraph two."), "repeated body paragraphs should be rendered");
  assert(!xml.includes("Sample paragraph text"), "sample text should not survive export");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  if (fixtureDir) {
    await runFixtureHarness(fixtureDir);
  } else {
    await runSyntheticHarness();
    console.log("DOCX export regression harness passed");
  }
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
