"use client";

import { clearLocalCache } from "./local-db";

/** Forget what this device cached for the current user (shared tablet). */
export async function clearDeviceSession() {
  await clearLocalCache();
  navigator.serviceWorker?.controller?.postMessage("clear-pages");
}
