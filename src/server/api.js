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
5. In the Tailored Resume:
   - Preserve all real companies, job titles, dates, education, and projects from the candidate's resume.
   - Reorder and rephrase bullet points to emphasize existing relevant technologies and accomplishments aligned with the job description.
   - Every experience bullet MUST follow the X-Y-Z formula: Accomplished [X] as measured by [Y], by doing [Z]. Start each bullet with a strong action verb and weave in exact key phrases from the job description wherever truthfully applicable.
   - The Professional Summary MUST be exactly 3 punchy sentences tailoring the candidate's top skills to the target role.
   - Technical Skills MUST be grouped into clear categories (e.g. "Languages/Frameworks", "Tools/Platforms", plus any other categories the resume supports).
6. In the Cover Letter:
   - Format as: [Date] / Hiring Team / [Company Name] / (blank line) / Dear Hiring Team, / then exactly 3-4 paragraphs / Sincerely, / [Candidate Name].
   - Paragraph 1: hook with genuine enthusiasm for the role and why this specific company aligns with the candidate's goals.
   - Paragraph 2: connect the candidate's real technical highlights directly to the pain points/requirements in the job description.
   - Paragraph 3: showcase soft skills, collaborative style, and dedication to quality, grounded in real resume evidence.
   - No boilerplate fluff. No invented facts.
7. In the Recruiter Email:
   - Subject line MUST follow the exact format: "Application — [Job Title] — [Candidate Name]"
   - Body must include introduction, relevant experience, relevant skills, enthusiasm for the role, and reference that the resume is attached.
   - Do NOT invent recruiter names or fake email addresses.
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
    "fullTextResume": "<Complete tailored resume rendered as clean markdown using exactly this schema:\\n# [Full Name]\\n[Contact Info: Email | Phone | GitHub | LinkedIn]\\n\\n## Professional Summary\\n[3 sentence summary]\\n\\n## Technical Skills\\n- **Languages/Frameworks:** [...]\\n- **Tools/Platforms:** [...]\\n\\n## Experience\\n### [Job Title] | [Company Name] | [Dates]\\n- [X-Y-Z bullets]\\n\\n## Education / Certifications\\n- [Degree/Cert] | [Institution] | [Year]>"
  },
  "coverLetter": "<The full cover letter as plain text, following exactly this structure with blank lines between blocks:\\n[Date]\\n\\nHiring Team\\n[Company Name]\\n\\nDear Hiring Team,\\n\\n[Paragraph 1 - hook/enthusiasm/company alignment]\\n\\n[Paragraph 2 - technical highlights vs JD pain points]\\n\\n[Paragraph 3 - soft skills, collaboration, quality]\\n\\nSincerely,\\n[Candidate Name]>",
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
  const candidateModels = [
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ];
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
