'use client';

import { useState, useEffect } from 'react';
import { Application, applications } from '@/lib/db/schema';
import { updateApplication, getProfile } from '@/lib/actions';
import {
    Loader2, Save, Wand2, Upload, FileText, ChevronLeft, ChevronRight,
    RefreshCw, Download, CheckSquare, Square, UserCheck, Briefcase,
    Sparkles, X, Eye, GitCompare, LayoutGrid, Mail, Copy, Check,
    PenLine, BookOpen, Zap, Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { JobDetails } from '@/lib/parser';
import { useAIConfig } from '@/app/context/AIConfigContext';
import { ResumePreview } from '@/components/ResumePreview';
import { DiffViewer } from '@/components/DiffViewer';

interface ApplicationClientProps {
    initialApplication: Application;
}

// Helper for constructing job description strings
function constructJobString(parts: string[]) {
    return parts.join('\n');
}

// ─── Score Ring Component ───
function ScoreRing({ score, size = 80, strokeWidth = 7 }: { score: number; size?: number; strokeWidth?: number }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} className="score-ring-bg" />
            <circle
                cx={size / 2} cy={size / 2} r={radius}
                className="score-ring-fill"
                stroke={color}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
            />
            <text
                x={size / 2} y={size / 2}
                textAnchor="middle" dominantBaseline="central"
                className="transform rotate-90 origin-center fill-slate-900 font-bold"
                style={{ fontSize: size * 0.28 }}
            >
                {score}
            </text>
        </svg>
    );
}



