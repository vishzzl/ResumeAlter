const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/applications/[id]/client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove tailorEngine state
content = content.replace(/const \[tailorEngine, setTailorEngine\] = useState<'standard' \| 'ensemble'>\('standard'\);\s*\n/g, '');

// 2. Remove ensembleData state
content = content.replace(/const \[ensembleData, setEnsembleData\] = useState[\s\S]*?\} \| null>\(null\);\s*\n/g, '');

// 3. Remove selectedCandidate state
content = content.replace(/const \[selectedCandidate, setSelectedCandidate\] = useState<number>\(0\);\s*\n/g, '');

// 4. Remove ensemble handleTailor logic
content = content.replace(/if \(tailorEngine === 'ensemble'\) \{[\s\S]*?toast\.error\('❌ Tailoring failed[^;]*;\n\s*setTailorPhase\(null\);\n\s*\} finally \{\n\s*setLoading\(false\);\n\s*\}\n\s*return;\n\s*\}/g, '');

// 5. Remove select dropdown
content = content.replace(/<select\s+value=\{tailorEngine\}[\s\S]*?<\/select>\s*\n/g, '');

// 6. Remove Ensemble Comparison Panel
content = content.replace(/\{\/\*\s*🧪 Ensemble Comparison Panel\s*\*\/\}[\s\S]*?\{ensembleData && tailorEngine === 'ensemble' && tailoredResume && \([\s\S]*?\}\s*\)\s*\}/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('UI cleanup complete.');
