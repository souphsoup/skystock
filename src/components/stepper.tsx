"use client";

import { useState } from "react";

/** ปุ่ม − / + ใหญ่ พร้อมช่องพิมพ์ตัวเลข (รองรับทศนิยมสำหรับ กก.) */
export function Stepper({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
}) {
  // While typing keep the raw text ("1." on the way to "1.5"); otherwise show the value.
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  const commit = (s: string) => {
    const n = Number(s.replace(",", "."));
    if (s.trim() === "") onChange(0);
    else if (Number.isFinite(n) && n >= 0) onChange(Math.round(n * 100) / 100);
  };

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        className="btn num w-14 px-0 text-2xl"
        onClick={() => onChange(Math.max(0, Math.round((value - 1) * 100) / 100))}
        disabled={disabled || value <= 0}
        aria-label={`ลด ${label}`}
      >
        −
      </button>
      <input
        className="input num w-20 text-center text-xl font-semibold"
        inputMode="decimal"
        aria-label={label}
        value={focused ? text : String(value)}
        disabled={disabled}
        onFocus={(e) => {
          setText(String(value));
          setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setFocused(false)}
      />
      <button
        type="button"
        className="btn num w-14 px-0 text-2xl"
        onClick={() => onChange(Math.round((value + 1) * 100) / 100)}
        disabled={disabled}
        aria-label={`เพิ่ม ${label}`}
      >
        +
      </button>
    </div>
  );
}
