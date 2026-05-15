import { cleanJson } from './generate';
import { ResumeSections } from './resume-parser';
import { KeywordHints } from './ats-scoring';

export type TailorableSectionName = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other';

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

export interface SectionCandidate {
    model: string;
    focus: string;
    text: string;
}

export interface SectionCandidateResponse {
    candidates: SectionCandidate[];
    warnings: string[];
}

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

export function reconstructResume(sections: TailoredSections): string {
    const parts: string[] = [];
    if (sections.header) parts.push(sections.header);
    if (sections.summary) parts.push(`## Summary\n${sections.summary}`);
    if (sections.experience) parts.push(`## Experience\n${sections.experience}`);
    if (sections.skills) parts.push(`## Skills\n${sections.skills}`);
    if (sections.education) parts.push(`## Education\n${sections.education}`);
    if (sections.projects) parts.push(`## Projects\n${sections.projects}`);
    if (sections.other) parts.push(`## Certifications\n${sections.other}`);
    return parts.join('\n\n').trim();
}

export function mergeJDAnalysis(hints: KeywordHints, generated?: Partial<JDAnalysis>): JDAnalysis {
    return {
        targetTitle: generated?.targetTitle || hints.targetTitle || '',
        seniority: generated?.seniority || '',
        requiredSkills: dedupe([...(hints.requiredSkills || []), ...(generated?.requiredSkills || [])]),
        preferredSkills: dedupe([...(hints.preferredSkills || []), ...(generated?.preferredSkills || [])]),
        requirements: dedupe([...(hints.requirements || []), ...(generated?.requirements || [])]),
        keyVerbs: dedupe([...(hints.keyVerbs || []), ...(generated?.keyVerbs || [])]).slice(0, 12),
        keyPhrases: dedupe([...(hints.keyPhrases || []), ...(generated?.keyPhrases || [])]).slice(0, 10),
        companyDomain: generated?.companyDomain || '',
    };
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

export function buildTailoringPrompt(sections: ResumeSections, jobDescription: string, hints: KeywordHints): string {
    return `You are tailoring a resume for a specific job. Use a balanced ATS style: exact JD terms where supported, concise professional language, and no keyword stuffing.

PRIORITY ORDER
1. Factual accuracy: the original resume is the only source of truth.
2. ATS alignment: use exact job-description terms only when the resume contains evidence for them.
3. Human readability: concise bullets, strong verbs, and plain ATS-safe Markdown.
4. Completeness: keep relevant roles/projects; prune unrelated bullets only when enough relevant evidence remains.

JOB DESCRIPTION AND USER SELECTIONS
${jobDescription}

DETERMINISTIC KEYWORD HINTS FROM UI
${JSON.stringify(hints, null, 2)}

ORIGINAL RESUME SOURCE OF TRUTH
${sectionSourceBlock(sections)}

TASK
Stage 1 - Analyze the JD:
- Extract targetTitle, seniority, requiredSkills, preferredSkills, requirements, keyVerbs, keyPhrases, and companyDomain.
- Treat "Required Skills (must target)" and "Selected Requirements" as high priority.

Stage 2 - Map evidence:
- For every required or preferred skill, decide whether the original resume supports it.
- If unsupported, do not add it. Put it in skippedRequirements with a short reason.
- Equivalent spellings are allowed only when genuinely evident, for example AWS for Amazon Web Services or NodeJS for Node.js.

Stage 3 - Rewrite:
- Header: copy the original header exactly.
- Summary: 2-3 sentences. Position the candidate for the target role without claiming the target title as a current job title unless it is already in the resume.
- Skills: group skills with ATS-friendly labels such as **Languages**, **Frameworks**, **Cloud/DevOps**, **Databases**, **Tools**, and include only evidenced skills.
- Experience: preserve real companies, roles, dates, clients, and metrics. Use 2-4 bullets per relevant role when possible. Each bullet must be one sentence, action-led, and result-oriented.
- Education: copy the original education exactly.
- Projects and certifications: keep only source-backed items that strengthen JD alignment.
- Do not mention the hiring company as an employer unless it appears in the original resume.

Stage 4 - Self-audit:
- Remove unsupported skills, numbers, certifications, company names, job titles, and responsibilities.
- Prefer omission over fabrication.

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

CHECKS
- Header must be copied exactly from the original.
- Education must be copied exactly from the original.
- Remove any unsupported skills, tools, metrics, dates, employers, titles, certifications, clients, or achievements.
- Keep JD phrasing only when the original resume clearly supports it.
- Keep ATS-safe Markdown and no section headings inside values.

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

RULES
- Make the smallest natural edit needed to include each evidenced keyword.
- Use exact JD phrasing for the keyword.
- Do not add any new responsibility, metric, credential, employer, or date.
- If a keyword cannot be added without inventing context, skip it.
- Header and education must remain copied exactly from the original.

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

export function buildSectionTailoringPrompt(params: {
    sectionName: TailorableSectionName;
    sections: ResumeSections;
    jobDescription: string;
    jdAnalysis: JDAnalysis;
}): string {
    const label = params.sectionName.toUpperCase();
    return `Create three grounded variants for only the ${label} section of this resume.

JOB DESCRIPTION AND USER SELECTIONS
${params.jobDescription}

JD ANALYSIS
${JSON.stringify(params.jdAnalysis, null, 2)}

ORIGINAL RESUME SOURCE OF TRUTH
${sectionSourceBlock(params.sections)}

SECTION-SPECIFIC RULES
- Output only ${label} content in each candidate. Do not include section headings.
- Every claim must be supported by the original resume.
- Use exact JD keywords only when supported by the original resume.
- If the section is education, preserve the original education content unless light formatting is needed.
- If the section is skills, group skills into concise ATS-friendly categories.
- If the section is experience or projects, use action-led bullets and only source-backed metrics.

Return ONLY valid JSON:
{
  "candidates": [
    { "model": "Balanced ATS", "focus": "Best balance of ATS coverage, readability, and factual fidelity", "text": "section content only" },
    { "model": "Keyword Coverage", "focus": "More exact JD phrasing while staying grounded", "text": "section content only" },
    { "model": "Concise Impact", "focus": "Tighter human-readable version with strong impact language", "text": "section content only" }
  ],
  "warnings": ["brief warning"]
}`;
}

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

export function parseSectionCandidateResponse(raw: string): SectionCandidateResponse {
    const obj = parseObject(raw);
    const candidates = Array.isArray(obj.candidates)
        ? obj.candidates
            .map((item, index) => {
                if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
                const candidate = item as Record<string, unknown>;
                return {
                    model: asString(candidate.model) || `Variant ${index + 1}`,
                    focus: asString(candidate.focus) || 'Balanced ATS tailoring',
                    text: asString(candidate.text),
                };
            })
            .filter((item): item is SectionCandidate => !!item?.text)
        : [];

    return {
        candidates,
        warnings: asStringArray(obj.warnings),
    };
}
