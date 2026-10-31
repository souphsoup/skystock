import { handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/session";
import { recordMovement } from "@/lib/movements";
import { MAX_PHOTO_BYTES } from "@/lib/files";
import type { MoveInput } from "@/lib/movement-types";
import { can } from "@/lib/types";

// multipart/form-data: payload = MoveInput as JSON, photo = optional image.
// Cross-site forms can post multipart, so the session cookie (SameSite=Lax) is what blocks CSRF here.
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireApiUser(can.count);
    if (Number(req.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES + 200_000) {
      throw new HttpError(413, "ข้อมูลใหญ่เกินไป");
    }
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
    }
    let input: MoveInput;
    try {
      input = JSON.parse(String(form.get("payload") ?? ""));
    } catch {
      throw new HttpError(400, "ข้อมูลไม่ถูกต้อง");
    }
    const photo = form.get("photo");
    return recordMovement(user, input, photo instanceof File ? photo : null);
  });
}
