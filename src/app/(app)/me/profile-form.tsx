"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeOwnPinAction, updateOwnNameAction } from "@/app/actions/me";
import { useT } from "@/i18n/client";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error: string | null }>, okMessage: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.error);
      setDone(r.error ? null : okMessage);
      if (!r.error) {
        after?.();
        router.refresh();
      }
    });
  return { pending, error, done, run };
}

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
const pinOk = (p: string) => /^\d{6}$/.test(p);

export function NameForm({ name: current }: { name: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(current);
  const { pending, error, done, run } = useAction();
  const { t } = useT();

  if (!editing) {
    return (
      <>
        <button type="button" className="btn w-full" onClick={() => (setName(current), setEditing(true))}>
          {t("แก้ชื่อที่แสดง")}
        </button>
        {done && <p role="status" className="mt-2 text-sm text-ok">✓ {done}</p>}
      </>
    );
  }
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateOwnNameAction(name), t("บันทึกแล้ว"), () => setEditing(false));
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-muted">{t("ชื่อที่แสดง")}</span>
        <input className="input" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" disabled={pending} onClick={() => setEditing(false)}>
          {t("ยกเลิก")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending || !name.trim() || name.trim() === current}>
          {t("บันทึก")}
        </button>
      </div>
    </form>
  );
}

export function PinForm() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const { pending, error, done, run } = useAction();
  const { t } = useT();
  const mismatch = pinOk(pin) && pinOk(again) && pin !== again;
  const reset = () => {
    setCurrent("");
    setPin("");
    setAgain("");
  };

  if (!open) {
    return (
      <>
        <button type="button" className="btn w-full" onClick={() => setOpen(true)}>
          {t("เปลี่ยน PIN")}
        </button>
        {done && <p role="status" className="mt-2 text-sm text-ok">✓ {done}</p>}
      </>
    );
  }
  const field = (label: string, value: string, set: (v: string) => void, autoComplete: string) => (
    <label className="grid gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input
        className="input num"
        type="password"
        inputMode="numeric"
        maxLength={6}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => set(digits(e.target.value))}
      />
    </label>
  );
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => changeOwnPinAction(current, pin), t("เปลี่ยน PIN แล้ว เครื่องอื่นออกจากระบบหมดแล้ว"), () => {
          reset();
          setOpen(false);
        });
      }}
    >
      {field(t("PIN เดิม"), current, setCurrent, "current-password")}
      {field(t("PIN ใหม่ 6 หลัก"), pin, setPin, "new-password")}
      {field(t("ใส่ PIN ใหม่อีกครั้ง"), again, setAgain, "new-password")}
      <p className="text-sm text-muted">
        {t("ห้ามใช้ PIN ที่เดาง่าย เช่น 123456 หรือ 111111 เปลี่ยนแล้วเครื่องอื่นที่เข้าระบบไว้จะออกจากระบบ")}
      </p>
      {mismatch && <p role="alert" className="text-sm text-bad">{t("PIN ใหม่ทั้งสองช่องไม่ตรงกัน")}</p>}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" disabled={pending} onClick={() => (reset(), setOpen(false))}>
          {t("ยกเลิก")}
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || !pinOk(current) || !pinOk(pin) || pin !== again}
        >
          {t("เปลี่ยน PIN")}
        </button>
      </div>
    </form>
  );
}
