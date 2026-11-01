import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listUsers } from "@/lib/settings";
import { can } from "@/lib/types";
import { PageHeader } from "@/components/status";
import { IconBack } from "@/components/icons";
import { UserList } from "./user-list";
import { SignupRequests } from "./signup-requests";
import { listSignups } from "@/lib/signup";
import { fmtDateTime } from "@/lib/dates";
import { getT } from "@/i18n/server";
import { getProfiles } from "@/lib/me";

export default async function UsersPage() {
  const user = await requireUser(can.users);
  const [users, signups] = await Promise.all([listUsers(user), listSignups(user)]);
  const { t, lang } = await getT();
  const profiles = Object.fromEntries(await getProfiles(user, users.map((u) => u.id)));
  return (
    <main className="mx-auto max-w-xl px-4 pt-4">
      <Link href="/settings" className="btn btn-ghost -ml-3 mb-1 min-h-11 px-2 text-sm text-muted">
        <IconBack width={18} height={18} /> {t("ตั้งค่า")}
      </Link>
      <PageHeader eyebrow="Admin" title={t("ผู้ใช้และสิทธิ์")} />
      <SignupRequests
        requests={signups.map((s) => ({ id: s.id, login: s.login, name: s.name, at: fmtDateTime(s.createdAt, lang) }))}
      />
      <UserList users={users} profiles={profiles} selfId={user.id} />
    </main>
  );
}
