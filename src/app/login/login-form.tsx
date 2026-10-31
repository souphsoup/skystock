"use client";

import { useActionState, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { loginAction } from "@/app/actions/auth";

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
  const [state, action, pending] = useActionState(async (prev: { error: string | null }, form: FormData) => {
    const res = await loginAction(prev, form);
    if (res.error) setPin("");
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
        <span className="text-sm font-medium text-muted">ชื่อผู้ใช้</span>
        <input
          name="login"
          className="input"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="เช่น ton"
        />
      </label>

      {recent.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="ผู้ใช้ล่าสุดในเครื่องนี้">
          {recent.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setLogin(r);
                setPin("");
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
        <span className="text-sm font-medium text-muted">PIN 6 หลัก</span>
        <div className="mt-2 flex justify-center gap-3" aria-live="polite" aria-label={`ใส่แล้ว ${pin.length} จาก ${PIN_LENGTH} หลัก`}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 ${i < pin.length ? "border-accent bg-accent" : "border-line"}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className="btn num text-xl" onClick={() => press(d)} disabled={pending}>
            {d}
          </button>
        ))}
        <button type="button" className="btn btn-ghost text-sm" onClick={() => setPin("")} disabled={pending}>
          ล้าง
        </button>
        <button type="button" className="btn num text-xl" onClick={() => press("0")} disabled={pending}>
          0
        </button>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => setPin(pin.slice(0, -1))}
          disabled={pending}
          aria-label="ลบตัวสุดท้าย"
        >
          ⌫
        </button>
      </div>

      {state.error && (
        <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending || !login.trim() || pin.length !== PIN_LENGTH}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
