"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser, type User } from "@/lib/session";
import * as settings from "@/lib/settings";
import { can, type Role } from "@/lib/types";

export type ActionResult = { error: string | null; id?: number };

async function run(
  allowed: (r: Role) => boolean,
  fn: (u: User) => Promise<number | void>,
): Promise<ActionResult> {
  try {
    const user = await requireApiUser(allowed);
    const id = await fn(user);
    revalidatePath("/", "layout");
    return { error: null, id: id ?? undefined };
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message };
    console.error(e);
    return { error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
}

// categories + items: หัวหน้า / Admin
export async function addCategoryAction(parentId: number | null, name: string) {
  return run(can.settings, (u) => settings.addCategory(u, parentId, name));
}
export async function renameCategoryAction(id: number, name: string) {
  return run(can.settings, (u) => settings.renameCategory(u, id, name));
}
export async function deleteCategoryAction(id: number) {
  return run(can.settings, (u) => settings.deleteCategory(u, id));
}
export async function saveItemAction(id: number | null, input: settings.ItemInput) {
  return run(can.settings, (u) => (id ? settings.updateItem(u, id, input) : settings.createItem(u, input)));
}

// users: Admin
export async function createUserAction(input: { login: string; name: string; role: Role; pin: string }) {
  return run(can.users, (u) => settings.createUser(u, input));
}
export async function updateUserAction(id: number, input: { name: string; role: Role }) {
  return run(can.users, (u) => settings.updateUser(u, id, input));
}
export async function resetPinAction(id: number, pin: string) {
  return run(can.users, (u) => settings.resetPin(u, id, pin));
}
export async function setUserActiveAction(id: number, active: boolean) {
  return run(can.users, (u) => settings.setUserActive(u, id, active));
}
export async function revokeSessionsAction(id: number) {
  return run(can.users, (u) => settings.revokeSessions(u, id));
}
