'use client';

import { useState, useCallback } from 'react';
import {
    Loader2, Sparkles, RefreshCw, Check, RotateCcw,
    ChevronDown, ChevronUp, GitCompare, PenLine, Eye,
    CheckCircle2, AlertCircle, Clock, Layers, Wand2,
    FileText, GraduationCap, Briefcase, Code2, FolderOpen, Award,
    Trophy, Zap, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DiffViewer } from '@/components/DiffViewer';

export type SectionName = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other';
export type SectionStatus = 'idle' | 'generating' | 'done' | 'error';

export interface SectionVariant {
    model: string;
    focus: string;
    text: string;
    score: number;
    scoreBreakdown: { keyword: number; format: number; groundedness: number };
}

export interface SectionState {
    original: string;
    tailored: string;           // currently active/selected tailored text
    variants: SectionVariant[]; // all 3 generated candidates
    selectedVariantIndex: number;
    status: SectionStatus;
    accepted: boolean;
    error?: string;
}

export type SectionsState = Record<SectionName, SectionState>;

interface SectionWiseEditorProps {
    sections: SectionsState;
    fullOriginalResume: string;          // full resume text for hallucination scanner
    onGenerate: (sectionName: SectionName) => void;
    onGenerateAll: () => void;
    onAccept: (sectionName: SectionName) => void;
    onReset: (sectionName: SectionName) => void;
    onTailoredChange: (sectionName: SectionName, value: string) => void;
    onSelectVariant: (sectionName: SectionName, index: number) => void;
    onAssemble: () => void;
    isAnyGenerating: boolean;
    canAssemble: boolean;
    jdAnalysisTitle?: string;            // optional: show analyzed role title in header
}

// ─── Client-side hallucination scanner ───────────────────────────────────────────────
// Pure text matching — zero latency, zero API calls.
// Compares proper nouns and numbers in generated text against the FULL original resume.
function detectHallucinations(generated: string, fullOriginal: string): string[] {
    if (!fullOriginal || !generated) return [];
    const origLower = fullOriginal.toLowerCase();
    const suspicious: string[] = [];

    // Check percentages: any "42%" not in original is suspicious
    const pcts = generated.match(/\b\d+%/g) || [];
    for (const p of pcts) {
        if (!origLower.includes(p.toLowerCase())) suspicious.push(p);
    }

    // Check numbers with units: "400ms", "6 engineers", "35k users"
    const nums = generated.match(/\b\d+\.?\d*\s*(?:ms|k|M|B|x|\busers\b|\bengineers\b|\bclients\b)/gi) || [];
    for (const n of nums) {
        if (!origLower.includes(n.toLowerCase().trim())) suspicious.push(n.trim());
    }

    // Check standalone 2+ digit numbers
    const digits = generated.match(/\b\d{2,}\b/g) || [];
    for (const d of digits) {
        if (!origLower.includes(d)) suspicious.push(d);
    }

    // Check proper nouns (CamelCase or TitleCase, 4+ chars)
    const skip = new Set(['This','With','From','Into','Over','Under','Through','Using',
        'Resume','Company','Client','Role','Team','Lead','Staff','Senior','Junior',
        'Product','Platform','Service','System','Project','Feature','Module']);
    const propPat = /\b([A-Z][a-z]{3,}(?:\.[a-z]+)?)\.?\b/g;
    let m: RegExpExecArray | null;
    while ((m = propPat.exec(generated)) !== null) {
        const word = m[1];
        if (!skip.has(word) && !origLower.includes(word.toLowerCase())) {
            suspicious.push(word);
        }
    }

    return [...new Set(suspicious)].slice(0, 8);
}

// ─── Section metadata ─────────────────────────────────────────────────────────
const SECTION_META: Record<SectionName, {
    label: string;
    description: string;
    Icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    ringColor: string;
    badgeBg: string;
    badgeText: string;
}> = {
    summary: {
        label: 'Summary',
        description: '2–3 sentences targeting the role + years of experience',
        Icon: FileText,
        iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
        ringColor: 'ring-indigo-300', badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-700',
    },
    skills: {
        label: 'Skills',
        description: 'Grouped categories matched to JD keywords',
        Icon: Code2,
        iconBg: 'bg-violet-100', iconColor: 'text-violet-600',
        ringColor: 'ring-violet-300', badgeBg: 'bg-violet-50', badgeText: 'text-violet-700',
    },
    experience: {
        label: 'Experience',
        description: 'STAR-method bullets, client sub-sections preserved',
        Icon: Briefcase,
        iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
        ringColor: 'ring-blue-300', badgeBg: 'bg-blue-50', badgeText: 'text-blue-700',
    },
    education: {
        label: 'Education',
        description: 'Formatted exactly from your original',
        Icon: GraduationCap,
        iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
        ringColor: 'ring-emerald-300', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-700',
    },
    projects: {
        label: 'Projects',
        description: 'Top 5 JD-relevant projects',
        Icon: FolderOpen,
        iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
        ringColor: 'ring-amber-300', badgeBg: 'bg-amber-50', badgeText: 'text-amber-700',
    },
    other: {
        label: 'Certifications',
        description: 'Awards & certs reordered by relevance',
        Icon: Award,
        iconBg: 'bg-rose-100', iconColor: 'text-rose-600',
        ringColor: 'ring-rose-300', badgeBg: 'bg-rose-50', badgeText: 'text-rose-700',
    },
};

