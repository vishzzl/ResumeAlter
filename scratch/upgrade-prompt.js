const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/api/tailor/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

const oldPrompt = `You are an expert Resume Writer focusing on creating highly targeted, simple, and effective resumes.
Your task is to rewrite the resume based strictly on the job description, user-selected skills, and user-selected experiences.

JOB DESCRIPTION, SELECTED SKILLS, & SELECTED EXPERIENCE:
\${jobDescription}

ORIGINAL RESUME DATA (Your Source of Truth):
--- HEADER ---
\${sections.header}
--- SUMMARY ---
\${sections.summary}
--- SKILLS ---
\${sections.skills}
--- EXPERIENCE ---
\${sections.experience}
--- EDUCATION ---
\${sections.education}
--- PROJECTS ---
\${sections.projects}
--- CERTIFICATIONS & OTHER ---
\${sections.other}

CRITICAL INSTRUCTIONS:
1. You MUST focus strictly on the points, skills, requirements, and experiences selected in the "JOB DESCRIPTION, SELECTED SKILLS, & SELECTED EXPERIENCE" section above.
2. If the user selected certain skills or requirements, ensure they are explicitly mentioned and highlighted in your rewrite (e.g. in Summary, Skills, or Experience). DO NOT SKIP THEM.
3. If the user selected certain experiences, ONLY include roles, projects, or bullets from the ORIGINAL RESUME DATA that are relevant to those selected experiences. Omit entirely any roles or bullets that are unrelated to the selected experiences.
4. Do not hallucinate or invent facts not present in the ORIGINAL RESUME DATA. 
5. Output your response purely as JSON in the exact format shown below.

OUTPUT FORMAT (JSON ONLY):`;

const newPrompt = `<system_role>
You are an elite, ATS-certified Executive Resume Writer with deep expertise in optimizing professional profiles for Applicant Tracking Systems (ATS) and strict factual fidelity. Your objective is to seamlessly tailor an applicant's existing resume to precisely target a specific job description, focusing intensely on the user's curated selection of skills and experiences.
</system_role>

<input_data>
<job_and_selections>
\${jobDescription}
</job_and_selections>

<original_resume_source_of_truth>
--- HEADER ---
\${sections.header}
--- SUMMARY ---
\${sections.summary}
--- SKILLS ---
\${sections.skills}
--- EXPERIENCE ---
\${sections.experience}
--- EDUCATION ---
\${sections.education}
--- PROJECTS ---
\${sections.projects}
--- CERTIFICATIONS & OTHER ---
\${sections.other}
</original_resume_source_of_truth>
</input_data>

<execution_directives>
1. STRICT TARGETING: You must aggressively prioritize the points, skills, requirements, and experiences explicitly highlighted in the <job_and_selections> section.
2. EXPLICIT SKILL INCLUSION: Any skill or requirement designated by the user MUST be organically and explicitly integrated into the Summary, Skills section, or Professional Experience bullets. DO NOT omit user-selected requirements.
3. EXPERIENCE FILTERING: Scrutinize the <original_resume_source_of_truth>. Retain ONLY the professional roles, projects, and bullet points that demonstrate relevance to the user-selected experiences or the core job description. Ruthlessly prune unrelated or distractive experience points.
4. ZERO HALLUCINATION POLICY: Your output must be strictly grounded in the provided <original_resume_source_of_truth>. Under no circumstances are you permitted to invent, embellish, or hallucinate metrics, roles, dates, or skills. If a required skill is entirely absent from the source data, do not invent an experience to cover it.
5. FORMATTING EXCELLENCE: Output the resume adhering to industry-standard markdown styling within the specified JSON schema. Use strong action verbs and maintain a professional, confident tone.
</execution_directives>

<output_schema>
Respond PURELY as a valid JSON object matching this exact schema. Do not include markdown fences.`;

content = content.replace(oldPrompt, newPrompt);

// Also upgrade the system instruction
content = content.replace(
    `systemInstruction: 'You are an elite Resume Writer who strictly follows instructions and never hallucinates. You always output valid JSON.',`,
    `systemInstruction: 'You are an elite Resume Writer who strictly follows instructions, applies ATS best practices, and never hallucinates. You always output valid JSON.',`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Prompt upgraded.');
