import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
export async function processApplicationAnalysis(payload) {
  const {
    jobDescription,
    resumeFileName,
    resumeText,
    resumeFileBase64,
    resumeMimeType,
  } = payload;

  if (!jobDescription || (!resumeText && !resumeFileBase64)) {
    throw new Error("Both resume content and job description are required.");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env.local file.",
    );
  }
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are ApplySmart's senior job application engine, an expert career coach and technical writer.
Your mission is to generate a comprehensive, truthful, tailored job application package strictly based on the candidate's actual uploaded resume and target job description.

STRICT SOURCE-OF-TRUTH AND ANTI-HALLUCINATION RULES:
1. The uploaded resume is the EXCLUSIVE and ONLY source of truth for the candidate's history, experience, technologies, metrics, education, titles, and companies.
2. NEVER invent, hallucinate, assume, or fabricate any skills, metrics, percentages, team sizes, projects, or employment history not explicitly supported by the resume.
3. If a job requirement is absent from the resume, DO NOT claim the candidate has it. List it under missingSkills with "(Not found in resume)".
4. For factual screening fields (Current CTC, Expected CTC, Notice Period, Total Experience, Relevant Experience, Current Location, Preferred Location):
   - Only fill in values that are EXPLICITLY present or mathematically calculated from dates in the resume.
   - If ANY factual item is not explicitly mentioned or verifiable, you MUST set its value exactly to "Please enter this information.". NEVER guess.

FORMATTING & ALIGNMENT MANDATE FOR TAILORED RESUME & COVER LETTER:
1. Do NOT use LaTeX tags or Markdown code blocks inside the string values. Use HTML elements inside Markdown to enforce absolute layout alignment.
2. Header & Entry Alignment:
   - Header must be centered using <div align="center">...</div>.
   - EVERY work experience title line, project header, and education entry MUST use an HTML table wrapper to guarantee right-aligned dates and locations:
     <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td align="left"><strong>[Job Title / Degree]</strong> — <em>[Company / Institution]</em></td><td align="right"><em>[Dates / Location]</em></td></tr></table>
   - Subheadings (Tech Stack / Details) must follow immediately on a new line in italics: <em>Tech Stack: [Technologies]</em>
3. Section Dividers:
   - Use horizontal rules (---) between major sections (SUMMARY, CORE COMPETENCIES, WORK EXPERIENCE, TECHNICAL SKILLS, EDUCATION).
4. Competencies Layout:
   - Format CORE COMPETENCIES as a Markdown table:
     | Category | Details |
     | :--- | :--- |
     | **Integrations & APIs** | ... |
5. Tailored Resume Bullet Points:
   - Preserve all real companies, job titles, dates, education, and projects from the candidate's resume.
   - Every experience bullet MUST follow the X-Y-Z formula: Accomplished [X] as measured by [Y], by doing [Z].
   - The Professional Summary MUST be exactly 3-4 punchy sentences tailoring the candidate's top skills to the target role.
6. Cover Letter Structure:
   - Use the same centered header block as the resume at the top.
   - Format: Date / Hiring Team / [Company Name] / Dear Hiring Team, / 3-4 structured paragraphs / Sincerely, / [Candidate Name].
7. In the Recruiter Email:
   - Subject line MUST follow the exact format: "Application — [Job Title] — [Candidate Name]".
   - Body must include introduction, relevant experience, relevant skills, enthusiasm for the role, and reference that the resume is attached.
8. Return clean, valid JSON matching the exact specified schema.`;

  const promptText = `
=== TARGET JOB DESCRIPTION ===
${jobDescription.trim()}

=== CANDIDATE RESUME FILE INFO ===
File Name: ${resumeFileName || "Candidate_Resume"}
${resumeText ? `=== EXTRACTED RESUME TEXT ===\n${resumeText.trim()}` : ""}

