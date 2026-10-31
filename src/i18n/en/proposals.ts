// Staff proposing items missing from the count sheet; supervisor approval.
const proposals: Record<string, string> = {
  // count screen
  "รายการที่ยังไม่มีในใบนับ": "Items not on the count sheet",
  "รอส่ง": "Waiting to send",
  "เหตุผล: {reason}": "Reason: {reason}",
  "รอหัวหน้าอนุมัติ": "Waiting for supervisor",
  "อนุมัติแล้ว": "Approved",
  "ไม่อนุมัติ": "Not approved",
  "ส่ง {name} ให้หัวหน้าแล้ว รายการจะเข้าใบนับเมื่อหัวหน้าอนุมัติ":
    "{name} sent to the supervisor. It joins the count sheet once approved.",
  "บันทึก {name} ในเครื่องแล้ว จะส่งให้หัวหน้าเองเมื่อมีสัญญาณ":
    "{name} saved on this device. It will be sent to the supervisor when there's a signal.",
  "+ ไม่เจอ \"{q}\"? เสนอเป็นรายการใหม่": "+ Can't find \"{q}\"? Propose it as a new item",
  "+ มีของที่ไม่อยู่ในใบนับ? เสนอรายการใหม่": "+ Something not on the sheet? Propose a new item",
  "เสนอรายการใหม่": "Propose a new item",
  "หัวหน้าจะตรวจและตั้งหมวด Par ราคาทุน แล้วรายการจะเข้าใบนับ":
    "The supervisor checks it and sets the category, Par and cost, then it joins the count sheet.",
  "เช่น ซอสพริก": "e.g. ซอสพริก",
  "มีในใบนับแล้วหรือเปล่า?": "Already on the sheet?",
  "หรือพิมพ์หน่วยอื่น": "Or type another unit",
  "หน่วยอื่น": "Other unit",
  "นับได้ตอนนี้ (ไม่บังคับ)": "Counted now (optional)",
  "หมายเหตุถึงหัวหน้า (ไม่บังคับ)": "Note for the supervisor (optional)",
  "เช่น ของใหม่จากซัพพลายเออร์": "e.g. new product from the supplier",
  "ส่งให้หัวหน้า": "Send to supervisor",
  // review
  "ใส่ยอดที่นับได้ในใบนับวันนี้ให้แล้ว": "The counted amount is filled in on today's sheet",
  "เพิ่มยอดที่นับได้ในรอบนับที่รอตรวจแล้ว": "The counted amount was added to the count waiting for review",
  "จะเริ่มนับในรอบถัดไป": "It will be counted from the next round",
  "จะอยู่ในใบนับรอบถัดไป": "It will be on the next count sheet",
  "เพิ่ม {name} แล้ว": "{name} added",
  "รายการใหม่ที่พนักงานเสนอ ({n})": "New items proposed by staff ({n})",
  "นับได้ {n} {unit}": "Counted {n} {unit}",
  "เสนอโดย {name}": "Proposed by {name}",
  "รออนุมัติ": "Waiting",
  "รายการนี้อนุมัติไปแล้ว": "This item has already been approved.",
  "รายการนี้ไม่อนุมัติ: {reason}": "This item was not approved: {reason}",
  "ยอดที่นับได้จะใส่ในใบนับวันนี้ให้เลย": "The counted amount goes straight into today's count sheet.",
  "ใบนับวันนั้นส่งแล้ว ยอดที่นับได้จะเพิ่มเข้าไปให้หัวหน้าตรวจพร้อมกัน":
    "That day's count is already submitted. The counted amount is added to it for review.",
  "ใบนับวันนั้นอนุมัติไปแล้ว รายการจะเริ่มนับในรอบถัดไป":
    "That day's count is already approved. The item will be counted from the next round.",
  "ข้อมูลที่พนักงานเสนอ": "What staff proposed",
  "{name} เสนอเมื่อ {time}": "Proposed by {name} at {time}",
  "เคยมีรายการชื่อนี้ที่ปิดใช้งานไว้ อนุมัติแล้วจะเปิดใช้รายการเดิม ประวัติการนับยังอยู่ครบ":
    "An inactive item with this name exists. Approving switches it back on, with its count history kept.",
  "ตั้งหมวด Par และราคาทุนด้านล่าง แก้ชื่อหรือหน่วยได้ก่อนอนุมัติ":
    "Set the category, Par and cost below. You can fix the name or unit before approving.",
  "ไม่อนุมัติรายการนี้": "Don't approve this item",
  "เหตุผลที่ไม่อนุมัติ (พนักงานจะเห็น)": "Reason (staff will see it)",
  "เช่น มีอยู่แล้วในชื่อ Chili sauce": "e.g. already on the sheet as Chili sauce",
  "ยืนยันไม่อนุมัติ": "Confirm: not approved",
  "อนุมัติรายการที่เสนอ": "Approve proposed item",
  "อนุมัติและเพิ่มในใบนับ": "Approve and add to sheet",
  // morning summary
  "รายการใหม่ที่พนักงานเสนอ รออนุมัติ {n} รายการ": "{n, # new item, # new items} proposed by staff waiting for approval",
  // errors
  "กรุณาใส่ชื่อรายการ": "Enter the item name",
  "กรุณาเลือกหน่วยนับ": "Choose a unit",
  "จำนวนที่นับได้ไม่ถูกต้อง": "Invalid counted amount",
  "มี \"{name}\" ในใบนับนี้อยู่แล้ว ค้นหาแล้วนับได้เลย": "\"{name}\" is already on this sheet. Search for it and count it.",
  "มีคนเสนอ \"{name}\" ไว้แล้ว รอหัวหน้าอนุมัติ": "\"{name}\" has already been proposed and is waiting for the supervisor.",
  "ไม่พบรายการที่เสนอ": "Proposed item not found",
  "รายการนี้มีคนตัดสินไปแล้ว": "Someone has already decided on this item",
  "กรุณาใส่เหตุผลที่ไม่อนุมัติ": "Enter a reason",
};
export default proposals;
