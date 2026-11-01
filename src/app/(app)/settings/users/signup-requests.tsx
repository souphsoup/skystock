"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import { approveSignupAction, rejectSignupAction } from "@/app/actions/signup";
import { useT } from "@/i18n/client";
import { RolePicker } from "./user-list";

export interface SignupRequest {
  id: number;
  login: string;
  name: string;
  at: string; // already formatted on the server
}

/** คำขอสมัครจากหน้า /signup: Admin เลือกบทบาทแล้วอนุมัติ หรือปฏิเสธ */
export function SignupRequests({ requests }: { requests: SignupRequest[] }) {
  const { t } = useT();
  if (requests.length === 0) return null;
  return (
    <section className="mb-4" aria-labelledby="signup-requests">
      <h2 id="signup-requests" className="mb-2 font-semibold">
        {t("คำขอสมัครใช้งาน ({n})", { n: requests.length })}
      </h2>
      <ul className="grid gap-3">
        {requests.map((r) => (
          <Request key={r.id} request={r} />
        ))}
      </ul>
    </section>
  );
}

function Request({ request: r }: { request: SignupRequest }) {
  const router = useRouter();
  const { t } = useT();
  const [role, setRole] = useState<Role>("operation");
  const [confirmReject, setConfirmReject] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error: string | null }>) =>
    start(async () => {
      const res = await fn();
      setError(res.error);
      if (!res.error) router.refresh();
    });

  return (
    <li className="card grid gap-3 border-accent p-4">
      <div>
        <b className="block">{r.name}</b>
        <span className="text-sm text-muted">
          {r.login} · {t("ขอเมื่อ {at}", { at: r.at })}
        </span>
      </div>
      <RolePicker value={role} onChange={setRole} />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn text-bad"
          disabled={pending}
          onClick={() => (confirmReject ? run(() => rejectSignupAction(r.id)) : setConfirmReject(true))}
        >
          {confirmReject ? t("แตะอีกครั้งเพื่อปฏิเสธ") : t("ปฏิเสธ")}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() => run(() => approveSignupAction(r.id, role))}
        >
          {t("อนุมัติเป็น {role}", { role: t(ROLE_LABEL[role]) })}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </li>
  );
}
