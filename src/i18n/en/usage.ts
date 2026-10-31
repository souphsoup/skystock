// App usage screen (admin): src/app/(app)/usage, src/lib/usage.ts.
const usage: Record<string, string> = {
  "การใช้งานแอป": "App usage",
  "ใครเข้าใช้ นับไปเท่าไหร่ วันนี้": "Who signed in and how much they counted today",
  "ติดตามการใช้งาน": "Usage monitor",
  "อัปเดตเองทุก 1 นาที · {time}": "Refreshes every minute · {time}",
  "วันทำการ": "Business day",
  "วันนี้": "Today",

  // summary tiles
  "ผู้ใช้ที่เข้าใช้": "Active users",
  "ออนไลน์ตอนนี้ {n}": "{n} online now",
  "ไม่สำเร็จ {n} ครั้ง": "{n} failed",
  "รายการที่นับ": "Items counted",
  "รับ / เบิก / โอน / เสีย": "Receive / issue / transfer / waste",
  "ใบ": "slips",

  // hourly chart
  "กิจกรรมรายชั่วโมง": "Activity by hour",
  "มากสุดช่วง {from}:00–{to}:00 · {n} ครั้ง": "Busiest {from}:00–{to}:00 · {n, # event, # events}",
  "ยังไม่มีการใช้งาน": "No activity yet",
  "{n} ครั้ง": "{n, # event, # events}",
  "นับรวม: เข้าสู่ระบบ, บันทึกยอดนับ, ส่ง/อนุมัติ, รับ-เบิก-โอน-เสีย, เสนอรายการ":
    "Includes sign-ins, saved count lines, submit/approve, receive/issue/transfer/waste and item proposals",

  // locations
  "ความคืบหน้าการนับ": "Count progress",
  "นับแล้ว {n}/{total} รายการ": "{n}/{total} items counted",
  "ส่งโดย {name} {time}": "sent by {name} at {time}",
  "ยังไม่มีจุดเก็บ": "No locations yet",

  // failed sign-ins
  "เข้าสู่ระบบไม่สำเร็จ": "Failed sign-ins",
  "PIN ผิด": "Wrong PIN",
  "บัญชีถูกล็อกชั่วคราว": "Account temporarily locked",
  "ไม่มีชื่อผู้ใช้นี้ หรือถูกปิดใช้งาน": "Unknown or deactivated username",

  // per user table
  "รายคน": "By person",
  "ประวัติการแก้ไข ›": "Edit history ›",
  "ใช้ล่าสุด": "Last active",
  "เข้า": "Sign-ins",
  "นับ": "Counted",
  "ส่ง": "Sent",
  "ใบรับ-เบิก": "Slips",
  "เสนอ": "Proposed",
  "ตรวจ": "Reviewed",
  "อนุมัติ / สั่งนับซ้ำ / แก้ยอด": "Approve / recount / adjust",
  "ล็อกถึง {time}": "Locked until {time}",
  "ออนไลน์": "Online",
  "ยังไม่เคยเข้า": "Never signed in",
  "ไม่ได้ใช้งาน {n} คน": "{n, # person, # people} inactive",
  "ผิด {n}": "{n} failed",
};

export default usage;
