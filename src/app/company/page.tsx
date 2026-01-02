"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CompanyPage() {
  const router = useRouter();
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "company",
        resumeText,
        jdText,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Failed to create session");
      return;
    }

    router.push(`/interview/${data.sessionId}`);
  }

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h2 className="text-2xl font-semibold text-[var(--text)]">Company mode</h2>
      <p className="mt-2 text-[var(--muted)]">
        Upload resume and job description to begin the interview process.
      </p>
      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Resume text</label>
          <textarea
            className="mt-2 w-full rounded-lg border border-[var(--border)] p-3 text-[var(--text)] focus:ring-2 focus:ring-indigo-200 focus:border-[var(--primary)]"
            rows={8}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste resume text here..."
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text)]">Job description</label>
          <textarea
            className="mt-2 w-full rounded-lg border border-[var(--border)] p-3 text-[var(--text)] focus:ring-2 focus:ring-indigo-200 focus:border-[var(--primary)]"
            rows={8}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste job description text here..."
          />
        </div>
        {error && <p className="text-sm text-red-800 font-medium">{error}</p>}
        <button
          onClick={start}
          disabled={loading}
          className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Creating..." : "Begin interview"}
        </button>
      </div>
    </main>
  );
}

