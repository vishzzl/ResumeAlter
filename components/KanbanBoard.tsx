'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateApplication, deleteApplication } from '@/lib/actions';
import {
    Briefcase, Calendar, Plus, Trash2, GripVertical,
    Sparkles, Clock, FileCheck, FileX, ArrowRight,
    ChevronRight, Zap, Trophy, XCircle, Send
} from 'lucide-react';

type Application = {
    id: number;
    jobTitle: string | null;
    companyName: string | null;
    status: string | null;
    createdAt: string | null;
    tailoredResume?: string | null;
    dateApplied?: string | null;
    analysis?: string | null;
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

function getDaysSince(dateString: string | null): number {
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
    const router = useRouter();

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

        let updates: any = { status };

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
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Application Tracker
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {totalApps} application{totalApps !== 1 ? 's' : ''}
                        {appliedCount > 0 && <> · <span className="text-blue-600 font-medium">{appliedCount} applied</span></>}
                        {interviewCount > 0 && <> · <span className="text-violet-600 font-medium">{interviewCount} interviewing</span></>}
                        {offerCount > 0 && <> · <span className="text-emerald-600 font-medium">{offerCount} offer{offerCount !== 1 ? 's' : ''}</span></>}
                    </p>
                </div>
                <Link
                    href="/new"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-violet-600 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus className="h-4 w-4" />
                    New Application
                </Link>
            </div>

            {/* ━━━ Kanban Columns ━━━ */}
            <div className="flex-1 overflow-x-auto pb-2 custom-scrollbar">
                <div className="flex gap-3 min-w-[1100px] h-full">
                    {STATUS_COLUMNS.map(col => {
                        const colApps = applications.filter(a => (a.status || 'draft') === col.id);
                        const Icon = col.icon;
                        const isDropTarget = dragOverCol === col.id && draggedAppId !== null;

                        return (
                            <div
                                key={col.id}
                                className={`flex-1 min-w-[210px] rounded-xl border flex flex-col h-full transition-all duration-200 ${col.bg} ${col.border} ${isDropTarget ? 'ring-2 ring-indigo-400/50 scale-[1.01] shadow-lg' : ''
                                    }`}
                                onDragOver={(e) => handleDragOver(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={() => handleDrop(col.id)}
                            >
                                {/* Column Header */}
                                <div className={`px-3.5 py-2.5 rounded-t-xl flex items-center justify-between ${col.headerBg} border-b ${col.border}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${col.gradient} flex items-center justify-center shadow-sm`}>
                                            <Icon className="h-3 w-3 text-white" />
                                        </div>
                                        <h3 className="font-semibold text-slate-700 text-sm">{col.label}</h3>
                                    </div>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                                        {colApps.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 custom-scrollbar">
                                    {colApps.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-10 text-center">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                                                <Icon className="h-5 w-5 text-slate-300" />
                                            </div>
                                            <p className="text-xs text-slate-400 font-medium">
                                                No applications
                                            </p>
                                            <p className="text-[10px] text-slate-300 mt-0.5">
                                                Drag cards here
                                            </p>
                                        </div>
                                    )}

                                    {colApps.map(app => {
                                        const daysAgo = getDaysAgo(app.createdAt);
                                        const daysSinceApplied = getDaysSince(app.dateApplied);
                                        const atsScore = getAtsScore(app.analysis);
                                        const hasResume = !!app.tailoredResume;
                                        const isDeleting = deletingIds.has(app.id);

                                        return (
                                            <div
                                                key={app.id}
                                                draggable={!isDeleting}
                                                onDragStart={(e) => handleDragStart(e, app.id)}
                                                onDragEnd={handleDragEnd}
                                                className={`
                                                    group relative bg-white rounded-xl border border-slate-200/80 shadow-sm
                                                    cursor-grab active:cursor-grabbing
                                                    hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5
                                                    transition-all duration-200 ease-out
                                                    ${isDeleting ? 'opacity-40 scale-95 pointer-events-none' : ''}
                                                    ${draggedAppId === app.id ? 'opacity-50 scale-95' : ''}
                                                `}
                                            >
                                                {/* Drag Handle + Delete */}
                                                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <button
                                                        onClick={(e) => handleDelete(app.id, e)}
                                                        disabled={isDeleting}
                                                        className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>

                                                <Link href={`/applications/${app.id}`} className="block p-3">
                                                    {/* Title */}
                                                    <h4 className="font-semibold text-sm text-slate-800 truncate pr-6 group-hover:text-indigo-600 transition-colors leading-snug">
                                                        {app.jobTitle || 'Untitled Position'}
                                                    </h4>

                                                    {/* Company */}
                                                    <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1">
                                                        <Briefcase className="h-3 w-3 text-slate-400 shrink-0" />
                                                        {app.companyName || 'Unknown Company'}
                                                    </p>

                                                    {/* Metadata Row */}
                                                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                                        {/* Days ago badge */}
                                                        {daysAgo && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                {daysAgo}
                                                            </span>
                                                        )}

                                                        {/* Days since applied */}
                                                        {daysSinceApplied >= 0 && col.id !== 'draft' && (
                                                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${daysSinceApplied > 14
                                                                ? 'text-amber-600 bg-amber-50'
                                                                : 'text-blue-500 bg-blue-50'
                                                                }`}>
                                                                <Send className="h-2.5 w-2.5" />
                                                                {daysSinceApplied === 0 ? 'Applied today' : `${daysSinceApplied}d since applied`}
                                                            </span>
                                                        )}

                                                        {/* ATS Score */}
                                                        {atsScore !== null && (
                                                            <AtsScoreBadge score={atsScore} />
                                                        )}
                                                    </div>

                                                    {/* Resume status indicator */}
                                                    <div className="mt-2 flex items-center justify-between">
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${hasResume
                                                            ? 'text-emerald-600 bg-emerald-50'
                                                            : 'text-slate-400 bg-slate-50'
                                                            }`}>
                                                            {hasResume ? <FileCheck className="h-2.5 w-2.5" /> : <FileX className="h-2.5 w-2.5" />}
                                                            {hasResume ? 'Resume ready' : 'No resume'}
                                                        </span>
                                                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                                    </div>
                                                </Link>
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
