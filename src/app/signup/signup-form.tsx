"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signupAction, type SignupState } from "@/app/actions/signup";
import { useT } from "@/i18n/client";

const pinOk = (p: string) => /^\d{6}$/.test(p);
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

export function SignupForm() {
  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const { t } = useT();
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, { error: null, done: false });

  if (state.done) {
    return (
      <section className="card grid gap-3 p-5" role="status">
        <h2 className="text-lg font-bold">{t("ส่งคำขอแล้ว")}</h2>
        <p className="text-muted">
          {t("แจ้ง Admin ให้อนุมัติบัญชี {login} หลังอนุมัติแล้วเข้าระบบด้วยชื่อผู้ใช้และ PIN ที่ตั้งไว้", { login })}
        </p>
        <Link href="/login" className="btn btn-primary">
          {t("ไปหน้าเข้าสู่ระบบ")}
        </Link>
      </section>
    );
  }

  const mismatch = pin2.length === 6 && pin !== pin2;
  return (
    <form action={action} className="card grid gap-4 p-5">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-muted">{t("ชื่อผู้ใช้ (ใช้เข้าระบบ)")}</span>
        <input
          name="login"
          className="input"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          maxLength={30}
          value={login}
          onChange={(e) => setLogin(e.target.value.toLowerCase())}
          placeholder={t("เช่น nok")}
        />
        <span className="text-xs text-muted">{t("a-z 0-9 . _ - เท่านั้น")}</span>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-muted">{t("ชื่อที่แสดง")}</span>
        <input name="name" className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("เช่น นก")} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-muted">{t("PIN 6 หลัก")}</span>
          <input
            name="pin"
            type="password"
            className="input num"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(digits(e.target.value))}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-muted">{t("ยืนยัน PIN")}</span>
          <input
            name="pin2"
            type="password"
            className="input num"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin2}
            onChange={(e) => setPin2(digits(e.target.value))}
            aria-invalid={mismatch}
          />
        </label>
      </div>
      {mismatch && <p className="text-sm text-bad">{t("PIN ทั้งสองช่องไม่ตรงกัน")}</p>}
      {state.error && (
        <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={pending || !login.trim() || !name.trim() || !pinOk(pin) || pin !== pin2}
      >
        {pending ? t("กำลังส่ง…") : t("ส่งคำขอสมัคร")}
      </button>
    </form>
  );
}
