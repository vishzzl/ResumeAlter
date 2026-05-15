const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/api/tailor/route.ts');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// View file lines are 1-indexed. Array is 0-indexed.
// Line 148: data.education ? `\\n## Education\\n\\${normalizeNewlines(data.education)}` : '',
// Line 149: data.projects ? `\\n## Projects\\n\\${normalizeNewlines(data.projects)}` : '',
// Line 150: data.other ? `\\n## Certifications\\n\\${normalizeNewlines(data.other)}` : ''

// Just forcefully replace the bad substring on those lines.
lines[147] = "                    data.education ? `\\n## Education\\n${normalizeNewlines(data.education)}` : '',";
lines[148] = "                    data.projects ? `\\n## Projects\\n${normalizeNewlines(data.projects)}` : '',";
lines[149] = "                    data.other ? `\\n## Certifications\\n${normalizeNewlines(data.other)}` : ''";

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Fixed explicitly by line index!');
