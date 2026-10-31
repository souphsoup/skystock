import type { Digest, Tone } from "@/lib/digest";

const TONE: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-bad", muted: "text-muted" };

/** What recipients see in LINE / email, rendered with the app's theme. */
export function DigestPreview({ digest: d }: { digest: Digest }) {
  return (
    <article className="card overflow-hidden" aria-label="ตัวอย่างสรุปตอนเช้า">
      <header className="bg-[#15212f] px-4 py-3">
        <b className="block text-lg text-white">{d.title}</b>
        <span className="text-sm text-[#c9b48a]">{d.subtitle}</span>
      </header>
      <div className="grid gap-4 p-4">
        <div>
          {d.status.map((s) => (
            <b key={s.text} className={`block ${TONE[s.tone]}`}>
              {s.text}
            </b>
          ))}
        </div>
        <dl className="grid grid-cols-3 gap-2">
          {d.stats.map((s) => (
            <div key={s.label}>
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className={`num font-semibold ${s.tone ? TONE[s.tone] : ""}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
        {d.sections.map((sec) => (
          <section key={sec.title} className="border-t border-line pt-3">
            <h3 className="mb-1 text-sm font-semibold text-accent">{sec.title}</h3>
            <ul className="grid gap-1 text-sm">
              {sec.rows.map((r) => (
                <li key={r.left} className="flex justify-between gap-3">
                  <span>{r.left}</span>
                  <span className={`text-right tabular-nums ${TONE[r.tone ?? "muted"]}`}>{r.right}</span>
                </li>
              ))}
            </ul>
            {sec.more > 0 && <p className="mt-1 text-xs text-muted">และอีก {sec.more} รายการ</p>}
          </section>
        ))}
        {d.url && <span className="btn btn-primary pointer-events-none min-h-10 text-sm">เปิด Dashboard</span>}
      </div>
    </article>
  );
}
