const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/api/tailor/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Use a more robust regex to find the tailoredResume block
const startMarker = 'const tailoredResume = [';
const endMarker = '].join(\'\\\\n\').trim();';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const newBlock = `const tailoredResume = [
                    normalizeNewlines(data.header) || sections.header,
                    '',
                    '## Summary',
                    normalizeNewlines(data.summary) || sections.summary,
                    '',
                    '## Experience',
                    normalizeNewlines(data.experience) || sections.experience,
                    '',
                    '## Skills',
                    normalizeNewlines(data.skills) || sections.skills,
                    '',
                    data.education ? '## Education\\n' + normalizeNewlines(data.education) : '',
                    '',
                    data.projects ? '## Projects\\n' + normalizeNewlines(data.projects) : '',
                    '',
                    data.other ? '## Certifications\\n' + normalizeNewlines(data.other) : ''
                ].filter(Boolean).join('\\n\\n').trim();`;

    content = content.substring(0, startIdx) + newBlock + content.substring(endIdx + endMarker.length);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('tailoredResume block rewritten successfully.');
} else {
    console.error('Could not find tailoredResume block.');
}
