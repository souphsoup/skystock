import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getCatalog } from "@/lib/settings";
import { can, ROLE_LABEL } from "@/lib/types";
import { PageHeader } from "@/components/status";
import { IconBell, IconUser } from "@/components/icons";
import { CatalogTree } from "./catalog-tree";
import { getT } from "@/i18n/server";

export default async function SettingsPage() {
  const user = await requireUser(can.settings);
  const catalog = await getCatalog(user);
  const { t } = await getT();
  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <PageHeader eyebrow={`${t("ตั้งค่า")} · ${t(ROLE_LABEL[user.role])}`} title={t("ประเภทวัตถุดิบ")} />
      {can.users(user.role) && (
        <nav className="card mb-4 divide-y divide-line" aria-label={t("ตั้งค่าระบบ")}>
          <Link href="/settings/users" className="flex min-h-14 items-center gap-3 px-4">
            <IconUser className="text-accent" />
            <span className="flex-1 font-semibold">{t("ผู้ใช้และสิทธิ์")}</span>
            <span className="text-muted" aria-hidden>
              ›
            </span>
          </Link>
          <Link href="/settings/notify" className="flex min-h-14 items-center gap-3 px-4">
            <IconBell className="text-accent" />
            <span className="flex-1">
              <b className="block">{t("สรุปตอนเช้า")}</b>
              <span className="text-sm text-muted">{t("ส่งเข้า LINE และอีเมล 08:00 น.")}</span>
            </span>
            <span className="text-muted" aria-hidden>
              ›
            </span>
          </Link>
        </nav>
      )}
      <CatalogTree catalog={catalog} />
    </main>
  );
}