Generate the complete tailored application package as a valid JSON object matching this exact structure:
{
  "candidateName": "Candidate's real full name from resume (or 'Candidate' if unavailable)",
  "targetRole": "Role title extracted from Job Description",
  "targetCompany": "Company name from Job Description (or 'Hiring Organization' if not specified)",
  "matchScore": <integer 20-98 indicating genuine overlap between resume and JD>,
  "matchCategory": "<e.g. Strong Technical Fit, Solid Alignment, Relevant Experience>",
  "matchExplanation": "<Honest 2-3 sentence overview of how the candidate's real experience aligns or differs from the JD>",
  "matchedSkills": ["<Skills found in BOTH the resume and JD>"],
  "missingSkills": ["<Required JD skills absent from resume, formatted as 'Skill (Not found in resume)'>"],
  "recommendedKeywords": ["<Relevant skills/terms from candidate's resume to emphasize for this role>"],
  "tailoredResume": {
    "candidateName": "Candidate Full Name",
    "contactInfo": {
      "email": "candidate email from resume if present, or ''",
      "phone": "candidate phone from resume if present, or ''",
      "location": "candidate location from resume if present, or ''",
      "linkedin": "linkedin url from resume if present, or ''",
      "portfolio": "github/portfolio url from resume if present, or ''"
    },
    "professionalSummary": "<Exactly 3 punchy sentences tailoring real top skills to the target role>",
    "skillsGroups": [
      {
        "category": "<e.g. Languages/Frameworks, Tools/Platforms, Databases>",
        "skills": ["<real skills only>"]
      }
    ],
    "workExperience": [
      {
        "company": "Company Name from resume",
        "role": "Role Title from resume",
        "location": "Location if present in resume",
        "duration": "Dates/tenure from resume",
        "bullets": [
          "<X-Y-Z formula bullet: strong action verb + accomplishment [X] + measured by [Y] + by doing [Z], using JD keywords where truthful>",
          "<Another X-Y-Z formula bullet highlighting real responsibilities from resume>"
        ]
      }
    ],
    "education": [
      {
        "degree": "Degree and major from resume",
        "institution": "University / College name from resume",
        "year": "Graduation year if present in resume",
        "details": "Honors / GPA / Focus if in resume, or ''"
      }
    ],
    "projects": [
      {
        "name": "Project Name from resume",
        "technologies": ["<real tech from resume>"],
        "description": "Short description of project from resume",
        "bullets": ["<bullet point if applicable>"]
      }
    ],
    "certifications": ["<real certifications from resume, or empty array>"],
    "fullTextResume": "<Complete tailored resume formatted strictly according to the HTML/Markdown layout instructions below>",
    "coverLetter": "<Complete cover letter formatted strictly according to the HTML/Markdown layout instructions below>"
  },
  "applicationAnswers": {
    "screeningAnswers": [
      {
        "question": "Tell us about yourself.",
        "answer": "<Tailored summary connecting candidate's genuine background to the target role>"
      },
      {
        "question": "Why are you interested in this role?",
        "answer": "<Specific motivation connecting the candidate's actual career trajectory with the role and company mission>"
      },
      {
        "question": "Why should we hire you?",
        "answer": "<Compelling value proposition based strictly on proven skills and background from resume>"
      },
      {
        "question": "Why are you a good fit?",
        "answer": "<Clear alignment between candidate's direct experience and target role requirements>"
      },
      {
        "question": "What makes you suitable for this position?",
        "answer": "<Highlight of core strengths, technical capabilities, and execution reliability from resume>"
      }
    ],
    "factualFields": {
      "currentCtc": "<extracted or 'Please enter this information.'>",
      "expectedCtc": "Please enter this information.",
      "noticePeriod": "<extracted from resume or 'Please enter this information.'>",
      "totalExperience": "<calculated from resume dates (e.g. '5 years') or 'Please enter this information.'>",
      "relevantExperience": "<calculated from relevant roles in resume (e.g. '4+ years') or 'Please enter this information.'>",
      "currentLocation": "<extracted from resume or 'Please enter this information.'>",
      "preferredLocation": "<extracted or 'Please enter this information.'>"
    }
  },
  "recruiterEmail": {
    "subject": "Application — [Target Role Title] — [Candidate Name]",
    "body": "Hi [Hiring Team / Recruiter],\\n\\n[Candidate introduction and enthusiasm for the target role]\\n\\n[Paragraph detailing 2-3 core relevant accomplishments and skills directly from resume matching the role]\\n\\n[Closing expressing appreciation, noting the attached resume, and offering availability to connect]\\n\\nBest regards,\\n[Candidate Name]"
  }
}

=== MANDATORY LAYOUT INSTRUCTIONS FOR fullTextResume AND coverLetter ===

1. fullTextResume FORMAT:
Use centered top headers, horizontal rules (---) between sections, Markdown tables for Core Competencies, and HTML table wrappers for dual-aligned headers (Job Title on left, Date on right):

