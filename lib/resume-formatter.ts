/**
 * resume-formatter.ts
 *
 * Converts ANY resume input (plain text, partial Markdown, messy PDF extract)
 * into a canonical, industry-standard Markdown format that is consistently
 * rendered by ResumePreview, ResumePDFPage, and exportResumeDOCX.
 *
 * Canonical format produced:
 *
 *   # Full Name
 *   email@example.com | +1-555-000-0000 | [LinkedIn](url) | Location
 *
 *   ## Summary
 *   2-3 sentence professional summary.
 *
 *   ## Experience
 *   **Company Name** | **Job Title** | **Jan 2021 – Present**
 *
 *   * Accomplished X by doing Y, resulting in Z.
 *   * Led a team of N to deliver ...
 *
 *   ## Skills
 *   **Languages**: Python, TypeScript, Java
 *   **Frameworks**: React, FastAPI, Spring Boot
 *
 *   ## Education
 *   **University Name** | **Degree in Field** | **2017 – 2021**
 *
 *   ## Projects
 *   **Project Name** | Technologies | [Link](url)
 *
 *   * Short description of what it does and impact.
 *
 *   ## Certifications
 *   **Cert Name** | Issuer | Date
 */

import { generateText, CustomConfig } from './generate';

// ---------------------------------------------------------------------------
// Plain-text detection heuristic
// ---------------------------------------------------------------------------

/**
 * Returns true when the text looks like plain/unstructured text rather than
 * Markdown. Used to decide whether to run the formatting step.
 *
 * A resume is considered "plain text" when it has very few or no:
 *   - Markdown section headings (## ...)
 *   - Bold markers (**...**)
 *   - Markdown link syntax ([...](...))
 */
