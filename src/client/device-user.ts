"use client";

// The person who last signed in on this phone. The login page greets them and asks only
// for the PIN, like a banking app. Written after a successful sign-in, not when typed, so a
// mistyped username is never remembered.

const KEY = "sop-device-user";
// Before 2026-11 the login page kept a list of recent usernames under this key.
const OLD_KEY = "sop-recent-logins";

export type DeviceUser = { login: string; name: string };

/** Raw snapshot for useSyncExternalStore: a string, so repeated calls compare equal. */
export function deviceUserSnapshot(): string {
  try {
    const cur = localStorage.getItem(KEY);
    if (cur) return cur;
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? "[]");
    return Array.isArray(old) && typeof old[0] === "string" ? JSON.stringify({ login: old[0], name: "" }) : "";
  } catch {
    return "";
  }
}

export function parseDeviceUser(raw: string): DeviceUser | null {
  try {
    const u = JSON.parse(raw);
    return typeof u?.login === "string" && u.login ? { login: u.login, name: typeof u.name === "string" ? u.name : "" } : null;
  } catch {
    return null;
  }
}

export function rememberDeviceUser(u: DeviceUser) {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
    localStorage.removeItem(OLD_KEY);
  } catch {}
}

export function forgetDeviceUser() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
  } catch {}
}
