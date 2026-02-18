import React, { useState, useMemo } from 'react';
import * as diff from 'diff';
import { ChevronDown } from 'lucide-react';

interface DiffViewerProps {
    oldText: string;
    newText: string;
}

type DiffRow = {
    left?: { line: string; lineNumber: number; type: 'removed' | 'unchanged' | 'modified_old' };
    right?: { line: string; lineNumber: number; type: 'added' | 'unchanged' | 'modified_new' };
    isCollapsed?: boolean;
};

export const DiffViewer: React.FC<DiffViewerProps> = ({ oldText, newText }) => {
    const [expandedBlocks, setExpandedBlocks] = useState<Record<number, boolean>>({});

    const rows = useMemo(() => {
        const lineDiffs = diff.diffLines(oldText || '', newText || '');
        const result: DiffRow[] = [];
        let leftLineNum = 1;
        let rightLineNum = 1;

        for (let i = 0; i < lineDiffs.length; i++) {
            const part = lineDiffs[i];
            const lines = part.value.split('\n');
            if (lines[lines.length - 1] === '') lines.pop();

            if (part.added) {
                // Check if previous was removed to group into 'modified'
                // This logic needs to look back at the *result* array to find the 'removed' rows
                // OR we can peek ahead/behind in the loop.
                // Simpler: Just render added. If we want alignment, we need to handle it when processing 'removed'.
                // Let's change strategy: Look ahead.

                // Since we are iterating, 'added' comes after 'removed' usually.
                // But let's handle it simply:
                // If we are at an 'added' block, we just adding rows with Right content.
                // Unless we want to try to "backfill" into empty Right slots of previous 'Removed' rows?
                // That's the "Modified" alignment visual.

                // Let's try to align if the previous rows were 'removed' and have empty 'right'.
                let startBackfill = result.length - 1;
                while (startBackfill >= 0 && result[startBackfill].left?.type === 'removed' && !result[startBackfill].right) {
                    startBackfill--;
                }
                startBackfill++; // The first index that is pure 'removed'

                const removedCount = result.length - startBackfill;

                // If we have a block of removed rows at the end, we can align this added block with them.
                if (removedCount > 0 && result[result.length - 1].left?.type === 'removed') {
                    lines.forEach((line, idx) => {
                        if (idx < removedCount) {
                            // Match with existing removed row
                            const row = result[startBackfill + idx];
                            row.right = { line, lineNumber: rightLineNum++, type: 'modified_new' };
                            if (row.left) row.left.type = 'modified_old'; // Upgrade type
                        } else {
                            // New row needed (added is longer than removed)
                            result.push({
                                right: { line, lineNumber: rightLineNum++, type: 'added' }
                            });
                        }
                    });
                } else {
                    // Just standard added rows
                    lines.forEach(line => {
                        result.push({
                            right: { line, lineNumber: rightLineNum++, type: 'added' }
                        });
                    });
                }

            } else if (part.removed) {
                lines.forEach(line => {
                    result.push({
                        left: { line, lineNumber: leftLineNum++, type: 'removed' }
                    });
                });
            } else {
                lines.forEach(line => {
                    result.push({
                        left: { line, lineNumber: leftLineNum++, type: 'unchanged' },
                        right: { line, lineNumber: rightLineNum++, type: 'unchanged' }
                    });
                });
            }
        }
        return result;
    }, [oldText, newText]);


    // Identify collapsible blocks
    // A block is collapsible if it has > 4 unchanged rows
    const renderRows = () => {
        const rendered: React.ReactNode[] = [];
        let collapseBuffer: DiffRow[] = [];
        let bufferStartIndex = -1;

        const flushBuffer = (idx: number) => {
            if (collapseBuffer.length === 0) return;

            if (collapseBuffer.length > 4 && !expandedBlocks[bufferStartIndex]) {
                // Render collapsed placeholder
                rendered.push(
                    <tr key={`collapse-${bufferStartIndex}`} className="bg-gray-50 border-y border-gray-100 group cursor-pointer hover:bg-gray-100" onClick={() => setExpandedBlocks(p => ({ ...p, [bufferStartIndex]: true }))}>
                        <td colSpan={4} className="py-2 px-4 text-center text-gray-400 select-none text-[10px]">
                            <div className="flex items-center justify-center gap-2">
                                <ChevronDown className="h-3 w-3" />
                                <span>Expand {collapseBuffer.length} unchanged lines</span>
                            </div>
                        </td>
                    </tr>
                );
            } else {
                // Render all normally
                collapseBuffer.forEach((row, i) => {
                    rendered.push(renderSingleRow(row, bufferStartIndex + i));
                });
            }
            collapseBuffer = [];
            bufferStartIndex = -1;
        };

        const renderSingleRow = (row: DiffRow, idx: number) => {
            // Word diff highlighting for modified rows
            let leftContent: React.ReactNode = row.left?.line;
            let rightContent: React.ReactNode = row.right?.line;

            if (row.left?.type === 'modified_old' && row.right?.type === 'modified_new') {
                const wordDiffs = diff.diffWordsWithSpace(row.left.line, row.right.line);

                leftContent = wordDiffs.map((part, i) => {
                    if (part.added) return null;
                    return <span key={i} className={part.removed ? 'bg-red-200 text-red-900 rounded-[1px]' : ''}>{part.value}</span>;
                });

                rightContent = wordDiffs.map((part, i) => {
                    if (part.removed) return null;
                    return <span key={i} className={part.added ? 'bg-green-200 text-green-900 rounded-[1px]' : ''}>{part.value}</span>;
                });
            }

            return (
                <tr key={idx} className="hover:bg-gray-50/50">
                    {/* LEFT SIDE */}
                    <td className={`w-8 select-none text-right pr-2 text-[10px] leading-5 py-0.5 border-r border-gray-100 ${row.left ? 'text-gray-400' : 'text-transparent'}`}>
                        {row.left?.lineNumber}
                    </td>
                    <td className={`w-1/2 pl-2 py-0.5 whitespace-pre-wrap break-all border-r border-gray-100 ${row.left?.type === 'removed' ? 'bg-red-50 text-red-900' :
                            row.left?.type === 'modified_old' ? 'bg-red-50 text-gray-600' : 'text-gray-500'
                        }`}>
                        {leftContent || (row.left?.type ? '' : '')}
                    </td>

                    {/* RIGHT SIDE */}
                    <td className={`w-8 select-none text-right pr-2 text-[10px] leading-5 py-0.5 border-r border-gray-100 ${row.right ? 'text-gray-400' : 'text-transparent'}`}>
                        {row.right?.lineNumber}
                    </td>
                    <td className={`w-1/2 pl-2 py-0.5 whitespace-pre-wrap break-all ${row.right?.type === 'added' ? 'bg-green-50 text-green-900' :
                            row.right?.type === 'modified_new' ? 'bg-green-50 text-gray-900' : 'text-gray-500'
                        }`}>
                        {rightContent}
                    </td>
                </tr>
            );
        };


        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const isUnchanged = row.left?.type === 'unchanged' && row.right?.type === 'unchanged';

            if (isUnchanged) {
                if (bufferStartIndex === -1) bufferStartIndex = i;
                collapseBuffer.push(row);
            } else {
                flushBuffer(i);
                rendered.push(renderSingleRow(row, i));
            }
        }
        flushBuffer(rows.length);

        return rendered;
    };


    return (
        <div className="font-mono text-xs overflow-x-auto bg-white rounded-lg border shadow-sm">
            <table className="w-full border-collapse table-fixed">
                <colgroup>
                    <col style={{ width: '32px' }} />
                    <col style={{ width: '50%' }} />
                    <col style={{ width: '32px' }} />
                    <col style={{ width: '50%' }} />
                </colgroup>
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
                        <th colSpan={2} className="py-1 px-2 text-center text-[10px] uppercase font-medium border-r border-gray-200">Original</th>
                        <th colSpan={2} className="py-1 px-2 text-center text-[10px] uppercase font-medium">Tailored</th>
                    </tr>
                </thead>
                <tbody>
                    {renderRows()}
                </tbody>
            </table>
        </div>
    );
};
