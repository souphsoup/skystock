import Link from "next/link";
import { headers } from "next/headers";
import { requireUser } from "@/lib/session";
import { appUrl, buildDigest, emailConfigured, listRuns, listTargets } from "@/lib/notify";
import { lineConfigured, lineWebhookConfigured } from "@/lib/line";
import { fmtDateTime, fmtDay } from "@/lib/dates";
import { can } from "@/lib/types";
import { PageHeader } from "@/components/status";
import { IconBack } from "@/components/icons";
import { DigestPreview } from "@/components/digest-preview";
import { RUN_STATUS } from "@/lib/notify-labels";
import { NotifyTargets } from "./notify-targets";

export default async function NotifyPage() {
  const user = await requireUser(can.users);
  const [targets, runs, digest] = await Promise.all([listTargets(user), listRuns(user), buildDigest(user.outletId)]);

  const h = await headers();
  const origin = appUrl() ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const setup = [
    { ok: lineConfigured(), label: "LINE OA ส่งข้อความ", env: "LINE_CHANNEL_ACCESS_TOKEN" },
    { ok: lineWebhookConfigured(), label: "LINE OA รับกลุ่มอัตโนมัติ", env: "LINE_CHANNEL_SECRET" },
    { ok: emailConfigured(), label: "อีเมล (Resend)", env: "RESEND_API_KEY, EMAIL_FROM" },
    { ok: !!process.env.CRON_SECRET, label: "ส่งอัตโนมัติ 08:00 น.", env: "CRON_SECRET" },
    { ok: !!appUrl(), label: "ลิงก์เปิด Dashboard", env: "APP_URL" },
  ];

  return (
    <main className="mx-auto max-w-xl px-4 pt-4">
      <Link href="/settings" className="btn btn-ghost -ml-3 mb-1 min-h-11 px-2 text-sm text-muted">
        <IconBack width={18} height={18} /> ตั้งค่า
      </Link>
      <PageHeader eyebrow="Admin" title="สรุปตอนเช้า" />
      <p className="mb-4 text-muted">
        ทุกวัน 08:00 น. ระบบส่งสรุปยอดนับเมื่อวานเข้า LINE และอีเมลของผู้รับที่เปิดไว้ ส่งวันละครั้ง
      </p>

      <NotifyTargets targets={targets} lineReady={lineConfigured()} emailReady={emailConfigured()} />

      <h2 className="mt-6 mb-2 font-semibold">ตัวอย่างที่ผู้รับจะเห็น</h2>
      <DigestPreview digest={digest} />

      <h2 className="mt-6 mb-2 font-semibold">ประวัติการส่ง</h2>
      {runs.length === 0 ? (
        <p className="card p-4 text-muted">ยังไม่เคยส่ง</p>
      ) : (
        <ul className="card divide-y divide-line text-sm">
          {runs.map((r) => {
            const st = RUN_STATUS[r.status];
            const failed = r.results.filter((x) => !x.ok);
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex justify-between gap-2">
                  <span>
                    <b>{r.kind === "morning" ? "ส่งตามเวลา" : "ส่งทดสอบ"}</b>{" "}
                    <span className="text-muted">
                      · ยอด {fmtDay(r.date)} · {fmtDateTime(r.createdAt)}
                      {r.by ? ` · ${r.by}` : ""}
                    </span>
                  </span>
                  <span className={`pill ${st.cls}`}>{st.label}</span>
                </div>
                {r.results.length > 0 && (
                  <p className="mt-1 text-muted">ถึง {r.results.map((x) => `${x.label}${x.ok ? "" : " ✕"}`).join(", ")}</p>
                )}
                {failed.map((f) => (
                  <p key={f.targetId} className="mt-1 text-bad">
                    {f.label}: {f.error}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      <details className="card mt-6 mb-4 p-4">
        <summary className="cursor-pointer font-semibold">การเชื่อมต่อ (สำหรับผู้ดูแลระบบ)</summary>
        <ul className="mt-3 grid gap-2 text-sm">
          {setup.map((s) => (
            <li key={s.label} className="flex items-start justify-between gap-3">
              <span>
                {s.label}
                <span className="block font-mono text-xs text-muted">{s.env}</span>
              </span>
              <span className={`pill ${s.ok ? "bg-ok-soft text-ok" : "bg-line text-muted"}`}>
                {s.ok ? "พร้อม" : "ยังไม่ตั้ง"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">Webhook URL สำหรับ LINE Developers › Messaging API</p>
        <code className="block break-all rounded-lg bg-paper px-3 py-2 text-sm">{origin}/api/line/webhook</code>
        <p className="mt-3 text-sm text-muted">
          ถ้ายังไม่ได้ตั้งบัญชี ระบบจะทดลองส่ง (บันทึกลง log ของเซิร์ฟเวอร์) แทนการส่งจริง ขั้นตอนตั้งค่าอยู่ใน README
        </p>
      </details>
    </main>
  );
}
