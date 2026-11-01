import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { requireUser } from "@/lib/session";
import { reviewQueue, stockAlerts } from "@/lib/stock";
import { pendingProposals } from "@/lib/proposals";
import { countSignups } from "@/lib/signup";
import { can, ROLE_LABEL } from "@/lib/types";
import { BottomNav, type NavItem } from "@/components/bottom-nav";
import { SideNav, type SideGroup } from "@/components/side-nav";
import { IdleGuard } from "@/components/idle-guard";
import { RememberDevice } from "@/components/remember-device";
import { getT } from "@/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getT();
  const [alerts, queue, proposals, signups] = await Promise.all([
    stockAlerts(user),
    can.review(user.role) ? reviewQueue(user) : Promise.resolve(null),
    can.review(user.role) ? pendingProposals(user) : Promise.resolve([]),
    can.users(user.role) ? countSignups(user) : Promise.resolve(0),
  ]);
  const reviewBadge = queue ? queue.pending.length + proposals.length : 0;

  const items: NavItem[] = [];
  if (user.role !== "manager") items.push({ href: "/", label: t("หน้าแรก"), icon: "home" });
  if (queue) items.push({ href: "/review", label: t("อนุมัติ"), icon: "review", badge: reviewBadge });
  if (can.dashboard(user.role)) items.push({ href: "/dashboard", label: t("ภาพรวม"), icon: "dashboard" });
  items.push({ href: "/alerts", label: t("แจ้งเตือน"), icon: "alerts", badge: alerts.length });
  items.push({ href: "/me", label: t("ฉัน"), icon: "me" });

  // Desktop: the same screens, grouped in a sidebar; the executive console leads for managers/admins.
  const r = user.role;
  const groups: SideGroup[] = [
    {
      title: t("ติดตาม"),
      items: [
        ...(can.console(r) ? [{ href: "/admin", label: t("ภาพรวมผู้บริหาร"), icon: "console" as const }] : []),
        ...(can.console(r) ? [{ href: "/admin/stock", label: t("รายงานสต็อก"), icon: "stock" as const }] : []),
        ...(can.dashboard(r) && !can.console(r) ? [{ href: "/dashboard", label: t("ภาพรวม"), icon: "console" as const }] : []),
        ...(queue ? [{ href: "/review", label: t("อนุมัติ"), icon: "review" as const, badge: reviewBadge }] : []),
        { href: "/alerts", label: t("แจ้งเตือน"), icon: "alerts", badge: alerts.length },
        { href: "/movements", label: t("รับ · เบิก · โอน · ของเสีย"), icon: "moves" },
        ...(can.history(r) ? [{ href: "/history", label: t("ประวัติการแก้ไข"), icon: "history" as const }] : []),
        ...(can.usage(r) ? [{ href: "/usage", label: t("การใช้งานแอป"), icon: "usage" as const }] : []),
      ],
    },
    ...(can.count(r) ? [{ title: t("งานประจำวัน"), items: [{ href: "/", label: t("หน้าแรก"), icon: "home" as const }] }] : []),
    ...(can.settings(r)
      ? [
          {
            title: t("ตั้งค่า"),
            items: [
              { href: "/settings", label: t("วัตถุดิบและหมวด"), icon: "catalog" as const },
              { href: "/admin/items", label: t("ราคาทุนและ Par"), icon: "cost" as const },
              ...(can.users(r)
                ? [
                    { href: "/settings/users", label: t("ผู้ใช้และสิทธิ์"), icon: "users" as const, badge: signups },
                    { href: "/settings/notify", label: t("สรุปตอนเช้า"), icon: "notify" as const },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];

  return (
    <>
      <IdleGuard />
      <RememberDevice login={user.login} name={user.name} />
      <SideNav
        groups={groups}
        footer={
          <Link href="/me" className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-paper">
            <Avatar name={user.name} photo={user.avatar} size="sm" />
            <span className="min-w-0 flex-1 leading-tight">
              <b className="block truncate text-sm">{user.name}</b>
              <span className="text-xs text-muted">{t(ROLE_LABEL[user.role])}</span>
            </span>
          </Link>
        }
      />
      <div className="pb-24 lg:pb-10 lg:pl-60">{children}</div>
      <div className="lg:hidden">
        <BottomNav items={items} />
      </div>
    </>
  );
}
