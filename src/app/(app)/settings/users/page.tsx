import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listUsers } from "@/lib/settings";
import { can } from "@/lib/types";
import { PageHeader } from "@/components/status";
import { IconBack } from "@/components/icons";
import { UserList } from "./user-list";

export default async function UsersPage() {
  const user = await requireUser(can.users);
  const users = await listUsers(user);
  return (
    <main className="mx-auto max-w-xl px-4 pt-4">
      <Link href="/settings" className="btn btn-ghost -ml-3 mb-1 min-h-11 px-2 text-sm text-muted">
        <IconBack width={18} height={18} /> ตั้งค่า
      </Link>
      <PageHeader eyebrow="Admin" title="ผู้ใช้และสิทธิ์" />
      <UserList users={users} selfId={user.id} />
    </main>
  );
}
