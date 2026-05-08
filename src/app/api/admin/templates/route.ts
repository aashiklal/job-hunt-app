import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as users from "@/lib/repositories/users";
import * as templates from "@/lib/repositories/templates";
import * as auditLog from "@/lib/repositories/audit-log";
import type { TemplateType } from "@/lib/repositories/templates";
import { uploadGlobalTemplate } from "@/lib/template-intake";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const VALID_TYPES: TemplateType[] = ["resume", "cover_letter"];

async function requireAdmin(clerkUserId: string) {
  const user = await users.getByClerkId(clerkUserId);
  if (!user?.isAdmin) return null;
  return user;
}

/** POST /api/admin/templates: upload or replace a global document theme */
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

  const isDocxFile =
    file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!isDocxFile)
    return NextResponse.json(
      { error: "Only .docx files are supported as templates." },
      { status: 400 }
    );

  const buffer = Buffer.from(await file.arrayBuffer());

  let intake: Awaited<ReturnType<typeof uploadGlobalTemplate>>;
  try {
    intake = await uploadGlobalTemplate({
      type: type as TemplateType,
      fileName: file.name,
      fileData: buffer,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not process template" },
      { status: 422 }
    );
  }

  const adminIdStr = (admin._id as { toString(): string }).toString();
  await auditLog.create({
    adminId: adminIdStr,
    adminEmail: admin.email,
    targetUserId: adminIdStr,
    targetUserEmail: admin.email,
    action: "template.uploaded",
    details: {
      templateType: type,
      fileName: file.name,
      fileSize: file.size,
      ...intake.auditDetails,
    },
  });

  return NextResponse.json(intake.response);
}

/** DELETE /api/admin/templates?type=resume: remove a global template */
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

  await templates.deleteTemplate(type);

  const adminIdStr = (admin._id as { toString(): string }).toString();
  await auditLog.create({
    adminId: adminIdStr,
    adminEmail: admin.email,
    targetUserId: adminIdStr,
    targetUserEmail: admin.email,
    action: "template.deleted",
    details: { templateType: type },
  });

  return NextResponse.json({ ok: true });
}
