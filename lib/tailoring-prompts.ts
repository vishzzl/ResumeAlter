import { cleanJson } from './generate';
import { ResumeSections } from './resume-parser';
import { KeywordHints } from './ats-scoring';

export type TailorableSectionName = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other';
export type SectionPreference = 'quantify' | 'keywords' | 'concise' | 'detailed' | 'reword';

export interface JDAnalysis {
    targetTitle: string;
    seniority: string;
    requiredSkills: string[];
    preferredSkills: string[];
    requirements: string[];
    keyVerbs: string[];
    keyPhrases: string[];
    companyDomain: string;
}

export interface TailoredSections {
    header: string;
    summary: string;
    skills: string;
    experience: string;
    education: string;
    projects: string;
    other: string;
}

export interface TailoringResponse {
    jdAnalysis: JDAnalysis;
    tailoredSections: TailoredSections;
    skippedRequirements: string[];
    warnings: string[];
    changeLog: Array<{ section: string; reason: string }>;
}

export interface VerificationResponse {
    correctedSections: TailoredSections;
    corrections: string[];
    warnings: string[];
}

export interface GapFixResponse {
    tailoredSections: TailoredSections;
    injectedKeywords: string[];
    skippedKeywords: string[];
    warnings: string[];
}

export interface SectionResponse {
    text: string;
    warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function asString(value: unknown): string {
    return typeof value === 'string' ? normalizeNewlines(value).trim() : '';
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of value) {
        const text = asString(item).replace(/\s+/g, ' ');
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(text);
    }
    return result;
}

