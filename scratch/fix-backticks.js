const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/api/tailor/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\\\`\\\\n## Education\\\\n\\\$\\{normalizeNewlines\\(data\.education\\)\\}/g, '`\\n## Education\\n${normalizeNewlines(data.education)}');
content = content.replace(/\\\`\\\\n## Projects\\\\n\\\$\\{normalizeNewlines\\(data\.projects\\)\\}/g, '`\\n## Projects\\n${normalizeNewlines(data.projects)}');
content = content.replace(/\\\`\\\\n## Certifications\\\\n\\\$\\{normalizeNewlines\\(data\.other\\)\\}/g, '`\\n## Certifications\\n${normalizeNewlines(data.other)}');

// Also fix the trailing backticks
content = content.replace(/\\\`/g, '`');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Syntax errors fixed.');
