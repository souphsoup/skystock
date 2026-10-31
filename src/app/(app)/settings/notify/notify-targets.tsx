"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Channel, SendResult, Target } from "@/lib/notify";
import { addTargetAction, removeTargetAction, sendTestAction, setTargetActiveAction, type NotifyResult } from "@/app/actions/notify";

const LINE_KIND: Record<string, string> = { U: "ผู้ใช้", C: "กลุ่ม", R: "ห้องแชต" };

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

function sentText(r: NotifyResult): string {
  const res: SendResult[] = r.results ?? [];
  const failed = res.filter((x) => !x.ok);
  if (r.status === "dry_run") return "ทดลองส่งแล้ว (ยังไม่ได้ตั้งบัญชี จึงไม่ได้ส่งจริง ดูข้อความใน log)";
  if (failed.length) return `ส่งไม่สำเร็จ ${failed.length} จาก ${res.length}: ${failed.map((f) => f.error).join(" · ")}`;
  return `ส่งแล้ว ${res.length} ผู้รับ`;
}

export function NotifyTargets({ targets, lineReady, emailReady }: { targets: Target[]; lineReady: boolean; emailReady: boolean }) {
  const { pending, msg, run } = useAction();
  const active = targets.filter((t) => t.active).length;
  const line = targets.filter((t) => t.channel === "line");
  const email = targets.filter((t) => t.channel === "email");

  return (
    <div className="grid gap-4">
      <section className="card p-4" aria-labelledby="line-h">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="line-h" className="font-semibold">LINE</h2>
          {!lineReady && <span className="pill bg-line text-muted">ยังไม่เชื่อม LINE OA</span>}
        </div>
        {line.length === 0 ? (
          <p className="text-sm text-muted">
            เพิ่มบอท LINE OA ของร้านเข้ากลุ่มผู้บริหาร แล้วกลุ่มจะขึ้นที่นี่ให้เปิดรับ
          </p>
        ) : (
          <TargetList targets={line} />
        )}
        <AddTarget channel="line" />
      </section>

      <section className="card p-4" aria-labelledby="email-h">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 id="email-h" className="font-semibold">อีเมล</h2>
          {!emailReady && <span className="pill bg-line text-muted">ยังไม่ตั้งค่าอีเมล</span>}
        </div>
        {email.length > 0 && <TargetList targets={email} />}
        <AddTarget channel="email" />
      </section>

      <button
        type="button"
        className="btn w-full"
        disabled={pending || active === 0}
        onClick={() => run(() => sendTestAction(), sentText)}
      >
        {pending ? "กำลังส่ง…" : `ส่งสรุปทดสอบตอนนี้ (${active} ผู้รับที่เปิดไว้)`}
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
      {targets.map((t) => (
        <TargetRow key={t.id} t={t} />
      ))}
    </ul>
  );
}

function TargetRow({ t }: { t: Target }) {
  const { pending, msg, run } = useAction();
  const [confirm, setConfirm] = useState(false);
  const name = t.label || t.address;
  const sub = t.channel === "line" ? `${LINE_KIND[t.address[0]] ?? "LINE"} · …${t.address.slice(-6)}` : t.label ? t.address : null;

  return (
    <li className="py-2">
      <div className="flex min-h-12 items-center gap-3">
        <span className={`min-w-0 flex-1 ${t.active ? "" : "text-muted"}`}>
          <b className="block truncate">{name}</b>
          {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
          {!t.active && t.channel === "line" && <span className="text-sm text-warn">รอเปิดรับ</span>}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={t.active}
          aria-label={`รับสรุป ${name}`}
          disabled={pending}
          onClick={() => run(() => setTargetActiveAction(t.id, !t.active), () => (t.active ? "ปิดรับแล้ว" : "เปิดรับแล้ว"))}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${t.active ? "bg-ok" : "bg-line"}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${t.active ? "left-7" : "left-1"}`}
          />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost min-h-10 px-2 text-sm text-accent"
          disabled={pending}
          onClick={() => run(() => sendTestAction(t.id), sentText)}
        >
          ส่งทดสอบ
        </button>
        {confirm ? (
          <>
            <button
              type="button"
              className="btn min-h-10 px-3 text-sm text-bad"
              disabled={pending}
              onClick={() => run(() => removeTargetAction(t.id), () => "ลบแล้ว")}
            >
              ยืนยันลบ
            </button>
            <button type="button" className="btn btn-ghost min-h-10 px-2 text-sm" onClick={() => setConfirm(false)}>
              ไม่ลบ
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost min-h-10 px-2 text-sm text-muted" onClick={() => setConfirm(true)}>
            ลบ
          </button>
        )}
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
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const { pending, msg, run } = useAction();
  const isLine = channel === "line";

  if (!open) {
    return (
      <>
        <button
          type="button"
          className={isLine ? "btn btn-ghost min-h-10 px-2 text-sm text-muted" : "btn w-full"}
          onClick={() => setOpen(true)}
        >
          {isLine ? "ใส่ LINE ID เอง" : "+ เพิ่มอีเมล"}
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
        run(() => addTargetAction(channel, address, label), () => "เพิ่มแล้ว", () => {
          setOpen(false);
          setAddress("");
          setLabel("");
        });
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-muted">{isLine ? "LINE userId หรือ groupId" : "อีเมล"}</span>
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
        <span className="text-muted">ชื่อเรียก (ไม่บังคับ)</span>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={isLine ? "เช่น กลุ่มผู้บริหาร" : "เช่น คุณนภา GM"} />
      </label>
      {msg && !msg.ok && <p role="alert" className="text-sm text-bad">{msg.text}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn" onClick={() => setOpen(false)} disabled={pending}>
          ยกเลิก
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending || !address.trim()}>
          เพิ่มผู้รับ
        </button>
      </div>
    </form>
  );
}
