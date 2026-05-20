const fs = require('fs');

const file = 'app/api/tailor/route.ts';
let content = fs.readFileSync(file, 'utf8');

// The exact closing sequence from the debug output:  }`;  (backtick then semicolon with CRLF)
const END_MARKER = '}\`;\r\n\r\n                try {\r\n                    console.log(\"Phase 1.5: Verifying Content (CoVe)...\")';

const idx = content.indexOf(END_MARKER);
if (idx < 0) {
    // Try with \n instead of \r\n
    const END_MARKER2 = '}`;\n\n                try {\n                    console.log("Phase 1.5: Verifying Content (CoVe)...")';
    const idx2 = content.indexOf(END_MARKER2);
    if (idx2 < 0) {
        console.log('ERROR: End marker not found');
        process.exit(1);
    }
    console.log('Found with LF at', idx2);
}

console.log('Found END marker at index:', idx);

// Find the start of our block: "3. **Summary**..."
// We need the SECOND occurrence since there may be a similar block elsewhere
const startMarker = '3. **Summary**: Ensure it accurately reflects the original resume\'s level of experience. Keyword inclusion is FINE.\r\n4. **Education**: Ensure no degrees, institutions, or honors were fabricated.';
const summaryIdx = content.lastIndexOf(startMarker, idx);

if (summaryIdx < 0) {
    console.log('ERROR: Start marker not found before end marker');
    process.exit(1);
}

console.log('Found START marker at index:', summaryIdx);



// The new block replaces from summaryIdx to idx+3 (the }`; part)
const endOfBlock = idx + 3; // `}` + backtick + semicolon

const newBlock = `3. **Summary**: Ensure it accurately reflects the original resume's level of experience. Keyword inclusion is FINE.\r\n4. **Header**: Ensure the candidate's name and contact details are unchanged from the original. Format MUST be: \`# Name\` on line 1, contact info on line 2 separated by \` | \`.\r\n5. **Education**: Ensure no degrees, institutions, or honors were fabricated. Return education unchanged if it is correct.\r\n\r\nOUTPUT FORMAT (JSON ONLY, use \\\\\\\\n for newlines inside strings. Output ALL sections below):\r\n{\r\n    "header": "# Name\\\\\\\\nemail | phone | ...",\r\n    "summary": "...",\r\n    "skills": "...",\r\n    "experience": "...",\r\n    "education": "**Degree** | **University** | **Dates**",\r\n    "projects": "...",\r\n    "corrections": [\r\n        {"section": "skills", "action": "removed", "detail": "Kubernetes - not in original resume"}\r\n    ]\r\n}\``;

content = content.slice(0, summaryIdx) + newBlock + content.slice(endOfBlock);
fs.writeFileSync(file, content, 'utf8');
console.log('SUCCESS: CoVe schema updated with header + education');
