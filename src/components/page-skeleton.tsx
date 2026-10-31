/** Shown by loading.tsx the moment a link is tapped, while the server renders the page.
 * Static on purpose: Next prefetches it with the link, so the switch is instant. */
export function PageSkeleton() {
  return (
    <main className="mx-auto max-w-xl animate-pulse px-4 pt-5" aria-busy="true">
      <div className="mb-4">
        <div className="mb-2 h-4 w-40 rounded bg-line" />
        <div className="h-7 w-32 rounded-lg bg-line" />
      </div>
      <div className="card divide-y divide-line">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
            <span className="flex-1">
              <span className="mb-1.5 block h-4 w-2/5 rounded bg-line" />
              <span className="block h-3 w-3/5 rounded bg-line" />
            </span>
            <span className="h-6 w-14 rounded-full bg-line" />
          </div>
        ))}
      </div>
    </main>
  );
}
