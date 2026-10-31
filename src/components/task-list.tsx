import Link from "next/link";
import type { LocationTask } from "@/lib/stock";
import { CountStatusPill } from "@/components/status";
import { getT } from "@/i18n/server";

/** รายการจุดนับวันนี้ แตะเพื่อเข้าไปนับจุดนั้น */
export async function TaskList({ tasks }: { tasks: LocationTask[] }) {
  const { t, lang } = await getT();
  return (
    <ul className="card divide-y divide-line">
      {tasks.map((task) => (
        <li key={task.locationId}>
          <Link href={`/count/${task.locationId}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
            <span>
              <b>{task.locationName}</b>
              <span className="block text-sm text-muted">
                {t("{counted}/{items} รายการ · ก่อน {time}", { counted: task.counted, items: task.items, time: task.dueTime })}
              </span>
            </span>
            <CountStatusPill status={task.status} lang={lang} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
