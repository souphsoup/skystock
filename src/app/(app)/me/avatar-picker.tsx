"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOwnAvatarAction } from "@/app/actions/me";
import { Avatar } from "@/components/avatar";
import { IconCamera } from "@/components/icons";
import { squarePhoto } from "@/client/photo";
import { useT } from "@/i18n/client";

/** Tap the photo to pick one (the phone offers camera or gallery); it is cropped square on the device. */
export function AvatarPicker({ name, photo }: { name: string; photo: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

  const save = (blob: Blob | null) =>
    start(async () => {
      const form = new FormData();
      if (blob) form.set("photo", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const r = await setOwnAvatarAction(form);
      setError(r.error);
      if (!r.error) router.refresh();
    });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      save(await squarePhoto(file));
    } catch {
      setError(t("เปิดรูปนี้ไม่ได้ ลองเลือกรูป JPG หรือ PNG"));
    }
  };

  return (
    <div className="grid justify-items-center gap-1">
      <button
        type="button"
        className="relative rounded-full"
        disabled={pending}
        onClick={() => input.current?.click()}
        aria-label={photo ? t("เปลี่ยนรูปโปรไฟล์") : t("เพิ่มรูปโปรไฟล์")}
      >
        <span className={pending ? "opacity-50" : ""}>
          <Avatar name={name} photo={photo} size="lg" />
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 grid h-8 w-8 place-items-center rounded-full border-2 border-paper bg-accent text-paper">
          <IconCamera width={16} height={16} />
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {photo && (
        <button type="button" className="text-xs text-muted underline" disabled={pending} onClick={() => save(null)}>
          {t("ลบรูป")}
        </button>
      )}
      {pending && <span className="text-xs text-muted">{t("กำลังบันทึก…")}</span>}
      {error && (
        <p role="alert" className="max-w-40 text-center text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
