"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X, Plus, Edit2, Trash2, AlertCircle, Users } from "lucide-react";
import Stepper from "@/components/Stepper";
import Card from "@/components/Card";
import Container from "@/components/Container";
import FileUploadWithPreview from "@/components/FileUploadWithPreview";
import StudentSelector from "@/components/StudentSelector";
import { ToastContainer, useToast } from "@/components/Toast";
import { clientLogger } from "@/lib/clientLogger";

const STEPS = [
  { label: "Job Setup", key: "setup" },
  { label: "Candidates", key: "candidates" },
  { label: "Review", key: "review" },
  { label: "Complete", key: "complete" },
];

export default function CollegePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const [jdText, setJdText] = useState("");
  const [topSkills, setTopSkills] = useState<string[]>([""]);
  const [questionCount, setQuestionCount] = useState<5 | 10 | 15 | 20 | 25 | 1>(1);
  const [difficultyCurve, setDifficultyCurve] = useState<"easy_to_hard" | "balanced" | "custom">("balanced");

  const [jobTemplateId, setJobTemplateId] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [candidates, setCandidates] = useState<Array<{ email: string; name: string; studentId?: string }>>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [csvPasteText, setCsvPasteText] = useState("");
  const [uploadMethod, setUploadMethod] = useState<"file" | "paste">("file");

  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProcessingJd, setIsProcessingJd] = useState(false);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [isExtractingSkills, setIsExtractingSkills] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<number | null>(null);
  const [newCandidate, setNewCandidate] = useState<{ email: string; name: string; studentId: string }>({ email: "", name: "", studentId: "" });
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/college/auth/session");
        const data = await res.json();
        if (!res.ok || !data.data?.session) {
          setCheckingAuth(false);
          router.push("/college/login?redirect=/college");
          return;
        }
        setIsAuthenticated(true);
        setCheckingAuth(false);
      } catch (err) {
        setCheckingAuth(false);
        router.push("/college/login?redirect=/college");
      }
    }
    checkAuth();
  }, [router]);

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

  // Email validation helper
  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Validate candidates
  const validateCandidates = (): { valid: boolean; errors: string[]; warnings: string[] } => {
    const errs: string[] = [];
    const warns: string[] = [];
    const emailSet = new Set<string>();

    if (candidates.length === 0) {
      errs.push("At least one candidate is required");
      return { valid: false, errors: errs, warnings };
    }

    candidates.forEach((c, idx) => {
      const rowNum = idx + 2; // +2 because row 1 is header
      if (!c.email || !c.email.trim()) {
        errs.push(`Row ${rowNum}: Missing email address`);
      } else if (!isValidEmail(c.email)) {
        errs.push(`Row ${rowNum}: Invalid email format (${c.email})`);
      } else if (emailSet.has(c.email.toLowerCase())) {
        errs.push(`Row ${rowNum}: Duplicate email (${c.email})`);
      } else {
        emailSet.add(c.email.toLowerCase());
      }

      if (!c.name || !c.name.trim()) {
        errs.push(`Row ${rowNum}: Missing name`);
      }
    });

    if (candidates.length > 100) {
      warns.push(`Large candidate list (${candidates.length}). This may take a few minutes to process.`);
    }

    return { valid: errs.length === 0, errors: errs, warnings: warns };
  };

  const handleNext = () => {
    setError(null);
    setErrors([]);
    setWarnings([]);

    if (currentStep === 1) {
      // Job Setup validation
      if (isProcessingJd) {
        setError("Please wait for text extraction to complete");
        return;
      }
      if (jdText.length < 50) {
        setError("Job description must be at least 50 characters");
        return;
      }
      if (topSkills.filter(s => s.trim()).length < 1) {
        setError("Please add at least 1 skill");
        return;
      }
    }

    if (currentStep === 2) {
      // Candidate validation
      const validation = validateCandidates();
      if (!validation.valid) {
        setErrors(validation.errors);
        setWarnings(validation.warnings);
        setError(`Please fix ${validation.errors.length} error(s) before continuing`);
        return;
      }
      if (validation.warnings.length > 0) {
        setWarnings(validation.warnings);
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
      router.push("/college/dashboard");
    }
  };

  const handleStepClick = (step: number) => {
    if (completedSteps.includes(step) || step < currentStep) {
      setCurrentStep(step);
    }
  };

  const parseCsvText = (text: string): {
    parsed: Array<{ email: string; name: string; studentId?: string }>;
    errors: string[];
    warnings: string[];
  } => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines = text.split("\n").filter(l => l.trim());

    if (lines.length < 2) {
      return {
        parsed: [],
        errors: ["CSV must have at least a header row and one data row"],
        warnings: []
      };
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const emailIdx = headers.findIndex(h => h.includes("email"));
    const nameIdx = headers.findIndex(h => h.includes("name"));
    const idIdx = headers.findIndex(h => h.includes("id") || h.includes("student"));

    if (emailIdx < 0 || nameIdx < 0) {
      const foundCols = headers.length > 0 ? headers.join(", ") : "none";
      return {
        parsed: [],
        errors: [`CSV must have 'email' and 'name' columns. Found columns: [${foundCols}]`],
        warnings: []
      };
    }

    const parsed: Array<{ email: string; name: string; studentId?: string }> = [];
    const emailSet = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1;
      const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
      const email = values[emailIdx] || "";
      const name = values[nameIdx] || "";
      const studentId = idIdx >= 0 ? values[idIdx] : undefined;

      // Validate row
      if (!email && !name) {
        continue; // Skip empty rows
      }

      if (!email) {
        errors.push(`Row ${rowNum}: Missing email address`);
        continue;
      }

      if (!isValidEmail(email)) {
        errors.push(`Row ${rowNum}: Invalid email format (${email})`);
        continue;
      }

      if (emailSet.has(email.toLowerCase())) {
        errors.push(`Row ${rowNum}: Duplicate email (${email})`);
        continue;
      }

      if (!name) {
        errors.push(`Row ${rowNum}: Missing name`);
        continue;
      }

      emailSet.add(email.toLowerCase());
      parsed.push({ email, name, studentId });
    }

    if (parsed.length === 0 && errors.length === 0) {
      errors.push("No valid candidates found in CSV");
    }

    if (parsed.length > 100) {
      warnings.push(`Large candidate list (${parsed.length}). Processing may take a few minutes.`);
    }

    return { parsed, errors, warnings };
  };

  const handleCsvUpload = async (file: File) => {
    setError(null);
    setErrors([]);
    setWarnings([]);
    try {
      const text = await file.text();
      const result = parseCsvText(text);

      if (result.errors.length > 0) {
        setErrors(result.errors);
        setWarnings(result.warnings);
        setError(`CSV parsing found ${result.errors.length} error(s). Please fix them.`);
        // Still set candidates if some were parsed
        if (result.parsed.length > 0) {
          setCandidates(result.parsed);
          setCsvFile(file);
        }
      } else {
        setCandidates(result.parsed);
        setCsvFile(file);
        setWarnings(result.warnings);
        if (result.warnings.length > 0) {
          setError(null); // Warnings don't block
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV file. Please check the format.");
      clientLogger.error("Failed to parse CSV file", err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleCsvPaste = () => {
    setError(null);
    setErrors([]);
    setWarnings([]);
    try {
      if (!csvPasteText.trim()) {
        setError("Please paste CSV data");
        return;
      }
      const result = parseCsvText(csvPasteText);

      if (result.errors.length > 0) {
        setErrors(result.errors);
        setWarnings(result.warnings);
        setError(`CSV parsing found ${result.errors.length} error(s). Please fix them.`);
        if (result.parsed.length > 0) {
          setCandidates(result.parsed);
        }
      } else {
        setCandidates(result.parsed);
        setCsvPasteText(""); // Clear after successful parse
        setWarnings(result.warnings);
        if (result.warnings.length > 0) {
          setError(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV data. Please check the format.");
      clientLogger.error("Failed to parse CSV paste", err instanceof Error ? err : new Error(String(err)));
    }
  };

  // Candidate management functions
  const handleAddCandidate = () => {
    if (!newCandidate.email || !newCandidate.name) {
      setError("Email and name are required");
      return;
    }
    if (!isValidEmail(newCandidate.email)) {
      setError("Invalid email format");
      return;
    }
    if (candidates.some(c => c.email.toLowerCase() === newCandidate.email.toLowerCase())) {
      setError("This email already exists in the list");
      return;
    }
    setCandidates([...candidates, {
      email: newCandidate.email.trim(),
      name: newCandidate.name.trim(),
      studentId: newCandidate.studentId.trim() || undefined,
    }]);
    setNewCandidate({ email: "", name: "", studentId: "" });
    setError(null);
  };

  const handleEditCandidate = (index: number) => {
    setEditingCandidate(index);
    const candidate = candidates[index];
    setNewCandidate({
      email: candidate.email,
      name: candidate.name,
      studentId: candidate.studentId || ""
    });
  };

  const handleSaveEdit = () => {
    if (editingCandidate === null) return;
    if (!newCandidate.email || !newCandidate.name) {
      setError("Email and name are required");
      return;
    }
    if (!isValidEmail(newCandidate.email)) {
      setError("Invalid email format");
      return;
    }
    // Check for duplicate (excluding current index)
    const duplicate = candidates.findIndex((c, i) =>
      i !== editingCandidate && c.email.toLowerCase() === newCandidate.email.toLowerCase()
    );
    if (duplicate >= 0) {
      setError("This email already exists in the list");
      return;
    }
    const updated = [...candidates];
    updated[editingCandidate] = {
      email: newCandidate.email.trim(),
      name: newCandidate.name.trim(),
      studentId: newCandidate.studentId.trim() || undefined,
    };
    setCandidates(updated);
    setEditingCandidate(null);
    setNewCandidate({ email: "", name: "", studentId: "" });
    setError(null);
  };

  const handleRemoveCandidate = (index: number) => {
    setCandidates(candidates.filter((_, i) => i !== index));
  };

  const handleFinalSubmit = async () => {
    // Validate candidates one more time
    const validation = validateCandidates();
    if (!validation.valid) {
      setErrors(validation.errors);
      setError(`Please fix ${validation.errors.length} error(s) before submitting`);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Step 1: Create template if not exists
      let templateId = jobTemplateId;
      if (!templateId) {
        const templateRes = await fetch("/api/college/templates", {
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

        const templateData = await templateRes.json();
        if (!templateRes.ok) {
          const errorMessage = templateData.error || templateData.message || "Failed to create template";
          setError(errorMessage);
          setLoading(false);
          return;
        }
        templateId = templateData.data?.templateId || templateData.templateId;
        setJobTemplateId(templateId);
      }

      // Step 2: Create batch and send links
      const res = await fetch("/api/college/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTemplateId: templateId,
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
      showToast(`Successfully created batch with ${candidates.length} candidate(s)!`, "success");
      setTimeout(() => {
        router.push(`/college/dashboard/${templateId}`);
      }, 1500);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      clientLogger.error("Failed to submit", err instanceof Error ? err : new Error(String(err)));
    }
  };

  if (checkingAuth) {
    return (
      <Container className="py-8">
        <div className="text-center py-12">
          <p className="text-[var(--muted)]">Checking authentication...</p>
        </div>
      </Container>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
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
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[var(--text)]">Step 1: Job Setup</h3>

              {/* Job Description */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--text)]">Job Description</label>
                <FileUploadWithPreview
                  label="Job Description"
                  onTextChange={setJdText}
                  previewText={jdText}
                  onProcessingChange={setIsProcessingJd}
                />
              </div>

              {/* Skills Section */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-[var(--text)]">
                  Top 5 Skills {topSkills.filter(s => s.trim()).length > 0 && `(${topSkills.filter(s => s.trim()).length}/5)`}
                </label>
                <p className="text-xs text-[var(--muted)]">
                  Select from suggestions or add your own
                </p>

                {/* Suggested Skills */}
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
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isAdded
                              ? "bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success)] cursor-not-allowed"
                              : isFull
                                ? "bg-[var(--bg-secondary)] text-[var(--muted)] border border-[var(--border)] cursor-not-allowed"
                                : "bg-[var(--info-bg)] text-[var(--info)] border border-[var(--info)] hover:opacity-80 cursor-pointer"
                              }`}
                          >
                            {isAdded ? <Check className="w-3 h-3 inline mr-1" /> : <Plus className="w-3 h-3 inline mr-1" />}{skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                    <option value={1}>1 question (Testing)</option>
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

              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <div className="flex gap-3">
                <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
                <button
                  onClick={handleNext}
                  disabled={isProcessingJd}
                  className="app-btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isProcessingJd ? "Extracting text..." : "Next: Add Candidates"}
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">Step 2: Add Candidates</h3>
              <p className="text-sm text-[var(--muted)]">
                Upload a CSV file, paste CSV data, or add candidates manually. Required columns: <code className="bg-[var(--bg)] px-1 rounded">email</code>, <code className="bg-[var(--bg)] px-1 rounded">name</code>, <code className="bg-[var(--bg)] px-1 rounded">studentId</code> (optional)
              </p>

              {/* Upload Method Toggle */}
              <div className="flex gap-2 border-b border-[var(--border)] pb-3">
                <button
                  onClick={() => setUploadMethod("file")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${uploadMethod === "file"
                    ? "text-[var(--primary)] border-b-2 border-[var(--primary)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                >
                  Upload File
                </button>
                <button
                  onClick={() => setUploadMethod("paste")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${uploadMethod === "paste"
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

              {/* Select from Students Database */}
              <div className="border-t border-[var(--border)] pt-4">
                <p className="text-sm font-medium text-[var(--text)] mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Select from Student Database
                </p>
                <StudentSelector
                  onSelect={(selectedStudents) => {
                    const newCandidates = selectedStudents.map((s) => ({
                      email: s.email,
                      name: s.name,
                      studentId: s.student_id || "",
                    }));
                    // Merge with existing, avoiding duplicates
                    const existingEmails = new Set(candidates.map((c) => c.email));
                    const uniqueNew = newCandidates.filter((c) => !existingEmails.has(c.email));
                    if (uniqueNew.length > 0) {
                      setCandidates([...candidates, ...uniqueNew]);
                      showToast(`Added ${uniqueNew.length} student(s)`, "success");
                    }
                  }}
                  selectedEmails={candidates.map((c) => c.email)}
                  multiSelect={true}
                />
              </div>

              {/* Manual Add Candidate */}
              <div className="border-t border-[var(--border)] pt-4 mt-4">
                <p className="text-sm font-medium text-[var(--text)] mb-3">Or add manually:</p>
                <div className="grid md:grid-cols-3 gap-3">
                  <input
                    type="email"
                    placeholder="Email *"
                    value={newCandidate.email}
                    onChange={async (e) => {
                      const email = e.target.value;
                      setNewCandidate({ ...newCandidate, email });
                      // Auto-fill from student database if email matches
                      if (email.includes("@")) {
                        try {
                          const res = await fetch(`/api/college/students?search=${encodeURIComponent(email)}`);
                          const data = await res.json();
                          if (res.ok) {
                            const responseData = data.data || data;
                            const students = responseData.students || [];
                            const match = students.find((s: any) => s.email.toLowerCase() === email.toLowerCase());
                            if (match) {
                              setNewCandidate({
                                email: match.email,
                                name: match.name,
                                studentId: match.student_id || "",
                              });
                              showToast("Auto-filled from student database", "info", 2000);
                            }
                          }
                        } catch (err) {
                          // Silently fail - user can still type manually
                        }
                      }
                    }}
                    className="app-input"
                  />
                  <input
                    type="text"
                    placeholder="Name *"
                    value={newCandidate.name}
                    onChange={(e) => setNewCandidate({ ...newCandidate, name: e.target.value })}
                    className="app-input"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Student ID (optional)"
                      value={newCandidate.studentId}
                      onChange={(e) => setNewCandidate({ ...newCandidate, studentId: e.target.value })}
                      className="app-input flex-1"
                    />
                    <button
                      onClick={editingCandidate !== null ? handleSaveEdit : handleAddCandidate}
                      className="app-btn-primary px-4 py-2"
                    >
                      {editingCandidate !== null ? "Save" : "Add"}
                    </button>
                    {editingCandidate !== null && (
                      <button
                        onClick={() => {
                          setEditingCandidate(null);
                          setNewCandidate({ email: "", name: "", studentId: "" });
                        }}
                        className="app-btn-secondary px-4 py-2"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Error/Warning Display */}
              {errors.length > 0 && (
                <div className="rounded-lg bg-[var(--danger-bg)] border border-[var(--danger)] p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                    <p className="text-sm font-medium text-red-900">{errors.length} error(s) found:</p>
                  </div>
                  <ul className="text-xs text-[var(--danger)] space-y-1 max-h-32 overflow-y-auto">
                    {errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <p className="text-sm font-medium text-yellow-900">Warning(s):</p>
                  </div>
                  <ul className="text-xs text-yellow-800 space-y-1">
                    {warnings.map((warn, i) => (
                      <li key={i}>• {warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Candidate List */}
              {candidates.length > 0 && (
                <div className="rounded-lg bg-[var(--bg)] border border-[var(--border)] p-4">
                  <p className="text-sm font-medium mb-3 text-[var(--text)]">
                    <Check className="w-4 h-4 inline mr-1" /> {candidates.length} candidate(s) loaded
                  </p>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {candidates.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-white rounded border border-[var(--border)]">
                        <div className="flex-1 text-sm">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-[var(--muted)] ml-2">({c.email})</span>
                          {c.studentId && <span className="text-xs text-[var(--muted)] ml-2">ID: {c.studentId}</span>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditCandidate(i)}
                            className="text-[var(--primary)] hover:text-blue-800 p-1"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveCandidate(i)}
                            className="text-red-600 hover:text-[var(--danger)] p-1"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <div className="flex gap-3">
                <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
                {candidates.length > 0 && (
                  <button onClick={handleNext} className="app-btn-primary px-6 py-2.5">
                    Next: Review
                  </button>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">Step 3: Review & Confirm</h3>
              <p className="text-sm text-[var(--muted)]">
                Review your configuration before creating the template and sending interview links.
              </p>

              {/* Job Setup Summary */}
              <Card variant="outlined" className="p-4">
                <h4 className="font-semibold text-[var(--text)] mb-3">Job Template Summary</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Questions:</span> {questionCount}</div>
                  <div><span className="font-medium">Skills:</span> {topSkills.filter(s => s.trim()).join(", ") || "None"}</div>
                  <div><span className="font-medium">Difficulty:</span> {difficultyCurve.replace("_", " ")}</div>
                  <div className="mt-2 pt-2 border-t border-[var(--border)]">
                    <span className="font-medium">JD Preview:</span>
                    <p className="text-xs text-[var(--muted)] mt-1 line-clamp-3">{jdText.substring(0, 200)}...</p>
                  </div>
                </div>
              </Card>

              {/* Candidates Summary */}
              <Card variant="outlined" className="p-4">
                <h4 className="font-semibold text-[var(--text)] mb-3">Candidates ({candidates.length})</h4>
                <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                  {candidates.slice(0, 20).map((c, i) => (
                    <div key={i} className="text-[var(--muted)] py-1 border-b border-[var(--border)] last:border-0">
                      {c.name} ({c.email}) {c.studentId && `- ID: ${c.studentId}`}
                    </div>
                  ))}
                  {candidates.length > 20 && (
                    <p className="text-xs text-[var(--muted)] pt-2">
                      ... and {candidates.length - 20} more
                    </p>
                  )}
                </div>
              </Card>

              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <div className="flex gap-3">
                <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
                <button onClick={handleNext} className="app-btn-primary px-6 py-2.5">
                  Next: Complete Setup
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[var(--text)]">Step 4: Complete Setup</h3>
              <p className="text-sm text-[var(--muted)]">
                This will create the job template and generate interview links for all {candidates.length} candidates.
              </p>
              <div className="bg-[var(--info-bg)] border border-[var(--info)] rounded-lg p-4">
                <p className="text-sm text-[var(--info)] mb-2">
                  <strong>What happens next:</strong>
                </p>
                <ul className="text-xs text-[var(--text)] space-y-1 list-disc list-inside">
                  <li>Job template will be created automatically</li>
                  <li>{candidates.length} interview sessions will be generated</li>
                  <li>You'll be redirected to the dashboard to view all candidates</li>
                  <li>Each candidate will have a unique interview link</li>
                </ul>
              </div>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <div className="flex gap-3">
                <button onClick={handleBack} className="app-btn-secondary px-6 py-2.5">Back</button>
                <button
                  onClick={handleFinalSubmit}
                  disabled={loading || candidates.length === 0}
                  className="app-btn-primary px-6 py-2.5 disabled:opacity-60"
                >
                  {loading ? "Creating template and sessions..." : `Complete Setup (${candidates.length} candidates)`}
                </button>
              </div>
            </div>
          )}
        </Card>
      </Container>
    </>
  );
}

