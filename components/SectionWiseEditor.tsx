'use client';

import { useState } from 'react';
import {
    Loader2, Sparkles, RefreshCw, Check, RotateCcw,
    ChevronDown, ChevronUp, GitCompare, PenLine, Eye,
    CheckCircle2, AlertCircle, Clock, Layers, Wand2,
    FileText, GraduationCap, Briefcase, Code2, FolderOpen, Award,
    Hash, KeyRound, Scissors, AlignLeft, TextSelect
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DiffViewer } from '@/components/DiffViewer';
import { SectionPreference } from '@/lib/tailoring-prompts';

export type SectionName = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other';
export type SectionStatus = 'idle' | 'generating' | 'done' | 'error';

export interface SectionState {
    original: string;
    tailored: string;
    status: SectionStatus;
    accepted: boolean;
    error?: string;
    preferences: SectionPreference[];
    customInstruction: string;
}

export type SectionsState = Record<SectionName, SectionState>;

interface SectionWiseEditorProps {
    sections: SectionsState;
    fullOriginalResume: string;
    onGenerate: (sectionName: SectionName) => void;
    onGenerateAll: () => void;
    onAccept: (sectionName: SectionName) => void;
    onReset: (sectionName: SectionName) => void;
    onTailoredChange: (sectionName: SectionName, value: string) => void;
    onSetPreferences: (sectionName: SectionName, prefs: SectionPreference[]) => void;
    onSetCustomInstruction: (sectionName: SectionName, text: string) => void;
    onAssemble: () => void;
    isAnyGenerating: boolean;
    canAssemble: boolean;
    jdAnalysisTitle?: string;
}

// ─── Client-side hallucination scanner ───────────────────────────────────────────────
function detectHallucinations(generated: string, fullOriginal: string): string[] {
    if (!fullOriginal || !generated) return [];
    const origLower = fullOriginal.toLowerCase();
    const suspicious: string[] = [];

    const pcts = generated.match(/\b\d+%/g) || [];
    for (const p of pcts) {
        if (!origLower.includes(p.toLowerCase())) suspicious.push(p);
    }

    const nums = generated.match(/\b\d+\.?\d*\s*(?:ms|k|M|B|x|\busers\b|\bengineers\b|\bclients\b)/gi) || [];
    for (const n of nums) {
        if (!origLower.includes(n.toLowerCase().trim())) suspicious.push(n.trim());
    }

    const digits = generated.match(/\b\d{2,}\b/g) || [];
    for (const d of digits) {
        if (!origLower.includes(d)) suspicious.push(d);
    }

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
}> = {
    summary: {
        label: 'Summary',
        description: '2–3 sentences targeting the role + years of experience',
        Icon: FileText,
        iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600',
    },
    skills: {
        label: 'Skills',
        description: 'Grouped categories matched to JD keywords',
        Icon: Code2,
        iconBg: 'bg-violet-100', iconColor: 'text-violet-600',
    },
    experience: {
        label: 'Experience',
        description: 'STAR-method bullets, client sub-sections preserved',
        Icon: Briefcase,
        iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
    },
    education: {
        label: 'Education',
        description: 'Formatted exactly from your original',
        Icon: GraduationCap,
        iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
    },
    projects: {
        label: 'Projects',
        description: 'Top 5 JD-relevant projects',
        Icon: FolderOpen,
        iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
    },
    other: {
        label: 'Certifications',
        description: 'Awards & certs reordered by relevance',
        Icon: Award,
        iconBg: 'bg-rose-100', iconColor: 'text-rose-600',
    },
};

export const SECTION_ORDER: SectionName[] = ['summary', 'skills', 'experience', 'education', 'projects', 'other'];

const PREFERENCE_OPTIONS: { id: SectionPreference; label: string; icon: React.ElementType }[] = [
    { id: 'quantify', label: 'Quantify', icon: Hash },
    { id: 'keywords', label: 'Keyword-Heavy', icon: KeyRound },
    { id: 'concise', label: 'Concise', icon: Scissors },
    { id: 'detailed', label: 'Detailed', icon: AlignLeft },
    { id: 'reword', label: 'Reword Only', icon: TextSelect },
];

