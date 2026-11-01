"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAlert,
  IconBell,
  IconChart,
  IconClipboard,
  IconClock,
  IconHome,
  IconLayers,
  IconSwap,
  IconTable,
  IconTag,
  IconUser,
} from "./icons";

// Desktop sidebar (lg and up); phones keep the bottom tabs. Same routes, so every
// existing screen opens inside the console without leaving it.

const ICONS = {
  home: IconHome,
  console: IconChart,
  stock: IconTable,
  review: IconClipboard,
  alerts: IconAlert,
  moves: IconSwap,
  history: IconClock,
  usage: IconChart,
  catalog: IconLayers,
  cost: IconTag,
  users: IconUser,
  notify: IconBell,
};

export interface SideItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

export interface SideGroup {
  title: string;
  items: SideItem[];
}

export function SideNav({ groups, footer }: { groups: SideGroup[]; footer: React.ReactNode }) {
  const path = usePathname();
  // longest matching href wins, so /settings/users doesn't also light up /settings
  const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const match = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`));
  const active = hrefs.filter(match).sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- static app icon */}
        <img src="/icons/icon-192.png" alt="" width={36} height={36} className="rounded-lg" />
        <div className="leading-tight">
          <b className="block">meStock</b>
          <span className="text-xs text-muted">MAI The Sky Bar</span>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.title} className="mt-3">
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{g.title}</p>
            <ul>
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={it.href === active ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium hover:bg-paper ${
                      it.href === active ? "bg-accent-soft text-ink" : "text-muted"
                    }`}
                  >
                    <SideLabel item={it} active={it.href === active} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">{footer}</div>
    </aside>
  );
}

function SideLabel({ item, active }: { item: SideItem; active: boolean }) {
  const { pending } = useLinkStatus();
  const Icon = ICONS[item.icon];
  return (
    <>
      <Icon width={18} height={18} className={active || pending ? "text-accent" : ""} />
      <span className="flex-1">{item.label}</span>
      {!!item.badge && (
        <span className="num min-w-5 rounded-full bg-bad px-1.5 text-center text-[11px] leading-5 text-surface">
          {item.badge}
        </span>
      )}
    </>
  );
}
