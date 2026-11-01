"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRow } from "@/lib/settings";
import { ROLE_LABEL, type Role } from "@/lib/types";
import {
  createUserAction,
  resetPinAction,
  revokeSessionsAction,
  setUserActiveAction,
  updateUserAction,
} from "@/app/actions/settings";
import { tk } from "@/i18n";
import { useT } from "@/i18n/client";
import { Avatar } from "@/components/avatar";
import type { Profile } from "@/lib/profile-types";
import { ProfileView } from "../../me/profile-details";

/** label / hint are Thai keys: render with t() */
const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "operation", label: ROLE_LABEL.operation, hint: tk("นับสต็อก") },
  { value: "supervisor", label: ROLE_LABEL.supervisor, hint: tk("นับ + ตรวจอนุมัติ + ตั้งค่ารายการ") },
  { value: "manager", label: ROLE_LABEL.manager, hint: tk("ดูภาพรวมและรายงาน") },
  { value: "admin", label: ROLE_LABEL.admin, hint: tk("ทุกอย่าง + จัดการผู้ใช้") },
];

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

const pinOk = (p: string) => /^\d{6}$/.test(p);

export function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const { t } = useT();
  return (
    <div className="grid gap-2" role="radiogroup" aria-label={t("บทบาท")}>
      {ROLES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          onClick={() => onChange(r.value)}
          className={`flex min-h-12 items-center justify-between rounded-xl border px-3 text-left ${
            value === r.value ? "border-accent-line bg-accent-soft" : "border-line bg-surface"
          }`}
        >
          <b>{t(r.label)}</b>
          <span className="text-sm text-muted">{t(r.hint)}</span>
        </button>
      ))}
    </div>
  );
}

export function UserList({
  users,
  profiles,
  selfId,
}: {
  users: UserRow[];
  profiles: Record<number, Profile>;
  selfId: number;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const { t } = useT();
  return (
    <>
      <AddUser />
      <ul className="card mt-4 divide-y divide-line">
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
              aria-expanded={openId === u.id}
              onClick={() => setOpenId(openId === u.id ? null : u.id)}
            >
              <span className={`flex min-w-0 items-center gap-3 ${u.active ? "" : "text-muted opacity-70"}`}>
                <Avatar name={u.name} photo={u.avatar} />
                <span className="min-w-0">
                  <b className="block">
                    {u.name}
                    {profiles[u.id]?.nickname && profiles[u.id].nickname !== u.name && (
                      <span className="ml-1 font-normal text-muted">({profiles[u.id].nickname})</span>
                    )}
                    {u.id === selfId && <span className="ml-1 text-sm font-normal text-muted">{t("(คุณ)")}</span>}
                  </b>
                  <span className="text-sm text-muted">
                    {u.login} · {t(ROLE_LABEL[u.role])}
                  </span>
                </span>
              </span>
              <span className="flex gap-1.5">
                {u.locked && <span className="pill bg-warn-soft text-warn">{t("ล็อก PIN")}</span>}
                {!u.active && <span className="pill bg-line text-muted">{t("ปิดใช้งาน")}</span>}
              </span>
            </button>
            {openId === u.id && <UserActions user={u} profile={profiles[u.id]} isSelf={u.id === selfId} />}
          </li>
        ))}
      </ul>
    </>
  );
}

