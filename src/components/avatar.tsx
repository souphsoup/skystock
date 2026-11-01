import { avatarUrl } from "@/lib/profile-types";

const SIZE = { sm: "h-8 w-8 text-sm", md: "h-10 w-10 text-base", lg: "h-20 w-20 text-3xl" } as const;

/** Profile photo, or the first letter of the name on the accent circle. */
export function Avatar({ name, photo, size = "md" }: { name: string; photo: string | null; size?: keyof typeof SIZE }) {
  const src = avatarUrl(photo);
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft font-bold text-hl ${SIZE[size]}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- private file route, not optimisable
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}
