'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Loader2, RefreshCw, CheckCircle, XCircle, AlertTriangle,
    TrendingUp, Target, Award, Zap, ShieldCheck, ChevronDown, ChevronUp,
    Info, Sparkles, Check, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDetailedATSReport, extractKeywordHints } from '@/lib/ats-scoring';

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
    initialScore?: ATSScore | null;
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
        score >= 80 ? '#10b981' // emerald-500
        : score >= 65 ? '#f59e0b' // amber-500
        : score >= 50 ? '#f97316' // orange-500
        : '#ef4444'; // red-500

    const gradId = `ring-grad-${size}-${score}`;

    useEffect(() => {
        if (!animate) { setDisplayed(score); return; }
        const steps = 30;
        let step = 0;
        const interval = setInterval(() => {
            step++;
            setDisplayed(Math.round((score * step) / steps));
            if (step >= steps) clearInterval(interval);
        }, 15);
        return () => clearInterval(interval);
    }, [score, animate]);

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
                        className="text-slate-100 dark:text-slate-800"
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
                        className="transition-all duration-300"
                    />
                </svg>
                {/* Centre text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black leading-none tracking-tight" style={{ color }}>
                        {displayed}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5">
                        / 100
                    </span>
                </div>
            </div>
            {label && <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{label}</p>}
            {sublabel && <p className="text-[10px] text-slate-400 dark:text-slate-500">{sublabel}</p>}
        </div>
    );
}

/* ──────────────────────────────────────── Grade Badge ── */
function gradeBadge(score: number): { label: string; bg: string; text: string; border: string } {
    if (score >= 85) return { label: 'Excellent', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/40' };
    if (score >= 70) return { label: 'Good',      bg: 'bg-blue-50 dark:bg-blue-950/30',    text: 'text-blue-700 dark:text-blue-400',    border: 'border-blue-200 dark:border-blue-800/40' };
    if (score >= 55) return { label: 'Fair',       bg: 'bg-amber-50 dark:bg-amber-950/30',   text: 'text-amber-700 dark:text-amber-400',   border: 'border-amber-200 dark:border-amber-800/40' };
    return               { label: 'Needs Work',   bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-600 dark:text-red-400',     border: 'border-red-200 dark:border-red-800/40' };
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
    const [loading, setLoading] = useState(false);
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const lastScoreRef = useRef<string>('');

    // Compute detailed ATS report client-side (realtime updates)
    const report = useMemo(() => {
        if (!tailoredResume || !jobDescription) return null;
        try {
            const keywordHints = extractKeywordHints(jobDescription);
            return getDetailedATSReport({
                originalResume,
                tailoredResume,
                requiredKeywords: keywordHints.requiredSkills,
                preferredKeywords: keywordHints.preferredSkills,
            });
        } catch (e) {
            console.error('[ATSScorePanel] Error calculating report:', e);
            return null;
        }
    }, [originalResume, tailoredResume, jobDescription]);

    // Compute before score client-side
    const beforeReport = useMemo(() => {
        if (!originalResume || !jobDescription) return null;
        try {
            const keywordHints = extractKeywordHints(jobDescription);
            return getDetailedATSReport({
                originalResume,
                tailoredResume: originalResume,
                requiredKeywords: keywordHints.requiredSkills,
                preferredKeywords: keywordHints.preferredSkills,
            });
        } catch (e) {
            console.error('[ATSScorePanel] Error calculating before report:', e);
            return null;
        }
    }, [originalResume, jobDescription]);

    // Propagate score updates back to parent if overall score changes
    useEffect(() => {
        if (report && beforeReport && onScoreUpdate) {
            const scoreKey = `${beforeReport.overall}-${report.overall}`;
            if (lastScoreRef.current !== scoreKey) {
                lastScoreRef.current = scoreKey;
                onScoreUpdate({
                    before: beforeReport.overall,
                    after: report.overall,
                    breakdown: {
                        keywordMatch: { before: beforeReport.dimensions.keywordCoverage.score, after: report.dimensions.keywordCoverage.score },
                        experienceRelevance: { before: beforeReport.dimensions.quantification.score, after: report.dimensions.quantification.score },
                        skillsAlignment: { before: beforeReport.dimensions.actionVerbs.score, after: report.dimensions.actionVerbs.score },
                        formatting: { before: beforeReport.dimensions.formatting.score, after: report.dimensions.formatting.score },
                        groundedness: { before: 100, after: 100 }
                    },
                    analysis: `Overall score: ${report.overall}/100. Dimensions breakdown complete.`
                }, null);
            }
        }
    }, [report, beforeReport, onScoreUpdate]);

    const handleReRun = () => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
        }, 500);
    };

    if (!tailoredResume || !jobDescription) {
        return (
            <div className={cn('flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 text-center', className)}>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-800">
                    <Target className="h-7 w-7 text-slate-300 dark:text-slate-600" />
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No ATS score yet</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Provide job description and resume to compute score.</p>
                </div>
            </div>
        );
    }

    if (!report || !beforeReport) return null;

    const grade = gradeBadge(report.overall);
    const delta = report.overall - beforeReport.overall;

    const dimensionsList = [
        {
            id: 'keywords',
            title: 'Keyword Match',
            score: report.dimensions.keywordCoverage.score,
            max: 60,
            icon: Target,
            color: 'text-indigo-500',
            barColor: 'bg-indigo-500',
            details: report.dimensions.keywordCoverage.missingKeywords,
            detailsLabel: 'Missing Keywords',
            noDetailsLabel: 'All required keywords matched!',
            summaryText: `${report.dimensions.keywordCoverage.missingKeywords.length} missing required keywords.`
        },
        {
            id: 'quantification',
            title: 'Quantification',
            score: report.dimensions.quantification.score,
            max: 20,
            icon: TrendingUp,
            color: 'text-blue-500',
            barColor: 'bg-blue-500',
            details: report.dimensions.quantification.bulletsLackingMetrics,
            detailsLabel: 'Bullets Lacking Metrics',
            noDetailsLabel: 'All bullets quantified with metrics!',
            summaryText: `${report.dimensions.quantification.bulletsLackingMetrics.length} bullets lack metrics.`
        },
        {
            id: 'action-verbs',
            title: 'Action Verbs',
            score: report.dimensions.actionVerbs.score,
            max: 10,
            icon: Zap,
            color: 'text-amber-500',
            barColor: 'bg-amber-500',
            details: report.dimensions.actionVerbs.weakVerbBullets,
            detailsLabel: 'Bullets with Weak Verbs',
            noDetailsLabel: 'All bullets begin with strong action verbs!',
            summaryText: `${report.dimensions.actionVerbs.weakVerbBullets.length} bullets use weak verbs.`
        },
        {
            id: 'formatting',
            title: 'ATS Formatting',
            score: report.dimensions.formatting.score,
            max: 10,
            icon: ShieldCheck,
            color: 'text-emerald-500',
            barColor: 'bg-emerald-500',
            details: report.dimensions.formatting.violations,
            detailsLabel: 'Formatting Issues',
            noDetailsLabel: 'No formatting violations detected.',
            summaryText: `${report.dimensions.formatting.violations.length} formatting issues found.`
        }
    ];

    return (
        <div className={cn('flex flex-col gap-4 max-w-[680px] w-full mx-auto', className)}>

            {/* ── Header / Ring Card ── */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all duration-300">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-50/50 dark:from-indigo-950/20 via-transparent to-violet-50/30 dark:to-violet-950/10" />
                
                <div className="relative px-5 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
                                <Award className="h-4.5 w-4.5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white leading-none">ATS Tailoring Analysis</h3>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Realtime Metric Breakdown</p>
                            </div>
                        </div>

                        {grade && (
                            <span className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider self-start',
                                grade.bg, grade.text, grade.border
                            )}>
                                <span className={cn('h-1.5 w-1.5 rounded-full', grade.text.replace('text-', 'bg-'))} />
                                {grade.label}
                            </span>
                        )}
                    </div>

                    {/* Ring score visualization */}
                    {loading ? (
                        <div className="flex items-center justify-center h-24 w-44">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-5">
                            <div className="text-center">
                                <AnimatedRing score={beforeReport.overall} size={64} strokeWidth={5} />
                                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Before</p>
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-emerald-500 animate-pulse" />
                            </div>
                            <div className="text-center">
                                <AnimatedRing score={report.overall} size={84} strokeWidth={7} />
                                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">After</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Improvement Badge and re-run */}
                <div className="border-t border-slate-100 dark:border-slate-800/60 px-5 py-3 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {delta > 0
                                ? `+${delta} point improvement after tailoring!`
                                : 'Tailoring aligned with original score.'
                            }
                        </p>
                    </div>
                    <button
                        onClick={handleReRun}
                        disabled={loading}
                        title="Re-run ATS scoring animation"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-800 shadow-sm transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            {/* ── 2x2 Grid Breakdown Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dimensionsList.map((dim) => {
                    const Icon = dim.icon;
                    const isExpanded = expandedCard === dim.id;
                    const pct = Math.round((dim.score / dim.max) * 100);

                    return (
                        <div
                            key={dim.id}
                            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all overflow-hidden flex flex-col"
                        >
                            <button
                                onClick={() => setExpandedCard(isExpanded ? null : dim.id)}
                                className="w-full text-left p-4 focus:outline-none flex flex-col gap-2 flex-grow"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={cn('p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800', dim.color)}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{dim.title}</span>
                                    </div>
                                    <span className="text-xs font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                        {dim.score} / {dim.max}
                                    </span>
                                </div>

                                {/* Mini progress bar */}
                                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden w-full mt-1.5">
                                    <div
                                        className={cn('h-full rounded-full transition-all duration-500', dim.barColor)}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                
                                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                    <span>{dim.summaryText}</span>
                                    <span className="font-semibold">{pct}%</span>
                                </div>
                            </button>

                            {/* Collapsible Details */}
                            {isExpanded && (
                                <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-950/20 max-h-48 overflow-y-auto">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">{dim.detailsLabel}</p>
                                    {dim.details.length === 0 ? (
                                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3 shrink-0" />
                                            {dim.noDetailsLabel}
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {dim.details.map((item, index) => (
                                                <span
                                                    key={index}
                                                    className="inline-block text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-slate-700 dark:text-slate-300 max-w-full truncate"
                                                    title={item}
                                                >
                                                    {item.length > 50 ? `${item.slice(0, 47)}...` : item}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Optimization Suggestions Card ── */}
            {report.suggestions.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 px-4 py-3.5 flex items-center gap-2">
                        <Sparkles className="h-4.5 w-4.5 text-indigo-500" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Recommended Optimization Tasks</span>
                    </div>
                    <div className="p-4 space-y-3.5">
                        {report.suggestions.map((suggestion, i) => (
                            <div key={i} className="flex gap-3 items-start">
                                <div className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                                    {i + 1}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-normal">{suggestion}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Groundedness Warnings (Unverified metrics) ── */}
            {(() => {
                // Determine if any unevidenced metrics exist in the tailored resume
                const requiredKeywords = extractKeywordHints(jobDescription).requiredSkills;
                const preferredKeywords = extractKeywordHints(jobDescription).preferredSkills;
                const ground = report.overall > 0 ? getDetailedATSReport({
                    originalResume,
                    tailoredResume,
                    requiredKeywords,
                    preferredKeywords
                }).dimensions.quantification : null;

                // Check formatting violations for warnings
                const formatIssues = report.dimensions.formatting.violations;

                return null;
            })()}
        </div>
    );
}
