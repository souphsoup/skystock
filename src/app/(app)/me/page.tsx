import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ROLE_LABEL, can } from "@/lib/types";
import { PageHeader } from "@/components/status";
import { SyncBadge } from "@/components/sync-badge";
import { LogoutButton } from "./logout-button";
import { LangSwitch } from "@/components/lang-switch";
import { getT } from "@/i18n/server";

export default async function MePage() {
  const user = await requireUser();
  const { t } = await getT();
  const idle = Number(process.env.NEXT_PUBLIC_IDLE_MINUTES) || 15;
  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <PageHeader title={t("ฉัน")} right={<SyncBadge />} />
      <section className="card mb-4 flex items-center gap-4 p-4">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-2xl font-bold text-accent">
          {user.name.slice(0, 1)}
        </span>
        <div>
          <b className="block text-lg">{user.name}</b>
          <span className="text-sm text-muted">
            {t(ROLE_LABEL[user.role])} · {t("ชื่อผู้ใช้ {login}", { login: user.login })}
          </span>
        </div>
      </section>
      {can.settings(user.role) && (
        <Link href="/settings" className="card mb-4 flex min-h-14 items-center justify-between px-4">
          <span>
            <b className="block">{t("ตั้งค่า")}</b>
            <span className="text-sm text-muted">
              {t("ประเภทวัตถุดิบ รายการ Par")}
              {can.users(user.role) ? t(" · ผู้ใช้และสิทธิ์") : ""}
            </span>
          </span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </Link>
      )}
      {can.history(user.role) && (
        <Link href="/history" className="card mb-4 flex min-h-14 items-center justify-between px-4">
          <span>
            <b className="block">{t("ประวัติการแก้ไข")}</b>
            <span className="text-sm text-muted">{t("ใครทำอะไร เมื่อไหร่")}</span>
          </span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </Link>
      )}
      <section className="mb-4" aria-labelledby="lang-h">
        <h2 id="lang-h" className="mb-2 text-sm text-muted">
          {t("ภาษา")} / Language
        </h2>
        <LangSwitch />
      </section>
      <p className="mb-4 text-sm text-muted">
        {t(
          "เครื่องที่ใช้ร่วมกันจะออกจากระบบเองหลังไม่ใช้งาน {n} นาที ยอดที่ยังไม่ซิงก์จะอยู่ในเครื่องจนกว่าจะส่งสำเร็จ",
          { n: idle },
        )}
      </p>
      <LogoutButton />
    </main>
  );
}
