"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X, Plus } from "lucide-react";
import Stepper from "@/components/Stepper";
import Card from "@/components/Card";
import Container from "@/components/Container";
import FileUploadWithPreview from "@/components/FileUploadWithPreview";
import { clientLogger } from "@/lib/clientLogger";

const STEPS = [
  { label: "Job Description", key: "jd" },
  { label: "Top 5 Skills", key: "skills" },
  { label: "Interview Setup", key: "config" },
  { label: "Create Template", key: "create" },
  { label: "Upload Candidates", key: "candidates" },
  { label: "Send Links", key: "send" },
];

export default function CollegePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  const [jdText, setJdText] = useState("");
  const [topSkills, setTopSkills] = useState<string[]>([""]);
  const [questionCount, setQuestionCount] = useState<5 | 10 | 15 | 20 | 25>(10);
  const [difficultyCurve, setDifficultyCurve] = useState<"easy_to_hard" | "balanced" | "custom">("balanced");
  
  const [jobTemplateId, setJobTemplateId] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<Array<{email: string; name: string; studentId?: string}>>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [csvPasteText, setCsvPasteText] = useState("");
  const [uploadMethod, setUploadMethod] = useState<"file" | "paste">("file");
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isProcessingJd, setIsProcessingJd] = useState(false);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [isExtractingSkills, setIsExtractingSkills] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("collegeModeDraft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setJdText(parsed.jdText || "");
        setTopSkills(parsed.topSkills || [""]);
        setQuestionCount(parsed.questionCount || 10);
        setDifficultyCurve(parsed.difficultyCurve || "balanced");
        setJobTemplateId(parsed.jobTemplateId || null);
        setCandidates(parsed.candidates || []);
        setBatchId(parsed.batchId || null);
        setCsvPasteText(parsed.csvPasteText || "");
        setUploadMethod(parsed.uploadMethod || "file");
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
    if (jdText.length >= 50 && currentStep === 1 && !isProcessingJd) {
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
    localStorage.setItem("collegeModeDraft", JSON.stringify({
      jdText,
      topSkills,
      questionCount,
      difficultyCurve,
      jobTemplateId,
      candidates,
      batchId,
      csvPasteText,
      uploadMethod,
      suggestedSkills,
      currentStep,
      completedSteps,
    }));
  }, [jdText, topSkills, questionCount, difficultyCurve, jobTemplateId, candidates, batchId, csvPasteText, uploadMethod, suggestedSkills, currentStep, completedSteps]);

  const handleNext = () => {
    setError(null);
    if (currentStep === 1) {
      if (isProcessingJd) {
        setError("Please wait for text extraction to complete");
        return;
      }
      if (jdText.length < 50) {
        setError("Job description must be at least 50 characters");
        return;
      }
    }
    if (currentStep === 2 && topSkills.filter(s => s.trim()).length < 1) {
      setError("Please add at least 1 skill");
      return;
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

  const handleCreateTemplate = async () => {
    setError(null);
    setLoading(true);
    
    const res = await fetch("/api/college/templates", {
      method: "POST",
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
    setLoading(false);

    if (!res.ok) {
      const errorMessage = data.error || data.message || "Failed to create template";
      const errorDetails = data.details ? `: ${data.details}` : "";
      setError(`${errorMessage}${errorDetails}`);
      return;
    }

    setJobTemplateId(data.data?.templateId || data.templateId);
    if (!completedSteps.includes(4)) {
      setCompletedSteps([...completedSteps, 4]);
    }
  };

  const parseCsvText = (text: string): Array<{email: string; name: string; studentId?: string}> => {
    const lines = text.split("\n").filter(l => l.trim());
    if (lines.length < 2) {
      throw new Error("CSV must have at least a header row and one data row");
    }
    
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const emailIdx = headers.findIndex(h => h.includes("email"));
    const nameIdx = headers.findIndex(h => h.includes("name"));
    const idIdx = headers.findIndex(h => h.includes("id") || h.includes("student"));
    
    if (emailIdx < 0 || nameIdx < 0) {
      throw new Error("CSV must have 'email' and 'name' columns");
    }
    
    const parsed: Array<{email: string; name: string; studentId?: string}> = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const email = values[emailIdx] || "";
      const name = values[nameIdx] || "";
      
      if (email && name) {
        parsed.push({
          email,
          name,
          studentId: idIdx >= 0 ? values[idIdx] : undefined,
        });
      }
    }
    
    if (parsed.length === 0) {
      throw new Error("No valid candidates found in CSV");
    }
    
    return parsed;
  };

  const handleCsvUpload = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      setCandidates(parsed);
      setCsvFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV file. Please check the format.");
      clientLogger.error("Failed to parse CSV file", err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleCsvPaste = () => {
    setError(null);
    try {
      if (!csvPasteText.trim()) {
        setError("Please paste CSV data");
        return;
      }
      const parsed = parseCsvText(csvPasteText);
      setCandidates(parsed);
      setCsvPasteText(""); // Clear after successful parse
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV data. Please check the format.");
      clientLogger.error("Failed to parse CSV paste", err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleBulkSend = async () => {
    if (!jobTemplateId || candidates.length === 0) {
      setError("Please complete previous steps");
      return;
    }
    
    setError(null);
    setLoading(true);
    
    const res = await fetch("/api/college/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobTemplateId,
        candidates,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      const errorMessage = data.error || data.message || "Failed to create batch";
      const errorDetails = data.details ? `: ${data.details}` : "";
      setError(`${errorMessage}${errorDetails}`);
      return;
    }

    setBatchId(data.data?.batchId || data.batchId);
    localStorage.removeItem("collegeModeDraft");
    router.push(`/college/dashboard/${jobTemplateId}`);
  };

  return (
    <Container className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        {jobTemplateId && (
          <Link
            href="/college/dashboard"
            className="text-sm text-[var(--primary)] hover:underline"
          >
            View Dashboard →
          </Link>
        )}
      </div>

      <h2 className="text-2xl font-semibold text-[var(--text)] mb-2">College Mode Setup</h2>
      <p className="text-[var(--muted)] mb-6">
        Create a job template once, then send interview links to multiple candidates.
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
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 1: Job Description</h3>
            <FileUploadWithPreview
              label="Job Description"
              onTextChange={setJdText}
              previewText={jdText}
              onProcessingChange={setIsProcessingJd}
            />
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <button 
              onClick={handleNext} 
              disabled={isProcessingJd}
              className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isProcessingJd ? "Extracting text..." : "Next: Add Skills"}
            </button>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 2: Top 5 Skills</h3>
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
                Next: Configure Interview
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 3: Interview Setup</h3>
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
                Next: Create Template
              </button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 4: Create Job Template</h3>
            <p className="text-sm text-[var(--muted)]">
              Review your configuration and create the template. This will be reused for all candidates.
            </p>
            {jobTemplateId ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-900 font-medium flex items-center gap-2"><Check className="w-4 h-4" /> Template created successfully</p>
                <p className="text-xs text-green-700 mt-1">Template ID: {jobTemplateId}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-[var(--bg)] rounded-lg p-4 text-sm space-y-2">
                  <div><span className="font-medium">Questions:</span> {questionCount}</div>
                  <div><span className="font-medium">Skills:</span> {topSkills.filter(s => s.trim()).join(", ") || "None"}</div>
                  <div><span className="font-medium">Difficulty:</span> {difficultyCurve.replace("_", " ")}</div>
                </div>
                <button
                  onClick={handleCreateTemplate}
                  disabled={loading}
                  className="app-btn-primary px-6 py-2.5 disabled:opacity-60"
                >
                  {loading ? "Creating..." : "Create Template"}
                </button>
              </div>
            )}
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
              {jobTemplateId && (
                <button onClick={handleNext} className="app-btn-primary px-6 py-2.5">
                  Next: Upload Candidates
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 5: Upload Candidate List</h3>
            <p className="text-sm text-[var(--muted)]">
              Upload a CSV file or paste CSV data with columns: <code className="bg-[var(--bg)] px-1 rounded">email</code>, <code className="bg-[var(--bg)] px-1 rounded">name</code>, <code className="bg-[var(--bg)] px-1 rounded">studentId</code> (optional)
            </p>
            
            {/* Upload Method Toggle */}
            <div className="flex gap-2 border-b border-[var(--border)] pb-3">
              <button
                onClick={() => setUploadMethod("file")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  uploadMethod === "file"
                    ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                Upload File
              </button>
              <button
                onClick={() => setUploadMethod("paste")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  uploadMethod === "paste"
                    ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                Paste CSV
              </button>
            </div>

            {/* File Upload Method */}
            {uploadMethod === "file" && (
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleCsvUpload(file);
                  }
                }}
                className="w-full app-input"
              />
            )}

            {/* Paste CSV Method */}
            {uploadMethod === "paste" && (
              <div className="space-y-3">
                <textarea
                  value={csvPasteText}
                  onChange={(e) => setCsvPasteText(e.target.value)}
                  placeholder="email,name,studentId&#10;john.doe@example.com,John Doe,STU001&#10;jane.smith@example.com,Jane Smith,STU002"
                  className="w-full app-input min-h-[200px] font-mono text-sm"
                  rows={8}
                />
                <button
                  onClick={handleCsvPaste}
                  disabled={!csvPasteText.trim()}
                  className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Process CSV Data
                </button>
              </div>
            )}
            {candidates.length > 0 && (
              <div className="rounded-lg bg-[var(--bg)] border border-[var(--border)] p-4">
                <p className="text-sm font-medium mb-2 text-[var(--text)]">
                  <Check className="w-4 h-4 inline mr-1" /> {candidates.length} candidates loaded
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {candidates.slice(0, 10).map((c, i) => (
                    <div key={i} className="text-xs text-[var(--muted)] py-1 border-b border-[var(--border)] last:border-0">
                      {c.name} ({c.email}) {c.studentId && `- ID: ${c.studentId}`}
                    </div>
                  ))}
                  {candidates.length > 10 && (
                    <p className="text-xs text-[var(--muted)] pt-2">
                      ... and {candidates.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
              {candidates.length > 0 && (
                <button onClick={handleNext} className="app-btn-primary px-6 py-2.5">
                  Next: Send Links
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--text)]">Step 6: Send Interview Links</h3>
            <p className="text-sm text-[var(--muted)]">
              Generate interview sessions for all candidates and send them links.
            </p>
            <div className="bg-[var(--bg)] rounded-lg p-4">
              <p className="text-sm text-[var(--text)] mb-2">
                Ready to send links to <span className="font-semibold">{candidates.length}</span> candidates
              </p>
              <p className="text-xs text-[var(--muted)]">
                Each candidate will receive a unique interview link based on the job template.
              </p>
            </div>
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
              <button
                onClick={handleBulkSend}
                disabled={loading || !jobTemplateId || candidates.length === 0}
                className="app-btn-primary px-6 py-2.5 disabled:opacity-60"
              >
                {loading ? "Generating..." : `Generate & Send Links (${candidates.length} candidates)`}
              </button>
            </div>
          </div>
        )}
      </Card>
    </Container>
  );
}

