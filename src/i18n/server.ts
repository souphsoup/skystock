import "server-only";
import { cookies } from "next/headers";
import { getUser } from "@/lib/session";
import { isLang, LANG_COOKIE, makeT, tk, translateError, type Lang, type TFn } from "./index";
import { HttpError } from "@/lib/session";

/** Signed in: the user's own language. Signed out (login page): the last language used on this device. */
export async function getLang(): Promise<Lang> {
  const user = await getUser();
  if (user) return user.lang;
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(c) ? c : "th";
}

export async function getT(): Promise<{ lang: Lang; t: TFn }> {
  const lang = await getLang();
  return { lang, t: makeT(lang) };
}

/** Message for an HttpError (or a generic one) in the caller's language. */
export async function errorMessage(e: unknown, fallback = tk("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง")): Promise<string> {
  const lang = await getLang();
  if (e instanceof HttpError) return translateError(lang, e.message, e.params);
  return translateError(lang, fallback);
}