<div align="center">
  <h1>[Candidate Full Name]</h1>
  <p><strong>[Primary Role Title] • [Core Tech 1] • [Core Tech 2] • [Core Tech 3]</strong></p>
  <p>[Location] • [Phone] • <a href="mailto:[Email]">[Email]</a> • <a href="[LinkedIn URL]">[LinkedIn]</a></p>
  <p><strong>[Availability Status / Notice Period if mentioned in resume]</strong></p>
</div>

---

### SUMMARY
[3-4 sentence professional summary tailored strictly from candidate's real background]

---

### CORE COMPETENCIES
| Category | Details |
| :--- | :--- |
| **Integrations & APIs** | [Relevant tools/tech from resume] |
| **Cloud & Infrastructure** | [Relevant cloud tech from resume] |
| **DevOps & Security** | [Relevant DevOps tech from resume] |

---

### WORK EXPERIENCE

<table width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td align="left"><strong>[Job Title]</strong> — <em>[Company Name]</em></td><td align="right"><em>[Dates]</em></td></tr></table>
*Tech Stack: [Technologies used]*
- [X-Y-Z formula bullet point]
- [X-Y-Z formula bullet point]

---

### TECHNICAL SKILLS
- **Languages & Runtimes:** [Technologies]
- **Cloud Infrastructure:** [Technologies]

---

### EDUCATION
<table width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td align="left"><strong>[Degree]</strong> — <em>[Institution]</em></td><td align="right"><em>[Years]</em></td></tr></table>


2. coverLetter FORMAT:
Use the same centered header block as the resume, followed by structured, unindented paragraphs with line breaks:

<div align="center">
  <h2>[Candidate Full Name]</h2>
  <p>[Location] • [Phone] • <a href="mailto:[Email]">[Email]</a></p>
</div>

---

**Date:** [Current Date]  
**To:** Hiring Team, [Target Company]  

**Subject:** Application for [Target Role Title]  

Dear Hiring Team,

[Paragraph 1: Clear hook and genuine interest in the role/company]

[Paragraph 2: Detailed technical highlights directly connecting resume experience to JD pain points]

[Paragraph 3: Soft skills, architectural rigor, testing, and team collaboration grounded in real resume evidence]

Sincerely,  
**[Candidate Name]**
`;
  const contents = [];
  if (resumeFileBase64 && (!resumeText || resumeText.length < 50)) {
    const cleanBase64 = resumeFileBase64.replace(/^data:[^;]+;base64,/, "");
    contents.push({
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: resumeMimeType || "application/pdf",
            data: cleanBase64,
          },
        },
        {
          text: promptText,
        },
      ],
    });
  } else {
    contents.push({
      role: "user",
      parts: [
        {
          text: promptText,
        },
      ],
    });
  }

  // Free-tier-eligible models on Google AI Studio, tried in order.
  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash"];
  let response = null;
  let lastError = null;
  for (const modelName of candidateModels) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          },
        });
        if (response && response.text) {
          break;
        }
      } catch (err) {
        lastError = err;
        const errStr = String(err?.message || err?.status || err || "");
        const isTransient =
          err?.status === 503 ||
          err?.code === 503 ||
          errStr.includes("503") ||
          errStr.includes("high demand") ||
          errStr.includes("UNAVAILABLE") ||
          errStr.includes("429") ||
          errStr.includes("RESOURCE_EXHAUSTED") ||
          errStr.includes("Overloaded");
        if (isTransient && attempt < 3) {
          await new Promise((resolve) =>
            setTimeout(resolve, attempt * 1200 + Math.random() * 400),
          );
          continue;
        }
        break;
      }
    }
    if (response && response.text) {
      break;
    }
  }
  if (!response || !response.text) {
    if (
      lastError?.message?.includes("high demand") ||
      lastError?.status === 503 ||
      String(lastError).includes("503") ||
      String(lastError).includes("RESOURCE_EXHAUSTED")
    ) {
      throw new Error(
        "AI service is experiencing high demand or you've hit the free-tier rate limit. Please try again in a moment.",
      );
    }
    throw lastError || new Error("No response generated by model");
  }
  const text = response.text;
  try {
    let cleaned = text.trim();

    // Remove markdown code fences
    cleaned = cleaned
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    // First attempt: direct JSON
    try {
      return JSON.parse(cleaned);
    } catch {
      // Continue to extract JSON object below
    }

    // Find the first JSON object in the response
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      const jsonCandidate = cleaned.slice(start, end + 1);
      return JSON.parse(jsonCandidate);
    }

    throw new Error("No valid JSON object found");
  } catch (err) {
    console.error("Failed to parse model JSON:", text);
    throw new Error("Invalid JSON format received from analysis model");
  }
}
