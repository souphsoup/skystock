import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { todayTasks } from "@/lib/stock";
import { can } from "@/lib/types";
import { TaskList } from "@/components/task-list";
import { getT } from "@/i18n/server";

/** เลือกจุดที่จะนับก่อน เมื่อมีมากกว่าหนึ่งจุด */
export default async function CountPickerPage() {
  const user = await requireUser(can.count);
  const tasks = await todayTasks(user);
  if (tasks.length === 0) redirect("/");
  if (tasks.length === 1) redirect(`/count/${tasks[0].locationId}`);
  const { t } = await getT();

  return (
    <main className="mx-auto max-w-xl px-4 pt-5">
      <h1 className="mb-1 text-2xl font-bold">{t("นับสต๊อก")}</h1>
      <p className="mb-4 text-muted">{t("เลือกจุดที่จะนับ")}</p>
      <TaskList tasks={tasks} />
    </main>
  );
}