function normalizeNewlines(value: string): string {
    return value
        .replace(/\r\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/^```[a-z]*\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function dedupe(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const cleaned = value.replace(/\s+/g, ' ').trim();
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(cleaned);
    }
    return result;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPTY_JD_ANALYSIS: JDAnalysis = {
    targetTitle: '',
    seniority: '',
    requiredSkills: [],
    preferredSkills: [],
    requirements: [],
    keyVerbs: [],
    keyPhrases: [],
    companyDomain: '',
};

export const TAILORING_SYSTEM_INSTRUCTION = [
    'You are an expert resume writer, ATS optimization specialist, and strict fact checker.',
    'Return only valid JSON when JSON is requested.',
    'Never invent skills, metrics, dates, employers, titles, credentials, tools, projects, clients, or responsibilities.',
].join(' ');

export const SECTION_SYSTEM_INSTRUCTION = [
    'You are an expert resume writer who creates grounded, ATS-aware section variants.',
    'Return only valid JSON with no markdown fences.',
    'Every claim must be supported by the original resume context.',
].join(' ');

// ---------------------------------------------------------------------------
// Section-level transforms
// ---------------------------------------------------------------------------

export function toTailoredSections(sections: ResumeSections | Partial<TailoredSections>): TailoredSections {
    return {
        header: asString(sections.header),
        summary: asString(sections.summary),
        skills: asString(sections.skills),
        experience: asString(sections.experience),
        education: asString(sections.education),
        projects: asString(sections.projects),
        other: asString(sections.other),
    };
}

export function mergeTailoredSections(
    fallback: ResumeSections | TailoredSections,
    partial: Partial<TailoredSections>
): TailoredSections {
    const base = toTailoredSections(fallback);
    return {
        header: asString(partial.header) || base.header,
        summary: asString(partial.summary) || base.summary,
        skills: asString(partial.skills) || base.skills,
        experience: asString(partial.experience) || base.experience,
        education: asString(partial.education) || base.education,
        projects: asString(partial.projects) || base.projects,
        other: asString(partial.other) || base.other,
    };
}

export function enforceImmutableSections(original: ResumeSections, sections: TailoredSections): TailoredSections {
    return {
        ...sections,
        header: original.header,
        education: original.education,
    };
}

// ---------------------------------------------------------------------------
// Post-parse quality utilities
// ---------------------------------------------------------------------------

/**
 * Detects a suitable heading for the "other" section by inspecting its content,
 * rather than always labelling it "Certifications".
 */
function inferOtherHeading(content: string): string {
    const lower = content.toLowerCase();
    if (lower.includes('certification') || lower.includes('certified') || lower.includes('licence')) {
        return 'Certifications';
    }
    if (lower.includes('award') || lower.includes('honor') || lower.includes('honour')) {
        return 'Awards';
    }
    if (lower.includes('publication') || lower.includes('paper') || lower.includes('journal')) {
        return 'Publications';
    }
    if (lower.includes('volunteer') || lower.includes('community')) {
        return 'Volunteer & Community';
    }
    return 'Additional';
}

/**
 * Warns when the same opening action verb appears more than twice across
 * experience bullets, which indicates monotonous language the model should vary.
 */
export function warnRepeatedVerbs(experience: string): string[] {
    const bullets = experience.split('\n').filter(l => /^\s*[-•*]/.test(l));
    const verbs = bullets.map(b =>
        b.trim().replace(/^[-•*]\s*/, '').split(/\s+/)[0].toLowerCase()
    );
    const counts: Record<string, number> = {};
    for (const verb of verbs) {
        if (verb) counts[verb] = (counts[verb] ?? 0) + 1;
    }
    return Object.entries(counts)
        .filter(([, count]) => count > 2)
        .map(([verb, count]) => `Action verb "${verb}" used ${count} times — vary with synonyms for stronger impact`);
}

/**
 * Checks whether any email address or phone number that appears in the
 * generated body sections differs from what the original header contained.
 * Returns warning strings for each mismatch found.
 */
export function auditContactLeakage(
    original: ResumeSections,
    sections: TailoredSections
): string[] {
    const warnings: string[] = [];

    const emailRe = /[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gi;
    const phoneRe = /\+?[\d][\d\s\-().]{6,}[\d]/g;

    const headerEmails = new Set((original.header.match(emailRe) ?? []).map(e => e.toLowerCase()));
    const headerPhones = new Set((original.header.match(phoneRe) ?? []).map(p => p.replace(/\D/g, '')));

    const bodyText = [sections.summary, sections.skills, sections.experience, sections.projects, sections.other]
        .join('\n');

    for (const email of bodyText.match(emailRe) ?? []) {
        if (!headerEmails.has(email.toLowerCase())) {
            warnings.push(`Possible fabricated email in body sections: "${email}"`);
        }
    }
    for (const phone of bodyText.match(phoneRe) ?? []) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length >= 7 && !headerPhones.has(digits)) {
            warnings.push(`Possible fabricated phone number in body sections: "${phone}"`);
        }
    }

    return warnings;
}

// ---------------------------------------------------------------------------
// Resume reconstruction
// ---------------------------------------------------------------------------

export function detectOptimalSectionOrder(jdAnalysis: JDAnalysis): string {
    // Heuristic: If there are many required skills, prioritize the Skills section by placing it before Experience
    if (jdAnalysis.requiredSkills.length > 8) {
        return 'skills-first';
    }
    return 'default';
}

export function reconstructResume(sections: TailoredSections, sectionOrder?: string): string {
    const parts: string[] = [];
    if (sections.header) parts.push(sections.header);
    if (sections.summary) parts.push(`## Summary\n${sections.summary}`);
    
    if (sectionOrder === 'skills-first') {
        if (sections.skills) parts.push(`## Skills\n${sections.skills}`);
        if (sections.experience) parts.push(`## Experience\n${sections.experience}`);
    } else {
        if (sections.experience) parts.push(`## Experience\n${sections.experience}`);
        if (sections.skills) parts.push(`## Skills\n${sections.skills}`);
    }
    
    if (sections.education) parts.push(`## Education\n${sections.education}`);
    if (sections.projects) parts.push(`## Projects\n${sections.projects}`);
    if (sections.other) parts.push(`## ${inferOtherHeading(sections.other)}\n${sections.other}`);
    return parts.join('\n\n').trim();
}

export function deduplicateBullets(experience: string, keywords: string[]): { cleaned: string; removedDuplicates: string[] } {
    const lines = experience.split('\n');
    const cleanedLines: string[] = [];
    const removedDuplicates: string[] = [];
    const seenBullets = new Set<string>();
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('-') && !trimmed.startsWith('*') && !trimmed.startsWith('•')) {
            cleanedLines.push(line);
            continue;
        }
        
        const bulletContent = trimmed.replace(/^[-*•]\s*/, '').trim();
        const normalized = bulletContent.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        let isDuplicate = false;
        for (const seen of seenBullets) {
            if (seen === normalized || (normalized.length > 15 && (seen.includes(normalized) || normalized.includes(seen)))) {
                isDuplicate = true;
                break;
            }
        }
        
        if (isDuplicate) {
            removedDuplicates.push(bulletContent);
        } else {
            seenBullets.add(normalized);
            cleanedLines.push(line);
        }
    }
    
    return {
        cleaned: cleanedLines.join('\n'),
        removedDuplicates,
    };
}

