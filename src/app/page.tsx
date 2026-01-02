import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold text-[var(--text)]">AI Interview Platform</h1>
      <p className="mt-3 text-[var(--muted)]">
        Enterprise AI-powered interview platform for candidate evaluation.
      </p>
      <div className="mt-8">
        <Link
          href="/mode"
          className="app-btn-primary inline-flex items-center px-6 py-2.5"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}

