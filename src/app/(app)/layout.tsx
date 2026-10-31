import { requireUser } from "@/lib/session";
import { reviewQueue, stockAlerts } from "@/lib/stock";
import { can } from "@/lib/types";
import { BottomNav, type NavItem } from "@/components/bottom-nav";
import { IdleGuard } from "@/components/idle-guard";
import { getT } from "@/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getT();
  const [alerts, queue] = await Promise.all([
    stockAlerts(user),
    can.review(user.role) ? reviewQueue(user) : Promise.resolve(null),
  ]);

  const items: NavItem[] = [];
  if (user.role !== "manager") items.push({ href: "/", label: t("หน้าแรก"), icon: "home" });
  if (queue) items.push({ href: "/review", label: t("อนุมัติ"), icon: "review", badge: queue.pending.length });
  if (can.dashboard(user.role)) items.push({ href: "/dashboard", label: t("ภาพรวม"), icon: "dashboard" });
  items.push({ href: "/alerts", label: t("แจ้งเตือน"), icon: "alerts", badge: alerts.length });
  items.push({ href: "/me", label: t("ฉัน"), icon: "me" });

  return (
    <>
      <IdleGuard />
      <div className="pb-24">{children}</div>
      <BottomNav items={items} />
    </>
  );
}