export function auditExperienceBullets(experience: string): string[] {
    const warnings: string[] = [];
    const lines = experience.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('-') && !trimmed.startsWith('*') && !trimmed.startsWith('•')) {
            continue;
        }
        const bullet = trimmed.replace(/^[-*•]\s*/, '').trim();
        if (!bullet) continue;
        
        if (bullet.length < 50) {
            warnings.push(`Bullet point is too short (${bullet.length} chars) — expand with more context/results: "${bullet.substring(0, 30)}..."`);
        } else if (bullet.length > 220) {
            warnings.push(`Bullet point is too long (${bullet.length} chars) — condense to stay concise: "${bullet.substring(0, 30)}..."`);
        }
        
        const lowercaseBullet = bullet.toLowerCase();
        if (lowercaseBullet.startsWith('responsible for') || lowercaseBullet.startsWith('helped with') || lowercaseBullet.startsWith('worked on')) {
            warnings.push(`Bullet starts with a weak phrase — use an active, professional verb: "${bullet.substring(0, 30)}..."`);
        }
    }
    
    return warnings;
}

// ---------------------------------------------------------------------------
// JD analysis merge
// ---------------------------------------------------------------------------

export function mergeJDAnalysis(hints: KeywordHints, generated?: Partial<JDAnalysis>): JDAnalysis {
    return {
        targetTitle: generated?.targetTitle || hints.targetTitle || '',
        seniority: generated?.seniority || '',
        requiredSkills: dedupe([...(hints.requiredSkills || []), ...(generated?.requiredSkills || [])]),
        preferredSkills: dedupe([...(hints.preferredSkills || []), ...(generated?.preferredSkills || [])]),
        requirements: dedupe([...(hints.requirements || []), ...(generated?.requirements || [])]),
        // generated verbs take priority so they are not crowded out by pre-computed hints
        keyVerbs: dedupe([...(generated?.keyVerbs || []), ...(hints.keyVerbs || [])]).slice(0, 12),
        keyPhrases: dedupe([...(generated?.keyPhrases || []), ...(hints.keyPhrases || [])]).slice(0, 10),
        companyDomain: generated?.companyDomain || '',
    };
}

// ---------------------------------------------------------------------------
// Prompt builders — shared source block
// ---------------------------------------------------------------------------

function sectionSourceBlock(sections: ResumeSections): string {
    return `--- HEADER ---
${sections.header}
--- SUMMARY ---
${sections.summary}
--- SKILLS ---
${sections.skills}
--- EXPERIENCE ---
${sections.experience}
--- EDUCATION ---
${sections.education}
--- PROJECTS ---
${sections.projects}
--- CERTIFICATIONS & OTHER ---
${sections.other}`;
}

// ---------------------------------------------------------------------------
// Prompt: full resume tailoring
// ---------------------------------------------------------------------------