function AddUser() {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("operation");
  const [pin, setPin] = useState("");
  const { pending, error, done, run } = useAction();
  const { t } = useT();

  if (!open) {
    return (
      <>
        <button type="button" className="btn btn-primary w-full" onClick={() => setOpen(true)}>
          {t("+ เพิ่มผู้ใช้")}
        </button>
        {done && <p role="status" className="mt-2 text-sm text-ok">✓ {done}</p>}
      </>
    );
  }
  return (
    <form
      className="card grid gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createUserAction({ login, name, role, pin }), t("เพิ่ม {login} แล้ว แจ้ง PIN ให้ผู้ใช้โดยตรง", { login }), () => {
          setOpen(false);
          setLogin("");
          setName("");
          setPin("");
          setRole("operation");
        });
      }}
    >
      <h2 className="font-semibold">{t("ผู้ใช้ใหม่")}</h2>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">{t("ชื่อผู้ใช้ (ใช้เข้าระบบ)")}</span>
          <input className="input" autoCapitalize="none" value={login} onChange={(e) => setLogin(e.target.value)} placeholder={t("เช่น nok")} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">{t("ชื่อที่แสดง")}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("เช่น นก")} />
        </label>
      </div>
      <RolePicker value={role} onChange={setRole} />
      <label className="grid gap-1 text-sm">
        <span className="text-muted">{t("PIN 6 หลัก")}</span>
        <input
          className="input num"
          inputMode="numeric"
          maxLength={6}
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)} disabled={pending}>
          {t("ยกเลิก")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending || !login.trim() || !name.trim() || !pinOk(pin)}>
          {t("เพิ่มผู้ใช้")}
        </button>
      </div>
    </form>
  );
}

function UserActions({ user, profile, isSelf }: { user: UserRow; profile?: Profile; isSelf: boolean }) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [pin, setPin] = useState("");
  const { pending, error, done, run } = useAction();
  const { t } = useT();
  const changed = name.trim() !== user.name || role !== user.role;

  return (
    <div className="grid gap-4 bg-paper px-4 py-4">
      {profile && Object.values(profile).some(Boolean) ? (
        <details className="rounded-xl border border-line bg-surface px-3 py-2">
          <summary className="min-h-9 cursor-pointer content-center text-sm font-semibold">{t("ข้อมูลส่วนตัว")}</summary>
          <div className="pb-2 pt-2">
            <ProfileView profile={profile} />
          </div>
        </details>
      ) : (
        <p className="text-sm text-muted">{t("ผู้ใช้ยังไม่ได้กรอกข้อมูลส่วนตัว")}</p>
      )}
      <div className="grid gap-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">{t("ชื่อที่แสดง")}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {!isSelf && <RolePicker value={role} onChange={setRole} />}
        {changed && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || !name.trim()}
            onClick={() => run(() => updateUserAction(user.id, { name, role }), t("บันทึกแล้ว"))}
          >
            {t("บันทึกการเปลี่ยนแปลง")}
          </button>
        )}
        {role !== user.role && <p className="text-sm text-muted">{t("เปลี่ยนบทบาทแล้ว ผู้ใช้ต้องเข้าระบบใหม่ทุกเครื่อง")}</p>}
      </div>

      <div className="grid gap-2">
        <span className="text-sm text-muted">{t("ตั้ง PIN ใหม่ (ปลดล็อกและออกจากระบบทุกเครื่อง)")}</span>
        <div className="flex gap-2">
          <input
            className="input num flex-1"
            inputMode="numeric"
            maxLength={6}
            autoComplete="off"
            placeholder={t("PIN 6 หลัก")}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            aria-label={t("PIN ใหม่ของ {name}", { name: user.name })}
          />
          <button
            type="button"
            className="btn"
            disabled={pending || !pinOk(pin)}
            onClick={() => run(() => resetPinAction(user.id, pin), t("ตั้ง PIN ใหม่แล้ว"), () => setPin(""))}
          >
            {t("ตั้ง PIN")}
          </button>
        </div>
      </div>

      {!isSelf && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn"
            disabled={pending || !user.active}
            onClick={() => run(() => revokeSessionsAction(user.id), t("ออกจากระบบทุกเครื่องแล้ว"))}
          >
            {t("ออกจากระบบทุกเครื่อง")}
          </button>
          <button
            type="button"
            className={`btn ${user.active ? "text-bad" : "text-ok"}`}
            disabled={pending}
            onClick={() =>
              run(
                () => setUserActiveAction(user.id, !user.active),
                user.active ? t("ปิดบัญชีและตัด session ทุกเครื่องแล้ว") : t("เปิดบัญชีแล้ว"),
              )
            }
          >
            {user.active ? t("ปิดบัญชี") : t("เปิดบัญชีอีกครั้ง")}
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {done && <p role="status" className="text-sm text-ok">✓ {done}</p>}
    </div>
  );
}
