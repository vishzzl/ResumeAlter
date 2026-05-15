const fs = require('fs');

function updateFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Update "JOB DESCRIPTION & SELECTED SKILLS/REQUIREMENTS:"
    content = content.replace(
        'JOB DESCRIPTION & SELECTED SKILLS/REQUIREMENTS:',
        'JOB DESCRIPTION, SELECTED SKILLS, & SELECTED EXPERIENCE:'
    );

    // Update section prompt instructions
    if (file.includes('tailor-section')) {
        content = content.replace(
            /CRITICAL INSTRUCTIONS:[\s\S]*?7\. Output ONLY the raw content\..*?\n/m,
`CRITICAL INSTRUCTIONS:
1. ONLY write the \${sectionName.toUpperCase()} section.
2. DO NOT include section headers (like "## Experience") in your output.
3. You MUST focus strictly on the points, skills, requirements, and experiences selected in the "JOB DESCRIPTION, SELECTED SKILLS, & SELECTED EXPERIENCE" section above.
4. If the user selected certain skills or requirements, ensure they are explicitly mentioned and highlighted in your rewrite. DO NOT SKIP THEM.
5. If the user selected certain experiences, ONLY include roles, projects, or bullets from the ORIGINAL RESUME DATA that are relevant to those selected experiences. Omit entirely any roles or bullets that are unrelated to the selected experiences.
6. Do not hallucinate or invent facts not present in the ORIGINAL RESUME DATA.
7. Keep the formatting simple and professional. For experience, use bullet points. For skills, group them logically.
8. Output ONLY the raw content. No preamble, no markdown formatting blocks (\`\`\`).
`
        );
    } else {
        content = content.replace(
            /CRITICAL INSTRUCTIONS:[\s\S]*?4\. Output your response purely as JSON.*?\n/m,
`CRITICAL INSTRUCTIONS:
1. You MUST focus strictly on the points, skills, requirements, and experiences selected in the "JOB DESCRIPTION, SELECTED SKILLS, & SELECTED EXPERIENCE" section above.
2. If the user selected certain skills or requirements, ensure they are explicitly mentioned and highlighted in your rewrite (e.g. in Summary, Skills, or Experience). DO NOT SKIP THEM.
3. If the user selected certain experiences, ONLY include roles, projects, or bullets from the ORIGINAL RESUME DATA that are relevant to those selected experiences. Omit entirely any roles or bullets that are unrelated to the selected experiences.
4. Do not hallucinate or invent facts not present in the ORIGINAL RESUME DATA. 
5. Output your response purely as JSON in the exact format shown below.
`
        );
    }
    
    fs.writeFileSync(file, content, 'utf8');
}

updateFile('app/api/tailor/route.ts');
updateFile('app/api/tailor-section/route.ts');
