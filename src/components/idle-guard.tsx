"use client";

import { useEffect } from "react";
import { logoutAction } from "@/app/actions/auth";
import { pendingCount } from "@/client/local-db";
import { clearDeviceSession } from "@/client/logout";

const IDLE_MS = Number(process.env.NEXT_PUBLIC_IDLE_MINUTES ?? 15) * 60_000;

/** แท็บเล็ตใช้ร่วมกัน: ออกจากระบบเองหลังไม่ใช้งาน 15 นาที
 * (ข้ามไปถ้ายังออฟไลน์หรือมียอดที่ยังไม่ซิงก์ เพื่อไม่ให้ข้อมูลค้าง) */
export function IdleGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      if (!navigator.onLine || (await pendingCount()) > 0) return reset();
      await clearDeviceSession();
      await logoutAction();
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(check, IDLE_MS);
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, []);
  return null;
}
