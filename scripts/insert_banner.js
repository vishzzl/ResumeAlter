const fs = require('fs');
const f = 'app/applications/[id]/client.tsx';
let c = fs.readFileSync(f, 'utf8');

const marker = '{/* \u2501\u2501\u2501 Main Workspace \u2501\u2501\u2501 */}';
const idx = c.indexOf(marker);
if (idx < 0) {
    console.log('Main Workspace marker not found, trying alternate...');
    // Try finding by nearby class
    const alt = 'flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-auto';
    const altIdx = c.indexOf(alt);
    if (altIdx >= 0) {
        console.log('Found by class at', altIdx);
    }
    process.exit(1);
}

const banner = `            {/* \u2501\u2501\u2501 SSE Incomplete Warning \u2501\u2501\u2501 */}
            {sseIncomplete && (
                <div className="animate-fade-in-up mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm print:hidden" role="alert">
                    <span className="shrink-0">\u26a0\ufe0f</span>
                    <p className="flex-1 min-w-0 text-xs">
                        <span className="font-semibold">Tailoring may be incomplete</span> \u2014 the process was interrupted. Try tailoring again if anything looks off.
                    </p>
                    <button onClick={() => setSseIncomplete(false)} className="p-1 rounded hover:bg-amber-100 transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            `;

c = c.slice(0, idx) + banner + c.slice(idx);
fs.writeFileSync(f, c, 'utf8');
console.log('SUCCESS: Banner inserted at index', idx);
