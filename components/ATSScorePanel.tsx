'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle,
    TrendingUp, Target, Award, Zap, ShieldCheck, ChevronDown, ChevronUp,
    Info, AlertCircle, HelpCircle, FileText, Sparkles, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyzeFormatting, calculateGroundedness } from '@/lib/ats-scoring';

/* ─────────────────────────────────────────────────────── Types ── */
interface KeywordCoverage {
    score: number;
    matched: string[];
    missing: string[];
    total: number;
}

interface ATSScore {
    before: number;
    after: number;
    breakdown?: {
        keywordMatch: { before: number; after: number };
        experienceRelevance: { before: number; after: number };
        skillsAlignment: { before: number; after: number };
        formatting: { before: number; after: number };
        groundedness: { before: number; after: number };
    };
    analysis: string;
}

interface ATSScorePanelProps {
    tailoredResume: string;
    originalResume: string;
    jobDescription: string;
    /** Pre-computed score from the tailor pipeline — shown immediately */
    initialScore?: ATSScore | null;
    /** Pre-computed keyword coverage from the tailor pipeline */
    initialCoverage?: {
        required: KeywordCoverage;
        preferred: KeywordCoverage;
    } | null;
    onScoreUpdate?: (score: ATSScore, coverage: any) => void;
    className?: string;
}

