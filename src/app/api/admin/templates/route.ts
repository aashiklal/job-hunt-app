import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as users from "@/lib/repositories/users";
import * as templates from "@/lib/repositories/templates";
import type { TemplateType } from "@/lib/repositories/templates";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const VALID_TYPES: TemplateType[] = ["resume", "cover_letter"];

async function requireAdmin(clerkUserId: string) {
  const user = await users.getByClerkId(clerkUserId);
  if (!user?.isAdmin) return null;
  return user;
}

/** POST /api/admin/templates — upload or replace a global default template */
export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await requireAdmin(clerkUserId);
  if (!admin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const type = formData.get("type");

  if (!file || !(file instanceof File))
    return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!type || !VALID_TYPES.includes(type as TemplateType))
    return NextResponse.json(
      { error: "type must be 'resume' or 'cover_letter'" },
      { status: 400 }
    );

  if (file.size > MAX_SIZE)
    return NextResponse.json(
      { error: "File too large. Maximum 10 MB." },
      { status: 413 }
    );

  if (file.type !== DOCX_MIME && !file.name.toLowerCase().endsWith(".docx"))
    return NextResponse.json(
      { error: "Only .docx files are supported as templates." },
      { status: 400 }
    );

  const buffer = Buffer.from(await file.arrayBuffer());
  await templates.upsert(null, type as TemplateType, buffer, file.name);

  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/templates?type=resume — remove a global template */
export async function DELETE(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await requireAdmin(clerkUserId);
  if (!admin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const type = req.nextUrl.searchParams.get("type") as TemplateType | null;
  if (!type || !VALID_TYPES.includes(type))
    return NextResponse.json(
      { error: "type must be 'resume' or 'cover_letter'" },
      { status: 400 }
    );

  await templates.deleteTemplate(null, type);

  return NextResponse.json({ ok: true });
}
