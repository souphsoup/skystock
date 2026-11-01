import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ROLE_LABEL, can } from "@/lib/types";
import { PageHeader } from "@/components/status";
import { SyncBadge } from "@/components/sync-badge";
import { LogoutButton } from "./logout-button";
import { NameForm, PinForm } from "./profile-form";
import { AvatarPicker } from "./avatar-picker";
import { ProfileDetails } from "./profile-details";
import { getOwnProfile } from "@/lib/me";
import { LangSwitch } from "@/components/lang-switch";
import { ThemeSwitch, ToneSwitch } from "@/components/theme-switch";
import { getT } from "@/i18n/server";

export default async function MePage() {
  const user = await requireUser();
  const [{ t }, profile] = await Promise.all([getT(), getOwnProfile(user)]);
  const idle = Number(process.env.NEXT_PUBLIC_IDLE_MINUTES) || 15;
  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <PageHeader title={t("ฉัน")} right={<SyncBadge />} />
      <section className="card mb-4 flex items-center gap-4 p-4">
        <AvatarPicker name={user.name} photo={user.avatar} />
        <div className="min-w-0">
          <b className="block text-lg">
            {user.name}
            {profile.nickname && profile.nickname !== user.name && (
              <span className="ml-1.5 text-base font-normal text-muted">({profile.nickname})</span>
            )}
          </b>
          {profile.fullName && <span className="block text-sm">{profile.fullName}</span>}
          <span className="text-sm text-muted">
            {t(ROLE_LABEL[user.role])} · {t("ชื่อผู้ใช้ {login}", { login: user.login })}
          </span>
        </div>
      </section>
      <section className="card mb-4 grid gap-3 p-4" aria-labelledby="account-h">
        <h2 id="account-h" className="font-semibold">
          {t("บัญชีของฉัน")}
        </h2>
        <NameForm name={user.name} />
        <PinForm />
      </section>
      <section className="card mb-4 grid gap-3 p-4" aria-labelledby="profile-h">
        <h2 id="profile-h" className="font-semibold">
          {t("ข้อมูลส่วนตัว")}
        </h2>
        <ProfileDetails profile={profile} />
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
      {can.usage(user.role) && (
        <Link href="/usage" className="card mb-4 flex min-h-14 items-center justify-between px-4">
          <span>
            <b className="block">{t("การใช้งานแอป")}</b>
            <span className="text-sm text-muted">{t("ใครเข้าใช้ นับไปเท่าไหร่ วันนี้")}</span>
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
      <section className="mb-4" aria-labelledby="theme-h">
        <h2 id="theme-h" className="mb-2 text-sm text-muted">
          {t("ธีม")}
        </h2>
        <ThemeSwitch />
      </section>
      <section className="mb-4" aria-labelledby="tone-h">
        <h2 id="tone-h" className="mb-2 text-sm text-muted">
          {t("โทนสี")}
        </h2>
        <ToneSwitch />
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
