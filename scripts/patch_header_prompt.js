const fs = require('fs');
const f = 'app/api/tailor/route.ts';
let c = fs.readFileSync(f, 'utf8');

const needle = '1. **Header**: ';
const idx = c.indexOf(needle);
if (idx < 0) { console.error('not found'); process.exit(1); }

// Find the end of the header section (next numbered item)
const nextItem = '\n2. **Summary**';
const endIdx = c.indexOf(nextItem, idx);
if (endIdx < 0) { console.error('end not found'); process.exit(1); }

const newHeader = `1. **Header**: 
   - **Name**: MUST start with \\\`# \\\` followed by the candidate's name (Markdown H1 format). Do NOT omit the \\\`# \\\`.
   - **Contact**: On the SECOND line, provide email, phone, location, and links EXACTLY separated by \\\` | \\\`. Do NOT use bullet points. Do NOT use multiple lines for contact info.
   - **CRITICAL for links**: LinkedIn, GitHub, Portfolio and any URLs MUST use Markdown link format: \\\`[LinkedIn](https://linkedin.com/in/...)\\\`, \\\`[GitHub](https://github.com/...)\\\`. NEVER output a bare URL like \\\`linkedin.com/in/...\\\` — it will break PDF formatting.
   - You MUST output EXACTLY 2 lines for the header. Example:
     # John Doe
     john@email.com | (555) 123-4567 | San Francisco, CA | [LinkedIn](https://linkedin.com/in/johndoe) | [GitHub](https://github.com/johndoe)
`;

c = c.slice(0, idx) + newHeader + c.slice(endIdx);
fs.writeFileSync(f, c, 'utf8');
console.log('SUCCESS');
