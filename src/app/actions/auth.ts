"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { login, logout } from "@/lib/session";
import { getT } from "@/i18n/server";
import { can } from "@/lib/types";

export async function loginAction(
  _prev: { error: string | null },
  form: FormData,
): Promise<{ error: string | null }> {
  const name = String(form.get("login") ?? "");
  const pin = String(form.get("pin") ?? "");
  const { t } = await getT();
  if (!name.trim() || !/^\d{6}$/.test(pin)) return { error: t("กรอกชื่อผู้ใช้และ PIN 6 หลัก") };
  const res = await login(name, pin);
  if (!res.ok) return { error: t(res.error, res.params) };
  // Managers/admins on a computer land in the executive console; phones keep the app screens.
  const phone = /Mobi|Android|iPhone|iPad/i.test((await headers()).get("user-agent") ?? "");
  if (can.console(res.user.role) && !phone) redirect("/admin");
  redirect(res.user.role === "manager" ? "/dashboard" : "/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
