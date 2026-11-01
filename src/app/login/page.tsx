import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    // Phone: the whole screen. Computer: a phone-sized panel, so the keypad doesn't sit at the bottom of a wide monitor.
    <main className="mx-auto flex min-h-dvh w-full flex-col bg-surface sm:my-[6vh] sm:max-w-sm sm:min-h-[640px] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-line">
      <LoginForm />
    </main>
  );
}