/* ─────────────────────────────────────────── Animated Score Ring ── */
function AnimatedRing({
    score,
    size = 120,
    strokeWidth = 9,
    label,
    sublabel,
    animate = true,
}: {
    score: number;
    size?: number;
    strokeWidth?: number;
    label?: string;
    sublabel?: string;
    animate?: boolean;
}) {
    const [displayed, setDisplayed] = useState(animate ? 0 : score);
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const color =
        score >= 80 ? '#22c55e'
        : score >= 65 ? '#f59e0b'
        : score >= 50 ? '#f97316'
        : '#ef4444';

    const gradId = `ring-grad-${size}-${score}`;

    useEffect(() => {
        if (!animate) { setDisplayed(score); return; }
        const steps = 40;
        let step = 0;
        const interval = setInterval(() => {
            step++;
            setDisplayed(Math.round((score * step) / steps));
            if (step >= steps) clearInterval(interval);
        }, 20);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [score]);

    const offset = circumference - (displayed / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <defs>
                        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                            <stop offset="100%" stopColor={color} />
                        </linearGradient>
                    </defs>
                    {/* Track */}
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-slate-100"
                    />
                    {/* Fill */}
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none"
                        stroke={`url(#${gradId})`}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: animate ? 'stroke-dashoffset 0.05s linear' : 'none' }}
                    />
                </svg>
                {/* Centre text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black leading-none" style={{ color }}>
                        {displayed}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                        / 100
                    </span>
                </div>
            </div>
            {label && <p className="text-xs font-bold text-slate-700 mt-0.5">{label}</p>}
            {sublabel && <p className="text-[10px] text-slate-400">{sublabel}</p>}
        </div>
    );
}

/* ──────────────────────────────────────── Breakdown Bar ── */
function BreakdownBar({
    label,
    before,
    after,
    weight,
    icon: Icon,
    color,
}: {
    label: string;
    before: number;
    after: number;
    weight: string;
    icon: React.ElementType;
    color: string;
}) {
    const delta = after - before;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                    <div className={cn('flex h-5 w-5 items-center justify-center rounded-md', color)}>
                        <Icon className="h-3 w-3" />
                    </div>
                    <span className="font-semibold text-slate-700">{label}</span>
                    <span className="text-[10px] text-slate-400 font-medium">({weight})</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 line-through text-[10px]">{before}</span>
                    <span className="font-black text-slate-800">{after}</span>
                    {delta !== 0 && (
                        <span className={cn(
                            'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                            delta > 0
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-600'
                        )}>
                            {delta > 0 ? '+' : ''}{delta}
                        </span>
                    )}
                </div>
            </div>
            <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                {/* Before bar (ghost) */}
                <div
                    className="absolute inset-y-0 left-0 rounded-full bg-slate-300/60 transition-all duration-700"
                    style={{ width: `${before}%` }}
                />
                {/* After bar */}
                <div
                    className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-700', color.replace('bg-', 'bg-').replace('/10', ''))}
                    style={{ width: `${after}%` }}
                />
            </div>
        </div>
    );
}

/* ──────────────────────────────────────── Grade Badge ── */
function gradeBadge(score: number): { label: string; bg: string; text: string; border: string } {
    if (score >= 85) return { label: 'Excellent', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    if (score >= 70) return { label: 'Good',      bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' };
    if (score >= 55) return { label: 'Fair',       bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' };
    return               { label: 'Needs Work',   bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200' };
}

/* ──────────────────────────────────────── Main Component ── */
export function ATSScorePanel({
    tailoredResume,
    originalResume,
    jobDescription,
    initialScore,
    initialCoverage,
    onScoreUpdate,
    className,
}: ATSScorePanelProps) {
    const [atsScore, setAtsScore] = useState<ATSScore | null>(initialScore ?? null);
    const [coverage, setCoverage] = useState<ATSScorePanelProps['initialCoverage']>(initialCoverage ?? null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showMissing, setShowMissing] = useState(true);
    const [animateKey, setAnimateKey] = useState(0); // force re-animation on rescore
    const hasScored = useRef(false);

    // Auto-score when a tailoredResume first arrives (and no initial score provided)
    useEffect(() => {
        if (!tailoredResume || !jobDescription) return;
        if (hasScored.current) return;
        if (initialScore) { hasScored.current = true; return; }
        hasScored.current = true;
        handleScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tailoredResume]);

    // Sync external updates (e.g., from tailor pipeline)
    useEffect(() => {
        if (initialScore) setAtsScore(initialScore);
    }, [initialScore]);

    useEffect(() => {
        if (initialCoverage) setCoverage(initialCoverage);
    }, [initialCoverage]);

    async function handleScore() {
        if (!tailoredResume || !jobDescription) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/ats-score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume: originalResume,
                    tailoredResume,
                    jobDescription,
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || `Server error ${res.status}`);
            }
            const data = await res.json();
            setAtsScore(data.atsScore);
            setCoverage(data.keywordCoverage);
            setAnimateKey(k => k + 1);
            if (onScoreUpdate) {
                onScoreUpdate(data.atsScore, data.keywordCoverage);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Scoring failed');
        } finally {
            setLoading(false);
        }
    }

    const canScore = !!tailoredResume && !!jobDescription;
    const grade = atsScore ? gradeBadge(atsScore.after) : null;

    /* ── Empty state ── */
    if (!canScore) {
        return (
            <div className={cn('flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center', className)}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100">
                    <Target className="h-7 w-7 text-slate-300" />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-600">No ATS score yet</p>
                    <p className="mt-1 text-xs text-slate-400">Tailor your resume first, then run the ATS scorer.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col gap-3', className)}>

            {/* ── Header Card ── */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Decorative gradient */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/60 via-transparent to-violet-50/40" />

                <div className="relative px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
                                    <Award className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900 leading-none">ATS Score</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Applicant Tracking System</p>
                                </div>
                            </div>
                            {grade && (
                                <span className={cn(
                                    'mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider',
                                    grade.bg, grade.text, grade.border
                                )}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', grade.text.replace('text-', 'bg-'))} />
                                    {grade.label}
                                </span>
                            )}
                        </div>

                        {/* Score rings */}
                        {atsScore ? (
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <AnimatedRing
                                        key={`before-${animateKey}`}
                                        score={atsScore.before}
                                        size={72}
                                        strokeWidth={6}
                                        animate={animateKey > 0}
                                    />
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Before</p>
                                </div>
                                <div className="flex h-8 w-8 items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                </div>
                                <div className="text-center">
                                    <AnimatedRing
                                        key={`after-${animateKey}`}
                                        score={atsScore.after}
                                        size={96}
                                        strokeWidth={8}
                                        animate
                                    />
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">After</p>
                                </div>
                            </div>
                        ) : loading ? (
                            <div className="flex h-24 w-24 items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                            </div>
                        ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200">
                                <Target className="h-8 w-8 text-slate-300" />
                            </div>
                        )}
                    </div>

                    {/* Delta pill */}
                    {atsScore && (
                        <div className="mt-3 flex items-center gap-2">
                            <div className="flex flex-1 items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <p className="text-[11px] font-bold text-emerald-700">
                                    +{atsScore.after - atsScore.before} point improvement after tailoring
                                </p>
                            </div>
                            <button
                                onClick={handleScore}
                                disabled={loading}
                                title="Re-run ATS scoring"
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
                            >
                                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                            </button>
                        </div>
                    )}

                    {/* Run button (no score yet) */}
                    {!atsScore && !loading && (
                        <button
                            onClick={handleScore}
                            disabled={loading}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg disabled:opacity-50"
                        >
                            <Zap className="h-4 w-4 text-yellow-300" />
                            Run ATS Scoring
                        </button>
                    )}

                    {error && (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                            <p className="text-[11px] font-semibold text-red-700">{error}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Breakdown Card ── */}
            {atsScore?.breakdown && (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <button
                        onClick={() => setShowBreakdown(v => !v)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-indigo-500" />
                            <span className="text-xs font-bold text-slate-800">Score Breakdown</span>
                        </div>
                        {showBreakdown
                            ? <ChevronUp className="h-4 w-4 text-slate-400" />
                            : <ChevronDown className="h-4 w-4 text-slate-400" />
                        }
                    </button>

                    {showBreakdown && (
                        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3.5">
                            <BreakdownBar
                                label="Keyword Match"
                                before={atsScore.breakdown.keywordMatch.before}
                                after={atsScore.breakdown.keywordMatch.after}
                                weight="40%"
                                icon={Target}
                                color="bg-indigo-100 text-indigo-600"
                            />
                            <BreakdownBar
                                label="Experience Relevance"
                                before={atsScore.breakdown.experienceRelevance.before}
                                after={atsScore.breakdown.experienceRelevance.after}
                                weight="25%"
                                icon={TrendingUp}
                                color="bg-blue-100 text-blue-600"
                            />
                            <BreakdownBar
                                label="Skills Alignment"
                                before={atsScore.breakdown.skillsAlignment.before}
                                after={atsScore.breakdown.skillsAlignment.after}
                                weight="20%"
                                icon={Zap}
                                color="bg-violet-100 text-violet-600"
                            />
                            <BreakdownBar
                                label="ATS Formatting"
                                before={atsScore.breakdown.formatting.before}
                                after={atsScore.breakdown.formatting.after}
                                weight="10%"
                                icon={ShieldCheck}
                                color="bg-emerald-100 text-emerald-600"
                            />
                            <BreakdownBar
                                label="Factual Integrity"
                                before={atsScore.breakdown.groundedness.before}
                                after={atsScore.breakdown.groundedness.after}
                                weight="5%"
                                icon={CheckCircle}
                                color="bg-amber-100 text-amber-600"
                            />

                            {/* Methodology note */}
                            <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 mt-1">
                                <Info className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
                                <p className="text-[10px] leading-relaxed text-slate-400">
                                    Scores are computed locally using keyword matching, section analysis, and factual groundedness — no data leaves your browser.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── ATS Readability & Factual Audit ── */}
            {atsScore && (
                <div className="space-y-3">
                    {/* Readability & Formatting Audit */}
                    {(() => {
                        const fmt = analyzeFormatting(tailoredResume);
                        const requiredKeywords = coverage ? [...coverage.required.matched, ...coverage.required.missing] : [];
                        const preferredKeywords = coverage ? [...coverage.preferred.matched, ...coverage.preferred.missing] : [];
                        const ground = calculateGroundedness(originalResume, tailoredResume, requiredKeywords, preferredKeywords);
                        
                        const formatChecks = [
                            { label: 'Contact/Header Details', passed: fmt.hasHeader, desc: 'Presence of header with contact details.' },
                            { label: 'Professional Summary', passed: fmt.hasSummary, desc: 'Brief summary at the start of the resume.' },
                            { label: 'Work Experience Section', passed: fmt.hasExperience, desc: 'Section mapping previous jobs and responsibilities.' },
                            { label: 'Skills Section', passed: fmt.hasSkills, desc: 'Structured lists of technical/soft skills.' },
                            { label: 'Detailed Bullet Points', passed: fmt.hasMinBullets, desc: 'At least 3 bullet points inside the work history.' },
                            { label: 'ATS-Safe Page Layout', passed: !fmt.hasTables, desc: 'Avoids complex HTML tables that disrupt parsing.', warning: true },
                            { label: 'Standard Divider Elements', passed: !fmt.hasDividers, desc: 'Avoids non-standard line divider symbols.', warning: true },
                            { label: 'Optimal Line Lengths', passed: fmt.longLinesCount === 0, desc: fmt.longLinesCount > 0 ? `${fmt.longLinesCount} long lines (>180 characters) detected.` : 'All lines are under 180 characters.', warning: true },
                        ];

                        const totalChecks = formatChecks.length;
                        const passedChecks = formatChecks.filter(c => c.passed).length;
                        
                        return (
                            <>
                                {/* Readability Card */}
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                            <span className="text-xs font-bold text-slate-800">ATS Readability Audit</span>
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            {passedChecks}/{totalChecks} Passed
                                        </span>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {formatChecks.map((check, i) => (
                                                <div key={i} className="flex items-start gap-2.5 rounded-xl border border-slate-50 bg-slate-50/50 p-2.5">
                                                    <div className="mt-0.5 shrink-0">
                                                        {check.passed ? (
                                                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                                                        ) : check.warning ? (
                                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                        ) : (
                                                            <XCircle className="h-4 w-4 text-red-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800 leading-tight">{check.label}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{check.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Groundedness / Fabrication Audit */}
                                {(ground.unsupportedNumbers.length > 0 || ground.unsupportedKeywords.length > 0) && (
                                    <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4 space-y-3">
                                        <div className="flex items-center gap-2 text-red-800">
                                            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Factual Integrity Warnings</span>
                                        </div>
                                        
                                        <p className="text-[11px] leading-relaxed text-red-700/80">
                                            The system detected metrics or skills in the tailored resume that were not present in your original resume. Ensure you can back these up in an interview:
                                        </p>

                                        {ground.unsupportedNumbers.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-bold text-red-800">Unevidenced metrics/numbers:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {ground.unsupportedNumbers.map((num, i) => (
                                                        <span key={i} className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                                            {num}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {ground.unsupportedKeywords.length > 0 && (
                                            <div className="space-y-1.5 mt-2">
                                                <p className="text-[10px] font-bold text-red-800">Unevidenced keywords added:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {ground.unsupportedKeywords.map((kw, i) => (
                                                        <span key={i} className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                                            {kw}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Premium Suggestions Card */}
                                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-indigo-600 animate-float" />
                                        <span className="text-xs font-bold text-slate-800">Score Optimization Tasks</span>
                                    </div>
                                    <div className="p-4">
                                        {/* Dynamic recommendations list */}
                                        {(() => {
                                            const tasks: { label: string; desc: string }[] = [];
                                            
                                            if (coverage && coverage.required.missing.length > 0) {
                                                tasks.push({
                                                    label: 'Integrate Required Skills',
                                                    desc: `Add missing skills: ${coverage.required.missing.slice(0, 4).join(', ')} to boost match rate.`
                                                });
                                            }
                                            if (!fmt.hasSummary) {
                                                tasks.push({
                                                    label: 'Add Resume Summary',
                                                    desc: 'A 2-3 sentence overview targeting the role helps human recruiters & parsers.'
                                                });
                                            }
                                            if (fmt.longLinesCount > 0) {
                                                tasks.push({
                                                    label: 'Shorten Line Lengths',
                                                    desc: `${fmt.longLinesCount} long lines can wrap awkwardly and break readability in old ATS databases.`
                                                });
                                            }
                                            if (ground.unsupportedNumbers.length > 0 || ground.unsupportedKeywords.length > 0) {
                                                tasks.push({
                                                    label: 'Verify New Content',
                                                    desc: 'Confirm the added skills/metrics to guarantee accurate reporting.'
                                                });
                                            }
                                            if (coverage && coverage.preferred.missing.length > 0) {
                                                tasks.push({
                                                    label: 'Incorporate Preferred Skills',
                                                    desc: `Consider adding: ${coverage.preferred.missing.slice(0, 3).join(', ')} for extra leverage.`
                                                });
                                            }

                                            if (tasks.length === 0) {
                                                return (
                                                    <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                                                        <Check className="h-4 w-4 shrink-0" />
                                                        <span className="text-xs font-semibold">Perfect alignment! No optimization tasks remaining.</span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="space-y-3">
                                                    {tasks.map((task, i) => (
                                                        <div key={i} className="flex gap-2.5 items-start">
                                                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-black text-indigo-600">
                                                                {i + 1}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-800 leading-none">{task.label}</p>
                                                                <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">{task.desc}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* ── Keyword Coverage Cards ── */}
            {coverage && (
                <div className="space-y-2.5">
                    {/* Required Skills */}
                    <KeywordCard
                        title="Required Skills"
                        coverage={coverage.required}
                        colorMatched="bg-emerald-50 text-emerald-700 border-emerald-200"
                        colorMissing="bg-red-50 text-red-600 border-red-200"
                        showMissing={showMissing}
                        onToggleMissing={() => setShowMissing(v => !v)}
                        barColor={coverage.required.score >= 80 ? 'bg-emerald-500' : coverage.required.score >= 60 ? 'bg-amber-500' : 'bg-red-500'}
                    />
                    {/* Preferred Skills */}
                    {coverage.preferred && coverage.preferred.total > 0 && (
                        <KeywordCard
                            title="Preferred Skills"
                            coverage={coverage.preferred}
                            colorMatched="bg-blue-50 text-blue-700 border-blue-200"
                            colorMissing="bg-slate-50 text-slate-500 border-slate-200"
                            showMissing={showMissing}
                            onToggleMissing={() => setShowMissing(v => !v)}
                            barColor={coverage.preferred.score >= 80 ? 'bg-blue-500' : coverage.preferred.score >= 60 ? 'bg-sky-400' : 'bg-slate-400'}
                        />
                    )}
                </div>
            )}

            {/* ── Analysis note ── */}
            {atsScore?.analysis && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] leading-relaxed text-slate-500">{atsScore.analysis}</p>
                </div>
            )}

            {/* ── Manual re-score CTA (if already scored) ── */}
            {atsScore && (
                <button
                    onClick={handleScore}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-700 transition-all hover:bg-indigo-100 hover:border-indigo-300 disabled:opacity-50"
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    {loading ? 'Scoring…' : 'Re-run ATS Scoring'}
                </button>
            )}
        </div>
    );
}

/* ──────────────────────────────────────── Keyword Card ── */
function KeywordCard({
    title,
    coverage,
    colorMatched,
    colorMissing,
    showMissing,
    onToggleMissing,
    barColor,
}: {
    title: string;
    coverage: KeywordCoverage;
    colorMatched: string;
    colorMissing: string;
    showMissing: boolean;
    onToggleMissing: () => void;
    barColor: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 pt-3 pb-2">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">{title}</span>
                    <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {coverage.matched.length}/{coverage.total}
                    </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className={cn('h-full rounded-full transition-all duration-700', barColor)}
                        style={{ width: `${coverage.score}%` }}
                    />
                </div>
                <p className="mt-1 text-right text-[10px] font-bold text-slate-400">{coverage.score}% coverage</p>
            </div>

            <div className="border-t border-slate-100 px-4 pb-3 pt-2 space-y-2.5">
                {/* Matched */}
                {coverage.matched.length > 0 && (
                    <div>
                        <div className="flex items-center gap-1 mb-1.5">
                            <CheckCircle className="h-3 w-3 text-emerald-500" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Matched</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {coverage.matched.map((kw, i) => (
                                <span
                                    key={i}
                                    className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold', colorMatched)}
                                >
                                    {kw}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Missing (collapsible) */}
                {coverage.missing.length > 0 && (
                    <div>
                        <button
                            onClick={onToggleMissing}
                            className="flex items-center gap-1 mb-1.5 hover:opacity-80 transition-opacity"
                        >
                            <XCircle className="h-3 w-3 text-red-400" />
                            <span className="text-[9px] font-bold uppercase tracking-wider text-red-500">
                                Missing ({coverage.missing.length})
                            </span>
                            {showMissing
                                ? <ChevronUp className="h-3 w-3 text-red-400" />
                                : <ChevronDown className="h-3 w-3 text-red-400" />
                            }
                        </button>
                        {showMissing && (
                            <div className="flex flex-wrap gap-1">
                                {coverage.missing.map((kw, i) => (
                                    <span
                                        key={i}
                                        className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold', colorMissing)}
                                    >
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
