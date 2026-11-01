// Self sign-up and Admin approval: src/app/signup, src/lib/signup.ts, settings/users/signup-requests.tsx.
const signup: Record<string, string> = {
  // /signup
  "สมัครใช้งาน": "Sign up",
  "กรอกข้อมูลแล้วรอ Admin อนุมัติ จึงจะเข้าระบบได้": "Fill in your details. You can sign in once an Admin approves you.",
  "มีบัญชีแล้ว? เข้าสู่ระบบ": "Have an account? Sign in",
  "พนักงานใหม่? สมัครใช้งาน": "New staff? Sign up",
  "a-z 0-9 . _ - เท่านั้น": "a-z 0-9 . _ - only",
  "ยืนยัน PIN": "Confirm PIN",
  "PIN ทั้งสองช่องไม่ตรงกัน": "The two PINs don't match",
  "กำลังส่ง…": "Sending…",
  "ส่งคำขอสมัคร": "Send request",
  "ส่งคำขอแล้ว": "Request sent",
  "แจ้ง Admin ให้อนุมัติบัญชี {login} หลังอนุมัติแล้วเข้าระบบด้วยชื่อผู้ใช้และ PIN ที่ตั้งไว้":
    "Ask an Admin to approve {login}. Then sign in with this username and PIN.",
  "ไปหน้าเข้าสู่ระบบ": "Go to sign in",
  // errors
  "ระบบยังไม่พร้อมรับสมัคร ติดต่อ Admin": "Sign-up isn't available yet. Contact an Admin.",
  "มีคำขอรออนุมัติอยู่มาก ติดต่อ Admin โดยตรง": "Too many requests are waiting. Contact an Admin directly.",
  "คำขอนี้ถูกจัดการไปแล้ว": "This request was already handled",
  "บัญชีนี้รอ Admin อนุมัติ เข้าระบบได้หลังอนุมัติแล้ว": "This account is waiting for Admin approval. You can sign in once it's approved.",
  // Admin
  "คำขอสมัครใช้งาน ({n})": "Sign-up requests ({n})",
  "ขอเมื่อ {at}": "Requested {at}",
  "ปฏิเสธ": "Reject",
  "แตะอีกครั้งเพื่อปฏิเสธ": "Tap again to reject",
  "อนุมัติเป็น {role}": "Approve as {role}",
  "รออนุมัติ {n}": "{n} waiting",
  "มีคนสมัครใช้งาน รออนุมัติ {n} คน": "{n, # person, # people} signed up and waiting for approval",
  "สมัครแล้ว รอ Admin อนุมัติ": "Signed up, waiting for approval",
};

export default signup;
