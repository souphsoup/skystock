import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { LangSwitch } from "@/components/lang-switch";
import { getT } from "@/i18n/server";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  if (await getUser()) redirect("/");
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <div>
        <div className="mb-6 flex justify-end">
          <LangSwitch compact />
        </div>
        <p className="text-sm font-semibold tracking-wide text-accent">MAI The Sky Bar</p>
        <h1 className="mt-1 text-3xl font-bold">{t("สมัครใช้งาน")}</h1>
        <p className="mt-1 text-muted">{t("กรอกข้อมูลแล้วรอ Admin อนุมัติ จึงจะเข้าระบบได้")}</p>
      </div>
      <SignupForm />
      <Link href="/login" className="btn btn-ghost text-sm text-muted">
        {t("มีบัญชีแล้ว? เข้าสู่ระบบ")}
      </Link>
    </main>
  );
}
