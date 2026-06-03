import { JDClassification } from '../jd-classifier';

/**
 * Builds the system and user prompt for the skills section.
 * Returns { systemPrompt, userPrompt } and is a pure function.
 * 
 * @param originalSkills The original skills text or list from the resume.
 * @param jdText The target job description.
 * @param classification The pre-classified industry and seniority context.
 */
export function buildSkillsPrompt(
    originalSkills: string,
    jdText: string,
    classification: JDClassification
): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = [
        'You are a professional resume writer and ATS optimization specialist.',
        'RULE 1 — FACTUAL INTEGRITY: The original skills list is the sole source of truth. You may only list skills present in the original skills section. Do not add skills mentioned in the JD that are absent from the original.',
        'RULE 2 — OUTPUT FORMAT: Return only a valid JSON object with skill categories as keys and arrays of skill strings as values. No markdown code fences. No commentary.',
        'RULE 3 — ATS CATEGORIES: Group skills into ATS-friendly categories. Use these standard categories when applicable: "Languages", "Frameworks", "Cloud Platforms", "Databases", "Tools". You may create other categories (e.g. "Concepts", "Libraries") only if needed to fit original skills.',
        'Rule 4: Every skill returned must be a string and must match the spelling in the original resume or represent a direct casing/alias match (e.g. "ReactJS" for "React").'
    ].join(' ');

    const userPrompt = `
ORIGINAL SKILLS:
${originalSkills || '(No skills listed)'}

JOB DESCRIPTION CONTEXT:
Industry: ${classification.industry}
Seniority: ${classification.seniority}
Job Description:
${jdText}

Organize the original skills into the ATS-friendly JSON category map. Do not add any new skills.
`;

    return { systemPrompt, userPrompt };
}
