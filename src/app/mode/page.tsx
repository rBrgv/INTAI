import Link from "next/link";

export default function ModePage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h2 className="text-2xl font-semibold text-[var(--text)]">Choose interview mode</h2>
      <p className="mt-2 text-[var(--muted)]">
        Company mode: Job description + Resume. Open market: Resume + Role/Level.
      </p>
      <div className="mt-6 flex gap-4">
        <Link
          href="/company"
          className="app-btn-secondary px-6 py-2.5"
        >
          Company mode
        </Link>
        <Link
          href="/open"
          className="app-btn-secondary px-6 py-2.5"
        >
          Open market mode
        </Link>
      </div>
    </main>
  );
}

