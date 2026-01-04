"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, X, Plus } from "lucide-react";
import Stepper from "@/components/Stepper";
import Card from "@/components/Card";
import Container from "@/components/Container";
import FileUploadWithPreview from "@/components/FileUploadWithPreview";
import { clientLogger } from "@/lib/clientLogger";

const STEPS = [
  { label: "Role & Level", key: "role" },
  { label: "Job Description", key: "jd" },
  { label: "Top 5 Skills", key: "skills" },
  { label: "Resume", key: "resume" },
  { label: "Interview Setup", key: "config" },
  { label: "Review & Start", key: "review" },
];

export default function IndividualPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<"junior" | "mid" | "senior">("mid");
  const [jdText, setJdText] = useState("");
  const [topSkills, setTopSkills] = useState<string[]>([""]);
  const [resumeText, setResumeText] = useState("");
  const [questionCount, setQuestionCount] = useState<5 | 10 | 15 | 20 | 25>(10);
  const [difficultyCurve, setDifficultyCurve] = useState<"easy_to_hard" | "balanced" | "custom">("balanced");
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isProcessingResume, setIsProcessingResume] = useState(false);
  const [isProcessingJd, setIsProcessingJd] = useState(false);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [isExtractingSkills, setIsExtractingSkills] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("individualModeDraft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRole(parsed.role || "");
        setLevel(parsed.level || "mid");
        setJdText(parsed.jdText || "");
        setTopSkills(parsed.topSkills || [""]);
        setResumeText(parsed.resumeText || "");
        setQuestionCount(parsed.questionCount || 10);
        setDifficultyCurve(parsed.difficultyCurve || "balanced");
        setSuggestedSkills(parsed.suggestedSkills || []);
        setCurrentStep(parsed.currentStep || 1);
        setCompletedSteps(parsed.completedSteps || []);
      } catch (e) {
        clientLogger.error("Failed to load draft", e instanceof Error ? e : new Error(String(e)));
      }
    }
  }, []);

  // Extract skills from JD when it changes
  useEffect(() => {
    if (jdText.length >= 50 && currentStep === 2 && !isProcessingJd) {
      const timer = setTimeout(async () => {
        setIsExtractingSkills(true);
        try {
          const res = await fetch("/api/skills/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jdText }),
          });
          const data = await res.json();
          if (res.ok && data.data?.skills && Array.isArray(data.data.skills)) {
            setSuggestedSkills(data.data.skills);
          }
        } catch (error) {
          clientLogger.error("Failed to extract skills", error instanceof Error ? error : new Error(String(error)));
        } finally {
          setIsExtractingSkills(false);
        }
      }, 2000); // Wait 2 seconds after user stops typing

      return () => clearTimeout(timer);
    } else if (jdText.length < 50) {
      setSuggestedSkills([]);
    }
  }, [jdText, currentStep, isProcessingJd]);

  // Function to add a suggested skill
  const addSuggestedSkill = (skill: string) => {
    if (topSkills.filter(s => s.trim()).length >= 5) return;
    if (topSkills.some(s => s.trim().toLowerCase() === skill.toLowerCase())) return;
    
    const emptyIndex = topSkills.findIndex(s => !s.trim());
    if (emptyIndex >= 0) {
      const newSkills = [...topSkills];
      newSkills[emptyIndex] = skill;
      setTopSkills(newSkills);
    } else {
      setTopSkills([...topSkills, skill]);
    }
  };

  useEffect(() => {
    localStorage.setItem("individualModeDraft", JSON.stringify({
      role,
      level,
      jdText,
      topSkills,
      resumeText,
      questionCount,
      difficultyCurve,
      suggestedSkills,
      currentStep,
      completedSteps,
    }));
  }, [role, level, jdText, topSkills, resumeText, questionCount, difficultyCurve, suggestedSkills, currentStep, completedSteps]);

  const handleNext = () => {
    setError(null);
    if (currentStep === 1 && (!role.trim() || !level)) {
      setError("Please select a role and level");
      return;
    }
    if (currentStep === 2) {
      if (isProcessingJd) {
        setError("Please wait for text extraction to complete");
        return;
      }
      if (jdText.length < 50) {
        setError("Job description must be at least 50 characters");
        return;
      }
    }
    if (currentStep === 3 && topSkills.filter(s => s.trim()).length < 1) {
      setError("Please add at least 1 skill");
      return;
    }
    if (currentStep === 4) {
      if (isProcessingResume) {
        setError("Please wait for text extraction to complete");
        return;
      }
      if (resumeText.length < 50) {
        setError("Resume must be at least 50 characters");
        return;
      }
    }

    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      router.push("/mode");
    }
  };

  const handleStepClick = (step: number) => {
    if (completedSteps.includes(step) || step < currentStep) {
      setCurrentStep(step);
    }
  };

  async function startInterview() {
    setError(null);
    setLoading(true);

    let response: any = {};
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "individual",
          resumeText,
          role,
          level,
          jobSetup: {
            jdText,
            topSkills: topSkills.filter(s => s.trim()).slice(0, 5),
            config: {
              questionCount,
              difficultyCurve,
            },
          },
        }),
      });

      // Try to parse JSON, but handle non-JSON responses (like 405)
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        response = await res.json().catch(() => ({}));
      } else {
        // For non-JSON responses, create a meaningful error
        const text = await res.text().catch(() => "");
        response = {
          error: `HTTP ${res.status} ${res.statusText}`,
          message: text || `Server returned ${res.status} ${res.statusText}`,
        };
      }

      setLoading(false);

      if (!res.ok) {
        const errorMessage = response.error || response.message || `Failed to create session (${res.status})`;
        const errorDetails = response.details ? `: ${response.details}` : "";
        setError(`${errorMessage}${errorDetails}`);
        console.error("Session creation failed:", { status: res.status, statusText: res.statusText, response });
        return;
      }
    } catch (networkError) {
      setLoading(false);
      console.error("Network error creating session:", networkError);
      setError("Network error. Please check your connection and try again.");
      return;
    }

    const sessionId = response.data?.sessionId || response.sessionId;
    if (!sessionId) {
      console.error("No session ID in response:", response);
      setError("Failed to get session ID from server response");
      return;
    }

    localStorage.removeItem("individualModeDraft");
    router.push(`/interview/${sessionId}`);
  }

  return (
    <Container className="py-8">
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      <h2 className="text-2xl font-semibold text-[var(--text)] mb-2">Individual Mode Setup</h2>
      <p className="text-[var(--muted)] mb-6">
        Set up your self-serve interview in 6 simple steps.
      </p>

      <Stepper
        currentStep={currentStep}
        steps={STEPS}
        onStepClick={handleStepClick}
        completedSteps={completedSteps}
      />

      <Card className="app-card">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 1: Role & Level</h3>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Target Role
              </label>
              <input
                className="w-full app-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Senior Software Engineer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-2">
                Experience Level
              </label>
              <select
                className="w-full app-input"
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
              >
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
              </select>
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <button onClick={handleNext} className="app-btn-primary px-6 py-2.5">
              Next: Job Description
            </button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 2: Job Description</h3>
            <FileUploadWithPreview
              label="Job Description"
              onTextChange={setJdText}
              previewText={jdText}
              onProcessingChange={setIsProcessingJd}
            />
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
              <button 
                onClick={handleNext} 
                disabled={isProcessingJd}
                className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessingJd ? "Extracting text..." : "Next: Add Skills"}
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 3: Top 5 Skills</h3>
            <p className="text-sm text-[var(--muted)]">
              Select from suggestions or add your own (max 5)
            </p>

            {/* Suggested Skills Tags */}
            {suggestedSkills.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[var(--muted)]">
                  💡 Suggested from Job Description:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedSkills.map((skill, idx) => {
                    const isAdded = topSkills.some(s => s.trim().toLowerCase() === skill.toLowerCase());
                    const isFull = topSkills.filter(s => s.trim()).length >= 5;
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => !isAdded && !isFull && addSuggestedSkill(skill)}
                        disabled={isAdded || isFull}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isAdded
                            ? "bg-green-100 text-green-700 border border-green-300 cursor-not-allowed"
                            : isFull
                            ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                            : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer"
                        }`}
                      >
                        {isAdded ? <Check className="w-3 h-3 inline mr-1" /> : <Plus className="w-3 h-3 inline mr-1" />}{skill}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isExtractingSkills && (
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                Analyzing job description for skills...
              </div>
            )}

            {/* Manual Skill Inputs */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted)]">
                Your Selected Skills:
              </p>
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
                className="app-btn-secondary px-4 py-2 text-sm"
              >
                + Add Another Skill
              </button>
            )}
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
              <button onClick={handleNext} className="app-btn-primary px-6 py-2.5">
                Next: Add Resume
              </button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 4: Resume</h3>
            <FileUploadWithPreview
              label="Your Resume"
              onTextChange={setResumeText}
              previewText={resumeText}
              onProcessingChange={setIsProcessingResume}
            />
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
              <button 
                onClick={handleNext} 
                disabled={isProcessingResume}
                className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessingResume ? "Extracting text..." : "Next: Configure Interview"}
              </button>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 5: Interview Setup</h3>
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
            <div className="flex gap-3">
              <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
              <button onClick={handleNext} className="app-btn-primary px-6 py-2.5">
                Next: Review
              </button>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 6: Review & Start</h3>
            <div className="space-y-3 text-sm bg-[var(--bg)] rounded-lg p-4">
              <div>
                <span className="font-medium text-[var(--text)]">Role:</span>{" "}
                <span className="text-[var(--muted)]">{role || "Not set"}</span>
              </div>
              <div>
                <span className="font-medium text-[var(--text)]">Level:</span>{" "}
                <span className="text-[var(--muted)]">{level}</span>
              </div>
              <div>
                <span className="font-medium text-[var(--text)]">Skills:</span>{" "}
                <span className="text-[var(--muted)]">{topSkills.filter(s => s.trim()).join(", ") || "None"}</span>
              </div>
              <div>
                <span className="font-medium text-[var(--text)]">Questions:</span>{" "}
                <span className="text-[var(--muted)]">{questionCount}</span>
              </div>
              <div>
                <span className="font-medium text-[var(--text)]">Difficulty:</span>{" "}
                <span className="text-[var(--muted)]">
                  {difficultyCurve.replace("_", " ")}
                </span>
              </div>
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
              <button
                onClick={startInterview}
                disabled={loading}
                className="app-btn-primary px-6 py-2.5 disabled:opacity-60"
              >
                {loading ? "Creating..." : "Begin Interview"}
              </button>
            </div>
          </div>
        )}
      </Card>
    </Container>
  );
}

