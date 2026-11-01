"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Channel, SendResult, Target } from "@/lib/notify";
import {
  addTargetAction,
  removeTargetAction,
  sendTestAction,
  setTargetActiveAction,
  setTargetLangAction,
  type NotifyResult,
} from "@/app/actions/notify";
import { LANGS, tk, type Lang, type TFn } from "@/i18n";
import { useT } from "@/i18n/client";

const LINE_KIND: Record<string, string> = { U: tk("ผู้ใช้"), C: tk("กลุ่ม"), R: tk("ห้องแชต") };

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<NotifyResult>, okText: (r: NotifyResult) => string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: okText(r) });
      if (!r.error) {
        after?.();
        router.refresh();
      }
    });
  return { pending, msg, run };
}

function sentText(t: TFn, r: NotifyResult): string {
  const res: SendResult[] = r.results ?? [];
  const failed = res.filter((x) => !x.ok);
  if (r.status === "dry_run") return t("ทดลองส่งแล้ว (ยังไม่ได้ตั้งบัญชี จึงไม่ได้ส่งจริง ดูข้อความใน log)");
  if (failed.length) {
    return t("ส่งไม่สำเร็จ {failed} จาก {total}: {errors}", {
      failed: failed.length,
      total: res.length,
      errors: failed.map((f) => f.error).join(" · "),
    });
  }
  return t("ส่งแล้ว {n} ผู้รับ", { n: res.length });
}

