const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/api/tailor/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// The file literally contains:
// data.education ? `\n## Education\n\${normalizeNewlines(data.education)}` : '',
// We want to remove the backslash before the $ sign.

content = content.replace(/\\\$\\{normalizeNewlines/g, '${normalizeNewlines');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Interpolation fixed.');
