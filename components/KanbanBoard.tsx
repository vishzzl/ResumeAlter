'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { updateApplication, deleteApplication } from '@/lib/actions';
import {
    Briefcase, Plus, Trash2,
    Sparkles, Clock, FileCheck, FileX, ArrowRight,
    ChevronRight, Zap, Trophy, XCircle, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Application = {
    id: number;
    jobTitle: string | null;
    companyName: string | null;
    status: string | null;
    createdAt: string | null;
    tailoredResume?: string | null;
    dateApplied?: string | null;
    analysis?: string | null;
    tailorStatus?: string | null;
};

const STATUS_COLUMNS = [
    {
        id: 'draft',
        label: 'Draft',
        icon: FileX,
        gradient: 'from-slate-500 to-slate-600',
        bg: 'bg-slate-50/50',
        border: 'border-slate-200/60',
        headerBg: 'bg-slate-100/80',
        dot: 'bg-slate-400',
        badge: 'bg-slate-100 text-slate-600',
    },
    {
        id: 'applied',
        label: 'Applied',
        icon: Send,
        gradient: 'from-blue-500 to-indigo-500',
        bg: 'bg-blue-50/30',
        border: 'border-blue-200/60',
        headerBg: 'bg-blue-50/80',
        dot: 'bg-blue-500',
        badge: 'bg-blue-50 text-blue-600',
    },
    {
        id: 'interview',
        label: 'Interview',
        icon: Zap,
        gradient: 'from-violet-500 to-purple-500',
        bg: 'bg-violet-50/30',
        border: 'border-violet-200/60',
        headerBg: 'bg-violet-50/80',
        dot: 'bg-violet-500',
        badge: 'bg-violet-50 text-violet-600',
    },
    {
        id: 'offer',
        label: 'Offer',
        icon: Trophy,
        gradient: 'from-emerald-500 to-green-500',
        bg: 'bg-emerald-50/30',
        border: 'border-emerald-200/60',
        headerBg: 'bg-emerald-50/80',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-600',
    },
    {
        id: 'rejected',
        label: 'Rejected',
        icon: XCircle,
        gradient: 'from-red-400 to-rose-500',
        bg: 'bg-red-50/30',
        border: 'border-red-200/60',
        headerBg: 'bg-red-50/80',
        dot: 'bg-red-400',
        badge: 'bg-red-50 text-red-500',
    },
];

function getDaysAgo(dateString: string | null): string {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
}

function getDaysSince(dateString: string | null | undefined): number {
    if (!dateString) return -1;
    const now = new Date();
    const date = new Date(dateString);
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function getAtsScore(analysis: string | null | undefined): number | null {
    if (!analysis) return null;
    try {
        const parsed = JSON.parse(analysis);
        return parsed?.atsScore?.after ?? null;
    } catch {
        return null;
    }
}

function AtsScoreBadge({ score }: { score: number }) {
    const color = score >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
        : score >= 60 ? 'text-amber-600 bg-amber-50 border-amber-200'
            : 'text-red-500 bg-red-50 border-red-200';
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${color}`}>
            <Sparkles className="h-2.5 w-2.5" />
            {score}
        </span>
    );
}

export default function KanbanBoard({ initialApplications }: { initialApplications: Application[] }) {
    const [applications, setApplications] = useState(initialApplications);
    const [draggedAppId, setDraggedAppId] = useState<number | null>(null);
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);
    const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
    const [mobileTab, setMobileTab] = useState('draft');
    const [movingAppId, setMovingAppId] = useState<number | null>(null);

    // Auto-update mobile tab if last active application was in a different column? 
    // For now, keep it simple.

    const getColumnApps = (colId: string) => applications.filter(a => (a.status || 'draft') === colId);

    const handleDragStart = (e: React.DragEvent, id: number) => {
        setDraggedAppId(id);
        e.dataTransfer.effectAllowed = 'move';
        // Add a slight delay to show the drag ghost
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = '0.5';
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const el = e.currentTarget as HTMLElement;
        el.style.opacity = '1';
        setDraggedAppId(null);
        setDragOverCol(null);
    };

    const handleDragOver = (e: React.DragEvent, colId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverCol(colId);
    };

    const handleDragLeave = () => {
        setDragOverCol(null);
    };

    const handleDrop = async (status: string) => {
        setDragOverCol(null);
        if (draggedAppId === null) return;

        const appToMove = applications.find(a => a.id === draggedAppId);
        if (!appToMove || (appToMove.status || 'draft') === status) {
            setDraggedAppId(null);
            return;
        }

        // RULE: "Ready to Apply" Check
        if (status === 'applied' && !appToMove.tailoredResume) {
            alert('Cannot move to Applied: You have not generated a Tailored Resume yet!');
            setDraggedAppId(null);
            return;
        }

        const updates: Record<string, string> = { status };

        // RULE: Auto-Timestamp
        if (status === 'applied' && !appToMove.dateApplied) {
            updates.dateApplied = new Date().toISOString();
        }

        // Optimistic update
        const updatedApps = applications.map(app =>
            app.id === draggedAppId ? { ...app, ...updates } : app
        );
        setApplications(updatedApps);
        setDraggedAppId(null);

        try {
            await updateApplication(draggedAppId, updates);
        } catch (error) {
            console.error('Failed to update status', error);
            setApplications(applications); // Revert
        }
    };

    const handleDelete = useCallback(async (id: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm('Delete this application? This can\'t be undone.')) return;

        setDeletingIds(prev => new Set(prev).add(id));

        try {
            await deleteApplication(id);
            // Remove from local state immediately — fixes the refresh bug
            setApplications(prev => prev.filter(app => app.id !== id));
        } catch (error) {
            console.error('Failed to delete:', error);
            alert('Failed to delete application.');
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, []);

    const totalApps = applications.length;
    const appliedCount = applications.filter(a => a.status === 'applied').length;
    const interviewCount = applications.filter(a => a.status === 'interview').length;
    const offerCount = applications.filter(a => a.status === 'offer').length;

    return (
        <div className="flex flex-col h-full overflow-hidden animate-fade-in-up">
            {/* ━━━ Dashboard Header ━━━ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-5 shrink-0 px-1">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-medium text-slate-700">{totalApps} Apps</span>
                        {appliedCount > 0 && <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">Applied {appliedCount}</span>}
                        {interviewCount > 0 && <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">Interview {interviewCount}</span>}
                        {offerCount > 0 && <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">Offers {offerCount}</span>}
                    </p>
                </div>
                <Link
                    href="/new"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:from-indigo-600 hover:to-violet-600 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus className="h-4 w-4" />
                    New Application
                </Link>
            </div>

            {/* ━━━ Mobile Tabs (Visible only on small screens) ━━━ */}
            <div className="lg:hidden mb-3 shrink-0 px-1">
                <div className="grid grid-cols-5 gap-1 bg-slate-100/80 rounded-xl p-1">
                    {STATUS_COLUMNS.map(col => {
                        const isActive = mobileTab === col.id;
                        const count = getColumnApps(col.id).length;
                        const Icon = col.icon;

                        return (
                            <button
                                key={col.id}
                                onClick={() => setMobileTab(col.id)}
                                className={cn(
                                    "flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg transition-all duration-200 min-w-0",
                                    isActive
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-indigo-600" : "text-slate-400")} />
                                <span className="text-[10px] font-semibold truncate w-full text-center leading-tight">{col.label}</span>
                                <span className={cn(
                                    "text-[9px] font-bold min-w-[16px] text-center rounded-full px-1",
                                    isActive ? "bg-indigo-100 text-indigo-700" : "text-slate-400"
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ━━━ Kanban Columns ━━━ */}
            <div className="flex-1 overflow-auto custom-scrollbar lg:overflow-x-auto pb-2">
                <div className="lg:flex lg:gap-4 lg:min-w-[1100px] h-full">
                    {STATUS_COLUMNS.map(col => {
                        // On mobile, only show valid column. On Desktop, show all.
                        const isVisibleMobile = mobileTab === col.id;
                        const colApps = getColumnApps(col.id);
                        const Icon = col.icon;
                        const isDropTarget = dragOverCol === col.id && draggedAppId !== null;

                        return (
                            <div
                                key={col.id}
                                className={cn(
                                    "flex-1 min-w-[280px] rounded-2xl border flex flex-col h-full transition-all duration-300",
                                    col.bg, col.border,
                                    isDropTarget && "ring-2 ring-indigo-400/50 scale-[1.01] shadow-xl",
                                    !isVisibleMobile && "hidden lg:flex" // Hide on mobile if not active tab
                                )}
                                onDragOver={(e) => handleDragOver(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={() => handleDrop(col.id)}
                            >
                                {/* Column Header */}
                                <div className={cn("px-4 py-3 rounded-t-2xl flex items-center justify-between border-b backdrop-blur-sm", col.headerBg, col.border)}>
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm", col.gradient)}>
                                            <Icon className="h-4 w-4 text-white" />
                                        </div>
                                        <h3 className="font-bold text-slate-800 text-sm tracking-tight">{col.label}</h3>
                                    </div>
                                    <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm/50", col.badge)}>
                                        {colApps.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                    {colApps.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-12 text-center select-none opacity-60">
                                            <div className="w-12 h-12 rounded-2xl bg-white/50 border border-slate-200/50 flex items-center justify-center mb-3">
                                                <Icon className="h-6 w-6 text-slate-300" />
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium">
                                                Empty
                                            </p>
                                        </div>
                                    )}

                                    {colApps.map(app => {
                                        const daysAgo = getDaysAgo(app.createdAt);
                                        const daysSinceApplied = getDaysSince(app.dateApplied);
                                        const atsScore = getAtsScore(app.analysis);
                                        const hasResume = !!app.tailoredResume;
                                        const isDeleting = deletingIds.has(app.id);
                                        const isTailoring = app.tailorStatus && ['tailoring', 'verifying', 'analyzing'].includes(app.tailorStatus);

                                        return (
                                            <div
                                                key={app.id}
                                                draggable={!isDeleting}
                                                onDragStart={(e) => handleDragStart(e, app.id)}
                                                onDragEnd={handleDragEnd}
                                                className={cn(
                                                    "group relative bg-white rounded-xl border border-slate-200/60 shadow-sm cursor-grab active:cursor-grabbing transition-all duration-200 ease-out",
                                                    "hover:shadow-md hover:border-indigo-200/60 hover:-translate-y-0.5",
                                                    isDeleting && "opacity-40 scale-95 pointer-events-none",
                                                    draggedAppId === app.id && "opacity-50 scale-95 rotate-1"
                                                )}
                                            >
                                                {/* Drag Handle + Delete (Desktop) */}
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 lg:flex hidden">
                                                    <button
                                                        onClick={(e) => handleDelete(app.id, e)}
                                                        disabled={isDeleting}
                                                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>

                                                <Link href={`/applications/${app.id}`} className="block p-4">
                                                    {/* Title */}
                                                    <div className="flex justify-between items-start gap-3">
                                                        <h4 className="font-bold text-sm text-slate-800 truncate leading-snug group-hover:text-indigo-600 transition-colors">
                                                            {app.jobTitle || 'Untitled Position'}
                                                        </h4>
                                                    </div>

                                                    {/* Company */}
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <Briefcase className="h-3 w-3 text-slate-400 shrink-0" />
                                                        <p className="text-xs font-medium text-slate-500 truncate">
                                                            {app.companyName || 'Unknown Company'}
                                                        </p>
                                                    </div>

                                                    {/* Metadata Row */}
                                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                        {/* Days ago badge */}
                                                        {daysAgo && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] lowercase text-slate-400 font-medium bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                {daysAgo}
                                                            </span>
                                                        )}

                                                        {/* Days since applied */}
                                                        {daysSinceApplied >= 0 && col.id !== 'draft' && (
                                                            <span className={cn(
                                                                "inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border",
                                                                daysSinceApplied > 14
                                                                    ? "text-amber-600 bg-amber-50 border-amber-100"
                                                                    : "text-blue-600 bg-blue-50 border-blue-100"
                                                            )}>
                                                                <Send className="h-2.5 w-2.5" />
                                                                {daysSinceApplied === 0 ? 'Today' : `${daysSinceApplied}d`}
                                                            </span>
                                                        )}

                                                        {/* ATS Score */}
                                                        {atsScore !== null && (
                                                            <AtsScoreBadge score={atsScore} />
                                                        )}
                                                    </div>

                                                    {/* Footer */}
                                                    <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                                                        {isTailoring ? (
                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full text-indigo-700 bg-indigo-50/50 ring-1 ring-indigo-100 animate-pulse">
                                                                <Sparkles className="h-3 w-3 animate-spin" />
                                                                {app.tailorStatus === 'tailoring' ? 'Tailoring...' :
                                                                    app.tailorStatus === 'verifying' ? 'Verifying...' :
                                                                        'Analyzing...'}
                                                            </span>
                                                        ) : (
                                                            <span className={cn(
                                                                "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                                                                hasResume
                                                                    ? "text-emerald-700 bg-emerald-50/50 ring-1 ring-emerald-100"
                                                                    : "text-slate-400 bg-slate-50 ring-1 ring-slate-100"
                                                            )}>
                                                                {hasResume ? <FileCheck className="h-3 w-3" /> : <FileX className="h-3 w-3" />}
                                                                {hasResume ? 'Ready' : 'No Resume'}
                                                            </span>
                                                        )}
                                                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                                                    </div>
                                                </Link>

                                                {/* Mobile Actions: Move + Delete */}
                                                <div className="lg:hidden flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setMovingAppId(movingAppId === app.id ? null : app.id);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                                                        >
                                                            <ArrowRight className="h-3 w-3" />
                                                            Move to
                                                        </button>
                                                        {movingAppId === app.id && (
                                                            <div className="absolute bottom-full left-0 mb-1 bg-white rounded-xl shadow-xl border border-slate-200 z-20 py-1 min-w-[140px] animate-in fade-in slide-in-from-bottom-2 duration-150">
                                                                {STATUS_COLUMNS.filter(c => c.id !== col.id).map(targetCol => {
                                                                    const TargetIcon = targetCol.icon;
                                                                    return (
                                                                        <button
                                                                            key={targetCol.id}
                                                                            onClick={async (e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                setMovingAppId(null);

                                                                                if (targetCol.id === 'applied' && !app.tailoredResume) {
                                                                                    alert('Cannot move to Applied: Generate a Tailored Resume first!');
                                                                                    return;
                                                                                }

                                                                                const updates: Record<string, string> = { status: targetCol.id };
                                                                                if (targetCol.id === 'applied' && !app.dateApplied) {
                                                                                    updates.dateApplied = new Date().toISOString();
                                                                                }

                                                                                setApplications(prev => prev.map(a =>
                                                                                    a.id === app.id ? { ...a, ...updates } : a
                                                                                ));

                                                                                try {
                                                                                    await updateApplication(app.id, updates);
                                                                                } catch (error) {
                                                                                    console.error('Failed to move', error);
                                                                                    setApplications(applications);
                                                                                }
                                                                            }}
                                                                            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                                                        >
                                                                            <TargetIcon className="h-3.5 w-3.5" />
                                                                            {targetCol.label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDelete(app.id, e)}
                                                        disabled={isDeleting}
                                                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