// ─── Individual Section Card ──────────────────────────────────────────────────
function SectionCard({
    name,
    state,
    fullOriginalResume,
    onGenerate,
    onAccept,
    onReset,
    onTailoredChange,
    onSetPreferences,
    onSetCustomInstruction,
    isAnyGenerating,
}: {
    name: SectionName;
    state: SectionState;
    fullOriginalResume: string;
    onGenerate: (n: SectionName) => void;
    onAccept: (n: SectionName) => void;
    onReset: (n: SectionName) => void;
    onTailoredChange: (n: SectionName, v: string) => void;
    onSetPreferences: (n: SectionName, prefs: SectionPreference[]) => void;
    onSetCustomInstruction: (n: SectionName, text: string) => void;
    isAnyGenerating: boolean;
}) {
    const meta = SECTION_META[name];
    const [showOriginal, setShowOriginal] = useState(false);
    const [viewMode, setViewMode] = useState<'preview' | 'edit' | 'diff'>('preview');
    const [showPreferences, setShowPreferences] = useState(false);
    const Icon = meta.Icon;

    const isGenerating = state.status === 'generating';
    const isDone = state.status === 'done';
    const isError = state.status === 'error';
    const hasContent = !!state.tailored;

    const hallucinationWarnings = isDone && state.tailored
        ? detectHallucinations(state.tailored, fullOriginalResume)
        : [];

    const togglePreference = (pref: SectionPreference) => {
        const current = new Set(state.preferences);
        if (current.has(pref)) current.delete(pref);
        else current.add(pref);
        onSetPreferences(name, Array.from(current));
    };

    return (
        <div className={cn(
            'overflow-hidden rounded-xl border-2 shadow-sm transition-all duration-300 sm:rounded-2xl sm:hover:shadow-md',
            state.accepted
                ? 'border-emerald-300 bg-emerald-50/40 shadow-emerald-100'
                : isDone
                    ? 'border-slate-200 bg-white'
                    : isError
                        ? 'border-red-200 bg-red-50/30'
                        : 'border-slate-200 bg-white',
        )}>
            {/* ─ Card Header ─ */}
            <div className="flex flex-wrap items-start gap-3 px-3 py-3 sm:flex-nowrap sm:items-center sm:px-4">
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
                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Tailoring...
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
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{meta.description}</p>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {hasContent && !isGenerating && (
                        <>
                            {!state.accepted ? (
                                <button
                                    onClick={() => onAccept(name)}
                                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-500 px-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
                                >
                                    <Check className="h-3 w-3" /> Accept
                                </button>
                            ) : (
                                <button
                                    onClick={() => onAccept(name)}
                                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                                >
                                    <CheckCircle2 className="h-3 w-3" /> Accepted
                                </button>
                            )}
                            <button
                                onClick={() => onReset(name)}
                                title="Clear and reset"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-red-200 hover:text-red-500"
                            >
                                <RotateCcw className="h-3 w-3" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ─ Optimization Controls ─ */}
            {(!hasContent || showPreferences) && !isGenerating && !isError && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Optimization Preferences</p>
                        <div className="flex flex-wrap gap-2">
                            {PREFERENCE_OPTIONS.map(opt => {
                                const active = state.preferences.includes(opt.id);
                                const OptIcon = opt.icon;
                                return (
                                    <button
                                        key={opt.id}
                                        onClick={() => togglePreference(opt.id)}
                                        className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all",
                                            active
                                                ? "border-indigo-400 bg-indigo-50 text-indigo-700 shadow-sm"
                                                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                        )}
                                    >
                                        <OptIcon className="h-3 w-3" />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <input
                            type="text"
                            placeholder="Custom instructions (optional)... e.g., 'emphasize leadership' or 'keep it under 3 bullets'"
                            value={state.customInstruction}
                            onChange={(e) => onSetCustomInstruction(name, e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 sm:text-[12px]"
                        />
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setShowPreferences(false);
                                onGenerate(name);
                            }}
                            disabled={isAnyGenerating}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {hasContent ? <RefreshCw className="h-3 w-3" /> : <Wand2 className="h-3 w-3" />}
                            {hasContent ? 'Regenerate' : 'Generate'}
                        </button>
                    </div>
                </div>
            )}

            {/* ─ Content Area ─ */}
            {(hasContent || isGenerating || isError) && (
                <div className="border-t border-slate-100">
                    {/* Toolbar row */}
                    {hasContent && !isGenerating && !showPreferences && (
                        <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                            <button
                                onClick={() => setShowPreferences(true)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-all"
                            >
                                <Settings2Icon className="h-3 w-3" /> Customize Output
                            </button>

                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
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

                    {/* Hallucination warning banner */}
                    {hallucinationWarnings.length > 0 && !isGenerating && (
                        <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 sm:mx-4">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[11px] font-semibold text-amber-700">
                                    {hallucinationWarnings.length} item{hallucinationWarnings.length > 1 ? 's' : ''} not found in original — verify before accepting
                                </p>
                                <p className="mt-0.5 break-words text-[10px] text-amber-600">
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
                                    <p className="text-sm font-semibold text-slate-700">Tailoring section with your preferences...</p>
                                    <div className="mt-2 flex gap-1.5 flex-wrap">
                                        {state.preferences.map((p) => (
                                            <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 animate-pulse">
                                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> {PREFERENCE_OPTIONS.find(o => o.id === p)?.label || p}
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
                            <div className="max-h-[70dvh] overflow-auto sm:max-h-80">
                                <DiffViewer oldText={state.original} newText={state.tailored} />
                            </div>
                        ) : viewMode === 'edit' ? (
                            <textarea
                                className="min-h-[160px] w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-base leading-relaxed text-slate-800 outline-none transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 sm:min-h-[120px] sm:text-[13px]"
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

// ─── Dummy icon for toolbar ───────────────────────────────────────────────────
function Settings2Icon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20 7h-9" />
            <path d="M14 17H5" />
            <circle cx="17" cy="17" r="3" />
            <circle cx="7" cy="7" r="3" />
        </svg>
    )
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
    onSetPreferences,
    onSetCustomInstruction,
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
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
                <div className="mr-auto flex min-w-0 items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
                        <Layers className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">Section Builder</p>
                        <p className="truncate text-[10px] text-slate-400">
                            {jdAnalysisTitle
                                ? <><span className="text-indigo-500 font-semibold">✓ {jdAnalysisTitle}</span> · Custom preferences</>
                                : 'Tailor sections with custom preferences'
                            }
                        </p>
                    </div>
                </div>

                <button
                    onClick={onGenerateAll}
                    disabled={isAnyGenerating}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                >
                    {isAnyGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {isAnyGenerating ? 'Generating...' : 'Generate All'}
                </button>

                <button
                    onClick={onAssemble}
                    disabled={!canAssemble}
                    title={canAssemble ? 'Assemble accepted sections into final resume' : 'Accept at least one section first'}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
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
            <div className="flex-1 space-y-3 overflow-auto p-3 pb-6 sm:p-4 lg:pb-6">
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
                        onSetPreferences={onSetPreferences}
                        onSetCustomInstruction={onSetCustomInstruction}
                        isAnyGenerating={isAnyGenerating}
                    />
                ))}
            </div>
        </div>
    );
}
