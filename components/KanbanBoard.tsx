'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { updateApplication, deleteApplication } from '@/lib/actions';
import {
    Briefcase, Plus, Trash2, Archive,
    Sparkles, Clock, FileCheck, FileX, ArrowRight,
    ChevronRight, Zap, Trophy, XCircle, Send,
    Search, Filter, ChevronDown, ArrowUpDown
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
    isArchived?: boolean | null;
};

const STATUS_COLUMNS = [
    {
        id: 'draft',
        label: 'Draft',
        icon: FileX,
        gradient: 'from-slate-400 to-slate-600',
        bg: 'bg-slate-50/50 dark:bg-slate-900/40',
        border: 'border-slate-200/60 dark:border-slate-800/60',
        headerBg: 'bg-white/60 dark:bg-slate-950/60',
        badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    },
    {
        id: 'applied',
        label: 'Applied',
        icon: Send,
        gradient: 'from-blue-500 to-indigo-500',
        bg: 'bg-blue-50/30 dark:bg-blue-950/20',
        border: 'border-blue-200/60 dark:border-blue-900/40',
        headerBg: 'bg-white/60 dark:bg-slate-950/60',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    },
    {
        id: 'interview',
        label: 'Interview',
        icon: Zap,
        gradient: 'from-violet-500 to-fuchsia-500',
        bg: 'bg-violet-50/30 dark:bg-violet-950/20',
        border: 'border-violet-200/60 dark:border-violet-900/40',
        headerBg: 'bg-white/60 dark:bg-slate-950/60',
        badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    },
    {
        id: 'offer',
        label: 'Offer',
        icon: Trophy,
        gradient: 'from-emerald-400 to-teal-500',
        bg: 'bg-emerald-50/30 dark:bg-emerald-950/20',
        border: 'border-emerald-200/60 dark:border-emerald-900/40',
        headerBg: 'bg-white/60 dark:bg-slate-950/60',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    },
    {
        id: 'rejected',
        label: 'Rejected',
        icon: XCircle,
        gradient: 'from-rose-400 to-red-500',
        bg: 'bg-rose-50/30 dark:bg-rose-950/20',
        border: 'border-rose-200/60 dark:border-rose-900/40',
        headerBg: 'bg-white/60 dark:bg-slate-950/60',
        badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
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
    const [showArchived, setShowArchived] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [atsFilter, setAtsFilter] = useState('all');
    const [sortBy, setSortBy] = useState('date-desc');

    // Auto-update mobile tab if last active application was in a different column? 
    // For now, keep it simple.

    const isAppArchived = useCallback((app: Application) => {
        if (app.isArchived) return true;
        if (!app.createdAt) return false;
        const days = getDaysSince(app.createdAt);
        return days > 30 && (app.status === 'rejected' || app.status === 'draft' || !app.status);
    }, []);

    const visibleApplications = applications
        .filter(app => showArchived ? isAppArchived(app) : !isAppArchived(app))
        .filter(app => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (app.jobTitle?.toLowerCase().includes(q) || app.companyName?.toLowerCase().includes(q));
        })
        .filter(app => {
            if (atsFilter === 'all') return true;
            const score = getAtsScore(app.analysis) || 0;
            if (atsFilter === 'high') return score >= 80;
            if (atsFilter === 'med') return score >= 60 && score < 80;
            if (atsFilter === 'low') return score < 60;
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'date-desc') {
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            }
            if (sortBy === 'date-asc') {
                return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            }
            if (sortBy === 'score-desc') {
                const scoreA = getAtsScore(a.analysis) || 0;
                const scoreB = getAtsScore(b.analysis) || 0;
                return scoreB - scoreA;
            }
            if (sortBy === 'title-asc') {
                return (a.jobTitle || '').localeCompare(b.jobTitle || '');
            }
            return 0;
        });

    const getColumnApps = (colId: string) => visibleApplications.filter(a => (a.status || 'draft') === colId);

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

    const handleArchive = useCallback(async (id: number, e: React.MouseEvent, currentlyArchived: boolean) => {
        e.preventDefault();
        e.stopPropagation();

        const newArchivedState = !currentlyArchived;
        
        // Optimistic update
        setApplications(prev => prev.map(app => 
            app.id === id ? { ...app, isArchived: newArchivedState } : app
        ));

        try {
            await updateApplication(id, { isArchived: newArchivedState });
        } catch (error) {
            console.error('Failed to update archive status:', error);
            // Revert
            setApplications(prev => prev.map(app => 
                app.id === id ? { ...app, isArchived: currentlyArchived } : app
            ));
            alert('Failed to update archive status.');
        }
    }, []);

    const totalApps = visibleApplications.length;
    const appliedCount = visibleApplications.filter(a => a.status === 'applied').length;
    const interviewCount = visibleApplications.filter(a => a.status === 'interview').length;
    const offerCount = visibleApplications.filter(a => a.status === 'offer').length;

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] lg:h-[calc(100vh-4rem)] overflow-hidden animate-fade-in-up">
            {/* ━━━ Dashboard Header ━━━ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 shrink-0 px-2 lg:px-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 sm:mt-1.5 flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{totalApps} Applications</span>
                        {appliedCount > 0 && <span className="inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide">Applied {appliedCount}</span>}
                        {interviewCount > 0 && <span className="inline-flex items-center gap-1.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide">Interview {interviewCount}</span>}
                        {offerCount > 0 && <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide">Offers {offerCount}</span>}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className={cn(
                            "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 border",
                            showArchived 
                                ? "bg-slate-800 text-white border-slate-700 dark:bg-slate-200 dark:text-slate-900" 
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
                        )}
                    >
                        <Clock className="h-4 w-4" />
                        {showArchived ? 'Show Active' : 'Show Archived'}
                    </button>
                    <Link
                        href="/new"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:from-indigo-600 hover:to-fuchsia-700 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">New Application</span>
                        <span className="sm:hidden">New</span>
                    </Link>
                </div>
            </div>

            {/* ━━━ Filter & Search Bar ━━━ */}
            <div className="flex flex-col md:flex-row items-center gap-3 mb-4 sm:mb-6 px-2 lg:px-4 shrink-0">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search roles or companies..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <select 
                            value={atsFilter}
                            onChange={e => setAtsFilter(e.target.value)}
                            className="w-full md:w-auto appearance-none pl-9 pr-8 py-2.5 text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 outline-none cursor-pointer shadow-sm transition-all text-slate-700 dark:text-slate-300"
                        >
                            <option value="all">All Scores</option>
                            <option value="high">High Match (80%+)</option>
                            <option value="med">Med Match (60-79%)</option>
                            <option value="low">Low Match (&lt;60%)</option>
                        </select>
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                    
                    <div className="relative flex-1 md:flex-none">
                        <select 
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            className="w-full md:w-auto appearance-none pl-9 pr-8 py-2.5 text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 outline-none cursor-pointer shadow-sm transition-all text-slate-700 dark:text-slate-300"
                        >
                            <option value="date-desc">Newest First</option>
                            <option value="date-asc">Oldest First</option>
                            <option value="score-desc">Highest Score</option>
                            <option value="title-asc">Title A-Z</option>
                        </select>
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* ━━━ Mobile Tabs (Visible only on small screens) ━━━ */}
            <div className="lg:hidden mb-4 shrink-0 px-2">
                <div className="grid grid-cols-5 gap-1 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-1.5 border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                    {STATUS_COLUMNS.map(col => {
                        const isActive = mobileTab === col.id;
                        const count = getColumnApps(col.id).length;
                        const Icon = col.icon;

                        return (
                            <button
                                key={col.id}
                                onClick={() => setMobileTab(col.id)}
                                className={cn(
                                    "flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all duration-300 min-w-0",
                                    isActive
                                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                                )}
                            >
                                <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500")} />
                                <span className="text-[11px] font-semibold truncate w-full text-center leading-tight">{col.label}</span>
                                <span className={cn(
                                    "text-[10px] font-bold min-w-[18px] text-center rounded-full px-1.5 py-0.5 transition-colors",
                                    isActive ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ━━━ Kanban Columns ━━━ */}
            <div className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar lg:overflow-x-auto pb-4 px-2 lg:px-4">
                <div className="lg:flex lg:gap-4 w-full h-full">
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
                                    "flex-1 min-w-[240px] lg:min-w-0 xl:min-w-[200px] rounded-3xl border flex flex-col h-full transition-all duration-300 glass-card !shadow-none",
                                    col.bg, col.border,
                                    isDropTarget && "ring-2 ring-indigo-400/50 dark:ring-indigo-500/50 scale-[1.01] shadow-2xl bg-indigo-50/30 dark:bg-indigo-900/20",
                                    !isVisibleMobile && "hidden lg:flex" // Hide on mobile if not active tab
                                )}
                                onDragOver={(e) => handleDragOver(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={() => handleDrop(col.id)}
                            >
                                {/* Column Header */}
                                <div className={cn("px-5 py-4 rounded-t-3xl flex items-center justify-between border-b backdrop-blur-xl z-10", col.headerBg, col.border)}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md", col.gradient)}>
                                            <Icon className="h-4 w-4 text-white" />
                                        </div>
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-wide uppercase">{col.label}</h3>
                                    </div>
                                    <span className={cn("text-[12px] font-bold px-3 py-1 rounded-full shadow-inner", col.badge)}>
                                        {colApps.length}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="p-4 flex-1 overflow-y-auto overflow-x-hidden space-y-4 custom-scrollbar relative">
                                    {colApps.length === 0 && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none opacity-50">
                                            <div className="w-16 h-16 rounded-3xl bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300/50 dark:border-slate-700/50 flex items-center justify-center mb-4 backdrop-blur-sm">
                                                <Icon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold tracking-wide uppercase">
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
                                                    "group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm cursor-grab active:cursor-grabbing transition-all duration-300 ease-out",
                                                    "hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300/60 dark:hover:border-indigo-500/50 hover:-translate-y-1",
                                                    isDeleting && "opacity-40 scale-95 pointer-events-none",
                                                    draggedAppId === app.id && "opacity-50 scale-95 rotate-2 shadow-2xl"
                                                )}
                                            >
                                                {/* Drag Handle + Delete/Archive (Desktop) */}
                                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 lg:flex hidden gap-1">
                                                    <button
                                                        onClick={(e) => handleArchive(app.id, e, !!app.isArchived)}
                                                        disabled={isDeleting}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                                        title={app.isArchived ? "Unarchive" : "Archive"}
                                                    >
                                                        <Archive className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(app.id, e)}
                                                        disabled={isDeleting}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>

                                                <Link href={`/applications/${app.id}`} className="block p-4">
                                                    {/* Title */}
                                                    <div className="flex justify-between items-start gap-3 min-w-0">
                                                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate min-w-0 flex-1 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors pr-10">
                                                            {app.jobTitle || 'Untitled Position'}
                                                        </h4>
                                                    </div>

                                                    {/* Company */}
                                                    <div className="flex items-center gap-1.5 mt-1 opacity-85 min-w-0">
                                                        <Briefcase className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate min-w-0 flex-1">
                                                            {app.companyName || 'Unknown Company'}
                                                        </p>
                                                    </div>

                                                    {/* Details: collapsible on desktop hover, visible on mobile */}
                                                    <div className="lg:max-h-0 lg:opacity-0 overflow-hidden transition-all duration-300 ease-in-out lg:group-hover:max-h-40 lg:group-hover:opacity-100 lg:group-hover:mt-3.5 mt-3">
                                                        <div className="space-y-3">
                                                            {/* Metadata Row */}
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                {/* Days ago badge */}
                                                                {daysAgo && (
                                                                    <span className="inline-flex items-center gap-1.2 text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 px-2 py-0.5 rounded-md shadow-sm">
                                                                        <Clock className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                                                                        {daysAgo}
                                                                    </span>
                                                                )}

                                                                {/* Days since applied */}
                                                                {daysSinceApplied >= 0 && col.id !== 'draft' && (
                                                                    <span className={cn(
                                                                        "inline-flex items-center gap-1.2 text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-sm",
                                                                        daysSinceApplied > 14
                                                                            ? "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/30 dark:border-amber-800/50"
                                                                            : "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-900/30 dark:border-blue-800/50"
                                                                    )}>
                                                                        <Send className="h-2.5 w-2.5 mr-0.5 shrink-0" />
                                                                        {daysSinceApplied === 0 ? 'Today' : `${daysSinceApplied}d`}
                                                                    </span>
                                                                )}

                                                                {/* ATS Score */}
                                                                {atsScore !== null && (
                                                                    <AtsScoreBadge score={atsScore} />
                                                                )}
                                                            </div>

                                                            {/* Footer */}
                                                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                                                                {isTailoring ? (
                                                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 dark:text-indigo-300 dark:bg-indigo-900/30 dark:ring-indigo-800/50 animate-pulse shadow-sm">
                                                                        <Sparkles className="h-3 w-3 animate-spin mr-0.5" />
                                                                        {app.tailorStatus === 'tailoring' ? 'Tailoring...' :
                                                                            app.tailorStatus === 'verifying' ? 'Verifying...' :
                                                                                'Analyzing...'}
                                                                    </span>
                                                                ) : (
                                                                    <span className={cn(
                                                                        "inline-flex items-center gap-1.2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ring-1",
                                                                        hasResume
                                                                            ? "text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/30 dark:ring-emerald-800/50"
                                                                            : "text-slate-500 bg-slate-100 ring-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:ring-slate-700"
                                                                    )}>
                                                                        {hasResume ? <FileCheck className="h-3 w-3 mr-0.5" /> : <FileX className="h-3 w-3 mr-0.5" />}
                                                                        {hasResume ? 'Ready' : 'No Resume'}
                                                                    </span>
                                                                )}
                                                                <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all duration-300" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>

                                                {/* Mobile Actions: Move + Delete */}
                                                <div className="lg:hidden flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl backdrop-blur-sm">
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
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => handleArchive(app.id, e, !!app.isArchived)}
                                                            disabled={isDeleting}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                                                            title={app.isArchived ? "Unarchive" : "Archive"}
                                                        >
                                                            <Archive className="h-3.5 w-3.5" />
                                                        </button>
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
