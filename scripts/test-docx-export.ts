import Module from "module";
import JSZip from "jszip";
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

async function main() {
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

main()
  .then(() => {
    console.log("DOCX export regression harness passed");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
