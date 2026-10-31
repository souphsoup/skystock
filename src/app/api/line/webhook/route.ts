import { NextResponse } from "next/server";
import { replyLine, sourceName, verifySignature, type LineSource } from "@/lib/line";
import { deactivateLineSource, lineOutletId, registerLineSource } from "@/lib/notify";
import { tk, translate } from "@/i18n";

// LINE Developers console › Messaging API › Webhook URL = https://<app>/api/line/webhook
// Adding the bot to a group (or a user adding it as a friend) registers that chat as a
// recipient, switched off until Admin turns it on in ตั้งค่า › สรุปตอนเช้า.

export const dynamic = "force-dynamic";

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: LineSource;
}

// The chat's language is unknown when it registers (it starts as Thai), so reply in both.
const REGISTERED_TH = tk(
  "เชื่อมแชตนี้กับ meStock แล้ว\nรอ Admin เปิดรับ \"สรุปสต๊อกตอนเช้า\" ในหน้า ตั้งค่า › สรุปตอนเช้า",
);
const REGISTERED = `${REGISTERED_TH}\n\n${translate("en", REGISTERED_TH)}`;

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  let events: LineEvent[];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const outletId = await lineOutletId();
  if (!outletId) return NextResponse.json({ ok: true });

  for (const ev of events) {
    if (!ev.source) continue;
    try {
      if (ev.type === "leave" || ev.type === "unfollow") {
        await deactivateLineSource(outletId, ev.source);
      } else if (ev.type === "join" || ev.type === "follow" || ev.type === "message") {
        const created = await registerLineSource(outletId, ev.source, () => sourceName(ev.source!));
        if (created && ev.replyToken) await replyLine(ev.replyToken, [{ type: "text", text: REGISTERED }]);
      }
    } catch (e) {
      console.error("[line:webhook]", ev.type, e);
    }
  }
  // Always 200 so LINE does not retry events we already handled.
  return NextResponse.json({ ok: true });
}
