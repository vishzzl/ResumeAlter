const fs = require('fs');
const f = 'app/api/tailor/route.ts';
let c = fs.readFileSync(f, 'utf8');

// Find the Content sub-section and replace with one-page rules
// Use indexOf to locate
const needle = '   - **Content**:';
const idx = c.indexOf(needle);
if (idx < 0) { console.error('needle not found'); process.exit(1); }

// Find the next item ending (two bullets after it)
const bulletEnd = '     - For each role, include 2-4 bullets ordered by relevance to the JD.';
const endIdx = c.indexOf(bulletEnd, idx);
if (endIdx < 0) { console.error('end not found'); process.exit(1); }

const replacement = `   - **Content (ONE-PAGE RULE)**:
     - MAX 2-3 bullets per role \u2014 keep only the most impactful ones.
     - MAX 3 job roles total \u2014 include only the 3 most recent or most relevant.
     - Each bullet must be ONE sentence, \u226425 words.`;

c = c.slice(0, idx) + replacement + c.slice(endIdx + bulletEnd.length);
fs.writeFileSync(f, c, 'utf8');
console.log('SUCCESS');
