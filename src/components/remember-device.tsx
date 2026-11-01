"use client";

import { useEffect } from "react";
import { rememberDeviceUser } from "@/client/device-user";

/** Keeps the login page's "signing in as" up to date, including name changes. */
export function RememberDevice({ login, name }: { login: string; name: string }) {
  useEffect(() => rememberDeviceUser({ login, name }), [login, name]);
  return null;
}
