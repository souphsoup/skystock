"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { loginAction } from "@/app/actions/auth";
import { LangSwitch } from "@/components/lang-switch";
import { deviceUserSnapshot, forgetDeviceUser, parseDeviceUser } from "@/client/device-user";
import { useT } from "@/i18n/client";

const PIN_LENGTH = 6;
const VENUE = "MAI The Sky Bar";

const noSubscribe = () => () => {};

// Two steps, like a banking app on a personal phone: the username once per phone, then only the PIN.
export function LoginForm() {
  // null on the server: we don't know yet whether this phone has a user, so render neither step.
  const raw = useSyncExternalStore(noSubscribe, deviceUserSnapshot, () => null);
  const [forgotten, setForgotten] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  if (raw === null) return <Brand venue />;
  const remembered = forgotten ? null : parseDeviceUser(raw);
  const login = chosen ?? remembered?.login;
  if (!login) return <UsernameStep onNext={setChosen} />;
  return (
    <PinStep
      key={login}
      login={login}
      name={remembered?.login === login ? remembered.name : ""}
      onChangeUser={() => {
        forgetDeviceUser();
        setForgotten(true);
        setChosen(null);
      }}
    />
  );
}

function Brand({ venue = false }: { venue?: boolean }) {
  const { t } = useT();
  return (
    <div>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight">
        me<span className="text-hl">Stock</span>
      </h1>
      <p className="text-sm text-muted">{t("ระบบบริหารสินค้าคงคลัง")}</p>
      {venue && <p className="mt-2.5 border-t border-line pt-2.5 text-xs tracking-wide text-muted">{VENUE}</p>}
    </div>
  );
}

function UsernameStep({ onNext }: { onNext: (login: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <form
      className="flex flex-1 flex-col px-6 pb-6 pt-14"
      onSubmit={(e) => {
        e.preventDefault();
        const l = value.trim().toLowerCase();
        if (l) onNext(l);
        else inputRef.current?.focus();
      }}
    >
      <Brand venue />
      <h2 className="mb-4 mt-10 text-xl font-semibold">{t("เข้าสู่ระบบ")}</h2>
      <label htmlFor="login" className="text-sm font-medium">
        {t("ชื่อผู้ใช้")}
      </label>
      <input
        ref={inputRef}
        id="login"
        name="login"
        className="input mt-1.5 rounded-lg"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="username"
        enterKeyHint="next"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn btn-primary mt-5 w-full rounded-lg">
        {t("ถัดไป")}
      </button>
      <div className="mt-auto flex items-center justify-between gap-3 pt-10 text-sm">
        <Link href="/signup" className="py-2 font-medium text-hl">
          {t("พนักงานใหม่? สมัครใช้งาน")}
        </Link>
        <LangSwitch text />
      </div>
    </form>
  );
}

function PinStep({ login, name, onChangeUser }: { login: string; name: string; onChangeUser: () => void }) {
  const { t } = useT();
  const [pin, setPin] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  // Failed tries on this device. Counted here, not by the server: the server must not tell
  // a guesser which usernames exist (or how close an account is to being locked).
  const [fails, setFails] = useState(0);
  const [state, action, pending] = useActionState(async (prev: { error: string | null }, form: FormData) => {
    const res = await loginAction(prev, form);
    if (res.error) {
      setPin("");
      setFails((n) => n + 1);
      navigator.vibrate?.(200);
    }
    return res;
  }, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  function press(d: string) {
    if (pending || pin.length >= PIN_LENGTH) return;
    const next = pin + d;
    setPin(next);
    // Let React commit the last digit into the hidden input first.
    if (next.length === PIN_LENGTH) setTimeout(() => formRef.current?.requestSubmit(), 0);
  }
  const back = () => !pending && setPin(pin.slice(0, -1));

  // A computer's number keys work too (managers sign in on a laptop).
  const pressRef = useRef(press);
  const backRef = useRef(back);
  useEffect(() => {
    pressRef.current = press;
    backRef.current = back;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) pressRef.current(e.key);
      else if (e.key === "Backspace") backRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shownName = name || login;
  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pt-8">
        <Brand />
        <div className="mt-7 flex items-center justify-between gap-3 rounded-lg border border-line py-2.5 pl-3.5 pr-2">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t("เข้าสู่ระบบในชื่อ")}</p>
            <p className="truncate font-semibold">
              {shownName}
              {shownName !== login && <span className="ml-1.5 text-sm font-normal text-muted">{login}</span>}
            </p>
          </div>
          <button type="button" onClick={onChangeUser} className="min-h-10 shrink-0 px-2 text-sm font-medium text-hl">
            {t("เปลี่ยน")}
          </button>
        </div>

        <p className="mt-7 text-center font-medium">{t("ใส่ PIN 6 หลัก")}</p>
        <div
          className="mt-3 flex justify-center gap-4"
          aria-live="polite"
          aria-label={t("ใส่แล้ว {n} จาก {total} หลัก", { n: pin.length, total: PIN_LENGTH })}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full border-[1.5px] ${i < pin.length ? "border-ink bg-ink" : "border-muted"}`}
            />
          ))}
        </div>

        {state.error && !pending && (
          <div role="alert" className="mt-4 text-center text-sm text-bad">
            <p className="font-medium">{state.error}</p>
            {fails >= 2 && (
              <p className="mt-1">{t("ใส่ผิดครบ 5 ครั้ง บัญชีจะถูกล็อก 5 นาที ลืม PIN ให้หัวหน้าหรือ Admin ตั้ง PIN ใหม่ให้")}</p>
            )}
          </div>
        )}
        {pending && <p className="mt-4 text-center text-sm text-muted">{t("กำลังเข้าสู่ระบบ…")}</p>}

        <div className="mt-3 text-center text-sm">
          {showForgot ? (
            <p className="text-muted">{t("ให้หัวหน้าหรือ Admin ตั้ง PIN ใหม่ให้ แล้วเข้าระบบด้วย PIN ใหม่")}</p>
          ) : (
            <button type="button" onClick={() => setShowForgot(true)} className="min-h-10 px-2 font-medium text-hl">
              {t("ลืม PIN?")}
            </button>
          )}
        </div>
      </div>

      <form
        ref={formRef}
        action={action}
        className="mt-auto grid grid-cols-3 gap-1.5 border-t border-line bg-paper px-1.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2"
      >
        <input type="hidden" name="login" value={login} />
        <input type="hidden" name="pin" value={pin} />
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={pending}>
            {d}
          </Key>
        ))}
        <Key fn onClick={() => !pending && setPin("")} disabled={pending}>
          {t("ล้าง")}
        </Key>
        <Key onClick={() => press("0")} disabled={pending}>
          0
        </Key>
        <Key fn onClick={back} disabled={pending} label={t("ลบตัวสุดท้าย")}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
            <path d="M9 5h11v14H9l-6-7z" />
            <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
          </svg>
        </Key>
      </form>
    </div>
  );
}

function Key({
  children,
  onClick,
  disabled,
  fn = false,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  fn?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-[52px] items-center justify-center rounded-md disabled:opacity-60 ${
        fn ? "text-[15px] text-muted active:bg-line" : "num bg-surface text-[22px] shadow-[0_1px_0_var(--line)] active:bg-line"
      }`}
    >
      {children}
    </button>
  );
}
