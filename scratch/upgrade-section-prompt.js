const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/api/tailor-section/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

const oldPrompt = `You are an expert Resume Writer focusing on creating highly targeted, simple, and effective resumes.
Your task is to rewrite ONLY the "\${sectionName.toUpperCase()}" section of the resume.

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
1. ONLY write the \${sectionName.toUpperCase()} section.
2. DO NOT include section headers (like "## Experience") in your output.
3. You MUST focus strictly on the points, skills, requirements, and experiences selected in the "JOB DESCRIPTION, SELECTED SKILLS, & SELECTED EXPERIENCE" section above.
4. If the user selected certain skills or requirements, ensure they are explicitly mentioned and highlighted in your rewrite. DO NOT SKIP THEM.
5. If the user selected certain experiences, ONLY include roles, projects, or bullets from the ORIGINAL RESUME DATA that are relevant to those selected experiences. Omit entirely any roles or bullets that are unrelated to the selected experiences.
6. Do not hallucinate or invent facts not present in the ORIGINAL RESUME DATA. 
7. Keep the formatting simple and professional. For experience, use bullet points. For skills, group them logically.
8. Output ONLY the raw content. No preamble, no markdown formatting blocks (\`\`\`).`;

const newPrompt = `<system_role>
You are an elite, ATS-certified Executive Resume Writer. Your objective is to rewrite ONLY the "\${sectionName.toUpperCase()}" section of an applicant's resume to precisely target a specific job description, focusing intensely on the user's curated selection of skills and experiences.
</system_role>

<input_data>
<target_section>\${sectionName.toUpperCase()}</target_section>
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
1. SCOPE: Rewrite ONLY the content for the \${sectionName.toUpperCase()} section.
2. NO HEADERS: Do NOT include any section headers (e.g., do not include "## Experience").
3. STRICT TARGETING: Aggressively prioritize the points, skills, and experiences highlighted in <job_and_selections>.
4. EXPLICIT INCLUSION: Any skill designated by the user MUST be integrated into this section if it is the Skills, Summary, or Experience section.
5. EXPERIENCE FILTERING: Retain ONLY roles/projects relevant to the user-selected experiences. Prune unrelated points.
6. ZERO HALLUCINATION: Strictly grounded in the provided source data. Do not invent metrics or roles.
7. FORMATTING: Use industry-standard markdown (bullet points for experience).
8. OUTPUT: Raw content ONLY. No preamble.
</execution_directives>`;

content = content.replace(oldPrompt, newPrompt);

content = content.replace(
    `systemInstruction = 'You are an elite Resume Writer who strictly follows instructions and never hallucinates.';`,
    `systemInstruction = 'You are an elite Resume Writer who strictly follows instructions, applies ATS best practices, and never hallucinates.';`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Section prompt upgraded.');
