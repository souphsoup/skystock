"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AREAS, HISTORY_DAYS, type HistoryArea } from "@/lib/history-types";
import { useT } from "@/i18n/client";

export function HistoryFilters({ users }: { users: { id: number; name: string }[] }) {
  const { t } = useT();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${path}?${next}`, { scroll: false }));
  };

  return (
    <div className={`mb-4 grid gap-2 sm:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
      <label className="grid gap-1">
        <span className="text-sm text-muted">{t("ใคร")}</span>
        <select className="input" value={params.get("who") ?? ""} onChange={(e) => set("who", e.target.value)}>
          <option value="">{t("ทุกคน")}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-muted">{t("เรื่อง")}</span>
        <select className="input" value={params.get("area") ?? "all"} onChange={(e) => set("area", e.target.value === "all" ? "" : e.target.value)}>
          {(Object.keys(AREAS) as HistoryArea[]).map((a) => (
            <option key={a} value={a}>
              {t(AREAS[a].label)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-muted">{t("ช่วงเวลา")}</span>
        <select className="input" value={params.get("days") ?? "7"} onChange={(e) => set("days", e.target.value === "7" ? "" : e.target.value)}>
          {HISTORY_DAYS.map((d) => (
            <option key={d} value={d}>
              {d === 1 ? t("24 ชั่วโมงล่าสุด") : t("{n} วันล่าสุด", { n: d })}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
