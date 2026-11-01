"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnProfileAction } from "@/app/actions/me";
import type { Profile } from "@/lib/profile-types";
import { fmtFullDate } from "@/lib/dates";
import { tk } from "@/i18n";
import { useT } from "@/i18n/client";

type Key = keyof Profile;
type Field = { key: Key; label: string; type?: "tel" | "email" | "date" | "area"; placeholder?: string; max: number };

/** label / placeholder are Thai keys: render with t() */
const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: tk("ข้อมูลพื้นฐาน"),
    fields: [
      { key: "fullName", label: tk("ชื่อ-นามสกุล"), placeholder: tk("เช่น สมหญิง ใจดี"), max: 100 },
      { key: "nickname", label: tk("ชื่อเล่น"), placeholder: tk("เช่น นก"), max: 40 },
      { key: "birthday", label: tk("วันเกิด"), type: "date", max: 10 },
    ],
  },
  {
    title: tk("ช่องทางติดต่อ"),
    fields: [
      { key: "phone", label: tk("เบอร์โทร"), type: "tel", placeholder: "08x-xxx-xxxx", max: 20 },
      { key: "email", label: tk("อีเมล"), type: "email", placeholder: "name@example.com", max: 120 },
      { key: "lineId", label: tk("LINE ID"), max: 60 },
    ],
  },
  {
    title: tk("อาหารและสุขภาพ"),
    fields: [
      {
        key: "allergies",
        label: tk("แพ้อาหาร / อาหารที่ไม่ทาน"),
        type: "area",
        placeholder: tk("เช่น แพ้กุ้ง ถั่วลิสง · ไม่ทานหมู · มังสวิรัติ"),
        max: 300,
      },
    ],
  },
  {
    title: tk("ผู้ติดต่อฉุกเฉิน"),
    fields: [
      { key: "emergencyName", label: tk("ผู้ติดต่อฉุกเฉิน"), placeholder: tk("ชื่อ (ความสัมพันธ์) เช่น แม่ - สมศรี"), max: 100 },
      { key: "emergencyPhone", label: tk("เบอร์ผู้ติดต่อฉุกเฉิน"), type: "tel", max: 20 },
    ],
  },
];

/** Read-only view of a profile: the Me page and Admin's user list. */
export function ProfileView({ profile }: { profile: Profile }) {
  const { t, lang } = useT();
  const shown = (f: Field) => {
    const v = profile[f.key];
    if (!v) return null;
    return f.type === "date" ? fmtFullDate(v, lang) : v;
  };
  return (
    <dl className="grid gap-3">
      {GROUPS.map((g) => (
        <div key={g.title} className="grid gap-1.5">
          <dt className="text-xs font-semibold tracking-wide text-muted">{t(g.title)}</dt>
          <dd className="grid gap-1">
            {g.fields.map((f) => {
              const v = shown(f);
              return (
                <div key={f.key} className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted">{t(f.label)}</span>
                  <span
                    className={`min-w-0 whitespace-pre-line break-words text-right ${
                      !v ? "text-muted" : f.key === "allergies" ? "font-semibold text-warn" : ""
                    }`}
                  >
                    {v ?? "—"}
                  </span>
                </div>
              );
            })}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ProfileDetails({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profile);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { t } = useT();
  const filled = Object.values(profile).filter(Boolean).length;
  const changed = (Object.keys(form) as Key[]).some((k) => form[k].trim() !== profile[k]);

  if (!editing) {
    return (
      <>
        {filled ? (
          <ProfileView profile={profile} />
        ) : (
          <p className="text-sm text-muted">{t("ยังไม่ได้กรอกข้อมูลส่วนตัว กรอกไว้ให้ทีมติดต่อได้และรู้เรื่องแพ้อาหาร")}</p>
        )}
        <button
          type="button"
          className="btn w-full"
          onClick={() => (setForm(profile), setError(null), setDone(false), setEditing(true))}
        >
          {filled ? t("แก้ไขข้อมูลส่วนตัว") : t("กรอกข้อมูลส่วนตัว")}
        </button>
        {done && <p role="status" className="text-sm text-ok">✓ {t("บันทึกแล้ว")}</p>}
      </>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateOwnProfileAction(form);
          setError(r.error);
          if (!r.error) {
            setEditing(false);
            setDone(true);
            router.refresh();
          }
        });
      }}
    >
      {GROUPS.map((g) => (
        <fieldset key={g.title} className="grid gap-2">
          <legend className="mb-1 text-xs font-semibold tracking-wide text-muted">{t(g.title)}</legend>
          {g.fields.map((f) => {
            const props = {
              className: "input",
              value: form[f.key],
              maxLength: f.max,
              placeholder: f.placeholder ? t(f.placeholder) : undefined,
              onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setForm((p) => ({ ...p, [f.key]: e.target.value })),
            };
            return (
              <label key={f.key} className="grid gap-1 text-sm">
                <span className="text-muted">{t(f.label)}</span>
                {f.type === "area" ? (
                  <textarea {...props} rows={2} className="input min-h-20 py-2" />
                ) : (
                  <input
                    {...props}
                    type={f.type ?? "text"}
                    inputMode={f.type === "tel" ? "tel" : f.type === "email" ? "email" : undefined}
                    autoComplete={AUTOCOMPLETE[f.key]}
                    max={f.type === "date" ? new Date().toISOString().slice(0, 10) : undefined}
                  />
                )}
              </label>
            );
          })}
        </fieldset>
      ))}
      <p className="text-sm text-muted">{t("ไม่บังคับทุกช่อง ข้อมูลนี้เห็นเฉพาะคุณและ Admin")}</p>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" disabled={pending} onClick={() => setEditing(false)}>
          {t("ยกเลิก")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending || !changed}>
          {t("บันทึก")}
        </button>
      </div>
    </form>
  );
}

const AUTOCOMPLETE: Partial<Record<Key, string>> = {
  fullName: "name",
  nickname: "nickname",
  phone: "tel",
  email: "email",
  birthday: "bday",
};
