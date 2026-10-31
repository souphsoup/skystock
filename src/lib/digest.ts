// Morning summary ("สรุปสต๊อกตอนเช้า") as plain data, plus renderers for LINE Flex
// and email. No server-only imports: the settings page renders the same Digest as a preview.
// Every text is already in the Digest's language; the renderers translate their own fixed texts.

import { makeT, type Lang } from "@/i18n";

export type Tone = "ok" | "warn" | "bad" | "muted";

export interface DigestRow {
  left: string;
  right: string;
  tone?: Tone;
}

export interface Digest {
  date: string; // business date the summary covers (yesterday)
  lang: Lang;
  title: string;
  subtitle: string;
  status: { text: string; tone: Tone }[];
  stats: { label: string; value: string; tone?: Tone }[];
  sections: { title: string; rows: DigestRow[]; more: number }[];
  url: string | null;
  altText: string;
}

// Same palette as the app (light theme) and the proposal.
const HEX: Record<Tone, string> = { ok: "#2e7a57", warn: "#a86b12", bad: "#b0402f", muted: "#5b6776" };
const INK = "#15212f";
const NAVY = "#15212f";
const BRASS = "#a8731f";
const LINE_COLOR = "#d9dfe6";

// ---------------------------------------------------------------- LINE Flex Message

type Flex = Record<string, unknown>;

const text = (t: string, extra: Flex = {}): Flex => ({ type: "text", text: t || " ", wrap: true, ...extra });

function row(r: DigestRow): Flex {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    contents: [
      text(r.left, { size: "sm", color: INK, flex: 5 }),
      text(r.right, { size: "sm", color: HEX[r.tone ?? "muted"], align: "end", flex: 4 }),
    ],
  };
}

export function toFlex(d: Digest): Flex {
  const t = makeT(d.lang);
  const body: Flex[] = [
    {
      type: "box",
      layout: "vertical",
      spacing: "xs",
      contents: d.status.map((s) => text(s.text, { size: "md", weight: "bold", color: HEX[s.tone] })),
    },
    {
      type: "box",
      layout: "horizontal",
      margin: "lg",
      spacing: "md",
      contents: d.stats.map((s) => ({
        type: "box",
        layout: "vertical",
        flex: 1,
        contents: [
          text(s.label, { size: "xxs", color: HEX.muted }),
          text(s.value, { size: "md", weight: "bold", color: s.tone ? HEX[s.tone] : INK }),
        ],
      })),
    },
  ];
  for (const sec of d.sections) {
    body.push({ type: "separator", margin: "lg", color: LINE_COLOR });
    body.push(text(sec.title, { size: "sm", weight: "bold", color: BRASS, margin: "lg" }));
    body.push({ type: "box", layout: "vertical", margin: "sm", spacing: "sm", contents: sec.rows.map(row) });
    if (sec.more > 0) body.push(text(t("และอีก {n} รายการ", { n: sec.more }), { size: "xs", color: HEX.muted, margin: "sm" }));
  }

  const bubble: Flex = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: NAVY,
      paddingAll: "lg",
      contents: [
        text(d.title, { size: "lg", weight: "bold", color: "#ffffff" }),
        text(d.subtitle, { size: "xs", color: "#c9b48a" }),
      ],
    },
    body: { type: "box", layout: "vertical", contents: body },
  };
  if (d.url) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: BRASS,
          height: "sm",
          action: { type: "uri", label: t("เปิด Dashboard"), uri: d.url },
        },
      ],
    };
  }
  return { type: "flex", altText: d.altText.slice(0, 400), contents: bubble };
}

// ---------------------------------------------------------------- email

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function toEmail(d: Digest): { subject: string; html: string; text: string } {
  const t = makeT(d.lang);
  const td = "padding:6px 0;border-bottom:1px solid " + LINE_COLOR;
  const sections = d.sections
    .map(
      (sec) => `
      <h3 style="margin:24px 0 6px;font-size:15px;color:${BRASS}">${esc(sec.title)}</h3>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
        ${sec.rows
          .map(
            (r) =>
              `<tr><td style="${td}">${esc(r.left)}</td><td align="right" style="${td};color:${HEX[r.tone ?? "muted"]}">${esc(r.right)}</td></tr>`,
          )
          .join("")}
      </table>
      ${sec.more > 0 ? `<p style="margin:6px 0 0;font-size:13px;color:${HEX.muted}">${esc(t("และอีก {n} รายการ", { n: sec.more }))}</p>` : ""}`,
    )
    .join("");

  const html = `<!doctype html><html lang="${d.lang}"><body style="margin:0;background:#f3f5f8;font-family:'IBM Plex Sans Thai','Noto Sans Thai',Tahoma,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
    <tr><td style="background:${NAVY};padding:20px 24px">
      <div style="font-size:20px;font-weight:700;color:#ffffff">${esc(d.title)}</div>
      <div style="font-size:13px;color:#c9b48a">${esc(d.subtitle)}</div>
    </td></tr>
    <tr><td style="padding:20px 24px">
      ${d.status.map((s) => `<div style="font-size:16px;font-weight:700;color:${HEX[s.tone]};margin-bottom:4px">${esc(s.text)}</div>`).join("")}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px"><tr>
        ${d.stats
          .map(
            (s) =>
              `<td valign="top"><div style="font-size:12px;color:${HEX.muted}">${esc(s.label)}</div><div style="font-size:18px;font-weight:700;color:${s.tone ? HEX[s.tone] : INK}">${esc(s.value)}</div></td>`,
          )
          .join("")}
      </tr></table>
      ${sections}
      ${
        d.url
          ? `<p style="margin:28px 0 4px"><a href="${esc(d.url)}" style="display:inline-block;background:${BRASS};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${esc(t("เปิด Dashboard"))}</a></p>`
          : ""
      }
    </td></tr>
  </table>
  <p style="font-size:12px;color:${HEX.muted}">${esc(t("ส่งอัตโนมัติจาก meStock"))}</p>
  </td></tr></table></body></html>`;

  const plain = [
    d.title,
    d.subtitle,
    "",
    ...d.status.map((s) => s.text),
    "",
    ...d.stats.map((s) => `${s.label}: ${s.value}`),
    ...d.sections.flatMap((sec) => [
      "",
      sec.title,
      ...sec.rows.map((r) => `- ${r.left}: ${r.right}`),
      ...(sec.more > 0 ? [t("และอีก {n} รายการ", { n: sec.more })] : []),
    ]),
    ...(d.url ? ["", `${t("เปิด Dashboard")}: ${d.url}`] : []),
  ].join("\n");

  return { subject: `${d.title} · ${d.subtitle}`, html, text: plain };
}
