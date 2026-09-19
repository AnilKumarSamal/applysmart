import {
  jsx as _jsx,
  jsxs as _jsxs,
  Fragment as _Fragment,
} from "react/jsx-runtime";
import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  Briefcase,
  Sparkles,
  Mail,
  FileCheck,
  Percent,
  X,
  RotateCcw,
  AlertTriangle,
  Download,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  User,
  ShieldCheck,
  Send,
  Zap,
} from "lucide-react";
import mammoth from "mammoth";
import {
  downloadResumeAsPdf,
  downloadResumeAsDocx,
  downloadCoverLetterPdf,
} from "./utils/documentGenerator";
import {
  trackEvent,
  getApplicationUsageCount,
  incrementApplicationUsageCount,
  saveWaitlistEmail,
} from "./utils/analytics";
const MAX_FREE_APPLICATIONS = 3;
export default function App() {
  // Navigation & Session
  const [currentPage, setCurrentPage] = useState("landing");
  const [applicationId, setApplicationId] = useState(() => crypto.randomUUID());
  const activeAppIdRef = useRef(applicationId);
  const abortControllerRef = useRef(null);
  // Application Inputs
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  // Processing, Progress & Error States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const [validationError, setValidationError] = useState(null);
  const [generationError, setGenerationError] = useState(null);
  // Results State (Editable in UI)
  const [resultData, setResultData] = useState(null);
  const [editableAnswers, setEditableAnswers] = useState([]);
  const [editableFactual, setEditableFactual] = useState({
    currentCtc: "",
    expectedCtc: "",
    noticePeriod: "",
    totalExperience: "",
    relevantExperience: "",
    currentLocation: "",
    preferredLocation: "",
  });
  const [editableCoverLetter, setEditableCoverLetter] = useState("");
  const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);
  // UI States
  const [copiedKey, setCopiedKey] = useState(null);
  const fileInputRef = useRef(null);
  // Feedback State
  const [feedbackGiven, setFeedbackGiven] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  // 3-Application Limit & Waitlist State
  const [usageCount, setUsageCount] = useState(() =>
    getApplicationUsageCount(),
  );
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistError, setWaitlistError] = useState(null);
  // Track initial landing view
  useEffect(() => {
    trackEvent("landing_view");
  }, []);
  useEffect(() => {
    activeAppIdRef.current = applicationId;
  }, [applicationId]);
  /**
   * Reset Application cleanly:
   * Clears all state, active generation requests, inputs, and results.
   */
  const resetApplication = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const newAppId = crypto.randomUUID();
    activeAppIdRef.current = newAppId;
    setApplicationId(newAppId);
    setResumeFile(null);
    setJobDescription("");
    setValidationError(null);
    setGenerationError(null);
    setIsAnalyzing(false);
    setProgressStage("");
    setResultData(null);
    setEditableAnswers([]);
    setEditableCoverLetter("");
    setIsEditingCoverLetter(false);
    setCopiedKey(null);
    setFeedbackGiven(null);
    setFeedbackComment("");
    setFeedbackSubmitted(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    trackEvent("prepare_another_application");
    setCurrentPage("application");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  /**
   * Process Uploaded File
   */
  const processUploadedFile = async (file) => {
    setValidationError(null);
    setGenerationError(null);
    const allowedExtensions = [".pdf", ".docx", ".doc", ".txt"];
    const fileExt = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      setValidationError(
        "Please upload a text-based PDF (.pdf) or Word document (.docx).",
      );
      return;
    }
    try {
      let extractedText = "";
      let base64 = "";
      const cleanExt = fileExt.replace(".", "") || "pdf";
      if (fileExt === ".docx") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (fileExt === ".txt") {
        extractedText = await file.text();
      }
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      base64 = await base64Promise;
      setResumeFile({
        name: file.name,
        size: file.size,
        type: file.type || cleanExt.toUpperCase(),
        extension: cleanExt,
        extractedText,
        base64,
      });
      trackEvent("resume_uploaded", {
        format: cleanExt,
      });
    } catch (err) {
      console.error("File reading error:", err);
      setValidationError(
        "Could not read this resume. Please upload a text-based PDF or DOCX.",
      );
    }
  };
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };
  /**
   * Submit Job & Analyze Application
   */
  const handleAnalyze = async () => {
    if (!resumeFile && !jobDescription.trim()) {
      setValidationError(
        "Please upload your resume and enter a job description to proceed.",
      );
      return;
    }
    if (!resumeFile) {
      setValidationError("Please upload your resume (PDF or DOCX).");
      return;
    }
    if (!jobDescription.trim()) {
      setValidationError("Please paste the job description.");
      return;
    }
    // Check 3 Free Application Limit
    const currentUsage = getApplicationUsageCount();
    if (currentUsage >= MAX_FREE_APPLICATIONS) {
      trackEvent("application_limit_reached");
      setShowWaitlistModal(true);
      return;
    }
    trackEvent("job_submitted");
    setValidationError(null);
    setGenerationError(null);
    setIsAnalyzing(true);
    setProgressStage("Reading your resume...");
    // Increment and record application usage
    const newUsage = incrementApplicationUsageCount();
    setUsageCount(newUsage);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const currentController = new AbortController();
    abortControllerRef.current = currentController;
    const currentAppId = applicationId;
    // Ordered Progress staging schedule
    const t1 = setTimeout(() => {
      if (activeAppIdRef.current === currentAppId)
        setProgressStage("Analyzing the job description...");
    }, 600);
    const t2 = setTimeout(() => {
      if (activeAppIdRef.current === currentAppId)
        setProgressStage("Comparing your experience...");
    }, 1300);
    const t3 = setTimeout(() => {
      if (activeAppIdRef.current === currentAppId)
        setProgressStage("Tailoring your resume...");
    }, 2000);
    const t4 = setTimeout(() => {
      if (activeAppIdRef.current === currentAppId)
        setProgressStage("Writing your cover letter...");
    }, 2800);
    const t5 = setTimeout(() => {
      if (activeAppIdRef.current === currentAppId)
        setProgressStage("Preparing application answers...");
    }, 3600);
    const t6 = setTimeout(() => {
      if (activeAppIdRef.current === currentAppId)
        setProgressStage("Preparing recruiter email...");
    }, 4400);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId: currentAppId,
          jobDescription: jobDescription.trim(),
          resumeFileName: resumeFile.name,
          resumeText: resumeFile.extractedText,
          resumeFileBase64: resumeFile.base64,
          resumeMimeType: resumeFile.type,
        }),
        signal: currentController.signal,
      });
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      if (activeAppIdRef.current !== currentAppId) {
        return;
      }
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error ||
            "Something went wrong while analyzing this application. Please try again.",
        );
      }
      const data = await response.json();
      if (activeAppIdRef.current !== currentAppId) {
        return;
      }
      // Record successful outputs generated
      trackEvent("analysis_completed");
      trackEvent("resume_generated");
      trackEvent("cover_letter_generated");
      trackEvent("answers_generated");
      trackEvent("email_generated");
      setResultData(data);
      setEditableAnswers(data.applicationAnswers?.screeningAnswers || []);
      setEditableFactual(
        data.applicationAnswers?.factualFields || {
          currentCtc: "Please enter this information.",
          expectedCtc: "Please enter this information.",
          noticePeriod: "Please enter this information.",
          totalExperience: "Please enter this information.",
          relevantExperience: "Please enter this information.",
          currentLocation: "Please enter this information.",
          preferredLocation: "Please enter this information.",
        },
      );
      setEditableCoverLetter(data.coverLetter || "");
      setIsAnalyzing(false);
      setProgressStage("");
      setCurrentPage("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
      if (
        err.name === "AbortError" ||
        activeAppIdRef.current !== currentAppId
      ) {
        return;
      }
      console.error("Generation error:", err);
      setIsAnalyzing(false);
      setProgressStage("");
      setGenerationError(
        err.message ||
          "Something went wrong while analyzing this application. Please try again.",
      );
    }
  };
  /**
   * Copy to Clipboard Helper
   */
  const copyToClipboard = (text, key, targetName) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    trackEvent("copy_clicked", { target: targetName });
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };
  /**
   * Handle Tailored Resume Download (preserves user format: PDF -> PDF, DOCX/DOC -> DOCX)
   */
  const handleDownloadResume = async () => {
    if (!resultData?.tailoredResume) return;
    const baseName = (resultData.candidateName || "Candidate").replace(
      /\s+/g,
      "_",
    );
    const roleSlug = (resultData.targetRole || "Role").replace(/\s+/g, "_");
    const isDocx =
      resumeFile?.extension === "docx" || resumeFile?.extension === "doc";
    if (isDocx) {
      const filename = `${baseName}_${roleSlug}_Resume.docx`;
      await downloadResumeAsDocx(resultData.tailoredResume, filename);
      trackEvent("resume_downloaded", { format: "docx" });
    } else {
      const filename = `${baseName}_${roleSlug}_Resume.pdf`;
      downloadResumeAsPdf(resultData.tailoredResume, filename);
      trackEvent("resume_downloaded", { format: "pdf" });
    }
  };
  /**
   * Handle Cover Letter Download (PDF)
   */
  const handleDownloadCoverLetter = () => {
    if (!resultData) return;
    const baseName = (resultData.candidateName || "Candidate").replace(
      /\s+/g,
      "_",
    );
    const roleSlug = (resultData.targetRole || "Role").replace(/\s+/g, "_");
    const filename = `${baseName}_${roleSlug}_Cover_Letter.pdf`;
    const letterToDownload = editableCoverLetter || resultData.coverLetter;
    downloadCoverLetterPdf(
      letterToDownload,
      resultData.candidateName || "Candidate",
      resultData.targetRole || "Role",
      resultData.targetCompany || "Company",
      filename,
    );
    trackEvent("cover_letter_downloaded");
  };
  /**
   * Handle Waitlist Submission
   */
  const handleWaitlistSubmit = (e) => {
    e.preventDefault();
    if (!waitlistEmail.trim() || !waitlistEmail.includes("@")) {
      setWaitlistError("Please enter a valid email address.");
      return;
    }
    saveWaitlistEmail(waitlistEmail.trim());
    trackEvent("waitlist_submitted");
    setWaitlistSuccess(true);
    setWaitlistError(null);
  };
  /**
   * Handle Feedback Submission
   */
  const handleFeedbackSubmit = (rating) => {
    setFeedbackGiven(rating);
    if (rating === "yes") {
      setFeedbackSubmitted(true);
      trackEvent("feedback_submitted", { rating: "yes" });
    }
  };
  const handleDetailedFeedbackSubmit = () => {
    setFeedbackSubmitted(true);
    trackEvent("feedback_submitted", {
      rating: "no",
    });
  };
  /**
   * Formatted Text for Tailored Resume Copy
   */
  const getFullResumeCopyText = () => {
    if (!resultData?.tailoredResume) return "";
    const res = resultData.tailoredResume;
    let text = `${res.candidateName.toUpperCase()}\n`;
    const contacts = [];
    if (res.contactInfo?.email) contacts.push(res.contactInfo.email);
    if (res.contactInfo?.phone) contacts.push(res.contactInfo.phone);
    if (res.contactInfo?.location) contacts.push(res.contactInfo.location);
    if (res.contactInfo?.linkedin) contacts.push(res.contactInfo.linkedin);
    if (contacts.length > 0) text += `${contacts.join(" | ")}\n\n`;
    if (res.professionalSummary) {
      text += `PROFESSIONAL SUMMARY\n${res.professionalSummary}\n\n`;
    }
    if (res.skillsGroups && res.skillsGroups.length > 0) {
      text += `TECHNICAL SKILLS\n`;
      res.skillsGroups.forEach((g) => {
        text += `${g.category}: ${g.skills.join(", ")}\n`;
      });
      text += `\n`;
    }
    if (res.workExperience && res.workExperience.length > 0) {
      text += `WORK EXPERIENCE\n`;
      res.workExperience.forEach((w) => {
        text += `${w.role} | ${w.company} (${w.duration})\n`;
        w.bullets.forEach((b) => {
          text += `• ${b}\n`;
        });
        text += `\n`;
      });
    }
    if (res.projects && res.projects.length > 0) {
      text += `KEY PROJECTS\n`;
      res.projects.forEach((p) => {
        text += `${p.name}${p.technologies ? ` (${p.technologies.join(", ")})` : ""}\n`;
        if (p.description) text += `${p.description}\n`;
        if (p.bullets) {
          p.bullets.forEach((b) => {
            text += `• ${b}\n`;
          });
        }
        text += `\n`;
      });
    }
    if (res.education && res.education.length > 0) {
      text += `EDUCATION\n`;
      res.education.forEach((e) => {
        text += `${e.degree} - ${e.institution}${e.year ? ` (${e.year})` : ""}\n`;
      });
      text += `\n`;
    }
    if (res.certifications && res.certifications.length > 0) {
      text += `CERTIFICATIONS\n`;
      res.certifications.forEach((c) => {
        text += `• ${c}\n`;
      });
    }
    return text.trim();
  };
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };
  return _jsxs("div", {
    className:
      "min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white",
    children: [
      _jsx("header", {
        className:
          "sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200",
        children: _jsxs("div", {
          className:
            "max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between",
          children: [
            _jsxs("button", {
              onClick: () => {
                setCurrentPage("landing");
                trackEvent("landing_view");
              },
              className:
                "text-xl font-bold tracking-tight text-slate-950 hover:text-slate-700 transition flex items-center gap-2",
              children: [
                _jsx("div", {
                  className:
                    "w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-sm",
                  children: "AS",
                }),
                _jsx("span", { children: "ApplySmart" }),
              ],
            }),
            _jsxs("nav", {
              className:
                "hidden md:flex items-center gap-6 text-sm font-medium text-slate-600",
              children: [
                _jsx("button", {
                  onClick: () => {
                    setCurrentPage("landing");
                    trackEvent("landing_view");
                  },
                  className: `hover:text-slate-950 transition ${currentPage === "landing" ? "text-slate-950 font-semibold" : ""}`,
                  children: "Overview",
                }),
                _jsx("button", {
                  onClick: () => {
                    if (currentPage === "landing") {
                      trackEvent("start_application");
                    }
                    setCurrentPage("application");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  },
                  className: `hover:text-slate-950 transition ${currentPage === "application" ? "text-slate-950 font-semibold" : ""}`,
                  children: "Prepare Application",
                }),
                currentPage === "result" &&
                  resultData &&
                  _jsxs("button", {
                    onClick: () => setCurrentPage("result"),
                    className:
                      "text-slate-950 font-semibold flex items-center gap-1.5",
                    children: [
                      _jsx("span", {
                        className: "w-2 h-2 rounded-full bg-emerald-500",
                      }),
                      "Active Application",
                    ],
                  }),
              ],
            }),
            _jsx("div", {
              className: "flex items-center gap-3",
              children:
                currentPage === "result"
                  ? _jsxs("button", {
                      onClick: resetApplication,
                      className:
                        "px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm",
                      children: [
                        _jsx(RefreshCw, { className: "w-3.5 h-3.5" }),
                        _jsx("span", {
                          children: "Prepare Another Application",
                        }),
                      ],
                    })
                  : currentPage === "application"
                    ? _jsxs("button", {
                        onClick: resetApplication,
                        className:
                          "px-3.5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-xl transition flex items-center gap-1.5 whitespace-nowrap shrink-0",
                        children: [
                          _jsx(RotateCcw, {
                            className: "w-3.5 h-3.5 text-slate-500",
                          }),
                          _jsx("span", { children: "Reset Inputs" }),
                        ],
                      })
                    : _jsx("button", {
                        onClick: () => {
                          trackEvent("start_application");
                          setCurrentPage("application");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        },
                        className:
                          "px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition whitespace-nowrap shrink-0 shadow-sm",
                        children: "Prepare My Application \u2014 Free",
                      }),
            }),
          ],
        }),
      }),
      _jsxs("main", {
        className: "flex-1",
        children: [
          currentPage === "landing" &&
            _jsx("div", {
              children: _jsxs("section", {
                className:
                  "py-20 sm:py-28 px-4 sm:px-6 max-w-5xl mx-auto text-center",
                children: [
                  _jsxs("div", {
                    className:
                      "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 mb-6",
                    children: [
                      _jsx(Sparkles, {
                        className: "w-3.5 h-3.5 text-slate-700",
                      }),
                      _jsx("span", {
                        children:
                          "Tailored ATS Resume \u2022 Cover Letter \u2022 Interview Answers \u2022 Recruiter Email",
                      }),
                    ],
                  }),
                  _jsx("h1", {
                    className:
                      "text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 max-w-4xl mx-auto leading-[1.12]",
                    children:
                      "Stop preparing every job application from scratch.",
                  }),
                  _jsx("p", {
                    className:
                      "mt-6 text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed",
                    children:
                      "Upload your resume + paste the job description. Get your tailored resume, cover letter, application answers and recruiter email ready in minutes.",
                  }),
                  _jsx("div", {
                    className:
                      "mt-10 flex flex-col sm:flex-row items-center justify-center gap-4",
                    children: _jsxs("button", {
                      onClick: () => {
                        trackEvent("start_application");
                        setCurrentPage("application");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      },
                      className:
                        "w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-2 group whitespace-nowrap shrink-0",
                      children: [
                        _jsx("span", {
                          children: "Prepare My Application \u2014 Free",
                        }),
                        _jsx(ArrowRight, {
                          className:
                            "w-4 h-4 group-hover:translate-x-1 transition-transform",
                        }),
                      ],
                    }),
                  }),
                  _jsx("p", {
                    className:
                      "mt-3 text-xs sm:text-sm text-slate-500 font-medium",
                    children: "3 applications free.",
                  }),
                  _jsxs("div", {
                    className:
                      "mt-16 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-left",
                    children: [
                      _jsxs("div", {
                        className:
                          "border-b border-slate-100 pb-4 mb-6 flex items-center justify-between",
                        children: [
                          _jsxs("div", {
                            className: "flex items-center gap-2",
                            children: [
                              _jsx("span", {
                                className:
                                  "w-2.5 h-2.5 rounded-full bg-slate-300",
                              }),
                              _jsx("span", {
                                className:
                                  "w-2.5 h-2.5 rounded-full bg-slate-300",
                              }),
                              _jsx("span", {
                                className:
                                  "w-2.5 h-2.5 rounded-full bg-slate-300",
                              }),
                              _jsx("span", {
                                className:
                                  "ml-2 text-xs font-semibold uppercase tracking-wider text-slate-400",
                                children: "Everything generated in one go",
                              }),
                            ],
                          }),
                          _jsx("span", {
                            className: "text-xs text-slate-500 font-medium",
                            children: "Anti-hallucination grounded",
                          }),
                        ],
                      }),
                      _jsxs("div", {
                        className:
                          "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
                        children: [
                          _jsxs("div", {
                            className:
                              "p-4 rounded-xl bg-slate-50 border border-slate-200",
                            children: [
                              _jsx("div", {
                                className:
                                  "w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-2.5",
                                children: "1",
                              }),
                              _jsx("h2", {
                                className: "text-sm font-bold text-slate-900",
                                children: "Tailored ATS Resume",
                              }),
                              _jsx("p", {
                                className:
                                  "mt-1 text-xs text-slate-600 leading-relaxed",
                                children:
                                  "Optimized for target keywords while strictly preserving truthful experience. Downloadable as PDF or DOCX.",
                              }),
                            ],
                          }),
                          _jsxs("div", {
                            className:
                              "p-4 rounded-xl bg-slate-50 border border-slate-200",
                            children: [
                              _jsx("div", {
                                className:
                                  "w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-2.5",
                                children: "2",
                              }),
                              _jsx("h2", {
                                className: "text-sm font-bold text-slate-900",
                                children: "Custom Cover Letter",
                              }),
                              _jsx("p", {
                                className:
                                  "mt-1 text-xs text-slate-600 leading-relaxed",
                                children:
                                  "Concise, professional letter tailored to the specific role and company. Downloadable as PDF.",
                              }),
                            ],
                          }),
                          _jsxs("div", {
                            className:
                              "p-4 rounded-xl bg-slate-50 border border-slate-200",
                            children: [
                              _jsx("div", {
                                className:
                                  "w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-2.5",
                                children: "3",
                              }),
                              _jsx("h2", {
                                className: "text-sm font-bold text-slate-900",
                                children: "Application Answers",
                              }),
                              _jsx("p", {
                                className:
                                  "mt-1 text-xs text-slate-600 leading-relaxed",
                                children:
                                  "Grounded answers to common screening questions + factual portal fields with inline editing.",
                              }),
                            ],
                          }),
                          _jsxs("div", {
                            className:
                              "p-4 rounded-xl bg-slate-50 border border-slate-200",
                            children: [
                              _jsx("div", {
                                className:
                                  "w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-2.5",
                                children: "4",
                              }),
                              _jsx("h2", {
                                className: "text-sm font-bold text-slate-900",
                                children: "Recruiter Email",
                              }),
                              _jsx("p", {
                                className:
                                  "mt-1 text-xs text-slate-600 leading-relaxed",
                                children:
                                  "Direct cold outreach message and subject line ready to copy and send to hiring managers.",
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            }),
          currentPage === "application" &&
            _jsxs("div", {
              className: "py-10 sm:py-14 px-4 sm:px-6 max-w-4xl mx-auto",
              children: [
                _jsxs("div", {
                  className: "mb-8",
                  children: [
                    _jsxs("div", {
                      className:
                        "flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2",
                      children: [
                        _jsx("span", { children: "Application Input" }),
                        _jsx("span", { children: "\u2022" }),
                        _jsx("span", { children: "Job & Resume" }),
                        usageCount > 0 &&
                          _jsxs("span", {
                            className:
                              "ml-auto text-slate-400 font-mono text-[11px] normal-case",
                            children: [
                              "Used ",
                              usageCount,
                              " of ",
                              MAX_FREE_APPLICATIONS,
                              " free",
                            ],
                          }),
                      ],
                    }),
                    _jsx("h1", {
                      className:
                        "text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight",
                      children: "Prepare Your Application",
                    }),
                    _jsx("p", {
                      className: "mt-2 text-slate-600 text-base",
                      children:
                        "Upload your resume and paste the target job description to generate your complete application package.",
                    }),
                  ],
                }),
                validationError &&
                  _jsxs("div", {
                    className:
                      "mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 text-sm",
                    children: [
                      _jsx(AlertCircle, {
                        className: "w-5 h-5 text-red-600 shrink-0 mt-0.5",
                      }),
                      _jsx("div", {
                        className: "flex-1",
                        children: _jsx("p", {
                          className: "font-medium",
                          children: validationError,
                        }),
                      }),
                      _jsx("button", {
                        onClick: () => setValidationError(null),
                        className: "text-red-500 hover:text-red-700",
                        children: _jsx(X, { className: "w-4 h-4" }),
                      }),
                    ],
                  }),
                generationError &&
                  _jsxs("div", {
                    className:
                      "mb-6 p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm",
                    children: [
                      _jsxs("div", {
                        className: "flex items-start gap-3",
                        children: [
                          _jsx(AlertTriangle, {
                            className: "w-5 h-5 text-amber-600 shrink-0 mt-0.5",
                          }),
                          _jsxs("div", {
                            children: [
                              _jsx("p", {
                                className: "font-semibold text-amber-900",
                                children:
                                  "Application generation encountered an issue.",
                              }),
                              _jsx("p", {
                                className: "text-xs text-amber-700 mt-0.5",
                                children: generationError,
                              }),
                            ],
                          }),
                        ],
                      }),
                      _jsx("button", {
                        type: "button",
                        onClick: handleAnalyze,
                        className:
                          "px-4 py-2 bg-amber-900 hover:bg-amber-800 text-white font-medium rounded-lg text-xs transition whitespace-nowrap shrink-0",
                        children: "Retry",
                      }),
                    ],
                  }),
                _jsxs("div", {
                  className: "space-y-6",
                  children: [
                    _jsxs("div", {
                      className:
                        "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm",
                      children: [
                        _jsxs("div", {
                          className: "flex items-center justify-between mb-4",
                          children: [
                            _jsxs("div", {
                              children: [
                                _jsxs("h2", {
                                  className:
                                    "text-lg font-bold text-slate-950 flex items-center gap-2",
                                  children: [
                                    _jsx(FileText, {
                                      className: "w-5 h-5 text-slate-700",
                                    }),
                                    _jsx("span", {
                                      children: "Original Resume",
                                    }),
                                  ],
                                }),
                                _jsx("p", {
                                  className:
                                    "text-xs sm:text-sm text-slate-500 mt-0.5",
                                  children:
                                    "Upload your current PDF or Word (.docx, .doc) resume",
                                }),
                              ],
                            }),
                            resumeFile &&
                              _jsxs("span", {
                                className:
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium",
                                children: [
                                  _jsx(Check, { className: "w-3.5 h-3.5" }),
                                  "Loaded",
                                ],
                              }),
                          ],
                        }),
                        _jsx("input", {
                          type: "file",
                          ref: fileInputRef,
                          onChange: handleFileUpload,
                          accept: ".pdf,.docx,.doc,.txt",
                          className: "hidden",
                        }),
                        !resumeFile
                          ? _jsxs("div", {
                              onDragOver: (e) => e.preventDefault(),
                              onDrop: handleDrop,
                              onClick: () => fileInputRef.current?.click(),
                              className:
                                "border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-50 rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3",
                              children: [
                                _jsx("div", {
                                  className:
                                    "w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center",
                                  children: _jsx(Upload, {
                                    className: "w-6 h-6",
                                  }),
                                }),
                                _jsxs("div", {
                                  children: [
                                    _jsx("p", {
                                      className:
                                        "text-sm font-semibold text-slate-900",
                                      children:
                                        "Click to select resume or drag and drop",
                                    }),
                                    _jsx("p", {
                                      className: "text-xs text-slate-500 mt-1",
                                      children: "PDF or DOCX (max 10MB)",
                                    }),
                                  ],
                                }),
                                _jsx("button", {
                                  type: "button",
                                  className:
                                    "mt-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition whitespace-nowrap shadow-sm",
                                  children: "Browse Files",
                                }),
                              ],
                            })
                          : _jsxs("div", {
                              className:
                                "p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between",
                              children: [
                                _jsxs("div", {
                                  className: "flex items-center gap-3",
                                  children: [
                                    _jsx("div", {
                                      className:
                                        "w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase",
                                      children:
                                        resumeFile.extension.toUpperCase(),
                                    }),
                                    _jsxs("div", {
                                      children: [
                                        _jsx("p", {
                                          className:
                                            "text-sm font-semibold text-slate-900 truncate max-w-xs sm:max-w-md",
                                          children: resumeFile.name,
                                        }),
                                        _jsx("p", {
                                          className: "text-xs text-slate-500",
                                          children: formatFileSize(
                                            resumeFile.size,
                                          ),
                                        }),
                                      ],
                                    }),
                                  ],
                                }),
                                _jsxs("div", {
                                  className: "flex items-center gap-2",
                                  children: [
                                    _jsx("button", {
                                      type: "button",
                                      onClick: () =>
                                        fileInputRef.current?.click(),
                                      className:
                                        "px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition whitespace-nowrap",
                                      children: "Change File",
                                    }),
                                    _jsx("button", {
                                      type: "button",
                                      onClick: () => {
                                        setResumeFile(null);
                                        if (fileInputRef.current)
                                          fileInputRef.current.value = "";
                                      },
                                      className:
                                        "p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-200/50 transition",
                                      title: "Remove file",
                                      children: _jsx(X, {
                                        className: "w-4 h-4",
                                      }),
                                    }),
                                  ],
                                }),
                              ],
                            }),
                        _jsxs("div", {
                          className:
                            "mt-3.5 flex items-start gap-2 text-slate-500 text-xs leading-relaxed bg-slate-50/80 p-3 rounded-lg border border-slate-200/80",
                          children: [
                            _jsx(ShieldCheck, {
                              className:
                                "w-4 h-4 text-slate-500 shrink-0 mt-0.5",
                            }),
                            _jsx("span", {
                              children:
                                "Your resume is processed only to prepare this application. Do not upload sensitive documents you do not want processed.",
                            }),
                          ],
                        }),
                      ],
                    }),
                    _jsxs("div", {
                      className:
                        "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm",
                      children: [
                        _jsx("div", {
                          className:
                            "flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4",
                          children: _jsxs("div", {
                            children: [
                              _jsxs("h2", {
                                className:
                                  "text-lg font-bold text-slate-950 flex items-center gap-2",
                                children: [
                                  _jsx(Briefcase, {
                                    className: "w-5 h-5 text-slate-700",
                                  }),
                                  _jsx("span", {
                                    children: "Target Job Description",
                                  }),
                                ],
                              }),
                              _jsx("p", {
                                className:
                                  "text-xs sm:text-sm text-slate-500 mt-0.5",
                                children:
                                  "Paste the role title, responsibilities, requirements, and company details",
                              }),
                            ],
                          }),
                        }),
                        _jsxs("div", {
                          className: "relative",
                          children: [
                            _jsx("textarea", {
                              rows: 8,
                              value: jobDescription,
                              onChange: (e) => {
                                setJobDescription(e.target.value);
                                if (validationError) setValidationError(null);
                                if (generationError) setGenerationError(null);
                              },
                              placeholder: "Paste the job description here...",
                              className:
                                "w-full rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 p-4 text-sm text-slate-900 placeholder:text-slate-400 leading-relaxed font-sans outline-none resize-y transition bg-slate-50/30",
                            }),
                            jobDescription.length > 0 &&
                              _jsxs("div", {
                                className:
                                  "absolute bottom-3 right-3 text-[11px] text-slate-400 font-mono bg-white/90 px-2 py-0.5 rounded border border-slate-200",
                                children: [jobDescription.length, " chars"],
                              }),
                          ],
                        }),
                      ],
                    }),
                    _jsxs("div", {
                      className:
                        "flex flex-col sm:flex-row items-center justify-between gap-4 pt-2",
                      children: [
                        _jsxs("button", {
                          type: "button",
                          onClick: resetApplication,
                          className:
                            "w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-1.5",
                          children: [
                            _jsx(RotateCcw, { className: "w-3.5 h-3.5" }),
                            _jsx("span", { children: "Reset All Inputs" }),
                          ],
                        }),
                        _jsx("button", {
                          type: "button",
                          disabled: isAnalyzing,
                          onClick: handleAnalyze,
                          className: `w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-3 whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${isAnalyzing ? "opacity-90 cursor-wait" : ""}`,
                          children: isAnalyzing
                            ? _jsxs(_Fragment, {
                                children: [
                                  _jsx(RefreshCw, {
                                    className:
                                      "w-5 h-5 animate-spin text-white",
                                  }),
                                  _jsx("span", {
                                    children:
                                      progressStage ||
                                      "Preparing Application...",
                                  }),
                                ],
                              })
                            : _jsxs(_Fragment, {
                                children: [
                                  _jsx("span", {
                                    children: "Generate Complete Application",
                                  }),
                                  _jsx(ArrowRight, { className: "w-5 h-5" }),
                                ],
                              }),
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          currentPage === "result" &&
            resultData &&
            _jsxs("div", {
              className:
                "py-10 sm:py-14 px-4 sm:px-6 max-w-5xl mx-auto space-y-10",
              children: [
                _jsxs("div", {
                  className:
                    "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm",
                  children: [
                    _jsxs("div", {
                      className:
                        "flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6 mb-6",
                      children: [
                        _jsxs("div", {
                          children: [
                            _jsxs("div", {
                              className:
                                "flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2",
                              children: [
                                _jsx("span", {
                                  className:
                                    "w-2 h-2 rounded-full bg-emerald-500",
                                }),
                                _jsx("span", {
                                  children: "Application Package Ready",
                                }),
                                _jsx("span", { children: "\u2022" }),
                                _jsx("span", {
                                  children: resultData.targetRole,
                                }),
                              ],
                            }),
                            _jsx("h1", {
                              className:
                                "text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight",
                              children: "Complete Job Application",
                            }),
                            _jsxs("p", {
                              className:
                                "mt-1.5 text-slate-600 text-sm sm:text-base",
                              children: [
                                "Candidate: ",
                                _jsx("strong", {
                                  className: "text-slate-900 font-semibold",
                                  children: resultData.candidateName,
                                }),
                                " \u2022 Target Company: ",
                                _jsx("strong", {
                                  className: "text-slate-900 font-semibold",
                                  children: resultData.targetCompany,
                                }),
                              ],
                            }),
                          ],
                        }),
                        _jsx("div", {
                          className: "flex flex-wrap items-center gap-3",
                          children: _jsxs("button", {
                            onClick: resetApplication,
                            className:
                              "px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm",
                            children: [
                              _jsx(RefreshCw, { className: "w-4 h-4" }),
                              _jsx("span", {
                                children: "Prepare Another Application",
                              }),
                            ],
                          }),
                        }),
                      ],
                    }),
                    _jsxs("div", {
                      className: "flex flex-wrap items-center gap-2.5",
                      children: [
                        _jsxs("button", {
                          onClick: handleDownloadResume,
                          className:
                            "px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition flex items-center gap-2 whitespace-nowrap shadow-sm",
                          children: [
                            _jsx(Download, { className: "w-3.5 h-3.5" }),
                            _jsxs("span", {
                              children: [
                                "Download Tailored Resume (",
                                resumeFile?.extension === "docx" ||
                                resumeFile?.extension === "doc"
                                  ? "DOCX"
                                  : "PDF",
                                ")",
                              ],
                            }),
                          ],
                        }),
                        _jsx("button", {
                          onClick: () => {
                            const text = getFullResumeCopyText();
                            copyToClipboard(
                              text,
                              "full-resume",
                              "tailored_resume",
                            );
                          },
                          className:
                            "px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition flex items-center gap-1.5 whitespace-nowrap",
                          children:
                            copiedKey === "full-resume"
                              ? _jsxs(_Fragment, {
                                  children: [
                                    _jsx(Check, {
                                      className: "w-3.5 h-3.5 text-emerald-600",
                                    }),
                                    _jsx("span", { children: "Copied Resume" }),
                                  ],
                                })
                              : _jsxs(_Fragment, {
                                  children: [
                                    _jsx(Copy, { className: "w-3.5 h-3.5" }),
                                    _jsx("span", { children: "Copy Resume" }),
                                  ],
                                }),
                        }),
                        _jsxs("button", {
                          onClick: handleDownloadCoverLetter,
                          className:
                            "px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition flex items-center gap-1.5 whitespace-nowrap",
                          children: [
                            _jsx(Download, { className: "w-3.5 h-3.5" }),
                            _jsx("span", {
                              children: "Download Cover Letter (PDF)",
                            }),
                          ],
                        }),
                        _jsx("button", {
                          onClick: () => {
                            copyToClipboard(
                              editableCoverLetter || resultData.coverLetter,
                              "cover-letter",
                              "cover_letter",
                            );
                          },
                          className:
                            "px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition flex items-center gap-1.5 whitespace-nowrap",
                          children:
                            copiedKey === "cover-letter"
                              ? _jsxs(_Fragment, {
                                  children: [
                                    _jsx(Check, {
                                      className: "w-3.5 h-3.5 text-emerald-600",
                                    }),
                                    _jsx("span", {
                                      children: "Copied Cover Letter",
                                    }),
                                  ],
                                })
                              : _jsxs(_Fragment, {
                                  children: [
                                    _jsx(Copy, { className: "w-3.5 h-3.5" }),
                                    _jsx("span", {
                                      children: "Copy Cover Letter",
                                    }),
                                  ],
                                }),
                        }),
                        _jsx("button", {
                          onClick: () => {
                            const emailContent = `SUBJECT: ${resultData.recruiterEmail?.subject}\n\n${resultData.recruiterEmail?.body}`;
                            copyToClipboard(
                              emailContent,
                              "recruiter-email",
                              "recruiter_email",
                            );
                          },
                          className:
                            "px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition flex items-center gap-1.5 whitespace-nowrap",
                          children:
                            copiedKey === "recruiter-email"
                              ? _jsxs(_Fragment, {
                                  children: [
                                    _jsx(Check, {
                                      className: "w-3.5 h-3.5 text-emerald-600",
                                    }),
                                    _jsx("span", { children: "Copied Email" }),
                                  ],
                                })
                              : _jsxs(_Fragment, {
                                  children: [
                                    _jsx(Copy, { className: "w-3.5 h-3.5" }),
                                    _jsx("span", { children: "Copy Email" }),
                                  ],
                                }),
                        }),
                      ],
                    }),
                  ],
                }),
                _jsxs("section", {
                  className:
                    "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm",
                  children: [
                    _jsxs("div", {
                      className:
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6",
                      children: [
                        _jsxs("div", {
                          children: [
                            _jsx("span", {
                              className:
                                "text-[11px] font-bold tracking-wider uppercase text-slate-400",
                              children: "Output 1",
                            }),
                            _jsxs("h2", {
                              className:
                                "text-xl font-bold text-slate-950 flex items-center gap-2",
                              children: [
                                _jsx(Percent, {
                                  className: "w-5 h-5 text-slate-800",
                                }),
                                _jsx("span", { children: "JOB MATCH" }),
                              ],
                            }),
                          ],
                        }),
                        _jsx("div", {
                          className: "flex items-center gap-3",
                          children: _jsxs("div", {
                            className:
                              "px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-sm",
                            children: [resultData.matchScore, "% Match Score"],
                          }),
                        }),
                      ],
                    }),
                    _jsxs("div", {
                      className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6",
                      children: [
                        _jsxs("div", {
                          className:
                            "p-4 rounded-xl bg-slate-50 border border-slate-200",
                          children: [
                            _jsx("div", {
                              className:
                                "text-xs font-semibold uppercase text-slate-500 mb-1",
                              children: "Target Role",
                            }),
                            _jsx("div", {
                              className:
                                "text-base font-bold text-slate-900 truncate",
                              children: resultData.targetRole,
                            }),
                            _jsx("div", {
                              className:
                                "text-xs text-slate-500 mt-0.5 truncate",
                              children: resultData.targetCompany,
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className:
                            "p-4 rounded-xl bg-slate-50 border border-slate-200",
                          children: [
                            _jsx("div", {
                              className:
                                "text-xs font-semibold uppercase text-slate-500 mb-1",
                              children: "Candidate Profile",
                            }),
                            _jsx("div", {
                              className:
                                "text-base font-bold text-slate-900 truncate",
                              children: resultData.candidateName,
                            }),
                            _jsx("div", {
                              className:
                                "text-xs text-emerald-700 mt-0.5 font-medium truncate",
                              children: resultData.matchCategory,
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className:
                            "p-4 rounded-xl bg-slate-50 border border-slate-200",
                          children: [
                            _jsx("div", {
                              className:
                                "text-xs font-semibold uppercase text-slate-500 mb-1",
                              children: "Source Resume",
                            }),
                            _jsx("div", {
                              className:
                                "text-base font-bold text-slate-900 truncate",
                              children: resumeFile?.name || "Uploaded Document",
                            }),
                            _jsxs("div", {
                              className: "text-xs text-slate-500 mt-0.5",
                              children: [
                                resultData.matchedSkills?.length || 0,
                                " matched competencies",
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                    resultData.matchExplanation &&
                      _jsxs("div", {
                        className:
                          "mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed",
                        children: [
                          _jsx("p", {
                            className:
                              "font-semibold text-slate-900 text-xs uppercase tracking-wider mb-1",
                            children: "Alignment Analysis",
                          }),
                          resultData.matchExplanation,
                        ],
                      }),
                    _jsxs("div", {
                      className: "space-y-4",
                      children: [
                        resultData.matchedSkills &&
                          resultData.matchedSkills.length > 0 &&
                          _jsxs("div", {
                            children: [
                              _jsx("h3", {
                                className:
                                  "text-xs font-bold uppercase tracking-wider text-slate-500 mb-2",
                                children:
                                  "Matched Skills & Requirements (Found in Resume)",
                              }),
                              _jsx("div", {
                                className: "flex flex-wrap gap-2",
                                children: resultData.matchedSkills.map(
                                  (skill, idx) =>
                                    _jsxs(
                                      "span",
                                      {
                                        className:
                                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium",
                                        children: [
                                          _jsx(Check, {
                                            className:
                                              "w-3 h-3 text-emerald-600 shrink-0",
                                          }),
                                          skill,
                                        ],
                                      },
                                      idx,
                                    ),
                                ),
                              }),
                            ],
                          }),
                        resultData.missingSkills &&
                          resultData.missingSkills.length > 0 &&
                          _jsxs("div", {
                            children: [
                              _jsx("h3", {
                                className:
                                  "text-xs font-bold uppercase tracking-wider text-slate-500 mb-2",
                                children: "Job Requirements Absent From Resume",
                              }),
                              _jsx("div", {
                                className: "flex flex-wrap gap-2",
                                children: resultData.missingSkills.map(
                                  (item, idx) =>
                                    _jsxs(
                                      "span",
                                      {
                                        className:
                                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium",
                                        children: [
                                          _jsx("span", {
                                            className:
                                              "w-1.5 h-1.5 rounded-full bg-slate-400",
                                          }),
                                          item.includes("Not found in resume")
                                            ? item
                                            : `${item} (Not found in resume)`,
                                        ],
                                      },
                                      idx,
                                    ),
                                ),
                              }),
                            ],
                          }),
                        resultData.recommendedKeywords &&
                          resultData.recommendedKeywords.length > 0 &&
                          _jsxs("div", {
                            children: [
                              _jsx("h3", {
                                className:
                                  "text-xs font-bold uppercase tracking-wider text-slate-500 mb-2",
                                children: "Keywords to Emphasize",
                              }),
                              _jsx("div", {
                                className: "flex flex-wrap gap-2",
                                children: resultData.recommendedKeywords.map(
                                  (kw, idx) =>
                                    _jsxs(
                                      "span",
                                      {
                                        className:
                                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium",
                                        children: [
                                          _jsx(Sparkles, {
                                            className:
                                              "w-3 h-3 text-amber-600 shrink-0",
                                          }),
                                          kw,
                                        ],
                                      },
                                      idx,
                                    ),
                                ),
                              }),
                            ],
                          }),
                      ],
                    }),
                  ],
                }),
                _jsxs("section", {
                  className:
                    "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm",
                  children: [
                    _jsxs("div", {
                      className:
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6",
                      children: [
                        _jsxs("div", {
                          children: [
                            _jsx("span", {
                              className:
                                "text-[11px] font-bold tracking-wider uppercase text-slate-400",
                              children: "Output 2",
                            }),
                            _jsxs("h2", {
                              className:
                                "text-xl font-bold text-slate-950 flex items-center gap-2",
                              children: [
                                _jsx(FileCheck, {
                                  className: "w-5 h-5 text-slate-800",
                                }),
                                _jsx("span", { children: "TAILORED RESUME" }),
                              ],
                            }),
                            _jsx("p", {
                              className: "text-xs text-slate-500 mt-0.5",
                              children:
                                "Grounded strictly in original resume experience \u2022 Preserves structure and verified accomplishments",
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className: "flex flex-wrap items-center gap-2",
                          children: [
                            _jsx("button", {
                              onClick: () => {
                                const text = getFullResumeCopyText();
                                copyToClipboard(
                                  text,
                                  "resume-section",
                                  "tailored_resume",
                                );
                              },
                              className:
                                "px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition inline-flex items-center gap-1.5 whitespace-nowrap",
                              children:
                                copiedKey === "resume-section"
                                  ? _jsxs(_Fragment, {
                                      children: [
                                        _jsx(Check, {
                                          className:
                                            "w-3.5 h-3.5 text-emerald-600",
                                        }),
                                        _jsx("span", {
                                          children: "Copied Resume",
                                        }),
                                      ],
                                    })
                                  : _jsxs(_Fragment, {
                                      children: [
                                        _jsx(Copy, {
                                          className: "w-3.5 h-3.5",
                                        }),
                                        _jsx("span", {
                                          children: "Copy Resume",
                                        }),
                                      ],
                                    }),
                            }),
                            _jsxs("button", {
                              onClick: handleDownloadResume,
                              className:
                                "px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm",
                              children: [
                                _jsx(Download, { className: "w-3.5 h-3.5" }),
                                _jsx("span", {
                                  children: "Download Tailored Resume",
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                    _jsxs("div", {
                      className:
                        "p-6 sm:p-8 rounded-xl bg-slate-50/70 border border-slate-200 text-slate-900 space-y-6 font-sans",
                      children: [
                        _jsxs("div", {
                          className: "border-b border-slate-300 pb-4",
                          children: [
                            _jsx("h3", {
                              className:
                                "text-2xl font-bold text-slate-950 tracking-tight",
                              children:
                                resultData.tailoredResume?.candidateName ||
                                resultData.candidateName,
                            }),
                            resultData.tailoredResume?.contactInfo &&
                              _jsx("p", {
                                className:
                                  "text-xs text-slate-600 mt-1 flex flex-wrap gap-2",
                                children: [
                                  resultData.tailoredResume.contactInfo.email,
                                  resultData.tailoredResume.contactInfo.phone,
                                  resultData.tailoredResume.contactInfo
                                    .location,
                                  resultData.tailoredResume.contactInfo
                                    .linkedin,
                                ]
                                  .filter(Boolean)
                                  .join(" | "),
                              }),
                          ],
                        }),
                        resultData.tailoredResume?.professionalSummary &&
                          _jsxs("div", {
                            children: [
                              _jsx("h4", {
                                className:
                                  "text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2",
                                children: "Professional Summary",
                              }),
                              _jsx("p", {
                                className:
                                  "text-sm text-slate-800 leading-relaxed",
                                children:
                                  resultData.tailoredResume.professionalSummary,
                              }),
                            ],
                          }),
                        resultData.tailoredResume?.skillsGroups &&
                          resultData.tailoredResume.skillsGroups.length > 0 &&
                          _jsxs("div", {
                            children: [
                              _jsx("h4", {
                                className:
                                  "text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2",
                                children: "Technical Skills & Competencies",
                              }),
                              _jsx("div", {
                                className: "space-y-1 text-xs sm:text-sm",
                                children:
                                  resultData.tailoredResume.skillsGroups.map(
                                    (grp, idx) =>
                                      _jsxs(
                                        "div",
                                        {
                                          className:
                                            "flex flex-col sm:flex-row sm:gap-2",
                                          children: [
                                            _jsxs("strong", {
                                              className:
                                                "text-slate-900 font-semibold shrink-0",
                                              children: [grp.category, ":"],
                                            }),
                                            _jsx("span", {
                                              className: "text-slate-700",
                                              children: grp.skills.join(", "),
                                            }),
                                          ],
                                        },
                                        idx,
                                      ),
                                  ),
                              }),
                            ],
                          }),
                        resultData.tailoredResume?.workExperience &&
                          resultData.tailoredResume.workExperience.length > 0 &&
                          _jsxs("div", {
                            children: [
                              _jsx("h4", {
                                className:
                                  "text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-3",
                                children: "Professional Experience",
                              }),
                              _jsx("div", {
                                className: "space-y-4",
                                children:
                                  resultData.tailoredResume.workExperience.map(
                                    (exp, idx) =>
                                      _jsxs(
                                        "div",
                                        {
                                          className: "space-y-1.5",
                                          children: [
                                            _jsxs("div", {
                                              className:
                                                "flex flex-col sm:flex-row sm:items-center justify-between text-sm",
                                              children: [
                                                _jsx("span", {
                                                  className:
                                                    "font-bold text-slate-950",
                                                  children: exp.role,
                                                }),
                                                _jsx("span", {
                                                  className:
                                                    "text-xs text-slate-500 font-medium",
                                                  children: exp.duration,
                                                }),
                                              ],
                                            }),
                                            _jsxs("div", {
                                              className:
                                                "text-xs font-semibold text-slate-700",
                                              children: [
                                                exp.company,
                                                " ",
                                                exp.location
                                                  ? `• ${exp.location}`
                                                  : "",
                                              ],
                                            }),
                                            exp.bullets &&
                                              _jsx("ul", {
                                                className:
                                                  "list-disc list-outside pl-4 space-y-1 text-xs sm:text-sm text-slate-700 leading-relaxed",
                                                children: exp.bullets.map(
                                                  (bullet, bIdx) =>
                                                    _jsx(
                                                      "li",
                                                      { children: bullet },
                                                      bIdx,
                                                    ),
                                                ),
                                              }),
                                          ],
                                        },
                                        idx,
                                      ),
                                  ),
                              }),
                            ],
                          }),
                        resultData.tailoredResume?.projects &&
                          resultData.tailoredResume.projects.length > 0 &&
                          _jsxs("div", {
                            children: [
                              _jsx("h4", {
                                className:
                                  "text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2",
                                children: "Key Projects",
                              }),
                              _jsx("div", {
                                className: "space-y-3",
                                children:
                                  resultData.tailoredResume.projects.map(
                                    (proj, idx) =>
                                      _jsxs(
                                        "div",
                                        {
                                          className:
                                            "text-xs sm:text-sm space-y-1",
                                          children: [
                                            _jsxs("div", {
                                              className:
                                                "font-bold text-slate-900",
                                              children: [
                                                proj.name,
                                                " ",
                                                proj.technologies &&
                                                  proj.technologies.length >
                                                    0 &&
                                                  _jsxs("span", {
                                                    className:
                                                      "font-normal text-slate-500 text-xs",
                                                    children: [
                                                      "(",
                                                      proj.technologies.join(
                                                        ", ",
                                                      ),
                                                      ")",
                                                    ],
                                                  }),
                                              ],
                                            }),
                                            proj.description &&
                                              _jsx("p", {
                                                className: "text-slate-700",
                                                children: proj.description,
                                              }),
                                            proj.bullets &&
                                              _jsx("ul", {
                                                className:
                                                  "list-disc list-outside pl-4 space-y-0.5 text-slate-700",
                                                children: proj.bullets.map(
                                                  (b, bIdx) =>
                                                    _jsx(
                                                      "li",
                                                      { children: b },
                                                      bIdx,
                                                    ),
                                                ),
                                              }),
                                          ],
                                        },
                                        idx,
                                      ),
                                  ),
                              }),
                            ],
                          }),
                        resultData.tailoredResume?.education &&
                          resultData.tailoredResume.education.length > 0 &&
                          _jsxs("div", {
                            children: [
                              _jsx("h4", {
                                className:
                                  "text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1 mb-2",
                                children: "Education",
                              }),
                              _jsx("div", {
                                className: "space-y-2",
                                children:
                                  resultData.tailoredResume.education.map(
                                    (edu, idx) =>
                                      _jsxs(
                                        "div",
                                        {
                                          className:
                                            "text-xs sm:text-sm flex justify-between items-start",
                                          children: [
                                            _jsxs("div", {
                                              children: [
                                                _jsx("div", {
                                                  className:
                                                    "font-bold text-slate-900",
                                                  children: edu.degree,
                                                }),
                                                _jsxs("div", {
                                                  className: "text-slate-600",
                                                  children: [
                                                    edu.institution,
                                                    " ",
                                                    edu.details
                                                      ? `• ${edu.details}`
                                                      : "",
                                                  ],
                                                }),
                                              ],
                                            }),
                                            edu.year &&
                                              _jsx("span", {
                                                className:
                                                  "text-xs text-slate-500",
                                                children: edu.year,
                                              }),
                                          ],
                                        },
                                        idx,
                                      ),
                                  ),
                              }),
                            ],
                          }),
                      ],
                    }),
                  ],
                }),
                _jsxs("section", {
                  className:
                    "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm",
                  children: [
                    _jsxs("div", {
                      className:
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6",
                      children: [
                        _jsxs("div", {
                          children: [
                            _jsx("span", {
                              className:
                                "text-[11px] font-bold tracking-wider uppercase text-slate-400",
                              children: "Output 3",
                            }),
                            _jsxs("h2", {
                              className:
                                "text-xl font-bold text-slate-950 flex items-center gap-2",
                              children: [
                                _jsx(FileText, {
                                  className: "w-5 h-5 text-slate-800",
                                }),
                                _jsx("span", { children: "COVER LETTER" }),
                              ],
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className: "flex flex-wrap items-center gap-2",
                          children: [
                            _jsxs("button", {
                              onClick: () =>
                                setIsEditingCoverLetter(!isEditingCoverLetter),
                              className:
                                "px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition inline-flex items-center gap-1.5 whitespace-nowrap",
                              children: [
                                _jsx(Edit3, { className: "w-3.5 h-3.5" }),
                                _jsx("span", {
                                  children: isEditingCoverLetter
                                    ? "Done Editing"
                                    : "Edit Cover Letter",
                                }),
                              ],
                            }),
                            _jsx("button", {
                              onClick: () => {
                                copyToClipboard(
                                  editableCoverLetter || resultData.coverLetter,
                                  "cover-letter-sec",
                                  "cover_letter",
                                );
                              },
                              className:
                                "px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg transition inline-flex items-center gap-1.5 whitespace-nowrap",
                              children:
                                copiedKey === "cover-letter-sec"
                                  ? _jsxs(_Fragment, {
                                      children: [
                                        _jsx(Check, {
                                          className:
                                            "w-3.5 h-3.5 text-emerald-600",
                                        }),
                                        _jsx("span", { children: "Copied" }),
                                      ],
                                    })
                                  : _jsxs(_Fragment, {
                                      children: [
                                        _jsx(Copy, {
                                          className: "w-3.5 h-3.5",
                                        }),
                                        _jsx("span", {
                                          children: "Copy Cover Letter",
                                        }),
                                      ],
                                    }),
                            }),
                            _jsxs("button", {
                              onClick: handleDownloadCoverLetter,
                              className:
                                "px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm",
                              children: [
                                _jsx(Download, { className: "w-3.5 h-3.5" }),
                                _jsx("span", {
                                  children: "Download Cover Letter",
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                    isEditingCoverLetter
                      ? _jsx("textarea", {
                          rows: 12,
                          value: editableCoverLetter,
                          onChange: (e) =>
                            setEditableCoverLetter(e.target.value),
                          className:
                            "w-full rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 p-4 text-sm text-slate-800 leading-relaxed font-sans outline-none resize-y transition bg-slate-50/50",
                        })
                      : _jsx("div", {
                          className:
                            "p-6 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed space-y-4 font-sans whitespace-pre-line",
                          children:
                            editableCoverLetter || resultData.coverLetter,
                        }),
                  ],
                }),
                _jsxs("section", {
                  className:
                    "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm",
                  children: [
                    _jsx("div", {
                      className:
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6",
                      children: _jsxs("div", {
                        children: [
                          _jsx("span", {
                            className:
                              "text-[11px] font-bold tracking-wider uppercase text-slate-400",
                            children: "Output 4",
                          }),
                          _jsxs("h2", {
                            className:
                              "text-xl font-bold text-slate-950 flex items-center gap-2",
                            children: [
                              _jsx(CheckCircle2, {
                                className: "w-5 h-5 text-slate-800",
                              }),
                              _jsx("span", { children: "APPLICATION ANSWERS" }),
                            ],
                          }),
                          _jsx("p", {
                            className: "text-xs text-slate-500 mt-0.5",
                            children:
                              "Tailored responses for standard screening questions & factual fields. You can edit every answer.",
                          }),
                        ],
                      }),
                    }),
                    _jsxs("div", {
                      className: "mb-8",
                      children: [
                        _jsxs("h3", {
                          className:
                            "text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2",
                          children: [
                            _jsx(User, { className: "w-3.5 h-3.5" }),
                            _jsx("span", {
                              children:
                                "Factual Application Fields (Never Guessed)",
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          className:
                            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
                          children: [
                            _jsxs("div", {
                              className:
                                "p-3.5 rounded-xl bg-slate-50 border border-slate-200",
                              children: [
                                _jsx("label", {
                                  className:
                                    "text-[11px] font-bold uppercase text-slate-500 block mb-1",
                                  children: "Current CTC",
                                }),
                                _jsx("input", {
                                  type: "text",
                                  value: editableFactual.currentCtc,
                                  onChange: (e) =>
                                    setEditableFactual({
                                      ...editableFactual,
                                      currentCtc: e.target.value,
                                    }),
                                  className:
                                    "w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-slate-900 outline-none",
                                }),
                              ],
                            }),
                            _jsxs("div", {
                              className:
                                "p-3.5 rounded-xl bg-slate-50 border border-slate-200",
                              children: [
                                _jsx("label", {
                                  className:
                                    "text-[11px] font-bold uppercase text-slate-500 block mb-1",
                                  children: "Expected CTC",
                                }),
                                _jsx("input", {
                                  type: "text",
                                  value: editableFactual.expectedCtc,
                                  onChange: (e) =>
                                    setEditableFactual({
                                      ...editableFactual,
                                      expectedCtc: e.target.value,
                                    }),
                                  className:
                                    "w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-slate-900 outline-none",
                                }),
                              ],
                            }),
                            _jsxs("div", {
                              className:
                                "p-3.5 rounded-xl bg-slate-50 border border-slate-200",
                              children: [
                                _jsx("label", {
                                  className:
                                    "text-[11px] font-bold uppercase text-slate-500 block mb-1",
                                  children: "Notice Period",
                                }),
                                _jsx("input", {
                                  type: "text",
                                  value: editableFactual.noticePeriod,
                                  onChange: (e) =>
                                    setEditableFactual({
                                      ...editableFactual,
                                      noticePeriod: e.target.value,
                                    }),
                                  className:
                                    "w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-slate-900 outline-none",
                                }),
                              ],
                            }),
                            _jsxs("div", {
                              className:
                                "p-3.5 rounded-xl bg-slate-50 border border-slate-200",
                              children: [
                                _jsx("label", {
                                  className:
                                    "text-[11px] font-bold uppercase text-slate-500 block mb-1",
                                  children: "Total Experience",
                                }),
                                _jsx("input", {
                                  type: "text",
                                  value: editableFactual.totalExperience,
                                  onChange: (e) =>
                                    setEditableFactual({
                                      ...editableFactual,
                                      totalExperience: e.target.value,
                                    }),
                                  className:
                                    "w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-slate-900 outline-none",
                                }),
                              ],
                            }),
                            _jsxs("div", {
                              className:
                                "p-3.5 rounded-xl bg-slate-50 border border-slate-200",
                              children: [
                                _jsx("label", {
                                  className:
                                    "text-[11px] font-bold uppercase text-slate-500 block mb-1",
                                  children: "Relevant Experience",
                                }),
                                _jsx("input", {
                                  type: "text",
                                  value: editableFactual.relevantExperience,
                                  onChange: (e) =>
                                    setEditableFactual({
                                      ...editableFactual,
                                      relevantExperience: e.target.value,
                                    }),
                                  className:
                                    "w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-slate-900 outline-none",
                                }),
                              ],
                            }),
                            _jsxs("div", {
                              className:
                                "p-3.5 rounded-xl bg-slate-50 border border-slate-200",
                              children: [
                                _jsx("label", {
                                  className:
                                    "text-[11px] font-bold uppercase text-slate-500 block mb-1",
                                  children: "Current Location",
                                }),
                                _jsx("input", {
                                  type: "text",
                                  value: editableFactual.currentLocation,
                                  onChange: (e) =>
                                    setEditableFactual({
                                      ...editableFactual,
                                      currentLocation: e.target.value,
                                    }),
                                  className:
                                    "w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:border-slate-900 outline-none",
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                    _jsxs("div", {
                      className: "space-y-4",
                      children: [
                        _jsx("h3", {
                          className:
                            "text-xs font-bold uppercase tracking-wider text-slate-500 mb-2",
                          children: "Screening Questions & Answers",
                        }),
                        editableAnswers.map((item, idx) =>
                          _jsxs(
                            "div",
                            {
                              className:
                                "p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5",
                              children: [
                                _jsxs("div", {
                                  className:
                                    "flex items-center justify-between gap-2",
                                  children: [
                                    _jsxs("h4", {
                                      className:
                                        "text-sm font-bold text-slate-900 flex items-center gap-2",
                                      children: [
                                        _jsx("span", {
                                          className:
                                            "w-5 h-5 rounded bg-slate-200 text-slate-800 flex items-center justify-center text-xs font-bold",
                                          children: idx + 1,
                                        }),
                                        _jsx("span", {
                                          children: item.question,
                                        }),
                                      ],
                                    }),
                                    _jsx("button", {
                                      onClick: () =>
                                        copyToClipboard(
                                          item.answer,
                                          `ans-${idx}`,
                                          "screening_answer",
                                        ),
                                      className:
                                        "p-1 text-slate-400 hover:text-slate-800 transition rounded",
                                      title: "Copy answer",
                                      children:
                                        copiedKey === `ans-${idx}`
                                          ? _jsx(Check, {
                                              className:
                                                "w-4 h-4 text-emerald-600",
                                            })
                                          : _jsx(Copy, {
                                              className: "w-4 h-4",
                                            }),
                                    }),
                                  ],
                                }),
                                _jsx("textarea", {
                                  rows: 3,
                                  value: item.answer,
                                  onChange: (e) => {
                                    const newAnswers = [...editableAnswers];
                                    newAnswers[idx].answer = e.target.value;
                                    setEditableAnswers(newAnswers);
                                  },
                                  className:
                                    "w-full rounded-lg border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 p-3 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans outline-none resize-y bg-white",
                                }),
                              ],
                            },
                            idx,
                          ),
                        ),
                      ],
                    }),
                  ],
                }),
                _jsxs("section", {
                  className:
                    "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm",
                  children: [
                    _jsxs("div", {
                      className:
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6",
                      children: [
                        _jsxs("div", {
                          children: [
                            _jsx("span", {
                              className:
                                "text-[11px] font-bold tracking-wider uppercase text-slate-400",
                              children: "Output 5",
                            }),
                            _jsxs("h2", {
                              className:
                                "text-xl font-bold text-slate-950 flex items-center gap-2",
                              children: [
                                _jsx(Mail, {
                                  className: "w-5 h-5 text-slate-800",
                                }),
                                _jsx("span", { children: "RECRUITER EMAIL" }),
                              ],
                            }),
                          ],
                        }),
                        _jsx("button", {
                          onClick: () => {
                            const emailContent = `SUBJECT: ${resultData.recruiterEmail?.subject}\n\n${resultData.recruiterEmail?.body}`;
                            copyToClipboard(
                              emailContent,
                              "email-sec",
                              "recruiter_email",
                            );
                          },
                          className:
                            "px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto shadow-sm",
                          children:
                            copiedKey === "email-sec"
                              ? _jsxs(_Fragment, {
                                  children: [
                                    _jsx(Check, {
                                      className: "w-3.5 h-3.5 text-emerald-400",
                                    }),
                                    _jsx("span", { children: "Copied Email" }),
                                  ],
                                })
                              : _jsxs(_Fragment, {
                                  children: [
                                    _jsx(Copy, { className: "w-3.5 h-3.5" }),
                                    _jsx("span", { children: "Copy Email" }),
                                  ],
                                }),
                        }),
                      ],
                    }),
                    _jsxs("div", {
                      className:
                        "p-5 sm:p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-4",
                      children: [
                        _jsxs("div", {
                          className: "border-b border-slate-200 pb-3",
                          children: [
                            _jsx("span", {
                              className:
                                "text-xs font-bold uppercase text-slate-400 block mb-1",
                              children: "Subject Line",
                            }),
                            _jsx("div", {
                              className:
                                "text-sm font-semibold text-slate-950 font-mono bg-white px-3 py-2 rounded-lg border border-slate-200",
                              children:
                                resultData.recruiterEmail?.subject ||
                                `Application — ${resultData.targetRole} — ${resultData.candidateName}`,
                            }),
                          ],
                        }),
                        _jsxs("div", {
                          children: [
                            _jsx("span", {
                              className:
                                "text-xs font-bold uppercase text-slate-400 block mb-1",
                              children: "Email Body",
                            }),
                            _jsx("div", {
                              className:
                                "text-sm text-slate-800 font-sans leading-relaxed whitespace-pre-line bg-white p-4 rounded-lg border border-slate-200",
                              children: resultData.recruiterEmail?.body,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                _jsxs("section", {
                  className:
                    "bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm",
                  children: [
                    _jsxs("div", {
                      className:
                        "flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                      children: [
                        _jsxs("div", {
                          children: [
                            _jsx("h3", {
                              className: "text-base font-bold text-slate-950",
                              children: "Was this useful?",
                            }),
                            _jsx("p", {
                              className: "text-xs text-slate-500 mt-0.5",
                              children:
                                "Your feedback directly shapes the accuracy of ApplySmart.",
                            }),
                          ],
                        }),
                        !feedbackSubmitted
                          ? _jsxs("div", {
                              className: "flex items-center gap-3",
                              children: [
                                _jsxs("button", {
                                  onClick: () => handleFeedbackSubmit("yes"),
                                  className: `px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                                    feedbackGiven === "yes"
                                      ? "bg-emerald-700 text-white"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                                  }`,
                                  children: [
                                    _jsx(ThumbsUp, {
                                      className: "w-3.5 h-3.5",
                                    }),
                                    _jsx("span", { children: "Yes" }),
                                  ],
                                }),
                                _jsxs("button", {
                                  onClick: () => handleFeedbackSubmit("no"),
                                  className: `px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                                    feedbackGiven === "no"
                                      ? "bg-rose-700 text-white"
                                      : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                                  }`,
                                  children: [
                                    _jsx(ThumbsDown, {
                                      className: "w-3.5 h-3.5",
                                    }),
                                    _jsx("span", { children: "No" }),
                                  ],
                                }),
                              ],
                            })
                          : _jsx("span", {
                              className:
                                "text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200",
                              children: "Thank you for your feedback!",
                            }),
                      ],
                    }),
                    feedbackGiven === "no" &&
                      !feedbackSubmitted &&
                      _jsxs("div", {
                        className:
                          "mt-4 pt-4 border-t border-slate-100 space-y-3",
                        children: [
                          _jsx("label", {
                            className:
                              "text-xs font-semibold text-slate-700 block",
                            children: "What was wrong or missing?",
                          }),
                          _jsx("textarea", {
                            rows: 3,
                            value: feedbackComment,
                            onChange: (e) => setFeedbackComment(e.target.value),
                            placeholder: "Tell us what could be improved...",
                            className:
                              "w-full rounded-xl border border-slate-300 focus:border-slate-900 p-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none",
                          }),
                          _jsx("div", {
                            className: "flex justify-end",
                            children: _jsx("button", {
                              onClick: handleDetailedFeedbackSubmit,
                              className:
                                "px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition",
                              children: "Submit Feedback",
                            }),
                          }),
                        ],
                      }),
                  ],
                }),
                _jsx("div", {
                  className: "text-center pt-4 pb-8",
                  children: _jsxs("button", {
                    onClick: resetApplication,
                    className:
                      "px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white text-base font-semibold rounded-xl transition shadow-md inline-flex items-center gap-2.5",
                    children: [
                      _jsx(RefreshCw, { className: "w-4 h-4" }),
                      _jsx("span", { children: "Prepare Another Application" }),
                    ],
                  }),
                }),
              ],
            }),
        ],
      }),
      showWaitlistModal &&
        _jsx("div", {
          className:
            "fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4",
          children: _jsxs("div", {
            className:
              "bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8 shadow-xl relative animate-in fade-in zoom-in-95 duration-150",
            children: [
              _jsx("button", {
                onClick: () => setShowWaitlistModal(false),
                className:
                  "absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition",
                children: _jsx(X, { className: "w-5 h-5" }),
              }),
              _jsx("div", {
                className:
                  "w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center mb-4",
                children: _jsx(Zap, { className: "w-6 h-6" }),
              }),
              _jsx("h2", {
                className: "text-xl font-bold text-slate-950",
                children: "You've used your 3 free applications.",
              }),
              _jsx("p", {
                className: "text-sm text-slate-600 mt-2 leading-relaxed",
                children:
                  "We're validating ApplySmart. Want early access to unlimited applications?",
              }),
              !waitlistSuccess
                ? _jsxs("form", {
                    onSubmit: handleWaitlistSubmit,
                    className: "mt-6 space-y-3",
                    children: [
                      _jsxs("div", {
                        children: [
                          _jsx("input", {
                            type: "email",
                            value: waitlistEmail,
                            onChange: (e) => {
                              setWaitlistEmail(e.target.value);
                              if (waitlistError) setWaitlistError(null);
                            },
                            placeholder: "Enter your email address",
                            className:
                              "w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-sm outline-none transition",
                            autoFocus: true,
                          }),
                          waitlistError &&
                            _jsx("p", {
                              className:
                                "text-xs text-red-600 mt-1.5 font-medium",
                              children: waitlistError,
                            }),
                        ],
                      }),
                      _jsxs("button", {
                        type: "submit",
                        className:
                          "w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2 whitespace-nowrap",
                        children: [
                          _jsx(Send, { className: "w-4 h-4" }),
                          _jsx("span", { children: "Join Waitlist" }),
                        ],
                      }),
                    ],
                  })
                : _jsxs("div", {
                    className:
                      "mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-1",
                    children: [
                      _jsx("p", {
                        className: "font-bold text-sm",
                        children: "You're on the list.",
                      }),
                      _jsx("p", {
                        className: "text-xs text-emerald-700",
                        children:
                          "We'll notify you as soon as unlimited access opens up!",
                      }),
                    ],
                  }),
            ],
          }),
        }),
      _jsx("footer", {
        className:
          "bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500",
        children: _jsx("div", {
          className: "max-w-5xl mx-auto px-4",
          children: _jsxs("p", {
            children: [
              "\u00A9 ",
              new Date().getFullYear(),
              " ApplySmart. Tailored, truthful job applications from your resume.",
            ],
          }),
        }),
      }),
    ],
  });
}
