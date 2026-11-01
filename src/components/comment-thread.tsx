"use client";

import { useState } from "react";
import { COMMENT_MAX, type CountComment } from "@/lib/comment-types";
import { ROLE_LABEL } from "@/lib/types";
import { fmtDateTime, fmtTime } from "@/lib/dates";
import { useT } from "@/i18n/client";

const bangkokDay = (at: string) => new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

/** A message still in this device's outbox. */
export interface QueuedComment {
  key: string;
  itemId: number | null;
  body: string;
}

/**
 * Messages in a count round, between staff and the supervisor. Collapsed until there is
 * something to read. `onSend` resolves to an error message, or null once sent/queued.
 */
export function CommentThread({
  title,
  comments,
  queued = [],
  itemName,
  onSend,
  placeholder,
  warn,
  className = "",
}: {
  title: string;
  comments: CountComment[];
  queued?: QueuedComment[];
  /** set on the whole-round thread: labels messages that are about one line */
  itemName?: (itemId: number) => string | undefined;
  onSend: (body: string) => Promise<string | null>;
  placeholder?: string;
  /** shown under the box, e.g. a Blind reminder for the supervisor */
  warn?: string | null;
  className?: string;
}) {
  const { t, lang } = useT();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = comments.length + queued.length;
  const body = text.trim();

  async function send() {
    if (!body || sending) return;
    setSending(true);
    const err = await onSend(body).catch(() => t("ส่งข้อความไม่สำเร็จ ลองใหม่อีกครั้ง"));
    setSending(false);
    setError(err);
    if (!err) setText("");
  }

  // Time only, unless the thread runs past the day it started (e.g. a reply the next morning)
  const firstDay = comments[0] && bangkokDay(comments[0].at);
  const when = (at: string) => (bangkokDay(at) === firstDay ? fmtTime(at, lang) : fmtDateTime(at, lang));

  return (
    <details className={`group ${className}`} open={total > 0}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-sky">
        💬 {title}
        {total > 0 && <span className="pill num bg-sky-soft px-2 text-xs text-sky">{total}</span>}
      </summary>
      {total > 0 && (
        <ul className="mt-1 grid gap-2" aria-label={title}>
          {comments.map((c) => {
            const about = itemName && c.itemId !== null ? itemName(c.itemId) : undefined;
            return (
              <li key={c.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${c.mine ? "ml-auto bg-accent-soft" : "bg-paper"}`}>
                <p className="text-xs text-muted">
                  <b className="text-ink">{c.mine ? t("ฉัน") : c.by}</b>
                  {c.byRole !== "operation" && ` · ${t(ROLE_LABEL[c.byRole])}`} · <span className="num">{when(c.at)}</span>
                </p>
                {about && <p className="text-xs font-semibold text-sky">{t("เรื่อง {name}", { name: about })}</p>}
                <p className="break-words whitespace-pre-wrap">{c.body}</p>
              </li>
            );
          })}
          {queued.map((q) => {
            const about = itemName && q.itemId !== null ? itemName(q.itemId) : undefined;
            return (
              <li key={q.key} className="ml-auto max-w-[85%] rounded-2xl bg-accent-soft px-3 py-2 text-sm opacity-70">
                <p className="text-xs text-muted">
                  <b className="text-ink">{t("ฉัน")}</b> · {t("รอส่ง")}
                </p>
                {about && <p className="text-xs font-semibold text-sky">{t("เรื่อง {name}", { name: about })}</p>}
                <p className="break-words whitespace-pre-wrap">{q.body}</p>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-2 flex items-end gap-2">
        <textarea
          className="input min-h-11 flex-1 resize-none py-2"
          rows={2}
          maxLength={COMMENT_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder ?? t("พิมพ์ข้อความ…")}
          aria-label={title}
        />
        <button type="button" className="btn btn-primary" disabled={!body || sending} onClick={send}>
          {sending ? t("กำลังส่ง…") : t("ส่งข้อความ")}
        </button>
      </div>
      {warn && <p className="mt-1 text-xs text-warn">⚠ {warn}</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm text-bad">
          {error}
        </p>
      )}
    </details>
  );
}
