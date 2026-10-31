// Shared words, navigation, roles, statuses, errors raised by src/lib/session.ts / api.ts.
const common: Record<string, string> = {
  // navigation
  "หน้าแรก": "Home",
  "อนุมัติ": "Review",
  "ภาพรวม": "Overview",
  "แจ้งเตือน": "Alerts",
  "ฉัน": "Me",
  "ตั้งค่า": "Settings",
  // roles
  "Operation": "Operation",
  "หัวหน้า": "Supervisor",
  "ทีมบริหาร": "Management",
  "Admin": "Admin",
  // me page
  "ภาษา": "Language",
  "ชื่อผู้ใช้ {login}": "Username {login}",
  "ประเภทวัตถุดิบ รายการ Par": "Categories, items, Par",
  " · ผู้ใช้และสิทธิ์": " · Users & access",
  "เครื่องที่ใช้ร่วมกันจะออกจากระบบเองหลังไม่ใช้งาน {n} นาที ยอดที่ยังไม่ซิงก์จะอยู่ในเครื่องจนกว่าจะส่งสำเร็จ":
    "Shared devices sign out after {n} idle minutes. Unsynced entries stay on this device until they are sent.",
  "ยังมี {n} รายการที่ยังไม่ซิงก์ ต่อสัญญาณแล้วรอให้ซิงก์เสร็จก่อนออกจากระบบ":
    "{n, # entry is, # entries are} not synced yet. Get a signal and wait for sync to finish before signing out.",
  "กำลังออกจากระบบ…": "Signing out…",
  "ออกจากระบบ": "Sign out",
  // update banner
  "มีอัปเดตใหม่ แตะรีเฟรชเพื่อใช้เวอร์ชันล่าสุด": "A new version is out. Tap Refresh to use it.",
  "รีเฟรช": "Refresh",
  // login
  "นับสต๊อกครัวและบาร์": "Kitchen & bar stock counts",
  "กรอกชื่อผู้ใช้และ PIN 6 หลัก": "Enter your username and 6-digit PIN",
  "ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง": "Wrong username or PIN",
  "ใส่ PIN ผิดหลายครั้ง ลองใหม่ใน {n} นาที": "Too many wrong PINs. Try again in {n} minutes.",
  // install gate (phones, before the app is on the home screen)
  "ติดตั้ง meStock ลงเครื่อง": "Install meStock",
  "เปิดจากไอคอนบนหน้าจอ ใช้งานได้แม้สัญญาณหลุด": "Open it from your home screen. Works even when the signal drops.",
  "ลิงก์นี้เปิดอยู่ใน LINE ซึ่งติดตั้งแอปไม่ได้ ให้เปิดในเบราว์เซอร์ก่อน":
    "This link is open inside LINE, which can't install apps. Open it in your browser first.",
  "เปิดใน Safari / Chrome": "Open in Safari / Chrome",
  "แตะ ⋯ มุมขวาบน": "Tap ⋯ in the top-right corner",
  "เลือก “เปิดในเบราว์เซอร์” (Safari / Chrome)": "Choose “Open in browser” (Safari / Chrome)",
  "ทำตามขั้นตอนติดตั้งที่ขึ้นมา": "Follow the install steps that appear",
  "แตะปุ่มแชร์": "Tap the Share button",
  "ในแถบของ Safari": "in Safari's toolbar",
  "เลือก “เพิ่มไปยังหน้าจอโฮม”": "Choose “Add to Home Screen”",
  "แตะ “เพิ่ม” แล้วเปิด meStock จากไอคอนบนหน้าจอ": "Tap “Add”, then open meStock from the icon",
  "แตะ ⋮ มุมขวาบนของ Chrome": "Tap ⋮ in Chrome's top-right corner",
  "เลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”": "Choose “Install app” or “Add to Home screen”",
  "เปิด meStock จากไอคอนบนหน้าจอ": "Open meStock from the icon on your home screen",
  "ติดตั้งแอป": "Install app",
  "ติดตั้งแล้ว เปิด meStock จากไอคอนบนหน้าจอได้เลย": "Installed. Open meStock from your home screen.",
  "ติดตั้งไว้แล้ว? เปิดจากไอคอน meStock บนหน้าจอได้เลย": "Already installed? Open meStock from your home screen.",
  "ใช้งานในเบราว์เซอร์ไปก่อน": "Use in the browser for now",
  // errors (session / api)
  "กรุณาเข้าสู่ระบบใหม่": "Please sign in again",
  "ไม่มีสิทธิ์ทำรายการนี้": "You don't have permission to do this",
  "เกิดข้อผิดพลาดในระบบ ลองใหม่อีกครั้ง": "Something went wrong. Please try again.",
  "ต้องส่งข้อมูลเป็น JSON": "Request must be JSON",
  "ข้อมูลไม่ถูกต้อง": "Invalid data",
  "{name} ไม่ถูกต้อง": "Invalid {name}",
  "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง": "Couldn't save. Please try again.",
};
export default common;