/** Language of the summary a recipient gets. Same look as LangSwitch, but never changes the admin's own language. */
function LangToggle({
  value,
  onChange,
  disabled,
  label,
}: {
  value: Lang;
  onChange: (lang: Lang) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-xl border border-line bg-surface p-1">
      {LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          role="radio"
          aria-checked={value === l.value}
          disabled={disabled}
          lang={l.value}
          onClick={() => value !== l.value && onChange(l.value)}
          className={`min-h-8 rounded-lg px-3 text-xs font-semibold ${
            value === l.value ? "bg-accent text-accent-ink" : "text-muted"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function NotifyTargets({ targets, lineReady, emailReady }: { targets: Target[]; lineReady: boolean; emailReady: boolean }) {
  const { t } = useT();
  const { pending, msg, run } = useAction();
  const active = targets.filter((x) => x.active).length;
  const line = targets.filter((x) => x.channel === "line");
  const email = targets.filter((x) => x.channel === "email");

  return (
    <div className="grid gap-4">
      <section className="card p-4" aria-labelledby="line-h">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="line-h" className="font-semibold">LINE</h2>
          {!lineReady && <span className="pill bg-line text-muted">{t("ยังไม่เชื่อม LINE OA")}</span>}
        </div>
        {line.length === 0 ? (
          <p className="text-sm text-muted">
            {t("เพิ่มบอท LINE OA ของร้านเข้ากลุ่มผู้บริหาร แล้วกลุ่มจะขึ้นที่นี่ให้เปิดรับ")}
          </p>
        ) : (
          <TargetList targets={line} />
        )}
        <AddTarget channel="line" />
      </section>

      <section className="card p-4" aria-labelledby="email-h">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="email-h" className="font-semibold">{t("อีเมล")}</h2>
          {!emailReady && <span className="pill bg-line text-muted">{t("ยังไม่ตั้งค่าอีเมล")}</span>}
        </div>
        {email.length > 0 && <TargetList targets={email} />}
        <AddTarget channel="email" />
      </section>

      <button
        type="button"
        className="btn w-full"
        disabled={pending || active === 0}
        onClick={() => run(() => sendTestAction(), (r) => sentText(t, r))}
      >
        {pending ? t("กำลังส่ง…") : t("ส่งสรุปทดสอบตอนนี้ ({n} ผู้รับที่เปิดไว้)", { n: active })}
      </button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`-mt-2 text-sm ${msg.ok ? "text-ok" : "text-bad"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function TargetList({ targets }: { targets: Target[] }) {
  return (
    <ul className="mb-3 divide-y divide-line">
      {targets.map((x) => (
        <TargetRow key={x.id} target={x} />
      ))}
    </ul>
  );
}

function TargetRow({ target: tg }: { target: Target }) {
  const { t } = useT();
  const { pending, msg, run } = useAction();
  const [confirm, setConfirm] = useState(false);
  const name = tg.label || tg.address;
  const kind = LINE_KIND[tg.address[0]];
  const sub =
    tg.channel === "line" ? `${kind ? t(kind) : "LINE"} · …${tg.address.slice(-6)}` : tg.label ? tg.address : null;

  return (
    <li className="py-2">
      <div className="flex min-h-12 items-center gap-3">
        <span className={`min-w-0 flex-1 ${tg.active ? "" : "text-muted"}`}>
          <b className="block truncate">{name}</b>
          {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
          {!tg.active && tg.channel === "line" && <span className="text-sm text-warn">{t("รอเปิดรับ")}</span>}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={tg.active}
          aria-label={t("รับสรุป {name}", { name })}
          disabled={pending}
          onClick={() =>
            run(
              () => setTargetActiveAction(tg.id, !tg.active),
              () => (tg.active ? t("ปิดรับแล้ว") : t("เปิดรับแล้ว")),
            )
          }
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${tg.active ? "bg-ok" : "bg-line"}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${tg.active ? "left-7" : "left-1"}`}
          />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost min-h-10 px-2 text-sm text-hl"
          disabled={pending}
          onClick={() => run(() => sendTestAction(tg.id), (r) => sentText(t, r))}
        >
          {t("ส่งทดสอบ")}
        </button>
        {confirm ? (
          <>
            <button
              type="button"
              className="btn min-h-10 px-3 text-sm text-bad"
              disabled={pending}
              onClick={() => run(() => removeTargetAction(tg.id), () => t("ลบแล้ว"))}
            >
              {t("ยืนยันลบ")}
            </button>
            <button type="button" className="btn btn-ghost min-h-10 px-2 text-sm" onClick={() => setConfirm(false)}>
              {t("ไม่ลบ")}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost min-h-10 px-2 text-sm text-muted" onClick={() => setConfirm(true)}>
            {t("ลบ")}
          </button>
        )}
        <span className="ml-auto">
          <LangToggle
            value={tg.lang}
            disabled={pending}
            label={t("ภาษาของสรุปสำหรับ {name}", { name })}
            onChange={(lang) => run(() => setTargetLangAction(tg.id, lang), () => t("เปลี่ยนภาษาแล้ว"))}
          />
        </span>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-ok" : "text-bad"}`}>
          {msg.text}
        </p>
      )}
    </li>
  );
}

function AddTarget({ channel }: { channel: Channel }) {
  const { t, lang: uiLang } = useT();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [lang, setLang] = useState<Lang>(uiLang);
  const { pending, msg, run } = useAction();
  const isLine = channel === "line";

  if (!open) {
    return (
      <>
        <button
          type="button"
          className={isLine ? "btn btn-ghost min-h-10 px-2 text-sm text-muted" : "btn w-full"}
          onClick={() => {
            setLang(uiLang);
            setOpen(true);
          }}
        >
          {isLine ? t("ใส่ LINE ID เอง") : t("+ เพิ่มอีเมล")}
        </button>
        {msg?.ok && <p role="status" className="text-sm text-ok">✓ {msg.text}</p>}
      </>
    );
  }
  return (
    <form
      className="grid gap-2 rounded-xl bg-paper p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addTargetAction(channel, address, label, lang), () => t("เพิ่มแล้ว"), () => {
          setOpen(false);
          setAddress("");
          setLabel("");
        });
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-muted">{isLine ? t("LINE userId หรือ groupId") : t("อีเมล")}</span>
        <input
          className="input"
          type={isLine ? "text" : "email"}
          autoCapitalize="none"
          autoComplete="off"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={isLine ? "C1234…" : "gm@example.com"}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">{t("ชื่อเรียก (ไม่บังคับ)")}</span>
        <input
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={isLine ? t("เช่น กลุ่มผู้บริหาร") : t("เช่น คุณนภา GM")}
        />
      </label>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted">{t("ภาษาของสรุป")}</span>
        <LangToggle value={lang} onChange={setLang} disabled={pending} label={t("ภาษาของสรุป")} />
      </div>
      {msg && !msg.ok && <p role="alert" className="text-sm text-bad">{msg.text}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)} disabled={pending}>
          {t("ยกเลิก")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending || !address.trim()}>
          {t("เพิ่มผู้รับ")}
        </button>
      </div>
    </form>
  );
}
