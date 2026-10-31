import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, HttpError } from "@/lib/session";
import { getProposal } from "@/lib/proposals";
import { getCatalog } from "@/lib/settings";
import { fmtDateTime } from "@/lib/dates";
import { can } from "@/lib/types";
import { fmtQty, PageHeader } from "@/components/status";
import { IconBack } from "@/components/icons";
import { getT } from "@/i18n/server";
import { ItemForm } from "@/app/(app)/settings/items/item-form";
import { RejectProposal } from "./reject-proposal";

export default async function ProposalPage({ params }: PageProps<"/review/proposals/[id]">) {
  const user = await requireUser(can.review);
  const { t, lang } = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const p = await getProposal(user, id).catch((e) => {
    if (e instanceof HttpError) notFound();
    throw e;
  });

  if (p.status !== "pending") {
    return (
      <main className="mx-auto max-w-xl px-4 pt-4">
        <Link href="/review" className="btn btn-ghost -ml-3 mb-1 min-h-11 px-2 text-sm text-muted">
          <IconBack width={18} height={18} /> {t("ตรวจและอนุมัติยอด")}
        </Link>
        <PageHeader title={p.nameEn || p.nameTh} />
        <p className="card p-4">
          {p.status === "approved" ? t("รายการนี้อนุมัติไปแล้ว") : t("รายการนี้ไม่อนุมัติ: {reason}", { reason: p.rejectReason ?? "" })}
        </p>
      </main>
    );
  }

  // Where the proposer's count will go if approved at this location
  const countedHint =
    p.counted === null
      ? null
      : p.countStatus === "draft"
        ? t("ยอดที่นับได้จะใส่ในใบนับวันนี้ให้เลย")
        : p.countStatus === "submitted" || p.countStatus === "recount"
          ? t("ใบนับวันนั้นส่งแล้ว ยอดที่นับได้จะเพิ่มเข้าไปให้หัวหน้าตรวจพร้อมกัน")
          : t("ใบนับวันนั้นอนุมัติไปแล้ว รายการจะเริ่มนับในรอบถัดไป");

  const catalog = await getCatalog(user);
  return (
    <ItemForm
      catalog={catalog}
      item={null}
      defaultCategoryId={null}
      approve={{
        proposalId: p.id,
        initial: { nameTh: p.nameTh, nameEn: p.nameEn, unit: p.unit, locationId: p.locationId },
        intro: (
          <section className="card grid gap-1 bg-accent-soft p-4 text-sm" aria-label={t("ข้อมูลที่พนักงานเสนอ")}>
            <b className="text-base">
              {t("{name} เสนอเมื่อ {time}", { name: p.by, time: fmtDateTime(p.createdAt, lang) })}
            </b>
            <span>
              {p.locationName}
              {p.counted !== null && ` · ${t("นับได้ {n} {unit}", { n: fmtQty(p.counted), unit: p.unit })}`}
            </span>
            {p.note && <span>“{p.note}”</span>}
            {countedHint && <span className="text-muted">{countedHint}</span>}
            {p.inactiveItemId && (
              <span className="font-semibold text-warn">
                {t("เคยมีรายการชื่อนี้ที่ปิดใช้งานไว้ อนุมัติแล้วจะเปิดใช้รายการเดิม ประวัติการนับยังอยู่ครบ")}
              </span>
            )}
            <span className="text-muted">{t("ตั้งหมวด Par และราคาทุนด้านล่าง แก้ชื่อหรือหน่วยได้ก่อนอนุมัติ")}</span>
          </section>
        ),
        footer: <RejectProposal id={p.id} />,
      }}
    />
  );
}
