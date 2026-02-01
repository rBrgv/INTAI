"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, X, Plus, AlertCircle } from "lucide-react";
import Card from "@/components/Card";
import Container from "@/components/Container";
import { ToastContainer, useToast } from "@/components/Toast";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.templateId as string;
  const { toasts, showToast, removeToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [jdText, setJdText] = useState("");
  const [topSkills, setTopSkills] = useState<string[]>([""]);
  const [questionCount, setQuestionCount] = useState<5 | 10 | 15 | 20 | 25>(10);
  const [difficultyCurve, setDifficultyCurve] = useState<"easy_to_hard" | "balanced" | "custom">("balanced");

  useEffect(() => {
    async function fetchTemplate() {
      try {
        const res = await fetch(`/api/college/templates/${templateId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch template");
        }
        const template = data.data?.template || data.template;
        setJdText(template.jdText || "");
        setTopSkills(template.topSkills?.length > 0 ? template.topSkills : [""]);
        setQuestionCount(template.config?.questionCount || 10);
        setDifficultyCurve(template.config?.difficultyCurve || "balanced");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load template");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [templateId]);

  const handleSave = async () => {
    if (jdText.length < 50) {
      setError("Job description must be at least 50 characters");
      showToast("Job description must be at least 50 characters", "error");
      return;
    }

    if (topSkills.filter(s => s.trim()).length < 1) {
      setError("Please add at least 1 skill");
      showToast("Please add at least 1 skill", "error");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/college/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jdText,
          topSkills: topSkills.filter(s => s.trim()).slice(0, 5),
          config: {
            questionCount,
            difficultyCurve,
          },
        }),
      });

      const data = await res.json();
      setSaving(false);

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to update template");
      }

      showToast("Template updated successfully!", "success");
      setTimeout(() => {
        router.push(`/college/dashboard/${templateId}`);
      }, 1500);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Failed to update template");
      showToast(err instanceof Error ? err.message : "Failed to update template", "error");
    }
  };

  if (loading) {
    return (
      <Container className="py-8">
        <div className="text-center py-12">
          <p className="text-[var(--muted)]">Loading template...</p>
        </div>
      </Container>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <Container className="py-8">
        <Breadcrumbs
          items={[
            { label: "Templates", href: "/college/dashboard" },
            { label: `Template ${templateId.substring(0, 8)}...`, href: `/college/dashboard/${templateId}` },
            { label: "Edit" },
          ]}
        />

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text)] mb-2">Edit Template</h1>
            <p className="text-[var(--muted)]">Update job description, skills, and interview configuration</p>
          </div>
          <Link
            href={`/college/dashboard/${templateId}`}
            className="app-btn-secondary px-4 py-2 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </Link>
        </div>

        {error && (
          <Card className="app-card mb-6">
            <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)] p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--danger)]">{error}</p>
            </div>
          </Card>
        )}

        <Card className="app-card">
          <div className="space-y-6">
            {/* Job Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Job Description *
              </label>
              <textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                className="w-full app-input min-h-[200px]"
                placeholder="Enter the job description (minimum 50 characters)..."
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                {jdText.length} characters (minimum 50 required)
              </p>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Top Skills * (up to 5)
              </label>
              <div className="space-y-2">
                {topSkills.map((skill, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className="flex-1 app-input"
                      value={skill}
                      onChange={(e) => {
                        const newSkills = [...topSkills];
                        newSkills[i] = e.target.value;
                        setTopSkills(newSkills);
                      }}
                      placeholder={`Skill ${i + 1} (e.g., React, Python, Leadership)`}
                    />
                    {skill.trim() && (
                      <button
                        onClick={() => {
                          const newSkills = topSkills.filter((_, idx) => idx !== i);
                          if (newSkills.length === 0) newSkills.push("");
                          setTopSkills(newSkills);
                        }}
                        className="text-red-500 hover:text-red-700 px-2"
                        title="Remove skill"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {topSkills.filter(s => s.trim()).length < 5 && (
                <button
                  onClick={() => setTopSkills([...topSkills, ""])}
                  className="app-btn-secondary px-4 py-2 text-sm mt-2"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Add Another Skill
                </button>
              )}
            </div>

            {/* Interview Configuration */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Number of Questions
                </label>
                <select
                  className="w-full app-input"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value) as any)}
                >
                  <option value={5}>5 questions</option>
                  <option value={10}>10 questions</option>
                  <option value={15}>15 questions</option>
                  <option value={20}>20 questions</option>
                  <option value={25}>25 questions</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Difficulty Curve
                </label>
                <select
                  className="w-full app-input"
                  value={difficultyCurve}
                  onChange={(e) => setDifficultyCurve(e.target.value as any)}
                >
                  <option value="easy_to_hard">Easy to Hard (Progressive)</option>
                  <option value="balanced">Balanced Mix</option>
                  <option value="custom">Custom (configure later)</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
              <Link
                href={`/college/dashboard/${templateId}`}
                className="app-btn-secondary px-6 py-2.5"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                disabled={saving}
                className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </Card>
      </Container>
    </>
  );
}

