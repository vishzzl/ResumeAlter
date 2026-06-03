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
    'You are a professional resume writer and ATS optimization specialist. You operate under these immutable rules:',
    'RULE 1 — FACTUAL INTEGRITY: The original resume is the sole source of truth. Never invent, embellish, or transplant skills, metrics, dates, employers, titles, credentials, tools, projects, clients, or responsibilities. When in doubt, OMIT rather than fabricate.',
    'RULE 2 — OUTPUT FORMAT: Return only valid JSON when JSON is requested. No markdown code fences. No commentary outside the JSON object. Ensure all string values use proper JSON escaping.',
    'RULE 3 — DETERMINISM: For immutable sections (header, education), copy the original content character-for-character. Do not reformat, reorder, or "improve" these sections.',
    'RULE 4 — ATS ALIGNMENT: Use exact JD terminology only when the original resume provides supporting evidence. Prefer omission over keyword stuffing.',
].join(' ');

export const SECTION_SYSTEM_INSTRUCTION = [
    'You are a professional resume writer who creates grounded, ATS-aware section variants.',
    'Return only valid JSON with no markdown fences. No commentary outside the JSON object.',
    'Every claim must be supported by the original resume context. Never transplant metrics, skills, or achievements from one role or project to another.',
    'When in doubt between adding an unsupported claim and omitting it, always omit.',
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

PRIORITY ORDER (each level OVERRIDES the ones below it):
1. FACTUAL ACCURACY — if a claim cannot be verified from the original resume, OMIT it. This overrides all ATS and readability goals.
2. ATS ALIGNMENT — use exact JD terms, but only when the resume contains supporting evidence.
3. HUMAN READABILITY — concise bullets, strong verbs, plain ATS-safe Markdown.
4. COMPLETENESS — keep relevant roles/projects; prune unrelated bullets only when enough relevant evidence remains.
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
- For every required or preferred skill, decide whether the original resume supports it with substantive evidence (appears in a skill list, project description, or experience bullet describing direct hands-on work).
- If unsupported, do not add it. Put it in skippedRequirements with a short reason.
- Equivalent spellings are allowed ONLY for identical tools with variant notation (e.g. "AWS" ↔ "Amazon Web Services", "Node.js" ↔ "NodeJS", "PostgreSQL" ↔ "Postgres"). Do NOT treat related-but-different tools as equivalent (e.g. "React" ≠ "React Native", "Python" ≠ "Python scripting", "Java" ≠ "JavaScript", "AWS Lambda" ≠ "AWS").

Stage 3 — Rewrite with these rules:

HEADER
- Copy the original header exactly, character for character.

SUMMARY (2–3 sentences using this formula)
- Sentence 1: [Role identity from the resume] with [X years / domain] experience in [core areas most relevant to JD].
- Sentence 2: [Most relevant evidenced achievement or strength aligned to JD].
- Sentence 3 (optional): Forward-looking fit statement. You MUST NOT use the JD's target title anywhere in the summary unless that EXACT title (case-insensitive) already appears in the resume's header or experience section. If in doubt, describe the candidate's trajectory without naming the target title.

SKILLS
- Group skills into ATS-friendly bold-labelled categories. Use these standard categories when applicable: **Languages**, **Frameworks**, **Cloud / DevOps**, **Databases**, **Tools**. If the resume contains skills that don't fit these (e.g., ML/AI, Data Engineering, Design, Testing), create additional categories using the same **Bold** format. Match category names from the original resume when possible.
- Include only skills evidenced in the original resume with substantive usage.
- Do not list a skill more than once across groups.

EXPERIENCE
- Preserve real companies, roles, dates, clients, and metrics exactly as written.
- Preserve ALL roles from the original, including short-tenure positions (< 6 months). Do not add explanations for career gaps that are not in the original resume.
- Use past tense for roles that have ended; use present tense for the current role only.
- Retain ALL bullets from the original role, then prune to the best 3–6 bullets that demonstrate JD-relevant skills, measurable outcomes, or scope. If the original role has ≤ 6 bullets, keep all of them. If it has > 6, retain the top 6 ranked by JD relevance, and merge or drop the rest. Never add bullets that are not grounded in the original.
- Each bullet must be one sentence, 100–180 characters (excluding the leading "- "), action-led, and result-oriented.
- Preserve exact numbers, percentages, timeframes, and dollar amounts. Never round, approximate, or transplant a metric from one role to another.
- Vary action verbs across bullets; do not repeat the same opening verb more than twice in the entire section.

EDUCATION
- Copy the original education section exactly, character for character.

PROJECTS & CERTIFICATIONS
- Keep only source-backed items that strengthen JD alignment.
- Do not mention the hiring company as an employer unless it appears in the original resume.

Stage 4 — Self-audit (perform these checks IN ORDER and record violations in warnings[]):
CHECK-1: For each skill in tailoredSections.skills, verify it appears (same skill, not just same category) in the original resume. If not → remove it and add a warning.
CHECK-2: For each number/metric/percentage in experience bullets, verify the EXACT number exists in the original resume within the SAME role context. If not → remove the entire metric phrase and add a warning.
CHECK-3: Verify tailoredSections.header === original header (character-for-character).
CHECK-4: Verify tailoredSections.education === original education (character-for-character).
CHECK-5: Scan summary, skills, experience, projects, other for any email address or phone number not present in the original header. If found → remove it and add a warning.
CHECK-6: Count opening action verbs across all experience bullets. If any verb appears > 2 times → rewrite the excess occurrences with synonyms.

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
    { "section": "summary", "action": "rewritten", "reason": "what changed and why" }
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

VERIFICATION TASK — Compare each field of TAILORED SECTIONS against the ORIGINAL RESUME:

For each section (summary, skills, experience, projects, other):
1. List every factual claim (skill, metric, employer, title, date, tool, certification) in the tailored version.
2. For each claim, find the supporting evidence in the original resume.
3. If no supporting evidence exists → REMOVE the claim from correctedSections and record it in corrections[].
4. If the claim exists but uses different phrasing that changes meaning → RESTORE the original phrasing.

IMPORTANT: Your goal is to REMOVE fabrications, NOT to undo legitimate improvements. If the tailored version rephrases an original bullet using better action verbs or JD-aligned terminology but the underlying fact is the same, KEEP the improved version.

IMMUTABLE SECTIONS (copy character-for-character from original):
- header
- education

ADDITIONAL CHECKS:
- No contact details (email, phone, LinkedIn URL) in body sections unless already present in the original.
- Past tense for ended roles; present tense only for current role.
- ATS-safe Markdown only. No section headings inside JSON string values.
- Do NOT transplant metrics from one role to another. Each number must match the role context it came from.

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
  "corrections": ["what was removed or restored and why"],
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

INJECTION LIMITS (to prevent keyword stuffing)
- Skills section: Add at most 8 keywords per pass.
- Experience bullets: Modify at most 3 bullets per pass.
- Summary: Modify at most 1 sentence.
- If more keywords remain after these limits, put them in skippedKeywords with reason "injection limit reached".

RULES
- For each keyword, make a SINGLE atomic edit: either (a) append the keyword to an existing comma-separated list in Skills, OR (b) insert 1–3 words into an existing bullet to naturally include the keyword. Do not restructure, reorder, or rewrite sentences beyond the insertion point.
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
        prefInstructions.push('QUANTIFY: Make implicit metrics explicit ONLY when the number exists in the SAME role or project context. If the original says "improved performance" for a specific role, and that SAME role description contains a number (e.g., "50% latency reduction"), you may combine them. NEVER transplant a metric from one role/project to another. If no number exists in the same context, leave the claim qualitative. Do NOT invent numbers.');
    }
    if (prefs.includes('keywords')) {
        prefInstructions.push('KEYWORD-HEAVY: Maximize coverage of exact JD keywords and phrases. Weave them naturally into bullets and descriptions. Prioritize required skills over preferred skills. Use the exact phrasing from the job description where possible. Only include keywords that are evidenced in the original resume.');
    }
    if (prefs.includes('concise')) {
        prefInstructions.push('CONCISE: Each bullet must be 60–100 characters (excluding leading dash). Remove filler words, adverbs, and padding. One concrete achievement per bullet. Favor brevity over detail.');
    }
    if (prefs.includes('detailed')) {
        prefInstructions.push('DETAILED: Use full STAR format (Situation → Task → Action → Result) for each major bullet. Target 150–250 characters per bullet to accommodate the full STAR format. Provide context about the project scope, your specific role, technologies used, and measurable outcomes.');
    }
    if (prefs.includes('reword')) {
        prefInstructions.push('REWORD ONLY: Preserve the original structure, bullet count, and factual content exactly. Only make these specific changes: (a) Replace passive voice ("was responsible for") with active voice ("Led", "Architected"). (b) Replace generic terms with exact JD terminology when meaning is identical (e.g., "built APIs" → "developed RESTful APIs" if JD says "RESTful APIs" and the original context supports REST). Do NOT add, remove, merge, split, or reorder any bullets. ALLOWED example: "Managed a team" → "Led a cross-functional team" (if evidence supports cross-functional). FORBIDDEN example: "Built backend services" → "Architected microservices on AWS" (changes scope and adds unsupported detail).');
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
- Every claim must be supported by the original resume. Never transplant metrics or achievements from one role/project to another.
- Use exact JD keywords only when supported by the original resume.
- If the section is SUMMARY, limit to 2–3 sentences (40–80 words total). Do NOT use the JD's target title unless it already appears in the resume.
- If the section is EDUCATION, preserve the original education content unless light formatting is needed.
- If the section is SKILLS, group skills into concise ATS-friendly bold-label categories. Limit to 6–10 category lines. Do not create categories with fewer than 2 items.
- If the section is EXPERIENCE or PROJECTS:
  - Use action-led bullets and only source-backed metrics.
  - Past tense for ended roles; present tense for the current role only.
  - Preserve exact numbers, percentages, timeframes, and dollar amounts.
  - Vary opening action verbs; do not repeat the same verb more than twice.
  - Bullet character targets: ${prefs.includes('concise') ? '60–100' : prefs.includes('detailed') ? '150–250' : '100–180'} characters per bullet (excluding leading dash).

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