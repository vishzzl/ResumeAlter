const fs = require('fs');
const f = 'app/applications/[id]/client.tsx';
let c = fs.readFileSync(f, 'utf8');

// Find start of handleDownloadPDF (include the 4-space indent before `const`)
const startMarker = '    const handleDownloadPDF';
const startIdx = c.indexOf(startMarker);
if (startIdx < 0) { console.error('START not found'); process.exit(1); }

// Function ends at the next top-level `    };` (4 spaces + };)
// We find the `};` that closes the async function by scanning for the pattern
// that follows: the blank line + next handler or render comment
// Strategy: find the next `    };` after startIdx
let braceDepth = 0;
let inFunction = false;
let endIdx = -1;
for (let i = startIdx; i < c.length; i++) {
    if (c[i] === '{') {
        braceDepth++;
        inFunction = true;
    } else if (c[i] === '}') {
        braceDepth--;
        if (inFunction && braceDepth === 0) {
            // End of function body — advance to include the semicolon
            endIdx = i + 1; // after the }
            // skip optional ;
            if (c[endIdx] === ';') endIdx++;
            break;
        }
    }
}

if (endIdx < 0) { console.error('Could not find end of function'); process.exit(1); }
console.log('Function spans:', startIdx, '->', endIdx);
console.log('Old function preview:', JSON.stringify(c.slice(startIdx, startIdx + 80)));

const newFn = `    const handleDownloadPDF = async () => {
        if (!tailoredResume) {
            setError('No tailored resume to export. Please tailor the resume first.');
            return;
        }

        setPdfGenerating(true);
        try {
            const { exportResumePDF } = await import('@/lib/pdf-export');
            const fileName = ['Resume', app.companyName, app.jobTitle].filter(Boolean).join(' - ');
            await exportResumePDF(tailoredResume, { fileName });
        } catch (err) {
            console.error('PDF export failed:', err);
            setError('PDF export failed. Please try again.');
        } finally {
            setPdfGenerating(false);
        }
    };`;

c = c.slice(0, startIdx) + newFn + c.slice(endIdx);
fs.writeFileSync(f, c, 'utf8');
console.log('SUCCESS: handleDownloadPDF updated');
