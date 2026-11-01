"use client";

import { useActionState, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { loginAction } from "@/app/actions/auth";
import { useT } from "@/i18n/client";

const RECENT_KEY = "sop-recent-logins";
const PIN_LENGTH = 6;

const noSubscribe = () => () => {};
function parseRecent(raw: string): string[] {
  try {
    const r = JSON.parse(raw);
    return Array.isArray(r) ? r.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function LoginForm() {
  const [login, setLogin] = useState("");
  const [pin, setPin] = useState("");
  // Failed tries on this device. Counted here, not by the server: the server must not tell
  // a guesser which usernames exist (or how close an account is to being locked).
  const [fails, setFails] = useState(0);
  const { t } = useT();
  const [state, action, pending] = useActionState(async (prev: { error: string | null }, form: FormData) => {
    const res = await loginAction(prev, form);
    if (res.error) {
      setPin("");
      setFails((n) => n + 1);
      navigator.vibrate?.(200);
    }
    return res;
  }, { error: null });
  const recentRaw = useSyncExternalStore(
    noSubscribe,
    () => localStorage.getItem(RECENT_KEY) ?? "[]",
    () => "[]",
  );
  const recent = useMemo(() => parseRecent(recentRaw), [recentRaw]);
  const formRef = useRef<HTMLFormElement>(null);

  function press(d: string) {
    if (pending) return;
    const next = (pin + d).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH && login.trim()) {
      const l = login.trim().toLowerCase();
      localStorage.setItem(RECENT_KEY, JSON.stringify([l, ...recent.filter((x) => x !== l)].slice(0, 6)));
      // Let React commit the last digit into the hidden input first.
      setTimeout(() => formRef.current?.requestSubmit(), 0);
    }
  }

  return (
    <form ref={formRef} action={action} className="card flex flex-col gap-4 p-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-muted">{t("ชื่อผู้ใช้")}</span>
        <input
          name="login"
          className="input"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          value={login}
          onChange={(e) => {
            setLogin(e.target.value);
            setFails(0);
          }}
          placeholder={t("เช่น ton")}
        />
      </label>

      {recent.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t("ผู้ใช้ล่าสุดในเครื่องนี้")}>
          {recent.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setLogin(r);
                setPin("");
                setFails(0);
              }}
              className={`pill min-h-9 border ${login === r ? "border-accent bg-accent-soft text-ink" : "border-line text-muted"}`}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <input type="hidden" name="pin" value={pin} />
      <div>
        <span className="text-sm font-medium text-muted">{t("PIN 6 หลัก")}</span>
        <div className="mt-2 flex justify-center gap-3" aria-live="polite" aria-label={t("ใส่แล้ว {n} จาก {total} หลัก", { n: pin.length, total: PIN_LENGTH })}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 ${i < pin.length ? "border-accent bg-accent" : "border-line"}`}
            />
          ))}
        </div>
        {/* Right under the dots, so it's on screen even when the keypad fills a short phone. */}
        {state.error && (
          <div role="alert" className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-center text-sm font-medium text-bad">
            <p>{state.error}</p>
            {fails >= 2 && (
              <p className="mt-1 font-normal">
                {t("ใส่ผิดครบ 5 ครั้ง บัญชีจะถูกล็อก 5 นาที ลืม PIN ให้หัวหน้าหรือ Admin ตั้ง PIN ใหม่ให้")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className="btn num text-xl" onClick={() => press(d)} disabled={pending}>
            {d}
          </button>
        ))}
        <button type="button" className="btn btn-ghost text-sm" onClick={() => setPin("")} disabled={pending}>
          {t("ล้าง")}
        </button>
        <button type="button" className="btn num text-xl" onClick={() => press("0")} disabled={pending}>
          0
        </button>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => setPin(pin.slice(0, -1))}
          disabled={pending}
          aria-label={t("ลบตัวสุดท้าย")}
        >
          ⌫
        </button>
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending || !login.trim() || pin.length !== PIN_LENGTH}>
        {pending ? t("กำลังเข้าสู่ระบบ…") : t("เข้าสู่ระบบ")}
      </button>
    </form>
  );
}
