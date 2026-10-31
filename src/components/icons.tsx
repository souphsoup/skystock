// Minimal stroke icons (24px grid). Decorative unless a label is given.

import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { label?: string };

function Svg({ label, children, ...rest }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => (
  <Svg {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}><path d="M20 6L9 17l-5-5" /></Svg>
);
export const IconClipboard = (p: P) => (
  <Svg {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 11l2 2 4-4" /><path d="M9 17h6" /></Svg>
);
export const IconChart = (p: P) => (
  <Svg {...p}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></Svg>
);
export const IconUser = (p: P) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
);
export const IconBack = (p: P) => (
  <Svg {...p}><path d="M15 18l-6-6 6-6" /></Svg>
);
export const IconBox = (p: P) => (
  <Svg {...p}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></Svg>
);
export const IconTruck = (p: P) => (
  <Svg {...p}><path d="M1 5h13v11H1z" /><path d="M14 9h4l3 3v4h-7" /><circle cx="5.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></Svg>
);
export const IconSwap = (p: P) => (
  <Svg {...p}><path d="M7 4L3 8l4 4" /><path d="M3 8h14" /><path d="M17 20l4-4-4-4" /><path d="M21 16H7" /></Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5" /><path d="M12 18h.01" /></Svg>
);
export const IconWifiOff = (p: P) => (
  <Svg {...p}><path d="M2 2l20 20" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 12.9a10 10 0 0 1 5.2-2.8" /><path d="M14.5 10.3A10 10 0 0 1 19 12.9" /><path d="M12 20h.01" /></Svg>
);
export const IconCloud = (p: P) => (
  <Svg {...p}><path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7z" /></Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></Svg>
);
