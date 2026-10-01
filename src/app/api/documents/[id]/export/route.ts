import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApprovedApiUser } from "@/lib/api-access";
import * as templates from "@/lib/repositories/templates";
import * as documents from "@/lib/repositories/documents";
import { exportDocument } from "@/lib/export";
import { generatedResumeSchema, generatedCoverLetterSchema } from "@/lib/generated-documents";
import { renderThemedLatex, renderThemedCoverLetterLatex } from "@/lib/export/render-themed-latex";
import {
  RESUME_TEX_PREAMBLE,
  RESUME_TEX_FULL_EXAMPLE,
  COVER_LETTER_TEX_PREAMBLE,
  COVER_LETTER_TEX_FULL_EXAMPLE,
  buildDefaultLatexDoc,
  buildDefaultCoverLetterLatexDoc,
} from "@/lib/export/to-latex";
import { isDemoUser } from "@/lib/demo";
import { chargeFixtureCredits } from "@/lib/ai-execution";
import { aiLimitResponse } from "@/lib/ai-limit-response";
import { safeFilename } from "@/lib/safe-filename";

const querySchema = z.object({
  format: z.enum(["docx", "tex"]).default("docx"),
  filename: z.string().min(1).max(200).optional(),
});

function defaultFilename(type: string): string {
  return type === "cover_letter" ? "cover-letter" : "tailored-resume";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireApprovedApiUser();
  if (!access.ok) return access.response;
  const { user } = access;

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await params;
  const userIdStr = (user._id as { toString(): string }).toString();
  const doc = await documents.getById(userIdStr, id);
  if (!doc || (doc.type !== "resume" && doc.type !== "cover_letter")) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const filename = safeFilename(
    parsed.data.filename ?? "",
    defaultFilename(doc.type)
  );

  // LaTeX export branch — uses hardcoded templates baked into to-latex.ts
  if (parsed.data.format === "tex") {
    try {
      const cache = await documents.getLatexCache(userIdStr, id);
      const cacheValid =
        cache?.latexBodyCache &&
        cache.latexBodyCachedAt &&
        cache.latexBodyCachedAt > new Date(doc.updatedAt);

      let tex: string;

      if (cacheValid && cache.latexBodyCache) {
        tex = cache.latexBodyCache;
      } else if (isDemoUser(user)) {
        // The themed renderer calls Haiku to lay the content into the
        // template. The demo must not, so it uses the deterministic builders
        // instead: real, valid LaTeX for the same document, just laid out by
        // code rather than by a model. It still costs the live export's
        // credits, and is cached like a live export, so re-downloads are free
        // exactly as they are for real users.
        if (doc.type === "resume") {
          const parsedResume = generatedResumeSchema.safeParse(doc.structuredContent);
          if (!parsedResume.success) {
            return NextResponse.json(
              { error: "Resume data not available. Please regenerate the resume." },
              { status: 422 }
            );
          }
          tex = await chargeFixtureCredits(userIdStr, "latex_export", async () =>
            buildDefaultLatexDoc(parsedResume.data)
          );
        } else {
          const parsedLetter = generatedCoverLetterSchema.safeParse(doc.structuredContent);
          if (!parsedLetter.success) {
            return NextResponse.json(
              { error: "Cover letter data not available. Please regenerate the cover letter." },
              { status: 422 }
            );
          }
          tex = await chargeFixtureCredits(userIdStr, "latex_export", async () =>
            buildDefaultCoverLetterLatexDoc(parsedLetter.data)
          );
        }
        documents.setLatexCache(userIdStr, id, tex).catch((err) => {
          console.error("[documents/export] latex cache write failed:", err);
        });
      } else {
        const hardcodedTemplate =
          doc.type === "resume"
            ? { texPreamble: RESUME_TEX_PREAMBLE, texFullTemplate: RESUME_TEX_FULL_EXAMPLE }
            : { texPreamble: COVER_LETTER_TEX_PREAMBLE, texFullTemplate: COVER_LETTER_TEX_FULL_EXAMPLE };

        if (doc.type === "resume") {
          const parsed2 = generatedResumeSchema.safeParse(doc.structuredContent);
          if (!parsed2.success) {
            return NextResponse.json(
              { error: "Resume data not available. Please regenerate the resume." },
              { status: 422 }
            );
          }
          const result = await renderThemedLatex(userIdStr, parsed2.data, hardcodedTemplate);
          tex = result.tex;
        } else {
          const parsed2 = generatedCoverLetterSchema.safeParse(doc.structuredContent);
          if (!parsed2.success) {
            return NextResponse.json(
              { error: "Cover letter data not available. Please regenerate the cover letter." },
              { status: 422 }
            );
          }
          const result = await renderThemedCoverLetterLatex(userIdStr, parsed2.data, hardcodedTemplate);
          tex = result.tex;
        }

        documents.setLatexCache(userIdStr, id, tex).catch((err) => {
          console.error("[documents/export] latex cache write failed:", err);
        });
      }

      return new Response(tex, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.tex"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      // LaTeX export is metered (it costs credits); DOCX export is not.
      const limited = aiLimitResponse(err);
      if (limited) return limited;
      console.error("[documents/export] latex export failed:", err);
      return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
  }

  // DOCX export branch (existing). Demo exports skip the admin template: any
  // text or author metadata the template carries would reach anonymous
  // visitors, so they get the generic builder instead.
  const adminTemplate = isDemoUser(user) ? null : await templates.get(doc.type);
  const templateId = adminTemplate
    ? (adminTemplate._id as { toString(): string }).toString()
    : null;

  try {
    const { buffer, usedTheme } = await exportDocument({
      content: doc.content,
      type: doc.type,
      adminTemplate: adminTemplate && templateId
        ? {
            _id: templateId,
            fileData: adminTemplate.fileData as Buffer,
            uploadedAt: adminTemplate.uploadedAt,
            themeAnalysis: adminTemplate.themeAnalysis ?? null,
            pixelThemeMap: adminTemplate.pixelThemeMap ?? null,
            styleRoleMap: adminTemplate.styleRoleMap ?? null,
          }
        : null,
      structuredContent: doc.structuredContent ?? null,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
        "Cache-Control": "no-store",
        ...(usedTheme ? {} : { "X-Template-Fallback": "generic" }),
      },
    });
  } catch (err) {
    console.error("[documents/export] export failed:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
