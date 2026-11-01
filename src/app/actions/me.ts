"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser } from "@/lib/session";
import { changeOwnPin, setOwnAvatar, updateOwnName, updateOwnProfile } from "@/lib/me";
import type { Profile } from "@/lib/profile-types";
import { errorMessage } from "@/i18n/server";

export type ActionResult = { error: string | null };

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { error: null };
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return { error: await errorMessage(e) };
  }
}

// Any signed-in role, always on their own account.
export async function updateOwnNameAction(name: string) {
  return run(async () => updateOwnName(await requireApiUser(), name));
}
export async function changeOwnPinAction(currentPin: string, pin: string) {
  return run(async () => changeOwnPin(await requireApiUser(), currentPin, pin));
}
export async function updateOwnProfileAction(profile: Profile) {
  return run(async () => updateOwnProfile(await requireApiUser(), profile));
}
/** form field "photo": the image, or absent to remove the current one */
export async function setOwnAvatarAction(form: FormData) {
  const photo = form.get("photo");
  return run(async () => setOwnAvatar(await requireApiUser(), photo instanceof File ? photo : null));
}