export default function ApplicationClient({ initialApplication }: ApplicationClientProps) {
    const [app, setApp] = useState(initialApplication);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'job' | 'resume'>('job');
    const [mobileTab, setMobileTab] = useState<'job' | 'resume' | 'result'>('job');
    const router = useRouter();

    // Resume State
    const [resumeText, setResumeText] = useState(app.baseResume || '');
    const [isUploading, setIsUploading] = useState(false);

    // Job Description State
    const [jobDescription, setJobDescription] = useState(app.jobDescription || '');
    const [jobDetails, setJobDetails] = useState<JobDetails | null>(
        app.jobDetails ? JSON.parse(app.jobDetails) : null
    );
    const [viewMode, setViewMode] = useState<'analysis' | 'raw'>('analysis');

    // Selection state for optimization
    const [selectedJobDetails, setSelectedJobDetails] = useState<{
        skills: string[];
        requirements: string[];
        experience: string[];
        useFullDescription: boolean;
    }>({
        skills: [],
        requirements: [],
        experience: [],
        useFullDescription: false,
    });

    useEffect(() => {
        if (jobDetails) {
            setSelectedJobDetails({
                skills: jobDetails.skills || [],
                requirements: jobDetails.requirements || [],
                experience: jobDetails.experience || [],
                useFullDescription: false,
            });
            setViewMode('analysis');
        }
    }, [jobDetails]);

    const [isScraping, setIsScraping] = useState(false);

    // Result State
    const [tailoredResume, setTailoredResume] = useState(app.tailoredResume || '');
    const initialAnalysis = app.analysis ? JSON.parse(app.analysis) : { changes: [], atsScore: null, executionTime: null };
    const [changes, setChanges] = useState<any[]>(initialAnalysis.changes || []);
    const [atsScore, setAtsScore] = useState<{ before: number, after: number, analysis: string } | null>(initialAnalysis.atsScore || null);
    const [executionTime, setExecutionTime] = useState<number | null>(initialAnalysis.executionTime || null);
    const [resultViewMode, setResultViewMode] = useState<'preview' | 'diff'>('preview');

    // Cover Letter State
    const [coverLetter, setCoverLetter] = useState(app.coverLetter || '');
    const [coverLetterLoading, setCoverLetterLoading] = useState(false);
    const [coverLetterStyle, setCoverLetterStyle] = useState<'professional' | 'concise' | 'storytelling' | 'executive'>('professional');
    const [coverLetterInstructions, setCoverLetterInstructions] = useState('');
    const [outputTab, setOutputTab] = useState<'resume' | 'coverLetter'>('resume');
    const [copied, setCopied] = useState(false);
    const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);

    // Global AI Config
    const { selectedModel, selectedProvider, customModelConfig } = useAIConfig();

    // UI State
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<'modern' | 'classic' | 'minimal'>('modern');
    const [showChanges, setShowChanges] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Workflow step status
    const hasJobData = !!(jobDescription || jobDetails);
    const hasResume = !!resumeText;
    const hasResult = !!tailoredResume;

    useEffect(() => {
        if (!app.jobDescription && app.jobUrl && !jobDescription) {
            scrapeJob();
        }
    }, [app.jobDescription, app.jobUrl]);

    useEffect(() => {
        if (app.jobTitle && app.companyName) {
            document.title = `${app.jobTitle} at ${app.companyName}`;
        } else if (app.jobTitle) {
            document.title = `${app.jobTitle}`;
        }
    }, [app.jobTitle, app.companyName]);

    // ─── Handlers (all business logic unchanged) ───

    const scrapeJob = async () => {
        if (!app.jobUrl && !jobDescription) return;
        setIsScraping(true);
        try {
            const apiKey = localStorage.getItem('gemini_api_key');
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: app.jobUrl,
                    text: jobDescription,
                    apiKey,
                    modelProvider: selectedProvider,
                    modelName: selectedModel,
                    customConfig: customModelConfig
                }),
            });
            const data = await res.json();
            if (data.description) {
                setJobDescription(data.description);
                let newTitle = app.jobTitle;
                let newCompany = app.companyName;
                if (data.details) {
                    setJobDetails(data.details);
                    if (data.details.title) newTitle = data.details.title;
                    if (data.details.company) newCompany = data.details.company;
                }
                setApp((prev: any) => ({ ...prev, jobTitle: newTitle, companyName: newCompany }));
                await updateApplication(app.id, {
                    jobDescription: data.description,
                    jobDetails: data.details ? JSON.stringify(data.details) : undefined,
                    jobTitle: newTitle,
                    companyName: newCompany
                });
            }
        } catch (err) {
            console.error('Scraping failed', err);
        } finally {
            setIsScraping(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        await updateApplication(app.id, {
            jobDescription,
            jobDetails: jobDetails ? JSON.stringify(jobDetails) : undefined,
            baseResume: resumeText,
            tailoredResume,
            coverLetter: coverLetter || undefined,
        });
        setLoading(false);
    };

    const handleGenerateCoverLetter = async () => {
        setCoverLetterLoading(true);
        setError(null);
        setOutputTab('coverLetter');
        try {
            const apiKey = localStorage.getItem('gemini_api_key');
            let finalJobDescription = jobDescription;
            if (jobDetails && !selectedJobDetails.useFullDescription) {
                const parts = [];
                parts.push(`Job Title: ${jobDetails.title || app.jobTitle}`);
                parts.push(`Company: ${jobDetails.company || app.companyName}`);
                if (selectedJobDetails.requirements.length > 0) {
                    parts.push(`\nRequirements:\n${selectedJobDetails.requirements.map(r => `- ${r}`).join('\n')}`);
                }
                if (selectedJobDetails.skills.length > 0) {
                    parts.push(`\nSkills:\n${selectedJobDetails.skills.map(s => `- ${s}`).join('\n')}`);
                }
                parts.push(`\nDescription:\n${jobDetails.description || jobDescription}`);
                finalJobDescription = parts.join('\n');
            }

            const res = await fetch('/api/cover-letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume: resumeText,
                    jobDescription: finalJobDescription,
                    companyName: app.companyName || jobDetails?.company,
                    jobTitle: app.jobTitle || jobDetails?.title,
                    apiKey,
                    modelProvider: selectedProvider,
                    modelName: selectedModel,
                    customConfig: customModelConfig,
                    style: coverLetterStyle,
                    customInstructions: coverLetterInstructions || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || `Server Error: ${res.status}`);
            }

            if (data.coverLetter) {
                setCoverLetter(data.coverLetter);
                setIsEditingCoverLetter(false);
                await updateApplication(app.id, { coverLetter: data.coverLetter });
            }
        } catch (err) {
            console.error('Cover letter generation failed', err);
            setError(err instanceof Error ? err.message : 'Failed to generate cover letter.');
        } finally {
            setCoverLetterLoading(false);
        }
    };

    const handleCopyCoverLetter = () => {
        navigator.clipboard.writeText(coverLetter);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadCoverLetterTxt = () => {
        const blob = new Blob([coverLetter], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cover-letter-${app.companyName || 'application'}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/parse-resume', {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                const text = await res.text();
                console.error('Server error:', res.status, text);
                throw new Error(`Server returned ${res.status}`);
            }
            const data = await res.json();
            if (data.text) {
                setResumeText(data.text);
                await updateApplication(app.id, { baseResume: data.text });
            }
        } catch (err) {
            console.error('Upload failed', err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSyncProfile = async () => {
        if (resumeText && !confirm("This will overwrite your current Base Resume with data from your Master Profile. Are you sure?")) {
            return;
        }
        setLoading(true);
        try {
            const profile = await getProfile();
            if (!profile) {
                alert("No Master Profile found. Please configure it in the Profile section.");
                setLoading(false);
                return;
            }
            const parts = [];
            if (profile.name) parts.push(`# ${profile.name}`);
            const contact = [profile.email, profile.phone, profile.linkedin, profile.website].filter(Boolean).join(' | ');
            if (contact) parts.push(`${contact}\n`);
            if (profile.summary) {
                parts.push(`## Professional Summary\n${profile.summary}\n`);
            }
            const exp = profile.experience ? JSON.parse(profile.experience) : [];
            if (exp.length > 0) {
                parts.push('## Experience');
                exp.forEach((e: any) => {
                    parts.push(`### ${e.role} | ${e.company}`);
                    parts.push(`*${e.dates}*`);
                    if (e.description) parts.push(e.description);
                    parts.push('');
                });
            }
            const edu = profile.education ? JSON.parse(profile.education) : [];
            if (edu.length > 0) {
                parts.push('## Education');
                edu.forEach((e: any) => {
                    parts.push(`### ${e.degree}`);
                    parts.push(`${e.institution} | ${e.dates}`);
                    parts.push('');
                });
            }
            let skills = profile.skills;
            if (typeof skills === 'string') {
                try { skills = JSON.parse(skills); } catch { }
            }
            if (Array.isArray(skills) && skills.length > 0) {
                parts.push('## Skills');
                parts.push(skills.join(', '));
                parts.push('');
            } else if (typeof skills === 'string' && skills) {
                parts.push('## Skills');
                parts.push(skills);
                parts.push('');
            }
            const projects = profile.projects ? JSON.parse(profile.projects) : [];
            if (projects.length > 0) {
                parts.push('## Projects');
                projects.forEach((p: any) => {
                    parts.push(`### ${p.name}`);
                    if (p.description) parts.push(p.description);
                    if (p.link) parts.push(`[Link](${p.link})`);
                    parts.push('');
                });
            }
            const newResumeText = parts.join('\n');
            setResumeText(newResumeText);
            await updateApplication(app.id, { baseResume: newResumeText });
        } catch (err) {
            console.error("Failed to sync profile", err);
            alert("Failed to sync profile");
        } finally {
            setLoading(false);
        }
    };

    const handleTailor = async () => {
        setLoading(true);
        setError(null);
        try {
            const apiKey = localStorage.getItem('gemini_api_key');
            let finalJobDescription = jobDescription;
            if (jobDetails && !selectedJobDetails.useFullDescription) {
                const parts = [];
                parts.push(`Job Title: ${jobDetails.title || app.jobTitle}`);
                parts.push(`Company: ${jobDetails.company || app.companyName}`);
                if (selectedJobDetails.requirements.length > 0) {
                    parts.push(`\nSelected Requirements:\n${selectedJobDetails.requirements.map(r => `- ${r}`).join('\n')}`);
                }
                if (selectedJobDetails.skills.length > 0) {
                    parts.push(`\nSelected Skills:\n${selectedJobDetails.skills.map(s => `- ${s}`).join('\n')}`);
                }
                if (selectedJobDetails.experience.length > 0) {
                    parts.push(`\nSelected Experience:\n${selectedJobDetails.experience.map(e => `- ${e}`).join('\n')}`);
                }
                parts.push(`\nAdditional Context (Cleaned Description):\n${jobDetails.description || jobDescription}`);
                finalJobDescription = parts.join('\n');
            }
            const startTime = performance.now();
            const res = await fetch('/api/tailor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume: resumeText,
                    jobDescription: finalJobDescription,
                    apiKey,
                    modelProvider: selectedProvider,
                    modelName: selectedModel,
                    customConfig: customModelConfig
                }),
            });
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);
            setExecutionTime(duration);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || `Server Error: ${res.status}`);
            }
            if (data.tailoredResume) {
                setTailoredResume(data.tailoredResume);
                setChanges(data.changes || []);
                if (data.atsScore) {
                    setAtsScore(data.atsScore);
                }
                await updateApplication(app.id, {
                    tailoredResume: data.tailoredResume,
                    analysis: JSON.stringify({
                        changes: data.changes || [],
                        atsScore: data.atsScore || null,
                        executionTime: duration
                    })
                });
            }
        } catch (err) {
            console.error('Tailoring failed', err);
            setError(err instanceof Error ? err.message : 'Failed to tailor resume. Please check your settings.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        // Force preview mode for printing (diff view doesn't make sense in PDF)
        if (resultViewMode !== 'preview') {
            setResultViewMode('preview');
        }
        // Small delay to let React re-render to preview mode before printing
        setTimeout(() => window.print(), 100);
    };

    // ─── RENDER ───

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col gap-0">

            {/* ━━━ Header (Sticky on Mobile) ━━━ */}
            <div className="sticky top-14 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-3 sm:px-5 py-2 flex items-center justify-between print:hidden flex-wrap gap-2 transition-all">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <Link
                        href="/"
                        className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors shrink-0"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="text-xs font-semibold hidden sm:inline">Dashboard</span>
                    </Link>

                    <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" />

                    <div className="min-w-0 flex items-center gap-2 flex-1">
                        <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                            {app.jobTitle || 'New Application'}
                        </h1>
                    </div>

                    {/* Status Badge */}
                    <span className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider",
                        hasResult ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            hasResume ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                "bg-slate-100 text-slate-500 border border-slate-200"
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", hasResult ? "bg-emerald-500" : hasResume ? "bg-amber-500" : "bg-slate-400")} />
                        <span className="hidden sm:inline">{hasResult ? 'Tailored' : hasResume ? 'In Progress' : 'Draft'}</span>
                    </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">Save</span>
                    </button>
                    <button
                        onClick={handleTailor}
                        disabled={loading || !resumeText || !jobDescription}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-indigo-300" />}
                        <span className="hidden sm:inline">Tailor Resume</span>
                        <span className="sm:hidden">Tailor</span>
                    </button>
                </div>
            </div>

            {/* ━━━ Mobile Bottom Tab Bar ━━━ */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-slate-200 px-6 py-2 flex items-center justify-between shadow-lg ring-1 ring-slate-900/5 pb-safe">
                {([
                    { id: 'job', label: 'Job', icon: Briefcase },
                    { id: 'resume', label: 'Resume', icon: FileText },
                    { id: 'result', label: 'Result', icon: Sparkles },
                ] as const).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setMobileTab(tab.id);
                            if (tab.id !== 'result') setActiveTab(tab.id as 'job' | 'resume');
                        }}
                        className={cn(
                            "flex flex-col items-center gap-1 transition-all",
                            mobileTab === tab.id
                                ? "text-indigo-600 scale-105"
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <div className={cn(
                            "p-1.5 rounded-full transition-colors",
                            mobileTab === tab.id ? "bg-indigo-50" : "bg-transparent"
                        )}>
                            <tab.icon className="h-5 w-5" />
                        </div>
                        <span className="text-[10px] font-medium">{tab.label}</span>
                    </button>
                ))}
            </div>



            {/* ━━━ Error Banner ━━━ */}
            {error && (
                <div className="animate-fade-in-up mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm print:hidden" role="alert">
                    <X className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="flex-1 min-w-0 text-xs truncate"><span className="font-semibold">Error:</span> {error}</p>
                    <button onClick={() => setError(null)} className="p-1 rounded hover:bg-red-100 transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* ━━━ Main Workspace ━━━ */}
            <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-hidden relative transition-all duration-300 ease-in-out">

                {/* ── Left Panel: Input (JD & Resume) ── */}
                <div
                    className={cn(
                        "transition-all duration-300 ease-in-out shrink-0 flex flex-col gap-3 min-h-0",
                        // Mobile: Full width, visible only if tab is job or resume
                        mobileTab === 'result' ? "hidden lg:flex" : "w-full",
                        // Desktop: Controlled by isLeftPanelOpen
                        isLeftPanelOpen ? "lg:w-[420px] opacity-100" : "lg:w-0 lg:opacity-0 lg:p-0 lg:overflow-hidden"
                    )}
                >
                    {/* Segmented Control (Desktop Only) */}
                    <div className="hidden lg:flex items-center gap-2 print:hidden">
                        <div className="segmented-control flex-1">
                            <button
                                onClick={() => setActiveTab('job')}
                                className={activeTab === 'job' ? 'active' : ''}
                            >
                                <span className="flex items-center justify-center gap-1.5">
                                    <Briefcase className="h-3.5 w-3.5" />
                                    Job Details
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab('resume')}
                                className={activeTab === 'resume' ? 'active' : ''}
                            >
                                <span className="flex items-center justify-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5" />
                                    Resume
                                </span>
                            </button>
                        </div>
                        <button
                            onClick={() => setIsLeftPanelOpen(false)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Collapse panel"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 glass-card-solid overflow-hidden flex flex-col">

                        {/* ─ Job Description Tab ─ */}
                        {activeTab === 'job' && (
                            <div className="flex flex-col h-full relative">
                                {/* Scraping Overlay */}
                                {isScraping && (
                                    <div className="loading-overlay">
                                        <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-xl shadow-lg border border-slate-100">
                                            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">Analyzing Job</p>
                                                <p className="text-xs text-slate-500">Extracting key details...</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Header */}
                                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                                    <div>
                                        <h3 className="font-semibold text-sm text-slate-900">
                                            {viewMode === 'raw' ? 'Raw Text' : 'Job Analysis'}
                                        </h3>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {jobDetails ? 'Select relevant features for tailoring' : 'Paste or scrape the job description'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {!jobDetails && jobDescription && (
                                            <button
                                                onClick={scrapeJob}
                                                disabled={isScraping}
                                                className="inline-flex items-center gap-1.5 text-xs font-medium bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
                                            >
                                                {isScraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                                                Analyze
                                            </button>
                                        )}
                                        <button
                                            onClick={scrapeJob}
                                            disabled={isScraping}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                                            title="Re-analyze"
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${isScraping ? 'animate-spin' : ''}`} />
                                        </button>

                                        {jobDetails && (
                                            <>
                                                <button
                                                    onClick={() => setViewMode(viewMode === 'analysis' ? 'raw' : 'analysis')}
                                                    className="text-[11px] font-medium text-indigo-500 hover:text-indigo-700 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                                                >
                                                    {viewMode === 'analysis' ? 'Raw' : 'Analysis'}
                                                </button>

                                                {viewMode === 'analysis' && (
                                                    <button
                                                        onClick={() => setSelectedJobDetails(prev => ({ ...prev, useFullDescription: !prev.useFullDescription }))}
                                                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border transition-all ${selectedJobDetails.useFullDescription
                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                                            }`}
                                                    >
                                                        {selectedJobDetails.useFullDescription ? <CheckSquare className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                                                        Full Text
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-auto custom-scrollbar pb-20 lg:pb-0">
                                    {jobDetails && viewMode === 'analysis' ? (
                                        <div className="p-4 space-y-5 stagger-children">
                                            {/* Job Type Badge */}
                                            {jobDetails.jobType && (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                    <Briefcase className="h-3 w-3" />
                                                    {jobDetails.jobType}
                                                </div>
                                            )}

                                            {!selectedJobDetails.useFullDescription && (
                                                <>
                                                    {/* Skills Pills */}
                                                    {jobDetails.skills && jobDetails.skills.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2.5">
                                                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Skills</h4>
                                                                <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                                    {selectedJobDetails.skills.length}/{jobDetails.skills.length}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {jobDetails.skills.map((skill, i) => {
                                                                    const isSelected = selectedJobDetails.skills.includes(skill);
                                                                    return (
                                                                        <button
                                                                            key={i}
                                                                            onClick={() => {
                                                                                setSelectedJobDetails(prev => ({
                                                                                    ...prev,
                                                                                    skills: isSelected
                                                                                        ? prev.skills.filter(s => s !== skill)
                                                                                        : [...prev.skills, skill]
                                                                                }));
                                                                            }}
                                                                            className={`chip ${isSelected ? 'selected' : ''}`}
                                                                        >
                                                                            {skill}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Requirements Checklist */}
                                                    {jobDetails.requirements && jobDetails.requirements.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">Requirements</h4>
                                                            <div className="space-y-1.5">
                                                                {jobDetails.requirements.map((req, i) => {
                                                                    const isSelected = selectedJobDetails.requirements.includes(req);
                                                                    return (
                                                                        <button
                                                                            key={i}
                                                                            className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all duration-200 group ${isSelected
                                                                                ? 'bg-indigo-50/70 border border-indigo-100'
                                                                                : 'bg-white border border-transparent hover:bg-slate-50 hover:border-slate-100'
                                                                                }`}
                                                                            onClick={() => {
                                                                                setSelectedJobDetails(prev => ({
                                                                                    ...prev,
                                                                                    requirements: isSelected
                                                                                        ? prev.requirements.filter(r => r !== req)
                                                                                        : [...prev.requirements, req]
                                                                                }));
                                                                            }}
                                                                        >
                                                                            <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                                                                {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                                                            </div>
                                                                            <span className={`text-[13px] leading-relaxed ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>
                                                                                {req}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Experience Checklist */}
                                                    {jobDetails.experience && jobDetails.experience.length > 0 && (
                                                        <div>
                                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">Experience</h4>
                                                            <div className="space-y-1.5">
                                                                {jobDetails.experience.map((exp, i) => {
                                                                    const isSelected = selectedJobDetails.experience.includes(exp);
                                                                    return (
                                                                        <button
                                                                            key={i}
                                                                            className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all duration-200 group ${isSelected
                                                                                ? 'bg-indigo-50/70 border border-indigo-100'
                                                                                : 'bg-white border border-transparent hover:bg-slate-50 hover:border-slate-100'
                                                                                }`}
                                                                            onClick={() => {
                                                                                setSelectedJobDetails(prev => ({
                                                                                    ...prev,
                                                                                    experience: isSelected
                                                                                        ? prev.experience.filter(e => e !== exp)
                                                                                        : [...prev.experience, exp]
                                                                                }));
                                                                            }}
                                                                        >
                                                                            <div className={`mt-0.5 shrink-0 ${isSelected ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                                                                {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                                                            </div>
                                                                            <span className={`text-[13px] leading-relaxed ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>
                                                                                {exp}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Full Description */}
                                            {(selectedJobDetails.useFullDescription || (!jobDetails.skills?.length && !jobDetails.requirements?.length)) && (
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Description</h4>
                                                    <div className="text-[13px] text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                        {jobDetails.description || jobDescription}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <textarea
                                            className="w-full h-full p-4 resize-none outline-none font-mono text-[13px] text-slate-800 bg-white placeholder:text-slate-300"
                                            placeholder="Paste the job description here, or click Analyze to extract key details..."
                                            value={jobDescription}
                                            onChange={(e) => setJobDescription(e.target.value)}
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ─ Resume Tab ─ */}
                        {activeTab === 'resume' && (
                            <div className="flex flex-col h-full">
                                {/* Toolbar */}
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                                    <h3 className="text-sm font-semibold text-slate-900">Resume Content</h3>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={handleSyncProfile}
                                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                                            title="Sync from Master Profile"
                                        >
                                            <UserCheck className="h-3.5 w-3.5" />
                                            Sync Profile
                                        </button>
                                        <div className="h-4 w-px bg-slate-200" />
                                        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer">
                                            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                            Upload PDF
                                            <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                </div>

                                {/* Editor or Dropzone */}
                                {!resumeText ? (
                                    <div className="flex-1 flex items-center justify-center p-8">
                                        <label className="w-full max-w-sm flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer group">
                                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                                <Upload className="h-6 w-6 text-indigo-500" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-semibold text-slate-700">Drop your resume here</p>
                                                <p className="text-xs text-slate-400 mt-1">PDF or TXT format, or paste text below</p>
                                            </div>
                                            <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                ) : (
                                    <textarea
                                        className="flex-1 w-full p-4 resize-none outline-none font-mono text-[13px] text-slate-800 bg-white placeholder:text-slate-300 custom-scrollbar"
                                        placeholder="Paste your resume content here..."
                                        value={resumeText}
                                        onChange={(e) => setResumeText(e.target.value)}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right Panel: Output ── */}
                <div className={cn(
                    "flex-1 flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out",
                    // Mobile: Visible only if tab is result
                    mobileTab !== 'result' ? "hidden lg:flex" : "flex"
                )}>
                    {/* ─ Main Result Area (single card, no gaps above) ─ */}
                    <div className="flex-1 glass-card-solid overflow-hidden flex flex-col relative">
                        {/* ─ Unified Compact Toolbar ─ */}
                        <div className="bg-white border-b border-slate-100 px-3 py-1.5 flex items-center gap-2 shrink-0 print:hidden flex-wrap">
                            {/* Output Tab Toggle */}
                            <div className="segmented-control text-[11px] mr-2">
                                <button onClick={() => setOutputTab('resume')} className={outputTab === 'resume' ? 'active' : ''}>
                                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Resume</span>
                                </button>
                                <button onClick={() => setOutputTab('coverLetter')} className={outputTab === 'coverLetter' ? 'active' : ''}>
                                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Cover Letter</span>
                                </button>
                            </div>

                            {/* Resume-specific controls */}
                            {outputTab === 'resume' && (
                                <>
                                    {/* Left: ATS Score inline badge */}
                                    {atsScore ? (
                                        <div className="flex items-center gap-2 mr-auto">
                                            <ScoreRing score={atsScore.after} size={28} strokeWidth={3} />
                                            <span className="text-xs font-bold text-slate-700">ATS {atsScore.after}</span>
                                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+{atsScore.after - atsScore.before}</span>
                                            {executionTime && <span className="text-[9px] text-slate-400 font-mono">{(executionTime / 1000).toFixed(1)}s</span>}
                                        </div>
                                    ) : (
                                        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mr-auto">
                                            <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Result
                                        </span>
                                    )}

                                    {/* Center/Right: Controls */}
                                    {tailoredResume && (
                                        <>
                                            {/* View toggle */}
                                            <div className="segmented-control text-[11px]">
                                                <button onClick={() => setResultViewMode('preview')} className={resultViewMode === 'preview' ? 'active' : ''}>
                                                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Preview</span>
                                                </button>
                                                <button onClick={() => setResultViewMode('diff')} className={resultViewMode === 'diff' ? 'active' : ''}>
                                                    <span className="flex items-center gap-1"><GitCompare className="h-3 w-3" /> Diff</span>
                                                </button>
                                            </div>

                                            {/* Template (only in preview mode) */}
                                            {resultViewMode === 'preview' && (
                                                <div className="segmented-control text-[11px]">
                                                    {(['modern', 'classic', 'minimal'] as const).map((t) => (
                                                        <button key={t} onClick={() => setSelectedTemplate(t)} className={selectedTemplate === t ? 'active' : ''}>
                                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <button
                                                onClick={handleDownloadPDF}
                                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                                            >
                                                <Download className="h-3 w-3" /> PDF
                                            </button>
                                        </>
                                    )}
                                </>
                            )}

                            {/* Cover Letter controls */}
                            {outputTab === 'coverLetter' && (
                                <>
                                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mr-auto">
                                        <Mail className="h-3.5 w-3.5 text-violet-400" /> Cover Letter
                                    </span>
                                    {coverLetter && (
                                        <>
                                            <button
                                                onClick={() => setIsEditingCoverLetter(!isEditingCoverLetter)}
                                                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors ${isEditingCoverLetter ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                                                    }`}
                                            >
                                                <PenLine className="h-3 w-3" /> Edit
                                            </button>
                                            <button
                                                onClick={handleCopyCoverLetter}
                                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                                            >
                                                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                                {copied ? 'Copied!' : 'Copy'}
                                            </button>
                                            <button
                                                onClick={handleDownloadCoverLetterTxt}
                                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                                            >
                                                <Download className="h-3 w-3" /> TXT
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Loading Overlay */}
                        {(loading || coverLetterLoading) && (
                            <div className="loading-overlay">
                                <div className="flex flex-col items-center gap-4 animate-fade-in-up">
                                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${coverLetterLoading ? 'from-violet-500 to-purple-600' : 'from-indigo-500 to-violet-500'} flex items-center justify-center shadow-lg`}>
                                        {coverLetterLoading
                                            ? <Mail className="h-7 w-7 text-white animate-spin" style={{ animationDuration: '3s' }} />
                                            : <Sparkles className="h-7 w-7 text-white animate-spin" style={{ animationDuration: '3s' }} />
                                        }
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-slate-800">
                                            {coverLetterLoading ? 'Writing your cover letter' : 'Tailoring your resume'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {coverLetterLoading ? 'Crafting a personalized letter...' : 'AI is optimizing for this role...'}
                                        </p>
                                    </div>
                                    <div className="w-48 h-1.5 rounded-full overflow-hidden bg-slate-100">
                                        <div className="h-full animate-shimmer rounded-full" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Content & Sidebar Wrapper */}
                        <div className="flex-1 flex min-h-0 overflow-hidden relative">
                            <div id="print-container" className="flex-1 overflow-auto p-4 md:p-8 bg-white custom-scrollbar print:p-0 print:overflow-visible pb-20 lg:pb-8">
                                {outputTab === 'resume' ? (
                                    // Resume output
                                    tailoredResume ? (
                                        resultViewMode === 'diff' ? (
                                            <div className="h-full overflow-y-auto">
                                                <DiffViewer oldText={resumeText} newText={tailoredResume} />
                                            </div>
                                        ) : (
                                            <ResumePreview
                                                content={tailoredResume}
                                                title={null}
                                                company={null}
                                                template={selectedTemplate}
                                            />
                                        )
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                            <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-5 animate-float">
                                                <Sparkles className="h-9 w-9 text-slate-300" />
                                            </div>
                                            <p className="text-base font-semibold text-slate-500 mb-1">No tailored result yet</p>
                                            <p className="text-sm text-slate-400 max-w-xs text-center">
                                                Fill in the job description and your resume, then click
                                                <span className="text-indigo-500 font-semibold"> Tailor Resume</span>
                                            </p>
                                        </div>
                                    )
                                ) : (
                                    // Cover Letter output
                                    coverLetter && !coverLetterLoading ? (
                                        isEditingCoverLetter ? (
                                            <textarea
                                                className="w-full h-full resize-none outline-none font-serif text-[15px] text-slate-800 leading-relaxed p-2"
                                                value={coverLetter}
                                                onChange={(e) => setCoverLetter(e.target.value)}
                                                onBlur={async () => {
                                                    await updateApplication(app.id, { coverLetter });
                                                }}
                                            />
                                        ) : (
                                            <div className="max-w-2xl mx-auto">
                                                <div className="font-serif text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                                                    {coverLetter}
                                                </div>
                                            </div>
                                        )
                                    ) : !coverLetterLoading ? (
                                        <div className="h-full flex flex-col items-center justify-center">
                                            {/* Style Picker */}
                                            <div className="w-full max-w-lg mb-8">
                                                <h3 className="text-sm font-bold text-slate-700 mb-3 text-center">Choose a Style</h3>
                                                <div className="grid grid-cols-2 gap-2.5">
                                                    {([
                                                        { id: 'professional' as const, label: 'Professional', desc: '3-4 paragraphs, balanced tone', icon: BookOpen, color: 'indigo' },
                                                        { id: 'concise' as const, label: 'Concise', desc: '2-3 short paragraphs, direct', icon: Zap, color: 'amber' },
                                                        { id: 'storytelling' as const, label: 'Storytelling', desc: 'Narrative-driven, engaging', icon: PenLine, color: 'violet' },
                                                        { id: 'executive' as const, label: 'Executive', desc: 'Strategic, leadership focus', icon: Crown, color: 'emerald' },
                                                    ]).map(s => {
                                                        const Icon = s.icon;
                                                        const isActive = coverLetterStyle === s.id;
                                                        return (
                                                            <button
                                                                key={s.id}
                                                                onClick={() => setCoverLetterStyle(s.id)}
                                                                className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${isActive
                                                                    ? `border-${s.color}-400 bg-${s.color}-50/50 shadow-sm`
                                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                                                    }`}
                                                            >
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? `bg-${s.color}-100 text-${s.color}-600` : 'bg-slate-100 text-slate-400'
                                                                    }`}>
                                                                    <Icon className="h-4 w-4" />
                                                                </div>
                                                                <div>
                                                                    <p className={`text-sm font-semibold ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>{s.label}</p>
                                                                    <p className="text-[11px] text-slate-400 mt-0.5">{s.desc}</p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Custom Instructions */}
                                            <div className="w-full max-w-lg mb-6">
                                                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Custom Instructions (optional)</label>
                                                <textarea
                                                    className="w-full h-20 p-3 resize-none rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                                                    placeholder='e.g., "Emphasize my leadership experience" or "Keep it under 200 words"'
                                                    value={coverLetterInstructions}
                                                    onChange={(e) => setCoverLetterInstructions(e.target.value)}
                                                />
                                            </div>

                                            {/* Generate Button */}
                                            <button
                                                onClick={handleGenerateCoverLetter}
                                                disabled={coverLetterLoading || !resumeText || !jobDescription}
                                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-violet-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                <Mail className="h-4 w-4" />
                                                Generate Cover Letter
                                            </button>

                                            {(!resumeText || !jobDescription) && (
                                                <p className="text-xs text-slate-400 mt-3">Add a resume and job description first</p>
                                            )}
                                        </div>
                                    ) : null
                                )}
                            </div>

                            {/* Change Analysis Sidebar */}
                            {changes.length > 0 && showChanges && resultViewMode === 'preview' && (
                                <div className="w-72 border-l border-slate-100 bg-slate-50/70 overflow-auto custom-scrollbar p-4 shrink-0 print:hidden transition-all duration-300 animate-slide-in-right">
                                    <div className="flex items-center justify-between mb-4 sticky top-0 bg-slate-50/90 backdrop-blur-sm py-2 -mt-2 z-10">
                                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            Changes ({changes.length})
                                        </h3>
                                        <button
                                            onClick={() => setShowChanges(false)}
                                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <div className="space-y-3 stagger-children">
                                        {changes.map((change, i) => (
                                            <div key={i} className="text-xs space-y-2 bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                                {change.section && (
                                                    <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                                        {change.section}
                                                    </span>
                                                )}
                                                <p className="font-semibold text-slate-800 leading-snug">{change.reason}</p>
                                                {change.original && (
                                                    <div className="text-slate-400 line-through bg-red-50/60 p-2 rounded-lg text-[10px] leading-relaxed">
                                                        {change.original.substring(0, 80)}...
                                                    </div>
                                                )}
                                                <div className="text-slate-700 pl-2.5 border-l-2 border-emerald-400 bg-emerald-50/50 p-2 rounded-r-lg">
                                                    <span className="font-semibold text-emerald-600 text-[10px]">Updated:</span>
                                                    <span className="text-[10px] ml-1">{change.new.substring(0, 80)}...</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ━━━ Floating Expand Button (Desktop Only) ━━━ */}
            {!isLeftPanelOpen && (
                <div className="hidden lg:block absolute left-6 top-40 z-10 print:hidden">
                    <button
                        onClick={() => setIsLeftPanelOpen(true)}
                        className="p-3 bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg rounded-xl text-white hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                        title="Show input panel"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            )}

            {/* Show Changes button when sidebar is hidden */}
            {changes.length > 0 && !showChanges && tailoredResume && resultViewMode === 'preview' && (
                <div className="absolute right-4 bottom-24 lg:right-6 lg:top-40 z-10 print:hidden">
                    <button
                        onClick={() => setShowChanges(true)}
                        className="p-3 bg-white border border-slate-200 shadow-lg rounded-xl text-slate-600 hover:shadow-xl hover:text-indigo-600 hover:border-indigo-200 transition-all hover:scale-105 active:scale-95"
                        title="Show change analysis"
                    >
                        <LayoutGrid className="h-5 w-5" />
                    </button>
                </div>
            )}
        </div>
    );
}
