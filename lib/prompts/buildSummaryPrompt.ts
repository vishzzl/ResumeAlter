import { JDClassification } from '../jd-classifier';

/**
 * Builds the system and user prompt for the professional summary section.
 * Returns { systemPrompt, userPrompt } and is a pure function.
 * 
 * @param originalSummary The original summary text from the resume.
 * @param jdText The target job description.
 * @param classification The pre-classified industry and seniority context.
 * @param topKeywords Top 5 required skills or keywords from the JD.
 */
export function buildSummaryPrompt(
    originalSummary: string,
    jdText: string,
    classification: JDClassification,
    topKeywords: string[]
): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = [
        'You are a professional resume writer and ATS optimization specialist.',
        'RULE 1 — FACTUAL INTEGRITY: The original resume is the sole source of truth. Never invent, embellish, or transplant skills, metrics, dates, employers, titles, credentials, tools, projects, clients, or responsibilities. When in doubt, OMIT rather than fabricate.',
        'RULE 2 — OUTPUT FORMAT: Return only a single string representing the rewritten professional summary. No markdown formatting (like bolding or header tags). No JSON envelopes. No commentary.',
        'RULE 3 — SUMMARY FORMULA: Write a maximum of 3 sentences using the following formula:',
        'Sentence 1: [Role identity as currently held] with [Years or scope of experience evidenced in original] in [core areas most relevant to JD].',
        'Sentence 2: [Most relevant achievement from original that maps to JD].',
        'Sentence 3 (optional): Forward-looking fit statement.',
        'Constraint: You MUST NOT begin with "I" or use first-person pronouns (my, we, our).',
        'Constraint: You MUST NOT adopt the JD\'s target title unless the candidate already held it verbatim in their original resume. If not held, describe their trajectory without using the exact target title.'
    ].join(' ');

    const userPrompt = `
ORIGINAL RESUME SUMMARY:
"${originalSummary || '(No summary provided)'}"

JOB DESCRIPTION CONTEXT:
Industry: ${classification.industry}
Seniority: ${classification.seniority}
Job Description Text:
${jdText}

TOP 5 REQUIRED SKILLS:
${topKeywords.slice(0, 5).map(kw => `- ${kw}`).join('\n')}

Rewrite the summary according to the formula, adhering strictly to the Factual Integrity rule and the target title constraint.
`;

    return { systemPrompt, userPrompt };
}
