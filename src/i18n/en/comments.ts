// Messages between staff and the supervisor inside a count round.
const comments: Record<string, string> = {
  // thread
  "เรื่อง {name}": "About {name}",
  "พิมพ์ข้อความ…": "Type a message…",
  "ส่งข้อความ": "Send",
  "ส่งข้อความไม่สำเร็จ ลองใหม่อีกครั้ง": "Couldn't send the message. Try again.",
  "ข้อความ: {error} (ไม่ได้ส่ง)": "Message: {error} (not sent)",
  "กรุณาพิมพ์ข้อความ": "Please type a message",
  "ข้อความยาวเกิน {n} ตัวอักษร": "The message is longer than {n} characters",
  // count screen
  "ข้อความในรอบนับนี้": "Messages in this count",
  "ข้อความเรื่อง {name}": "Messages about {name}",
  "ข้อความ {n}": "{n, # message, # messages}",
  "ฝากข้อความถึงหัวหน้า": "Leave a message for the supervisor",
  "เช่น ของอยู่อีกตู้ นับรวมแล้ว": "e.g. some is in the other freezer, already included",
  // review
  "ข้อความเรื่องรายการนี้": "Messages about this item",
  "บอกคนนับว่าให้ดูอะไร": "Tell the counter what to check",
  "ข้อความถึงคนนับรอบนี้": "Message to whoever counts this round",
  "เช่น ช่วยดูชั้นล่างของตู้อีกครั้ง": "e.g. please check the bottom shelf again",
  "Blind count: อย่าพิมพ์ยอดที่ควรเหลือ พนักงานจะเห็นข้อความนี้":
    "Blind count: don't type the expected amount. Staff will see this message.",
};

export default comments;
