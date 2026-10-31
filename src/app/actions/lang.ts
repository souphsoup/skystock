"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getUser, rememberLang } from "@/lib/session";
import { isLang } from "@/i18n";

/** Signed in: saves the user's language (follows them to every device). Signed out: this device only. */
export async function setLangAction(lang: string) {
  if (!isLang(lang)) return;
  const user = await getUser();
  if (user) {
    const db = await getDb();
    await db.query(`update users set lang = $2 where id = $1`, [user.id, lang]);
  }
  await rememberLang(lang);
  revalidatePath("/", "layout");
}
