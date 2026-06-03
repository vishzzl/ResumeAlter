import { JDClassification } from '../jd-classifier';

/**
 * Builds the system and user prompt for a single work experience role.
 * Returns { systemPrompt, userPrompt } and is a pure function.
 * 
 * @param role The original role object (with title, employer, dates, original bullets).
 * @param jdText The target job description.
 * @param classification The pre-classified industry and seniority context.
 */
export function buildExperiencePrompt(
    role: {
        title: string;
        company: string;
        location?: string;
        period?: string;
        bullets: string[];
    },
    jdText: string,
    classification: JDClassification
): { systemPrompt: string; userPrompt: string } {
    const actionVerbs = [
        'Architected', 'Designed', 'Developed', 'Implemented', 'Led', 'Managed', 'Directed', 'Created',
        'Built', 'Engineered', 'Optimized', 'Scaled', 'Automated', 'Delivered', 'Launched', 'Migrated',
        'Streamlined', 'Formulated', 'Expanded', 'Cultivated', 'Spearheaded', 'Secured', 'Drove',
        'Orchestrated', 'Integrated', 'Overhauled', 'Maximized', 'Minimized', 'Refactored',
        'Established', 'Executed', 'Maintained', 'Authored', 'Pioneered', 'Rescued', 'Negotiated',
        'Mentored', 'Standardized', 'Consolidated', 'Analyzed', 'Facilitated', 'Coordinated',
        'Reduced', 'Accelerated', 'Improved'
    ];

    const systemPrompt = [
        'You are a professional resume writer and ATS optimization specialist.',
        'RULE 1 — FACTUAL INTEGRITY & METRIC PRESERVATION: The original bullets are the sole source of truth.',
        'Every number, $ amount, and % value in the output bullets must also be present verbatim in the original bullets of the role.',
        'Never round, approximate, or transplant a metric from another role, and never invent metrics. If in doubt, keep it qualitative.',
        'RULE 2 — OUTPUT FORMAT: Return only a valid JSON array of rewritten bullet strings. No markdown code fences. No commentary.',
        'RULE 3 — STAR METHOD & BULLET QUALITY:',
        'Provide between 4 and 6 bullets for this role. If the original has fewer, you may write fewer (min 3) but target 4-6 if possible.',
        'Each bullet must be one sentence, between 100 and 180 characters long (excluding the leading "- " or bullet character).',
        'Each bullet must begin with a strong past-tense action verb from the approved list:',
        actionVerbs.join(', ') + '.',
        'Use the STAR method (Situation/Task, Action, Result) to frame achievements with strong impact clauses.'
    ].join(' ');

    const userPrompt = `
ORIGINAL ROLE DETAILS:
Company: ${role.company}
Title: ${role.title}
Location: ${role.location || ''}
Period: ${role.period || ''}
Original Bullets:
${role.bullets.map(b => `- ${b}`).join('\n')}

JOB DESCRIPTION CONTEXT:
Industry: ${classification.industry}
Seniority: ${classification.seniority}
Job Description:
${jdText}

Rewrite the experience bullets for this specific role. Make sure the output is a JSON array of strings:
[
  "bullet 1",
  "bullet 2",
  ...
]
`;

    return { systemPrompt, userPrompt };
}
export type ExperiencePromptRoleInput = Parameters<typeof buildExperiencePrompt>[0];
