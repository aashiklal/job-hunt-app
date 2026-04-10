import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { requireAdminWithPlan } from "@/lib/auth-helpers";
import * as usersRepo from "@/lib/repositories/users";
import { type IUser } from "@/lib/repositories/users";
import * as templates from "@/lib/repositories/templates";
import { TemplateManager } from "../resume/_components/template-manager";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserActionButton } from "./_components/user-actions";

export const metadata = {
  title: "Admin — Job Hunt",
  description: "Manage user access requests.",
};

function UserTable({
  users,
  adminId,
  showApprove,
  showReject,
}: {
  users: IUser[];
  adminId: string;
  showApprove: boolean;
  showReject: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Signed up</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const id = (user._id as { toString(): string }).toString();
          const isSelf = id === adminId;
          const name =
            user.firstName || user.lastName
              ? [user.firstName, user.lastName].filter(Boolean).join(" ")
              : "—";
          return (
            <TableRow key={id}>
              <TableCell>
                <Link href={`/admin/${id}`} className="hover:underline">
                  {user.email}
                </Link>
              </TableCell>
              <TableCell>{name}</TableCell>
              <TableCell className="text-gray-500">
                {formatDistanceToNow(new Date(user.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                {isSelf ? (
                  <span className="text-gray-400 text-sm">—</span>
                ) : (
                  <div className="flex items-center gap-2">
                    {showApprove && (
                      <UserActionButton userId={id} variant="approve" />
                    )}
                    {showReject && (
                      <UserActionButton userId={id} variant="reject" />
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default async function AdminPage() {
  const { user: admin } = await requireAdminWithPlan();
  const adminId = (admin._id as { toString(): string }).toString();

  const allUsers = await usersRepo.listAll();
  const adminTemplateList = await templates.listAdmin();
  const currentAdminTemplates = Object.fromEntries(
    adminTemplateList.map((t) => [t.type, { fileName: t.fileName }])
  ) as Partial<Record<"resume" | "cover_letter", { fileName: string }>>;

  const pending = allUsers.filter((u) => u.status === "pending");
  const approved = allUsers.filter((u) => u.status === "approved");
  const rejected = allUsers.filter((u) => u.status === "rejected");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">User Access</h1>
          <p className="text-sm text-gray-500 mt-1">
            Approve or reject sign-up requests.
          </p>
        </div>
        <Link
          href="/admin/audit"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          View audit log →
        </Link>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            <Badge className="ml-1.5 text-xs px-1.5 py-0 h-4">
              {pending.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
            <Badge className="ml-1.5 text-xs px-1.5 py-0 h-4">
              {approved.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected
            <Badge className="ml-1.5 text-xs px-1.5 py-0 h-4">
              {rejected.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pending.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              No pending requests. You&apos;re all caught up.
            </div>
          ) : (
            <UserTable
              users={pending}
              adminId={adminId}
              showApprove
              showReject
            />
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          <UserTable
            users={approved}
            adminId={adminId}
            showApprove={false}
            showReject
          />
        </TabsContent>

        <TabsContent value="rejected" className="mt-4">
          <UserTable
            users={rejected}
            adminId={adminId}
            showApprove
            showReject={false}
          />
        </TabsContent>
      </Tabs>

      <TemplateManager
        current={currentAdminTemplates}
        apiBase="/api/admin/templates"
        title="Default Export Templates"
        description="These templates are used for all users who have not uploaded their own. Upload a styled .docx file for each document type."
      />
    </div>
  );
}