export function buildTailoringPrompt(
    sections: ResumeSections,
    jobDescription: string,
    hints: KeywordHints,
    isPreFiltered?: boolean
): string {
    const preFilterBlock = isPreFiltered ? `
NOTE ON PRE-FILTERING (CRITICAL):
This resume has been programmatically pre-filtered based on the user's master profile skill mappings.
1. The Skills listed in the Skills section are the precise ones that match this JD. Prioritize all of them.
2. The Experience bullets contain a mix of direct JD keyword-matched achievements (first) and general high-impact accomplishments (following) for career continuity. Rephrase and optimize all bullets, prioritizing direct JD-alignment for the top bullets, and ensuring no fabrication of unsupported facts.
` : '';

    return `You are tailoring a resume for a specific job. Use a balanced ATS style: exact JD terms where supported, concise professional language, and no keyword stuffing.

PRIORITY ORDER
1. Factual accuracy: the original resume is the only source of truth.
2. ATS alignment: use exact job-description terms only when the resume contains evidence for them.
3. Human readability: concise bullets, strong verbs, and plain ATS-safe Markdown.
4. Completeness: keep relevant roles/projects; prune unrelated bullets only when enough relevant evidence remains.
${preFilterBlock}
JOB DESCRIPTION AND USER SELECTIONS
${jobDescription}

DETERMINISTIC KEYWORD HINTS FROM UI
${JSON.stringify(hints, null, 2)}

ORIGINAL RESUME SOURCE OF TRUTH
${sectionSourceBlock(sections)}

TASK

Stage 1 — Analyze the JD:
- Extract targetTitle, seniority, requiredSkills, preferredSkills, requirements, keyVerbs, keyPhrases, and companyDomain.
- Treat "Required Skills (must target)" and "Selected Requirements" as high priority.

Stage 2 — Map evidence:
- For every required or preferred skill, decide whether the original resume supports it.
- If unsupported, do not add it. Put it in skippedRequirements with a short reason.
- Equivalent spellings are allowed only when genuinely evident (e.g. AWS for Amazon Web Services, NodeJS for Node.js).

Stage 3 — Rewrite with these rules:

HEADER
- Copy the original header exactly, character for character.

SUMMARY (2–3 sentences using this formula)
- Sentence 1: [Role identity from the resume] with [X years / domain] experience in [core areas most relevant to JD].
- Sentence 2: [Most relevant evidenced achievement or strength aligned to JD].
- Sentence 3 (optional): Forward-looking fit statement using the JD target title only if the title or an equivalent already appears in the resume.
- Do not claim the target title as a current job title unless it is already in the resume.

SKILLS
- Group skills with ATS-friendly bold labels: **Languages**, **Frameworks**, **Cloud / DevOps**, **Databases**, **Tools**.
- Include only skills evidenced in the original resume.
- Do not list a skill more than once across groups.

EXPERIENCE
- Preserve real companies, roles, dates, clients, and metrics exactly as written.
- Use past tense for roles that have ended; use present tense for the current role only.
- Write 3–6 bullets per relevant role (retain and optimize as many bullets as the original role had, prioritizing JD-relevant achievements). Each bullet must be one sentence, action-led, and result-oriented.
- Target 100–180 characters per bullet (excluding the leading dash). This allows for sufficient detail (Action-Context-Result) without being too wordy.
- Preserve exact numbers, percentages, timeframes, and dollar amounts. Never round or approximate.
- Vary action verbs across bullets; do not repeat the same opening verb more than twice in the entire section.

EDUCATION
- Copy the original education section exactly, character for character.

PROJECTS & CERTIFICATIONS
- Keep only source-backed items that strengthen JD alignment.
- Do not mention the hiring company as an employer unless it appears in the original resume.

Stage 4 — Self-audit before returning:
- Remove unsupported skills, numbers, certifications, company names, job titles, and responsibilities.
- Prefer omission over fabrication.
- Verify header and education are copied exactly from the original.
- Verify no contact details (email, phone, LinkedIn URL) appear in body sections unless already there in the original.

Return ONLY valid JSON with this exact shape:
{
  "jdAnalysis": {
    "targetTitle": "string",
    "seniority": "string",
    "requiredSkills": ["string"],
    "preferredSkills": ["string"],
    "requirements": ["string"],
    "keyVerbs": ["string"],
    "keyPhrases": ["string"],
    "companyDomain": "string"
  },
  "tailoredSections": {
    "header": "copy original header exactly",
    "summary": "section content only, no heading",
    "skills": "section content only, no heading",
    "experience": "section content only, no heading",
    "education": "copy original education exactly, no heading",
    "projects": "section content only, no heading",
    "other": "section content only, no heading"
  },
  "skippedRequirements": ["unsupported JD requirement - reason"],
  "warnings": ["brief factual or formatting warning"],
  "changeLog": [
    { "section": "summary", "reason": "what changed and why" }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Prompt: verification pass
// ---------------------------------------------------------------------------

export function buildVerificationPrompt(
    originalSections: ResumeSections,
    generatedSections: TailoredSections,
    jdAnalysis: JDAnalysis
): string {
    return `You are verifying a tailored resume against the original resume. The original resume is the only source of truth.

JD ANALYSIS
${JSON.stringify(jdAnalysis, null, 2)}

ORIGINAL RESUME SOURCE OF TRUTH
${sectionSourceBlock(originalSections)}

TAILORED SECTIONS TO VERIFY
${JSON.stringify(generatedSections, null, 2)}

CHECKS — apply every rule below:
1. Header must be copied exactly from the original, character for character.
2. Education must be copied exactly from the original, character for character.
3. Remove any unsupported skills, tools, metrics, dates, employers, titles, certifications, clients, or achievements.
4. Keep JD phrasing only when the original resume clearly supports it.
5. Past tense for ended roles; present tense for the current role only.
6. No contact detail (email, phone, LinkedIn URL) may appear in body sections unless already present in the original.
7. Keep ATS-safe Markdown. No section headings inside JSON values.

Return ONLY valid JSON:
{
  "correctedSections": {
    "header": "copy original header exactly",
    "summary": "verified section content only",
    "skills": "verified section content only",
    "experience": "verified section content only",
    "education": "copy original education exactly",
    "projects": "verified section content only",
    "other": "verified section content only"
  },
  "corrections": ["removed or restored item"],
  "warnings": ["remaining caution, if any"]
}`;
}

// ---------------------------------------------------------------------------
// Prompt: gap fix (keyword injection)
// ---------------------------------------------------------------------------

export function buildGapFixPrompt(params: {
    originalSections: ResumeSections;
    currentSections: TailoredSections;
    jdAnalysis: JDAnalysis;
    evidencedMissingKeywords: string[];
}): string {
    return `You are making a minimal ATS keyword coverage fix. Add only the missing JD keywords that are already evidenced in the original resume.

MISSING BUT EVIDENCED KEYWORDS
${params.evidencedMissingKeywords.map(keyword => `- ${keyword}`).join('\n')}

JD ANALYSIS
${JSON.stringify(params.jdAnalysis, null, 2)}

ORIGINAL RESUME SOURCE OF TRUTH
${sectionSourceBlock(params.originalSections)}

CURRENT VERIFIED SECTIONS
${JSON.stringify(params.currentSections, null, 2)}

INJECTION PRIORITY ORDER
1. Skills section — add the keyword to the most relevant group first.
2. Experience bullets — weave it in naturally into an existing bullet only if it cannot fit in skills.
3. Summary — use only as a last resort, and only if the keyword strongly defines the candidate's identity.

RULES
- Make the smallest natural edit needed to include each evidenced keyword.
- Use exact JD phrasing for the keyword.
- Do not add any new responsibility, metric, credential, employer, or date.
- Do not repeat a keyword that already appears in the section.
- If a keyword cannot be added without inventing context, skip it and record it in skippedKeywords.
- Header and education must remain copied exactly from the original.
- Past tense for ended roles; present tense for the current role only.

Return ONLY valid JSON:
{
  "tailoredSections": {
    "header": "copy original header exactly",
    "summary": "section content only",
    "skills": "section content only",
    "experience": "section content only",
    "education": "copy original education exactly",
    "projects": "section content only",
    "other": "section content only"
  },
  "injectedKeywords": ["keyword added"],
  "skippedKeywords": ["keyword skipped - reason"],
  "warnings": ["brief warning"]
}`;
}

// ---------------------------------------------------------------------------
// Prompt: per-section candidate generation
// ---------------------------------------------------------------------------

export function buildSectionTailoringPrompt(params: {
    sectionName: TailorableSectionName;
    sections: ResumeSections;
    jobDescription: string;
    jdAnalysis: JDAnalysis;
    preferences?: SectionPreference[];
    customInstruction?: string;
}): string {
    const label = params.sectionName.toUpperCase();
    const prefs = params.preferences || ['quantify', 'keywords'];

    // Map preference chips to concrete prompt instructions
    const prefInstructions: string[] = [];
    if (prefs.includes('quantify')) {
        prefInstructions.push('QUANTIFY: Wherever the original resume contains implicit metrics (team sizes, timelines, user counts, scale, performance gains), make them explicit with numbers. If the original says "improved performance", and there is any numeric evidence anywhere in the resume, surface it. Do NOT invent numbers — only surface what exists.');
    }
    if (prefs.includes('keywords')) {
        prefInstructions.push('KEYWORD-HEAVY: Maximize coverage of exact JD keywords and phrases. Weave them naturally into bullets and descriptions. Prioritize required skills over preferred skills. Use the exact phrasing from the job description where possible.');
    }
    if (prefs.includes('concise')) {
        prefInstructions.push('CONCISE: Each bullet must be 60–100 characters (excluding leading dash). Remove filler words, adverbs, and padding. One concrete achievement per bullet. Favor brevity over detail.');
    }
    if (prefs.includes('detailed')) {
        prefInstructions.push('DETAILED: Use full STAR format (Situation → Task → Action → Result) for each major bullet. Provide context about the project scope, your specific role, technologies used, and measurable outcomes.');
    }
    if (prefs.includes('reword')) {
        prefInstructions.push('REWORD ONLY: Preserve the original structure, bullet count, and content exactly. Only rephrase for ATS optimization — replace passive voice with active, align terminology to JD phrasing. Do not add, remove, or reorder any bullets.');
    }

    const prefBlock = prefInstructions.length > 0
        ? `\nUSER OPTIMIZATION PREFERENCES\n${prefInstructions.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`
        : '';

    const customBlock = params.customInstruction?.trim()
        ? `\nCUSTOM USER INSTRUCTION\n${params.customInstruction.trim()}\n`
        : '';

    return `Create ONE optimized version of only the ${label} section of this resume, following the user's optimization preferences below.

JOB DESCRIPTION
${params.jobDescription}

JD ANALYSIS
${JSON.stringify(params.jdAnalysis, null, 2)}
${prefBlock}${customBlock}
ORIGINAL RESUME SOURCE OF TRUTH
${sectionSourceBlock(params.sections)}

SECTION-SPECIFIC RULES
- Output only ${label} content. Do not include section headings.
- Every claim must be supported by the original resume.
- Use exact JD keywords only when supported by the original resume.
- If the section is EDUCATION, preserve the original education content unless light formatting is needed.
- If the section is SKILLS, group skills into concise ATS-friendly bold-label categories.
- If the section is EXPERIENCE or PROJECTS:
  - Use action-led bullets and only source-backed metrics.
  - Past tense for ended roles; present tense for the current role only.
  - Preserve exact numbers, percentages, timeframes, and dollar amounts.
  - Vary opening action verbs; do not repeat the same verb more than twice.

Return ONLY valid JSON with no markdown fences:
{
  "text": "the optimized section content only — no heading",
  "warnings": ["brief warning if any"]
}`;
}

// ---------------------------------------------------------------------------
// Response parsers
// ---------------------------------------------------------------------------

function parseObject(raw: string): Record<string, unknown> {
    const parsed = JSON.parse(cleanJson(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
}

function parseJDAnalysis(value: unknown): JDAnalysis {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY_JD_ANALYSIS;
    const obj = value as Record<string, unknown>;
    return {
        targetTitle: asString(obj.targetTitle),
        seniority: asString(obj.seniority),
        requiredSkills: asStringArray(obj.requiredSkills),
        preferredSkills: asStringArray(obj.preferredSkills),
        requirements: asStringArray(obj.requirements),
        keyVerbs: asStringArray(obj.keyVerbs),
        keyPhrases: asStringArray(obj.keyPhrases),
        companyDomain: asString(obj.companyDomain),
    };
}

function parseSectionsObject(value: unknown, fallback: ResumeSections | TailoredSections): TailoredSections {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return toTailoredSections(fallback);
    return mergeTailoredSections(fallback, value as Partial<TailoredSections>);
}

export function parseTailoringResponse(raw: string, fallback: ResumeSections): TailoringResponse {
    const obj = parseObject(raw);
    return {
        jdAnalysis: parseJDAnalysis(obj.jdAnalysis),
        tailoredSections: parseSectionsObject(obj.tailoredSections || obj, fallback),
        skippedRequirements: asStringArray(obj.skippedRequirements),
        warnings: asStringArray(obj.warnings),
        changeLog: Array.isArray(obj.changeLog)
            ? obj.changeLog
                .map(item => {
                    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
                    const entry = item as Record<string, unknown>;
                    return { section: asString(entry.section), reason: asString(entry.reason) };
                })
                .filter((item): item is { section: string; reason: string } => !!item?.section && !!item.reason)
            : [],
    };
}

export function parseVerificationResponse(raw: string, fallback: TailoredSections): VerificationResponse {
    const obj = parseObject(raw);
    return {
        correctedSections: parseSectionsObject(obj.correctedSections || obj.tailoredSections || obj, fallback),
        corrections: asStringArray(obj.corrections),
        warnings: asStringArray(obj.warnings),
    };
}

export function parseGapFixResponse(raw: string, fallback: TailoredSections): GapFixResponse {
    const obj = parseObject(raw);
    return {
        tailoredSections: parseSectionsObject(obj.tailoredSections || obj, fallback),
        injectedKeywords: asStringArray(obj.injectedKeywords),
        skippedKeywords: asStringArray(obj.skippedKeywords),
        warnings: asStringArray(obj.warnings),
    };
}

export function parseSectionResponse(raw: string): SectionResponse {
    const obj = parseObject(raw);
    // Support both { text } and legacy { candidates: [{ text }] } shapes
    let text = asString(obj.text);
    if (!text && Array.isArray(obj.candidates) && obj.candidates.length > 0) {
        const first = obj.candidates[0] as Record<string, unknown>;
        text = asString(first?.text);
    }
    return {
        text,
        warnings: asStringArray(obj.warnings),
    };
}