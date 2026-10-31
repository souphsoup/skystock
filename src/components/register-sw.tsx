"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only (it would fight dev HMR). */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
