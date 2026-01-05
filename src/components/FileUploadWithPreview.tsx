"use client";

import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import Card from "./Card";
import mammoth from "mammoth";
import { sanitizeForStorageSync, sanitizeHtmlSync } from "@/lib/sanitize";
import { clientLogger } from "@/lib/clientLogger";

type FileUploadWithPreviewProps = {
  label: string;
  accept?: string;
  onFileChange?: (file: File | null) => void;
  onTextChange?: (text: string) => void;
  previewText?: string;
  onProcessingChange?: (isProcessing: boolean) => void;
  onResumeIdChange?: (resumeId: string | null) => void; // New: callback for resume ID
  enableStorage?: boolean; // New: enable Supabase storage upload
  sessionId?: string; // New: optional session ID for linking
  uploadedBy?: string; // New: optional user identifier
};

export default function FileUploadWithPreview({
  label,
  accept = ".pdf,.doc,.docx",
  onFileChange,
  onTextChange,
  previewText,
  onProcessingChange,
  onResumeIdChange,
  enableStorage = false,
  sessionId,
  uploadedBy,
}: FileUploadWithPreviewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState(previewText || "");
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [isProcessingDocx, setIsProcessingDocx] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Sync internal text state with previewText prop
  useEffect(() => {
    if (previewText !== undefined && previewText !== text) {
      setText(previewText);
    }
  }, [previewText]);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    // Handle dropped file by creating a synthetic event
    const syntheticEvent = {
      target: { files: [droppedFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    
    await handleFileSelect(syntheticEvent);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    onFileChange?.(selectedFile);
    setExtractionError(null); // Clear any previous errors

    const isDocx = selectedFile.name.toLowerCase().endsWith(".docx") || 
                  selectedFile.name.toLowerCase().endsWith(".doc");
    const isPdf = selectedFile.type === "application/pdf" || 
                  selectedFile.name.toLowerCase().endsWith(".pdf");

    // Handle PDF files with pdfjs
    if (isPdf) {
      setIsProcessingPdf(true);
      onProcessingChange?.(true);
      
      // Create preview URL for PDF first
      try {
        const url = URL.createObjectURL(selectedFile);
        setFilePreviewUrl(url);
        setDocxHtml(null);
      } catch (error) {
        clientLogger.error("Failed to create preview URL", error instanceof Error ? error : new Error(String(error)));
      }
      
      // Extract text from PDF
      try {
        // Load pdfjs from CDN to avoid bundling issues
        const loadPdfjs = async () => {
          // Check if already loaded
          if ((window as any).pdfjsLib) {
            return (window as any).pdfjsLib;
          }
          
          // Check if script is already being loaded
          if ((window as any).pdfjsLoading) {
            // Wait for existing load to complete
            return new Promise((resolve) => {
              const checkInterval = setInterval(() => {
                if ((window as any).pdfjsLib) {
                  clearInterval(checkInterval);
                  resolve((window as any).pdfjsLib);
                }
              }, 100);
            });
          }
          
          // Load from CDN
          (window as any).pdfjsLoading = true;
          return new Promise((resolve, reject) => {
            // Check if script already exists
            const existingScript = document.querySelector('script[src*="pdf.js"]');
            if (existingScript) {
              // Wait a bit for it to load
              setTimeout(() => {
                const pdfjs = (window as any).pdfjsLib || (window as any).pdfjs;
                if (pdfjs) {
                  (window as any).pdfjsLib = pdfjs;
                  (window as any).pdfjsLoading = false;
                  resolve(pdfjs);
                } else {
                  (window as any).pdfjsLoading = false;
                  reject(new Error("PDF.js script exists but library not available"));
                }
              }, 500);
              return;
            }
            
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.onload = () => {
              const pdfjs = (window as any).pdfjsLib || (window as any).pdfjs;
              if (pdfjs) {
                pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                (window as any).pdfjsLib = pdfjs;
                (window as any).pdfjsLoading = false;
                resolve(pdfjs);
              } else {
                (window as any).pdfjsLoading = false;
                reject(new Error("PDF.js failed to load"));
              }
            };
            script.onerror = () => {
              (window as any).pdfjsLoading = false;
              reject(new Error("Failed to load PDF.js script"));
            };
            document.head.appendChild(script);
          });
        };
        
        const pdfjs = await loadPdfjs() as any;
        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        
        let extractedText = "";
        // Extract text from all pages
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(" ");
          extractedText += pageText + "\n\n";
        }
        
        const trimmedText = extractedText.trim();
        if (trimmedText) {
          setText(trimmedText);
          // Call onTextChange to update parent state immediately
          onTextChange?.(trimmedText);
          clientLogger.debug("PDF text extracted", { characterCount: trimmedText.length });
          
          // Upload to Supabase Storage if enabled
          if (enableStorage && selectedFile) {
            await uploadFileToStorage(selectedFile, trimmedText);
          }
        } else {
          clientLogger.warn("PDF text extraction returned empty text");
        }
      } catch (error) {
        clientLogger.error("Failed to extract PDF text", error instanceof Error ? error : new Error(String(error)));
        setExtractionError("Failed to extract text from PDF. Please paste text manually.");
      } finally {
        setIsProcessingPdf(false);
        onProcessingChange?.(isUploading || isProcessingDocx);
      }
    }
    // Handle DOCX files with mammoth
    else if (isDocx) {
      setIsProcessingDocx(true);
      setDocxHtml(null);
      onProcessingChange?.(true);
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setDocxHtml(result.value);
        
        // Also extract plain text for the textarea
        const textResult = await mammoth.extractRawText({ arrayBuffer });
        if (textResult.value) {
          const sanitizedText = sanitizeForStorageSync(textResult.value);
          setText(sanitizedText);
          onTextChange?.(sanitizedText);
          
          // Upload to Supabase Storage if enabled
          if (enableStorage && selectedFile) {
            await uploadFileToStorage(selectedFile, textResult.value);
          }
        }
      } catch (error) {
        clientLogger.error("Failed to process DOCX", error instanceof Error ? error : new Error(String(error)));
        setDocxHtml("<p class='text-sm text-[var(--muted)]'>Failed to preview DOCX file. Please paste text below.</p>");
      } finally {
        setIsProcessingDocx(false);
        onProcessingChange?.(isUploading || isProcessingPdf);
      }
    } else {
      // Create preview URL for other file types
      try {
        const url = URL.createObjectURL(selectedFile);
        setFilePreviewUrl(url);
        setDocxHtml(null);
      } catch (error) {
        clientLogger.error("Failed to create preview URL", error instanceof Error ? error : new Error(String(error)));
      }
    }
  };

  // Upload file to Supabase Storage
  const uploadFileToStorage = async (file: File, extractedText: string) => {
    // Resume upload to Supabase storage is disabled for now
    // Text extraction still works without storage
    return null;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    onTextChange?.(newText);
  };

  const isPdf = file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf");
  const isImage = file?.type.startsWith("image/");
  const isDocx = file?.name.toLowerCase().endsWith(".docx") || file?.name.toLowerCase().endsWith(".doc");
  const isProcessing = isProcessingDocx || isProcessingPdf || isUploading;

  // Cleanup preview URL on unmount or file change
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-2">
          {label}
        </label>
        <div
          ref={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
            isDragging
              ? "border-[var(--primary)] bg-[var(--primary)]/5"
              : "border-[var(--border)] hover:border-[var(--primary)]/50"
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileSelect}
              className="hidden"
              id={`file-${label.replace(/\s+/g, "-")}`}
            />
            <label
              htmlFor={`file-${label.replace(/\s+/g, "-")}`}
              className="app-btn-secondary px-4 py-2 cursor-pointer"
            >
              {isDragging ? "Drop file here" : "Upload File (PDF/DOCX)"}
            </label>
            <p className="text-xs text-[var(--muted)]">
              or drag and drop your file here
            </p>
            {file && (
              <span className="flex items-center text-sm text-[var(--muted)] mt-2">
                <Check className="w-4 h-4 inline mr-1" /> {file.name}
                {resumeId && enableStorage && (
                  <span className="ml-2 text-xs text-[var(--success)]">(Saved)</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {file && (filePreviewUrl || docxHtml || isProcessing) && (
        <Card variant="outlined" className="app-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-[var(--text)]">File Preview</p>
            <p className="text-xs text-[var(--muted)]">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <div className="bg-[var(--bg)] rounded border border-[var(--border)] overflow-hidden">
            {isPdf && (
              <>
                {isProcessingPdf ? (
                  <div className="p-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                    <p className="text-sm text-[var(--muted)] mt-2">Extracting text from PDF...</p>
                  </div>
                ) : filePreviewUrl ? (
                  <iframe
                    src={filePreviewUrl}
                    className="w-full h-[400px] border-0"
                    title="PDF Preview"
                  />
                ) : null}
              </>
            )}
            {isImage && filePreviewUrl && (
              <div className="p-4">
                <img
                  src={filePreviewUrl}
                  alt="Preview"
                  className="max-w-full h-auto max-h-[400px] mx-auto rounded"
                />
              </div>
            )}
            {isDocx && (
              <div className="p-4 max-h-[400px] overflow-y-auto">
                {(isProcessingDocx || isUploading) ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
                    <p className="text-sm text-[var(--muted)] mt-2">
                      {isUploading ? "Uploading to storage..." : "Extracting text from DOCX..."}
                    </p>
                  </div>
                ) : docxHtml ? (
                  <div
                    className="text-[var(--text)] [&_p]:my-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:my-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2 [&_li]:my-1 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: docxHtml }}
                    style={{
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      lineHeight: '1.6',
                    }}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-[var(--muted)]">No preview available</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--muted)] mt-2">
            Text extraction will be available in the next update. Please paste text below as fallback.
          </p>
        </Card>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-2">
          {file ? "Or paste plain text (fallback)" : "Paste plain text"}
        </label>
        <textarea
          className="w-full app-input"
          rows={10}
          value={text}
          onChange={handleTextChange}
          placeholder="Paste text here if file upload fails or for quick testing..."
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          {text.length} characters
          {isProcessingPdf && (
            <span className="ml-2 text-[var(--primary)]">(Extracting text from PDF...)</span>
          )}
          {isProcessingDocx && (
            <span className="ml-2 text-[var(--primary)]">(Extracting text from DOCX...)</span>
          )}
        </p>
        {extractionError && (
          <p className="mt-1 text-xs text-[var(--danger)]">{extractionError}</p>
        )}
        {text.length > 0 && text.length < 50 && !isProcessingPdf && !isProcessingDocx && (
          <p className="mt-1 text-xs text-[var(--warning)]">
            ⚠️ Text is less than 50 characters. Please add more content.
          </p>
        )}
      </div>
    </div>
  );
}

