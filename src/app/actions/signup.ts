"use server";

import { revalidatePath } from "next/cache";
import { HttpError, requireApiUser } from "@/lib/session";
import { approveSignup, rejectSignup, signup } from "@/lib/signup";
import { can, type Role } from "@/lib/types";
import { errorMessage } from "@/i18n/server";

export type SignupState = { error: string | null; done: boolean };

// Public: anyone on the login page can ask for an account.
export async function signupAction(_prev: SignupState, form: FormData): Promise<SignupState> {
  try {
    await signup({ login: form.get("login"), name: form.get("name"), pin: form.get("pin"), pin2: form.get("pin2") });
    return { error: null, done: true };
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return { error: await errorMessage(e), done: false };
  }
}

async function run(fn: () => Promise<void>): Promise<{ error: string | null }> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { error: null };
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return { error: await errorMessage(e) };
  }
}

// Admin only
export async function approveSignupAction(id: number, role: Role) {
  return run(async () => approveSignup(await requireApiUser(can.users), id, role));
}
export async function rejectSignupAction(id: number) {
  return run(async () => rejectSignup(await requireApiUser(can.users), id));
}
