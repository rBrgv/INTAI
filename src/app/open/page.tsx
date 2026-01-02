"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OpenMarketPage() {
  const router = useRouter();
  const [resumeText, setResumeText] = useState("");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<"junior" | "mid" | "senior">("mid");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "open",
        resumeText,
        role,
        level,
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
      <h2 className="text-2xl font-semibold text-[var(--text)]">Open market mode</h2>
      <p className="mt-2 text-[var(--muted)]">
        Upload resume and select role and level to begin the interview process.
      </p>
      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Role</label>
          <input
            className="mt-2 w-full rounded-lg border border-[var(--border)] p-3 text-[var(--text)] focus:ring-2 focus:ring-indigo-200 focus:border-[var(--primary)]"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g., Salesforce Marketing Cloud Consultant"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text)]">Level</label>
          <select
            className="mt-2 w-full rounded-lg border border-[var(--border)] p-3 text-[var(--text)] focus:ring-2 focus:ring-indigo-200 focus:border-[var(--primary)]"
            value={level}
            onChange={(e) => setLevel(e.target.value as any)}
          >
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[var(--text)]">Resume</label>
          <textarea
            className="mt-2 w-full rounded-lg border border-[var(--border)] p-3 text-[var(--text)] focus:ring-2 focus:ring-indigo-200 focus:border-[var(--primary)]"
            rows={10}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste resume text here..."
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

