"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { IconBell, IconChart, IconClipboard, IconHome, IconUser } from "./icons";

const ICONS = { home: IconHome, review: IconClipboard, dashboard: IconChart, alerts: IconBell, me: IconUser };

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium active:bg-line/40"
              >
                <NavLabel item={it} active={active} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Lights the tab up on tap, before the new page arrives (must sit inside <Link>). */
function NavLabel({ item, active }: { item: NavItem; active: boolean }) {
  const { pending } = useLinkStatus();
  const Icon = ICONS[item.icon];
  return (
    <>
      <span className={`flex flex-col items-center gap-0.5 ${active || pending ? "text-hl" : "text-muted"}`}>
        <Icon />
        {item.label}
      </span>
      {!!item.badge && (
        <span className="num absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-bad px-1 text-center text-[11px] leading-5 text-surface">
          {item.badge}
        </span>
      )}
    </>
  );
}