export function isLikelyPlainText(text: string): boolean {
    if (!text || text.trim().length < 50) return false;

    const lines = text.split('\n');
    let mdHeadings = 0;
    let mdBoldCount = 0;
    let mdLinkCount = 0;

    for (const line of lines) {
        const t = line.trim();
        if (/^#{1,3}\s/.test(t)) mdHeadings++;
        if (/\*\*/.test(t)) mdBoldCount++;
        if (/\[.+?\]\(.+?\)/.test(t)) mdLinkCount++;
    }

    const totalSignals = mdHeadings + mdBoldCount + mdLinkCount;

    // If there are 3+ structural Markdown signals, treat as already-formatted
    return totalSignals < 3;
}

// ---------------------------------------------------------------------------
// Formatting prompt
// ---------------------------------------------------------------------------

const FORMAT_SYSTEM_INSTRUCTION = [
    'You are an expert resume formatter. Your only job is to convert unstructured resume text into clean, industry-standard Markdown.',
    'Never invent any information — only restructure what exists in the input.',
    'Return only valid JSON when JSON is requested.',
].join(' ');

function buildFormatPrompt(rawText: string): string {
    return `Convert the following resume text into clean, industry-standard Markdown.

RULES:
1. Extract the person's full name. Output it as the very first line: # Full Name
2. Extract all contact info (email, phone, location, LinkedIn URL, GitHub URL, personal website).
   Output as a SINGLE pipe-separated line below the name, using Markdown links for URLs:
   email@example.com | +1-555-000-0000 | City, Country | [LinkedIn](https://...) | [GitHub](https://...)
3. Detect these sections and output them with ## headings (include only sections present in input):
   - ## Summary  (or ## Professional Summary)
   - ## Experience
   - ## Skills
   - ## Education
   - ## Projects
   - ## Certifications  (or ## Certifications & Awards)
4. FORMAT RULES per section:

   SUMMARY: 2-3 sentences as plain paragraph text. No bullets.

   EXPERIENCE: Each role must follow this exact format:
     **Company Name** | **Job Title** | **Start – End** (or **Present**)
     (blank line)
     * Bullet point 1 describing achievement with metric if available.
     * Bullet point 2.
     (blank line between roles)
   
   If the company had clients (consulting roles), add after the role header:
     **Client:** Client Name - Domain
     (blank line)
     * Client-specific bullets.

   SKILLS: Group by category using this format (one per line):
     **Languages**: Python, TypeScript, Java
     **Frameworks**: React, FastAPI
     **Cloud / DevOps**: AWS, Docker, Kubernetes
     **Databases**: PostgreSQL, Redis, MongoDB
     **Tools**: Git, Jira, Figma
   Only include categories that have content.

   EDUCATION: Each entry:
     **Institution Name** | **Degree in Field** | **Year – Year**

   PROJECTS: Each entry:
     **Project Name** | Tech Stack | [Link](url) ← omit link if none exists
     (blank line)
     * One-line description of what it does and its impact.

   CERTIFICATIONS: Each entry:
     **Certification Name** | Issuing Organization | Year

5. Preserve ALL original facts exactly — dates, company names, metrics, titles, skills. Do not rephrase, embellish, or omit any real content.
6. If a section cannot be detected (e.g. no projects found), omit that ## heading entirely.
7. Return ONLY valid JSON with this shape:
   {
     "formatted": "the full formatted Markdown resume as a single string with real newlines",
     "detectedSections": ["Summary", "Experience", "Skills", "Education"]
   }

RESUME INPUT:
${rawText}`;
}

// ---------------------------------------------------------------------------
// Main formatter function
// ---------------------------------------------------------------------------

export interface FormatResumeOptions {
    provider?: string;
    apiKey?: string;
    modelName?: string;
    customConfig?: CustomConfig;
}

export interface FormatResumeResult {
    formatted: string;
    wasPlainText: boolean;
    detectedSections: string[];
}

/**
 * Formats any resume input into canonical industry-standard Markdown.
 * Falls back to the original text if the LLM call fails or the input
 * is already well-structured Markdown.
 */
export async function formatResumeToMarkdown(
    rawText: string,
    options: FormatResumeOptions = {}
): Promise<FormatResumeResult> {
    const wasPlainText = isLikelyPlainText(rawText);

    // If already well-structured Markdown, skip formatting
    if (!wasPlainText) {
        return {
            formatted: normalizeExistingMarkdown(rawText),
            wasPlainText: false,
            detectedSections: [],
        };
    }

    const {
        provider = 'gemini',
        apiKey,
        modelName,
        customConfig,
    } = options;

    try {
        const raw = await generateText({
            prompt: buildFormatPrompt(rawText),
            systemInstruction: FORMAT_SYSTEM_INSTRUCTION,
            provider,
            apiKey,
            modelName,
            customConfig,
            temperature: 0.1,
            jsonMode: true,
        });

        // Parse the JSON response
        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const parsed = JSON.parse(cleaned);

        const formatted = typeof parsed.formatted === 'string'
            ? parsed.formatted.replace(/\\n/g, '\n').trim()
            : '';

        const detectedSections = Array.isArray(parsed.detectedSections)
            ? parsed.detectedSections.filter((s: unknown) => typeof s === 'string')
            : [];

        if (!formatted) {
            console.warn('[resume-formatter] LLM returned empty formatted text; using original.');
            return { formatted: rawText, wasPlainText, detectedSections };
        }

        return { formatted, wasPlainText, detectedSections };
    } catch (error) {
        console.error('[resume-formatter] Formatting failed; using original text.', error);
        // Graceful fallback: return original text unchanged
        return { formatted: rawText, wasPlainText, detectedSections: [] };
    }
}

// ---------------------------------------------------------------------------
// Normalise already-Markdown resumes (light touch cleanup only)
// ---------------------------------------------------------------------------

/**
 * For resumes that are already in Markdown, apply minimal cleanup:
 * - Normalize line endings
 * - Collapse 3+ blank lines to 2
 * - Ensure section headings have a blank line before them
 * - Convert literal \n sequences to real newlines
 */
export function normalizeExistingMarkdown(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/([^\n])\n(#{1,3} )/g, '$1\n\n$2')
        .trim();
}
