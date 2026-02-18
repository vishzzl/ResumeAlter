import React, { useState, useMemo, useEffect } from 'react';
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

function useIsMobile(breakpoint = 1024) {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < breakpoint);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [breakpoint]);
    return isMobile;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ oldText, newText }) => {
    const [expandedBlocks, setExpandedBlocks] = useState<Record<number, boolean>>({});
    const isMobile = useIsMobile();

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
                let startBackfill = result.length - 1;
                while (startBackfill >= 0 && result[startBackfill].left?.type === 'removed' && !result[startBackfill].right) {
                    startBackfill--;
                }
                startBackfill++;

                const removedCount = result.length - startBackfill;

                if (removedCount > 0 && result[result.length - 1].left?.type === 'removed') {
                    lines.forEach((line, idx) => {
                        if (idx < removedCount) {
                            const row = result[startBackfill + idx];
                            row.right = { line, lineNumber: rightLineNum++, type: 'modified_new' };
                            if (row.left) row.left.type = 'modified_old';
                        } else {
                            result.push({
                                right: { line, lineNumber: rightLineNum++, type: 'added' }
                            });
                        }
                    });
                } else {
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

    // ─── MOBILE: Unified Diff ───
    const renderMobileRows = () => {
        const rendered: React.ReactNode[] = [];
        let collapseBuffer: DiffRow[] = [];
        let bufferStartIndex = -1;

        const flushBuffer = () => {
            if (collapseBuffer.length === 0) return;
            if (collapseBuffer.length > 4 && !expandedBlocks[bufferStartIndex]) {
                rendered.push(
                    <div
                        key={`collapse-m-${bufferStartIndex}`}
                        className="py-2 px-3 text-center text-gray-400 text-[11px] bg-gray-50 border-y border-gray-100 cursor-pointer active:bg-gray-100"
                        onClick={() => setExpandedBlocks(p => ({ ...p, [bufferStartIndex]: true }))}
                    >
                        <div className="flex items-center justify-center gap-1.5">
                            <ChevronDown className="h-3 w-3" />
                            <span>{collapseBuffer.length} unchanged lines</span>
                        </div>
                    </div>
                );
            } else {
                collapseBuffer.forEach((row, i) => {
                    const line = row.right?.line ?? row.left?.line ?? '';
                    const num = row.right?.lineNumber ?? row.left?.lineNumber ?? 0;
                    rendered.push(
                        <div key={`m-${bufferStartIndex + i}`} className="flex text-gray-500 leading-6">
                            <span className="w-8 shrink-0 text-right pr-2 text-[10px] text-gray-300 select-none">{num}</span>
                            <span className="flex-1 whitespace-pre-wrap break-words text-[13px] px-2">{line}</span>
                        </div>
                    );
                });
            }
            collapseBuffer = [];
            bufferStartIndex = -1;
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const isUnchanged = row.left?.type === 'unchanged' && row.right?.type === 'unchanged';

            if (isUnchanged) {
                if (bufferStartIndex === -1) bufferStartIndex = i;
                collapseBuffer.push(row);
                continue;
            }

            flushBuffer();

            // Modified pair: show old then new stacked
            if (row.left?.type === 'modified_old' && row.right?.type === 'modified_new') {
                const wordDiffs = diff.diffWordsWithSpace(row.left.line, row.right.line);

                const oldContent = wordDiffs.map((part, j) => {
                    if (part.added) return null;
                    return <span key={j} className={part.removed ? 'bg-red-200 text-red-900 rounded-sm' : ''}>{part.value}</span>;
                });

                const newContent = wordDiffs.map((part, j) => {
                    if (part.removed) return null;
                    return <span key={j} className={part.added ? 'bg-green-200 text-green-900 rounded-sm' : ''}>{part.value}</span>;
                });

                rendered.push(
                    <div key={`m-old-${i}`} className="flex bg-red-50 border-l-3 border-red-400 leading-6">
                        <span className="w-8 shrink-0 text-right pr-2 text-[10px] text-red-300 select-none">−</span>
                        <span className="flex-1 whitespace-pre-wrap break-words text-[13px] text-red-800 px-2 line-through decoration-red-300">{oldContent}</span>
                    </div>
                );
                rendered.push(
                    <div key={`m-new-${i}`} className="flex bg-green-50 border-l-3 border-green-400 leading-6">
                        <span className="w-8 shrink-0 text-right pr-2 text-[10px] text-green-400 select-none">+</span>
                        <span className="flex-1 whitespace-pre-wrap break-words text-[13px] text-green-900 px-2">{newContent}</span>
                    </div>
                );
            } else if (row.left?.type === 'removed') {
                rendered.push(
                    <div key={`m-rm-${i}`} className="flex bg-red-50 border-l-3 border-red-400 leading-6">
                        <span className="w-8 shrink-0 text-right pr-2 text-[10px] text-red-300 select-none">−</span>
                        <span className="flex-1 whitespace-pre-wrap break-words text-[13px] text-red-800 px-2">{row.left.line}</span>
                    </div>
                );
            } else if (row.right?.type === 'added') {
                rendered.push(
                    <div key={`m-add-${i}`} className="flex bg-green-50 border-l-3 border-green-400 leading-6">
                        <span className="w-8 shrink-0 text-right pr-2 text-[10px] text-green-400 select-none">+</span>
                        <span className="flex-1 whitespace-pre-wrap break-words text-[13px] text-green-900 px-2">{row.right.line}</span>
                    </div>
                );
            }
        }
        flushBuffer();
        return rendered;
    };

    // ─── DESKTOP: Side-by-Side Diff (Original) ───
    const renderDesktopRows = () => {
        const rendered: React.ReactNode[] = [];
        let collapseBuffer: DiffRow[] = [];
        let bufferStartIndex = -1;

        const flushBuffer = () => {
            if (collapseBuffer.length === 0) return;

            if (collapseBuffer.length > 4 && !expandedBlocks[bufferStartIndex]) {
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
                collapseBuffer.forEach((row, i) => {
                    rendered.push(renderSingleRow(row, bufferStartIndex + i));
                });
            }
            collapseBuffer = [];
            bufferStartIndex = -1;
        };

        const renderSingleRow = (row: DiffRow, idx: number) => {
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
                    <td className={`w-8 select-none text-right pr-2 text-[10px] leading-5 py-0.5 border-r border-gray-100 ${row.left ? 'text-gray-400' : 'text-transparent'}`}>
                        {row.left?.lineNumber}
                    </td>
                    <td className={`w-1/2 pl-2 py-0.5 whitespace-pre-wrap break-all border-r border-gray-100 ${row.left?.type === 'removed' ? 'bg-red-50 text-red-900' :
                        row.left?.type === 'modified_old' ? 'bg-red-50 text-gray-600' : 'text-gray-500'
                        }`}>
                        {leftContent || (row.left?.type ? '' : '')}
                    </td>
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
                flushBuffer();
                rendered.push(renderSingleRow(row, i));
            }
        }
        flushBuffer();

        return rendered;
    };

    // ─── RENDER ───
    if (isMobile) {
        return (
            <div className="font-mono text-xs bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Mobile Header */}
                <div className="flex border-b border-gray-200 bg-gray-50 text-[10px] uppercase font-medium text-gray-500">
                    <div className="flex-1 py-1.5 px-3 text-center">Unified Diff</div>
                </div>
                {/* Mobile Content */}
                <div className="divide-y divide-gray-50">
                    {renderMobileRows()}
                </div>
            </div>
        );
    }

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
                    {renderDesktopRows()}
                </tbody>
            </table>
        </div>
    );
};