export const SECTION_ORDER: SectionName[] = ['summary', 'skills', 'experience', 'education', 'projects', 'other'];

// ─── Score badge with breakdown tooltip ───────────────────────────────────────────────
function ScoreBadge({ score, breakdown, isWinner }: {
    score: number;
    breakdown?: { keyword: number; format: number; groundedness: number };
    isWinner?: boolean;
}) {
    const color = score >= 75 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : score >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200'
            : 'text-red-700 bg-red-50 border-red-200';
    const title = breakdown
        ? `Score: ${score}%\nKeywords: ${breakdown.keyword}%\nFormat: ${breakdown.format}%\nGroundedness: ${breakdown.groundedness}%`
        : `Score: ${score}%`;
    return (
        <span
            title={title}
            className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border cursor-help',
                color,
                isWinner && 'ring-1 ring-emerald-400'
            )}
        >
            {isWinner && <Trophy className="h-2.5 w-2.5" />}
            {score}%
        </span>
    );
}

// ─── Variant selector tabs ────────────────────────────────────────────────────
function VariantTabs({
    variants,
    selectedIndex,
    onSelect,
}: {
    variants: SectionVariant[];
    selectedIndex: number;
    onSelect: (i: number) => void;
}) {
    const labels = ['A', 'B', 'C'];
    const modelIcons = [Sparkles, Zap, Target];

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                {variants.length} Variants
            </span>
            {variants.map((v, i) => {
                const Icon = modelIcons[i] || Sparkles;
                const isSelected = i === selectedIndex;
                const isWinner = i === 0; // sorted by score, so index 0 is always winner

                return (
                    <button
                        key={i}
                        onClick={() => onSelect(i)}
                        title={`${v.model}\n${v.focus}\nScore: ${v.score}% (Keywords: ${v.scoreBreakdown?.keyword ?? '?'}% | Format: ${v.scoreBreakdown?.format ?? '?'}% | Grounded: ${v.scoreBreakdown?.groundedness ?? '?'}%)`}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 text-[11px] font-semibold transition-all duration-150',
                            isSelected
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                        )}
                    >
                        <Icon className="h-3 w-3" />
                        <span>{labels[i]}</span>
                        <ScoreBadge score={v.score} breakdown={v.scoreBreakdown} isWinner={isWinner && isSelected} />
                        {isWinner && (
                            <span className="text-[9px] font-bold text-emerald-600">★</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Individual Section Card ──────────────────────────────────────────────────
function SectionCard({
    name,
    state,
    fullOriginalResume,
    onGenerate,
    onAccept,
    onReset,
    onTailoredChange,
    onSelectVariant,
    isAnyGenerating,
}: {
    name: SectionName;
    state: SectionState;
    fullOriginalResume: string;
    onGenerate: (n: SectionName) => void;
    onAccept: (n: SectionName) => void;
    onReset: (n: SectionName) => void;
    onTailoredChange: (n: SectionName, v: string) => void;
    onSelectVariant: (n: SectionName, i: number) => void;
    isAnyGenerating: boolean;
}) {
    const meta = SECTION_META[name];
    const [showOriginal, setShowOriginal] = useState(false);
    const [viewMode, setViewMode] = useState<'preview' | 'edit' | 'diff'>('preview');
    const Icon = meta.Icon;

    const isGenerating = state.status === 'generating';
    const isDone = state.status === 'done';
    const isError = state.status === 'error';
    const hasVariants = state.variants.length > 0;
    const hasContent = !!state.tailored;
    const currentVariant = hasVariants ? state.variants[state.selectedVariantIndex] : null;

    // Run hallucination scanner on the currently active tailored text
    const hallucinationWarnings = isDone && state.tailored
        ? detectHallucinations(state.tailored, fullOriginalResume)
        : [];

    return (
        <div className={cn(
            'rounded-2xl border-2 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md',
            state.accepted
                ? 'border-emerald-300 bg-emerald-50/40 shadow-emerald-100'
                : isDone
                    ? 'border-slate-200 bg-white'
                    : isError
                        ? 'border-red-200 bg-red-50/30'
                        : 'border-slate-200 bg-white',
        )}>

            {/* ─ Card Header ─ */}
            <div className="px-4 py-3 flex items-center gap-3">
                {/* Icon */}
                <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                    state.accepted ? 'bg-emerald-100' : meta.iconBg,
                )}>
                    {isGenerating
                        ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        : state.accepted
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            : isError
                                ? <AlertCircle className="h-4 w-4 text-red-500" />
                                : <Icon className={cn('h-4 w-4', meta.iconColor)} />
                    }
                </div>

                {/* Label + status */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-800">{meta.label}</h3>

                        {state.accepted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                <Check className="h-2.5 w-2.5" /> Accepted
                            </span>
                        )}
                        {isGenerating && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 animate-pulse">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Generating 3 variants...
                            </span>
                        )}
                        {isError && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                <AlertCircle className="h-2.5 w-2.5" /> Error
                            </span>
                        )}
                        {isDone && !state.accepted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-600">
                                <Clock className="h-2.5 w-2.5" /> Review
                            </span>
                        )}

                        {/* Current variant score with breakdown */}
                        {currentVariant && !isGenerating && (
                            <ScoreBadge
                                score={currentVariant.score}
                                breakdown={currentVariant.scoreBreakdown}
                                isWinner={state.selectedVariantIndex === 0}
                            />
                        )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{meta.description}</p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {!hasContent && !isGenerating && (
                        <button
                            onClick={() => onGenerate(name)}
                            disabled={isAnyGenerating}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            <Wand2 className="h-3 w-3" />
                            Generate
                        </button>
                    )}
                    {hasContent && !isGenerating && (
                        <>
                            {!state.accepted ? (
                                <button
                                    onClick={() => onAccept(name)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-all shadow-sm"
                                >
                                    <Check className="h-3 w-3" /> Accept
                                </button>
                            ) : (
                                <button
                                    onClick={() => onAccept(name)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-xs font-semibold hover:bg-emerald-50 transition-all"
                                >
                                    <CheckCircle2 className="h-3 w-3" /> Accepted
                                </button>
                            )}
                            <button
                                onClick={() => onGenerate(name)}
                                disabled={isAnyGenerating}
                                title="Regenerate all 3 variants"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 transition-all"
                            >
                                <RefreshCw className="h-3 w-3" /> Redo
                            </button>
                            <button
                                onClick={() => onReset(name)}
                                title="Clear and reset"
                                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
                            >
                                <RotateCcw className="h-3 w-3" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ─ Content Area ─ */}
            {(hasContent || isGenerating || isError) && (
                <div className="border-t border-slate-100">

                    {/* Variant selector row */}
                    {hasVariants && !isGenerating && (
                        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                            <VariantTabs
                                variants={state.variants}
                                selectedIndex={state.selectedVariantIndex}
                                onSelect={(i) => onSelectVariant(name, i)}
                            />

                            {/* View mode + original toggle */}
                            <div className="ml-auto flex items-center gap-1">
                                <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5">
                                    {([
                                        { mode: 'preview' as const, Icon: Eye },
                                        { mode: 'edit' as const, Icon: PenLine },
                                        { mode: 'diff' as const, Icon: GitCompare },
                                    ] as const).map(({ mode, Icon: ModeIcon }) => (
                                        <button
                                            key={mode}
                                            onClick={() => setViewMode(mode)}
                                            title={mode}
                                            className={cn(
                                                'p-1 rounded-md transition-all',
                                                viewMode === mode
                                                    ? 'bg-slate-900 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-700'
                                            )}
                                        >
                                            <ModeIcon className="h-3 w-3" />
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowOriginal(p => !p)}
                                    className={cn(
                                        'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all',
                                        showOriginal ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                                    )}
                                >
                                    {showOriginal ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                                    Original
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Variant model info + hallucination warnings */}
                    {currentVariant && !isGenerating && (
                        <div className="px-4 py-1.5 bg-white border-b border-slate-50 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-semibold text-slate-500">{currentVariant.model}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-[10px] text-slate-400 italic">{currentVariant.focus}</span>
                        </div>
                    )}

                    {/* Hallucination warning banner */}
                    {hallucinationWarnings.length > 0 && !isGenerating && (
                        <div className="mx-4 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[11px] font-semibold text-amber-700">
                                    {hallucinationWarnings.length} item{hallucinationWarnings.length > 1 ? 's' : ''} not found in original — verify before accepting
                                </p>
                                <p className="text-[10px] text-amber-600 mt-0.5">
                                    {hallucinationWarnings.map(w => `"${w}"`).join(' · ')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Original content (collapsible) */}
                    {showOriginal && state.original && (
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Original</p>
                            <pre className="text-[12px] text-slate-500 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                                {state.original || '(empty)'}
                            </pre>
                        </div>
                    )}

                    {/* Main content */}
                    <div className="p-4">
                        {isGenerating ? (
                            <div className="flex items-start gap-3 py-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
                                    <Sparkles className="h-4 w-4 text-white animate-pulse" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Generating 3 variants in parallel...</p>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Gemini (balanced) · Ring (keyword-dense) · Laguna (impact) — all with full resume context
                                    </p>
                                    <div className="mt-2 flex gap-1.5">
                                        {['Gemini', 'Ring', 'Laguna'].map((m) => (
                                            <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 animate-pulse">
                                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> {m}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : isError ? (
                            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
                                <p className="text-xs font-semibold text-red-700">Generation failed</p>
                                <p className="text-[11px] text-red-500 mt-0.5">{state.error || 'Unknown error'}</p>
                            </div>
                        ) : viewMode === 'diff' ? (
                            <div className="overflow-auto max-h-80">
                                <DiffViewer oldText={state.original} newText={state.tailored} />
                            </div>
                        ) : viewMode === 'edit' ? (
                            <textarea
                                className="w-full min-h-[120px] text-[13px] text-slate-800 bg-white border border-slate-200 rounded-lg p-3 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-y font-mono leading-relaxed transition-all"
                                value={state.tailored}
                                onChange={e => onTailoredChange(name, e.target.value)}
                                spellCheck={false}
                            />
                        ) : (
                            <div className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {state.tailored}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ sections }: { sections: SectionsState }) {
    const total = SECTION_ORDER.length;
    const done = SECTION_ORDER.filter(n => sections[n].status === 'done' || sections[n].status === 'error').length;
    const accepted = SECTION_ORDER.filter(n => sections[n].accepted).length;

    return (
        <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${(done / total) * 100}%` }}
                />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                {accepted}/{total} accepted
            </span>
        </div>
    );
}

// ─── Main SectionWiseEditor ───────────────────────────────────────────────────
export function SectionWiseEditor({
    sections,
    fullOriginalResume,
    onGenerate,
    onGenerateAll,
    onAccept,
    onReset,
    onTailoredChange,
    onSelectVariant,
    onAssemble,
    isAnyGenerating,
    canAssemble,
    jdAnalysisTitle,
}: SectionWiseEditorProps) {
    const acceptedCount = SECTION_ORDER.filter(n => sections[n].accepted).length;
    const generatedCount = SECTION_ORDER.filter(n => sections[n].status === 'done').length;

    return (
        <div className="flex flex-col h-full">
            {/* ─ Header ─ */}
            <div className="shrink-0 px-4 py-3 bg-white border-b border-slate-100 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 mr-auto">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                        <Layers className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-800">Section Builder</p>
                        <p className="text-[10px] text-slate-400">
                            {jdAnalysisTitle
                                ? <><span className="text-indigo-500 font-semibold">✓ {jdAnalysisTitle}</span> · 3 variants · scored</>
                                : '3 variants per section · keyword-scored · ranked'
                            }
                        </p>
                    </div>
                </div>

                <button
                    onClick={onGenerateAll}
                    disabled={isAnyGenerating}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                    {isAnyGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {isAnyGenerating ? 'Generating...' : 'Generate All (3×6)'}
                </button>

                <button
                    onClick={onAssemble}
                    disabled={!canAssemble}
                    title={canAssemble ? 'Assemble accepted sections into final resume' : 'Accept at least one section first'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                    <FileText className="h-3 w-3" />
                    Assemble Resume
                    {acceptedCount > 0 && (
                        <span className="ml-1 bg-white/20 rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                            {acceptedCount}
                        </span>
                    )}
                </button>
            </div>

            {/* ─ Progress ─ */}
            {generatedCount > 0 && (
                <div className="shrink-0 px-4 py-2 bg-slate-50/80 border-b border-slate-100">
                    <ProgressBar sections={sections} />
                </div>
            )}

            {/* ─ Section cards ─ */}
            <div className="flex-1 overflow-auto p-4 space-y-3 pb-24 lg:pb-6">
                {SECTION_ORDER.map(name => (
                    <SectionCard
                        key={name}
                        name={name}
                        state={sections[name]}
                        fullOriginalResume={fullOriginalResume}
                        onGenerate={onGenerate}
                        onAccept={onAccept}
                        onReset={onReset}
                        onTailoredChange={onTailoredChange}
                        onSelectVariant={onSelectVariant}
                        isAnyGenerating={isAnyGenerating}
                    />
                ))}
            </div>
        </div>
    );
}
