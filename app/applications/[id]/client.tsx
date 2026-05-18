'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Application } from '@/lib/db/schema';
import { updateApplication, getProfile } from '@/lib/actions';
import {
    Loader2, Save, Wand2, Upload, FileText, ChevronLeft, ChevronRight,
    RefreshCw, Download, CheckSquare, Square, UserCheck, Briefcase,
    Sparkles, X, Eye, GitCompare, Mail, Copy, Check,
    PenLine, BookOpen, Zap, Crown, Target, Layers, CheckCircle2,
    AlertCircle, PanelLeftClose, PanelLeftOpen, FileCheck2, ClipboardCheck,
    FileDown, ListChecks, ArrowRight, Menu, Home, PlusCircle, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { JobDetails } from '@/lib/parser';
import { useAIConfig } from '@/app/context/AIConfigContext';
import { ResumePreview } from '@/components/ResumePreview';
import { DiffViewer } from '@/components/DiffViewer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SectionWiseEditor, SectionName, SectionState, SectionsState, SECTION_ORDER } from '@/components/SectionWiseEditor';
import { parseResumeSections } from '@/lib/resume-parser';
import { ModelSelector } from '@/components/ModelSelector';
interface AnalysisChange {
    section?: string;
    reason?: string;
    original?: string;
    new?: string;
    oldText?: string[];
}

interface ApplicationClientProps {
    initialApplication: Application;
}

interface SaveSnapshotInput {
    jobDescription: string;
    jobDetails: JobDetails | null;
    resumeText: string;
    tailoredResume: string;
    coverLetter: string;
    selectedCertifications: Record<string, unknown>[];
}

function createSaveSnapshot({
    jobDescription,
    jobDetails,
    resumeText,
    tailoredResume,
    coverLetter,
    selectedCertifications,
}: SaveSnapshotInput) {
    return JSON.stringify({
        jobDescription,
        jobDetails: jobDetails ? JSON.stringify(jobDetails) : '',
        baseResume: resumeText,
        tailoredResume,
        coverLetter,
        selectedCertifications: JSON.stringify(selectedCertifications),
    });
}

function formatSaveTime(date: Date | null) {
    if (!date) return 'All changes saved';
    return `Saved ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
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
    const [isSaving, setIsSaving] = useState(false); // separate from loading (which is used for tailoring)
    const [activeTab, setActiveTab] = useState<'job' | 'resume'>('job');
    const [mobileTab, setMobileTab] = useState<'job' | 'resume' | 'result'>('job');


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
        requiredSkills: string[];
        preferredSkills: string[];
        requirements: string[];
        experience: string[];
        useFullDescription: boolean;
    }>({
        skills: [],
        requiredSkills: [],
        preferredSkills: [],
        requirements: [],
        experience: [],
        useFullDescription: false,
    });

    useEffect(() => {
        if (jobDetails) {
            // Backward compat: if old data has only 'skills', treat them as requiredSkills
            const reqSkills = (jobDetails as any).requiredSkills || jobDetails.skills || [];
            const prefSkills = (jobDetails as any).preferredSkills || [];
            setSelectedJobDetails({
                skills: [...reqSkills, ...prefSkills],
                requiredSkills: reqSkills,
                preferredSkills: prefSkills,
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
    const [changes, setChanges] = useState<AnalysisChange[]>(initialAnalysis.changes || []);
    const [atsScore, setAtsScore] = useState<{ before: number; after: number; analysis: string } | null>(initialAnalysis.atsScore || null);
    const [, setExecutionTime] = useState<number | null>(initialAnalysis.executionTime || null);
    const [resultViewMode, setResultViewMode] = useState<'preview' | 'diff' | 'edit'>('preview');
    const [tailorPhase, setTailorPhase] = useState<'extracting' | 'tailoring' | 'verifying' | 'gap_check' | 'analyzing' | 'complete' | null>(null);

    // Keyword Coverage State — pre-fix (before gap injection) and post-fix (final)
    const [, setPreFixCoverage] = useState<{
        required: { score: number; matched: string[]; missing: string[]; total: number };
        preferred: { score: number; matched: string[]; missing: string[]; total: number };
    } | null>(null);
    const [keywordCoverage, setKeywordCoverage] = useState<{
        required: { score: number; matched: string[]; missing: string[]; total: number };
        preferred: { score: number; matched: string[]; missing: string[]; total: number };
    } | null>(null);
    const [gapFixResults, setGapFixResults] = useState<{ injected: string[]; skipped: string[] } | null>(null);
    // SSE completion tracking
    const [sseIncomplete, setSseIncomplete] = useState(false);

    // Cover Letter State
    const [coverLetter, setCoverLetter] = useState(app.coverLetter || '');
    const [coverLetterLoading, setCoverLetterLoading] = useState(false);
    const [coverLetterStyle, setCoverLetterStyle] = useState<'professional' | 'concise' | 'storytelling' | 'executive'>('professional');
    const [coverLetterInstructions, setCoverLetterInstructions] = useState('');
    const [outputTab, setOutputTab] = useState<'resume' | 'coverLetter' | 'sections'>('resume');
    const [copied, setCopied] = useState(false);
    const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);

    // Global AI Config
    const { selectedModel, selectedProvider, customModelConfig, reportGeminiIssue } = useAIConfig();

    // UI State
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<'modern' | 'classic' | 'minimal'>('modern');
    const [activeAnalysisTab, setActiveAnalysisTab] = useState<'changes' | 'coverage' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pdfGenerating, setPdfGenerating] = useState(false);
        // ─── Section-wise generation state ───────────────────────────────────────────
    const makeSectionState = useCallback((original: string): SectionState => ({ original, tailored: '', status: 'idle', accepted: false, preferences: ['quantify', 'keywords'], customInstruction: '' }), []);

    const buildInitialSections = useCallback((): SectionsState => {
        const parsed = parseResumeSections(resumeText);
        return {
            summary: makeSectionState(parsed.summary),
            skills: makeSectionState(parsed.skills),
            experience: makeSectionState(parsed.experience),
            education: makeSectionState(parsed.education),
            projects: makeSectionState(parsed.projects),
            other: makeSectionState(parsed.other),
        };
    }, [resumeText, makeSectionState]);

    const [sectionStates, setSectionStates] = useState<SectionsState>(() => {
        const empty = (s: string): SectionState => ({ original: s, tailored: '', status: 'idle', accepted: false, preferences: ['quantify', 'keywords'], customInstruction: '' });
        return {
            summary: empty(''), skills: empty(''), experience: empty(''),
            education: empty(''), projects: empty(''), other: empty(''),
        };
    });

    // JD analysis state — fetched once when user opens Section Builder
    const [jdAnalysis, setJdAnalysis] = useState<{
        targetTitle: string; seniority: string; requiredSkills: string[];
        preferredSkills: string[]; keyVerbs: string[]; companyDomain: string; keyPhrases: string[];
    } | null>(null);
    const [isAnalyzingJD, setIsAnalyzingJD] = useState(false);

            // Workflow step status

    const hasResume = !!resumeText;
    const hasResult = !!tailoredResume;
    const estimatedModelInputTokens = Math.ceil((resumeText.length + jobDescription.length) / 4) + 900;

    // Input validation — prevent tailoring with obviously insufficient data
    const inputTooShort = resumeText.length < 200 || jobDescription.length < 100;
    const canTailor = !loading && !!resumeText && !!jobDescription && !inputTooShort;

    // Certifications State
    const [, setProfileCertifications] = useState<Record<string, unknown>[]>([]);
    const [selectedCertifications] = useState<Record<string, unknown>[]>(
        app.selectedCertifications ? JSON.parse(app.selectedCertifications) : []
    );

    const currentSaveSnapshot = useMemo(() => createSaveSnapshot({
        jobDescription,
        jobDetails,
        resumeText,
        tailoredResume,
        coverLetter,
        selectedCertifications,
    }), [jobDescription, jobDetails, resumeText, tailoredResume, coverLetter, selectedCertifications]);
    const savedSnapshotRef = useRef(currentSaveSnapshot);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const hasUnsavedChanges = currentSaveSnapshot !== savedSnapshotRef.current;
    const saveStatusLabel = isSaving
        ? 'Saving...'
        : hasUnsavedChanges
            ? 'Unsaved changes'
            : formatSaveTime(lastSavedAt);
    const jobReady = jobDescription.trim().length >= 100 || !!jobDetails;
    const resumeReady = resumeText.trim().length >= 200;
    const tailoredReady = !!tailoredResume;
    const selectedSignalCount = selectedJobDetails.skills.length + selectedJobDetails.requirements.length + selectedJobDetails.experience.length;
    const tailorButtonLabel = loading && tailorPhase === 'extracting' ? 'Extracting details'
        : loading && tailorPhase === 'tailoring' ? 'Tailoring resume'
            : loading && tailorPhase === 'verifying' ? 'Verifying output'
                : loading && tailorPhase === 'gap_check' ? 'Optimizing gaps'
                    : loading && tailorPhase === 'analyzing' ? 'Analyzing match'
                        : 'Tailor resume';
    const hasInsights = ((changes.length > 0) || keywordCoverage) && tailoredResume;


    // Sync Profile Sections State
    const [selectedSyncSections, setSelectedSyncSections] = useState({
        basics: true,
        experience: true,
        education: true,
        skills: true,
        projects: true,
        certifications: true
    });
    const [isSyncPopoverOpen, setIsSyncPopoverOpen] = useState(false);

    useEffect(() => {
        // Load master profile certifications
        getProfile().then(p => {
            if (p && p.certifications) {
                try {
                    const certs = JSON.parse(p.certifications);
                    setProfileCertifications(certs);
                } catch (e) {
                    console.error("Failed to parse certifications:", e);
                    setProfileCertifications([]);
                }
                // If no selection made yet, select all by default? Or leave empty? 
                // Let's leave empty or respect DB.
            }
        });
    }, []);




    // Wrap scrapeJob in useCallback so it can be safely used in useEffect deps
    const scrapeJob = useCallback(async () => {
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

            // Handle auth-wall / bot-detection
            if (data.scrapeBlocked) {
                toast.warning('⚠️ Job page requires login or is blocking scraping. Please paste the job description manually.', { duration: 6000 });
                setIsScraping(false);
                return;
            }

            if (data.description) {
                setJobDescription(data.description);
                let newTitle = app.jobTitle;
                let newCompany = app.companyName;
                if (data.details) {
                    setJobDetails(data.details);
                    if (data.details.title) newTitle = data.details.title;
                    if (data.details.company) newCompany = data.details.company;
                }
                setApp((prev: Application) => ({ ...prev, jobTitle: newTitle, companyName: newCompany }));
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
    }, [app.jobUrl, app.id, app.jobTitle, app.companyName, jobDescription, selectedProvider, selectedModel, customModelConfig]);

    useEffect(() => {
        if (!app.jobDescription && app.jobUrl && !jobDescription) {
            scrapeJob();
        }
    }, [app.jobDescription, app.jobUrl, jobDescription, scrapeJob]);

    useEffect(() => {
        if (app.jobTitle && app.companyName) {
            document.title = `${app.jobTitle} at ${app.companyName}`;
        } else if (app.jobTitle) {
            document.title = `${app.jobTitle}`;
        }
    }, [app.jobTitle, app.companyName]);

    // ─── Handlers (all business logic unchanged) ───



    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateApplication(app.id, {
                jobDescription,
                jobDetails: jobDetails ? JSON.stringify(jobDetails) : undefined,
                baseResume: resumeText,
                tailoredResume,
                coverLetter: coverLetter || undefined,
                selectedCertifications: JSON.stringify(selectedCertifications),
            });
            savedSnapshotRef.current = currentSaveSnapshot;
            setLastSavedAt(new Date());
            setApp((prev: Application) => ({
                ...prev,
                jobDescription,
                jobDetails: jobDetails ? JSON.stringify(jobDetails) : null,
                baseResume: resumeText,
                tailoredResume,
                coverLetter,
                selectedCertifications: JSON.stringify(selectedCertifications),
            }));
            toast.success('Application saved.');
            return true;
        } catch (err) {
            console.error('Save failed', err);
            toast.error('Save failed. Please try again.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };



    const getSelectedSkillBuckets = () => {
        const selectedSkillSet = new Set(selectedJobDetails.skills);
        return {
            required: selectedJobDetails.requiredSkills.filter(skill => selectedSkillSet.has(skill)),
            preferred: selectedJobDetails.preferredSkills.filter(skill => selectedSkillSet.has(skill)),
        };
    };

    const handleGenerateCoverLetter = async () => {
        setCoverLetterLoading(true);
        setError(null);
        setOutputTab('coverLetter');
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
            const apiKey = localStorage.getItem('gemini_api_key');
            let finalJobDescription = jobDescription;
            if (jobDetails && !selectedJobDetails.useFullDescription) {
                const selectedSkills = getSelectedSkillBuckets();
                const parts = [];
                parts.push(`Job Title: ${jobDetails.title || app.jobTitle}`);
                parts.push(`Company: ${jobDetails.company || app.companyName}`);
                if (selectedJobDetails.requirements.length > 0) {
                    parts.push(`\nRequirements:\n${selectedJobDetails.requirements.map(r => `- ${r}`).join('\n')}`);
                }
                if (selectedSkills.required.length > 0) {
                    parts.push(`\nRequired Skills:\n${selectedSkills.required.map(s => `- ${s}`).join('\n')}`);
                }
                if (selectedSkills.preferred.length > 0) {
                    parts.push(`\nPreferred Skills:\n${selectedSkills.preferred.map(s => `- ${s}`).join('\n')}`);
                }
                parts.push(`\nDescription:\n${jobDetails.description || jobDescription}`);
                finalJobDescription = parts.join('\n');
            }

            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds max

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
                signal: controller.signal,
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
        } catch (err: any) {
            console.error('Cover letter generation failed', err);
            let errorMessage = err instanceof Error ? err.message : 'Failed to generate cover letter.';
            if (err?.name === 'AbortError') {
                errorMessage = '⚠️ The AI is taking too long to respond. The model might be overloaded. Please try again or switch to a faster model.';
            } else if (errorMessage.toLowerCase().includes('timeout')) {
                errorMessage = '⚠️ The AI timed out: ' + errorMessage;
            }
            if (selectedProvider === 'gemini') {
                reportGeminiIssue(errorMessage, selectedModel);
            }
            setError(errorMessage);
        } finally {
            clearTimeout(timeoutId);
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
        if (resumeText && !confirm("This will overwrite your current Base Resume with the selected sections from your Master Profile. Are you sure?")) {
            return;
        }
        setIsSyncPopoverOpen(false);
        setLoading(true);
        try {
            const profile = await getProfile();
            if (!profile) {
                alert("No Master Profile found. Please configure it in the Profile section.");
                setLoading(false);
                return;
            }
            const parts = [];

            if (selectedSyncSections.basics) {
                if (profile.name) parts.push(`# ${profile.name}`);
                const contact = [profile.email, profile.phone, profile.linkedin, profile.website].filter(Boolean).join(' | ');
                if (contact) parts.push(`${contact}\n`);
                if (profile.summary) {
                    parts.push(`## Professional Summary\n${profile.summary}\n`);
                }
            }

            if (selectedSyncSections.experience) {
                const exp = profile.experience ? JSON.parse(profile.experience) : [];
                if (exp.length > 0) {
                    parts.push('## Experience');
                    exp.forEach((e: any) => {
                        parts.push(`### ${e.role} | ${e.company}`);
                        parts.push(`*${e.dates}*`);
                        if (e.description) parts.push(e.description);

                        // Render client-specific sections if they exist
                        const clients = e.clients || [];
                        if (clients.length > 0) {
                            clients.forEach((c: any) => {
                                let clientHeader = '';
                                if (c.name) clientHeader += c.name;
                                if (c.domain) clientHeader += (clientHeader ? ` - ${c.domain}` : c.domain);
                                if (clientHeader) parts.push(`\n**Client:** ${clientHeader}`);
                                if (c.description) parts.push(c.description);
                            });
                        }

                        parts.push('');
                    });
                }
            }

            if (selectedSyncSections.education) {
                const edu = profile.education ? JSON.parse(profile.education) : [];
                if (edu.length > 0) {
                    parts.push('## Education');
                    edu.forEach((e: any) => {
                        parts.push(`### ${e.degree}`);
                        parts.push(`${e.institution} | ${e.dates}`);
                        parts.push('');
                    });
                }
            }

            if (selectedSyncSections.skills) {
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
            }

            if (selectedSyncSections.projects) {
                const projects = profile.projects ? JSON.parse(profile.projects) : [];
                if (projects.length > 0) {
                    parts.push('## Projects');
                    projects.forEach((p: any) => {
                        let projectLine = `### ${p.name}`;
                        if (p.link) projectLine += ` | [Link](${p.link})`;
                        parts.push(projectLine);
                        if (p.description) {
                            const descLines = p.description.split('\n').filter((l: string) => l.trim().length > 0);
                            descLines.forEach((line: string) => {
                                parts.push(line.trim().startsWith('*') || line.trim().startsWith('-') ? line : `* ${line}`);
                            });
                        }
                        parts.push('');
                    });
                }
            }

            if (selectedSyncSections.certifications) {
                const certs = profile.certifications ? JSON.parse(profile.certifications) : [];
                if (certs.length > 0) {
                    parts.push('## Certifications');
                    certs.forEach((c: any) => {
                        let certLine = `### ${c.name}`;
                        if (c.issuer) certLine += ` | ${c.issuer}`;
                        parts.push(certLine);

                        const details = [];
                        if (c.date) details.push(c.date);
                        if (c.url) details.push(`[Link](${c.url})`);
                        if (details.length > 0) parts.push(`* ${details.join(' | ')}`);

                        parts.push('');
                    });
                }
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
        setTailorPhase('extracting');
        setKeywordCoverage(null);
        setPreFixCoverage(null);
        setGapFixResults(null);
        setSseIncomplete(false);
        


        toast.info('🚀 Tailoring started...', { id: 'tailor-status' });

        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
            const apiKey = localStorage.getItem('gemini_api_key');
            let finalJobDescription = jobDescription;
            if (jobDetails && !selectedJobDetails.useFullDescription) {
                const selectedSkills = getSelectedSkillBuckets();
                const parts = [];
                parts.push(`Job Title: ${jobDetails.title || app.jobTitle}`);
                parts.push(`Company: ${jobDetails.company || app.companyName}`);
                if (selectedJobDetails.requirements.length > 0) {
                    parts.push(`\nSelected Requirements: \n${selectedJobDetails.requirements.map(r => `- ${r}`).join('\n')}`);
                }
                if (selectedSkills.required.length > 0) {
                    parts.push(`\nRequired Skills (must target): \n${selectedSkills.required.map(s => `- ${s}`).join('\n')}`);
                }
                if (selectedSkills.preferred.length > 0) {
                    parts.push(`\nPreferred Skills (nice to have): \n${selectedSkills.preferred.map(s => `- ${s}`).join('\n')}`);
                }
                if (selectedJobDetails.experience.length > 0) {
                    parts.push(`\nSelected Experience: \n${selectedJobDetails.experience.map(e => `- ${e}`).join('\n')}`);
                }
                parts.push(`\nAdditional Context(Cleaned Description): \n${jobDetails.description || jobDescription}`);
                finalJobDescription = parts.join('\n');
            }

            const startTime = performance.now();

            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 120000); // 120s overall max for SSE stream

            const res = await fetch('/api/tailor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resume: resumeText,
                    jobDescription: finalJobDescription,
                    apiKey,
                    modelProvider: selectedProvider,
                    modelName: selectedModel,
                    customConfig: customModelConfig,
                    applicationId: app.id,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Server Error: ${res.status}`);
            }

            if (!res.body) throw new Error('No response body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedData = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                accumulatedData += chunk;

                // Process complete SSE messages
                const lines = accumulatedData.split('\n\n');
                accumulatedData = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6));

                            if (event.phase === 'extracting') {
                                setTailorPhase('extracting');
                                toast.info('🔍 Extracting keywords...', { id: 'tailor-status' });
                            } else if (event.phase === 'tailoring') {
                                setTailorPhase('tailoring');
                                toast.info('✍️ Tailoring resume...', { id: 'tailor-status' });
                            } else if (event.phase === 'verifying') {
                                setTailorPhase('verifying');
                                toast.info('✨ Verifying tailored content...', { id: 'tailor-status' });
                            } else if (event.phase === 'gap_check') {
                                setTailorPhase('gap_check');
                                toast.info('🔧 Optimizing keyword coverage...', { id: 'tailor-status' });
                                if (event.data?.preFixCoverage) {
                                    // Store pre-fix separately so post-fix can be compared
                                    setPreFixCoverage(event.data.preFixCoverage);
                                    setKeywordCoverage(event.data.preFixCoverage);
                                }
                            } else if (event.phase === 'gap_fix_result') {
                                if (event.data) {
                                    setGapFixResults({ injected: event.data.injected || [], skipped: event.data.skipped || [] });
                                }
                            } else if (event.phase === 'tailored') {
                                setTailoredResume(event.data.tailoredResume);
                                if (event.data.keywordCoverage) {
                                    setKeywordCoverage(event.data.keywordCoverage);
                                }
                            } else if (event.phase === 'analyzing') {
                                setTailorPhase('analyzing');
                                toast.info('📊 Running ATS analysis...', { id: 'tailor-status' });
                            } else if (event.phase === 'complete') {
                                setTailorPhase('complete');
                                setSseIncomplete(false);
                                if (event.data.atsScore) setAtsScore(event.data.atsScore);
                                if (event.data.changes) setChanges(event.data.changes);

                                const endTime = performance.now();
                                const duration = Math.round(endTime - startTime);
                                setExecutionTime(duration);

                                toast.success('🎉 Resume tailored successfully!', { id: 'tailor-status' });

                                await updateApplication(app.id, {
                                    analysis: JSON.stringify({
                                        changes: event.data.changes || [],
                                        atsScore: event.data.atsScore || null,
                                        executionTime: duration
                                    })
                                });
                            } else if (event.phase === 'error') {
                                throw new Error(event.error);
                            }
                        } catch (e) {
                            if (e instanceof Error && e.message !== 'undefined') {
                                console.error('Error parsing SSE event:', e);
                            }
                        }
                    }
                }
            }

        } catch (err: any) {
            console.error('Tailoring failed', err);
            
            let errorMessage = err instanceof Error ? err.message : 'Failed to tailor resume.';
            if (err?.name === 'AbortError') {
                errorMessage = '⚠️ The AI is taking too long to respond. The model might be overloaded. Please try again or switch to a faster model.';
            } else if (errorMessage.toLowerCase().includes('timeout')) {
                errorMessage = '⚠️ ' + errorMessage;
            }
            
            if (selectedProvider === 'gemini') {
                reportGeminiIssue(errorMessage, selectedModel);
            }
            setError(errorMessage);
            toast.error('❌ Tailoring failed. See error banner for details.', { id: 'tailor-status', duration: 8000 });
        } finally {
            clearTimeout(timeoutId);
            setLoading(prevLoading => {
                // If we finished loading but never reached 'complete' phase, the stream was cut
                setTailorPhase(prev => {
                    if (prev !== null && prev !== 'complete') {
                        setSseIncomplete(true);
                        toast.warning('⚠️ Tailoring may be incomplete — some phases did not finish.', { id: 'tailor-status', duration: 8000 });
                    }
                    return null;
                });
                return false;
            });
        }
    };

    const handleDownloadPDF = async () => {
        if (!tailoredResume) {
            setError('No tailored resume to export. Please tailor the resume first.');
            return;
        }

        setPdfGenerating(true);
        try {
            if (hasUnsavedChanges) {
                const saved = await handleSave();
                if (!saved) return;
            }
            const { exportResumePDF } = await import('@/lib/pdf-export');
            const fileName = ['Resume', app.companyName, app.jobTitle].filter(Boolean).join(' - ');
            await exportResumePDF(tailoredResume, { fileName });
        } catch (err) {
            console.error('PDF export failed:', err);
            setError('PDF export failed. Please try again.');
        } finally {
            setPdfGenerating(false);
        }
    };

    // ─── Section-wise handlers ────────────────────────────────────────────────

    /**
     * Generate a single section using /api/tailor-section.
     * ALWAYS sends the full original resume + full JD as context to prevent hallucinations.
     * Only the OUTPUT is scoped to the requested section.
     */
    const handleGenerateSection = useCallback(async (sectionName: SectionName) => {
        if (!resumeText || !jobDescription) {
            toast.error('Add a resume and job description first.');
            return;
        }

        setSectionStates(prev => ({
            ...prev,
            [sectionName]: { ...prev[sectionName], status: 'generating', error: undefined },
        }));

        try {
            const apiKey = localStorage.getItem('gemini_api_key');
            const res = await fetch('/api/tailor-section', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sectionName,
                    resume: resumeText,       // FULL resume — anti-hallucination context
                    jobDescription,           // FULL job description
                    jdAnalysis,               // pre-analyzed JD intel (null if not yet ready)
                    apiKey,
                    modelProvider: selectedProvider,
                    modelName: selectedModel,
                    customConfig: customModelConfig,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Server Error: ${res.status}`);
            }
            if (!res.body) throw new Error('No response body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                accumulated += decoder.decode(value, { stream: true });
                const lines = accumulated.split('\n\n');
                accumulated = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.phase === 'complete' && event.data?.candidates?.length) {
                            const candidates = event.data.candidates;
                            // candidates are already sorted by score (highest first)
                            const winner = candidates[0];
                            setSectionStates(prev => ({
                                ...prev,
                                [sectionName]: {
                                    ...prev[sectionName],
                                    variants: candidates,
                                    selectedVariantIndex: 0,
                                    tailored: winner.text,
                                    status: 'done',
                                    accepted: false,
                                },
                            }));
                            toast.success(`${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)}: ${candidates.length} variants — best scored ${winner.score}%`, { duration: 3000 });
                        } else if (event.phase === 'error') {
                            throw new Error(event.error);
                        }
                    } catch { /* skip malformed events */ }
                }
            }
        } catch (err: any) {
            console.error(`[SectionBuilder] Failed to generate ${sectionName}:`, err);
            setSectionStates(prev => ({
                ...prev,
                [sectionName]: {
                    ...prev[sectionName],
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Generation failed',
                },
            }));
            if (selectedProvider === 'gemini') {
                const errorMessage = err instanceof Error ? err.message : 'Section generation failed';
                reportGeminiIssue(errorMessage, selectedModel);
            }
            toast.error(`Failed to generate ${sectionName}. Please try again.`);
        }
    }, [resumeText, jobDescription, selectedProvider, selectedModel, customModelConfig, reportGeminiIssue]);

    /** Generate all sections sequentially so the user sees each card populate */
    const handleGenerateAllSections = useCallback(async () => {
        if (!resumeText || !jobDescription) {
            toast.error('Add a resume and job description first.');
            return;
        }
        toast.info('🚀 Generating all sections (3 variants each)...', { id: 'section-gen' });
        for (const name of SECTION_ORDER) {
            await handleGenerateSection(name as SectionName);
        }
        toast.success('✅ All sections generated! Review and accept the best variants.', { id: 'section-gen' });
    }, [handleGenerateSection, resumeText, jobDescription]);

    const handleAcceptSection = useCallback((name: SectionName) => {
        setSectionStates(prev => ({
            ...prev,
            [name]: { ...prev[name], accepted: !prev[name].accepted },
        }));
    }, []);

    const handleResetSection = useCallback((name: SectionName) => {
        setSectionStates(prev => ({
            ...prev,
            [name]: {
                ...prev[name],
                tailored: '',
                status: 'idle', accepted: false, error: undefined,
            },
        }));
    }, []);

    const handleSectionTailoredChange = useCallback((name: SectionName, value: string) => {
        setSectionStates(prev => ({ ...prev, [name]: { ...prev[name], tailored: value } }));
    }, []);

    const handleSetPreferences = useCallback((name: SectionName, prefs: any[]) => {
        setSectionStates(prev => ({ ...prev, [name]: { ...prev[name], preferences: prefs } }));
    }, []);

    const handleSetCustomInstruction = useCallback((name: SectionName, text: string) => {
        setSectionStates(prev => ({ ...prev, [name]: { ...prev[name], customInstruction: text } }));
    }, []);

    /**
     * Assemble all accepted (or any generated) sections into a single markdown resume string.
     * Uses the tailored content where accepted/generated, falls back to original for ungenerated sections.
     */
    const handleAssembleResume = useCallback(() => {
        const s = sectionStates;
        const get = (name: SectionName) =>
            (s[name].accepted && s[name].tailored) ? s[name].tailored : s[name].original;

        const header = (() => {
            const parsed = parseResumeSections(resumeText);
            return parsed.header || '';
        })();

        const parts: string[] = [];
        if (header) parts.push(header);
        const summary = get('summary');
        if (summary) parts.push(`## Summary\n${summary}`);
        const experience = get('experience');
        if (experience) parts.push(`## Experience\n${experience}`);
        const skills = get('skills');
        if (skills) parts.push(`## Skills\n${skills}`);
        const education = get('education');
        if (education) parts.push(`## Education\n${education}`);
        const projects = get('projects');
        if (projects) parts.push(`## Projects\n${projects}`);
        const other = get('other');
        if (other) parts.push(`## Certifications\n${other}`);

        const assembled = parts.join('\n\n');
        setTailoredResume(assembled);
        setOutputTab('resume');
        setResultViewMode('preview');
        toast.success('🎉 Resume assembled! Switching to preview.');

        // Persist assembled resume
        updateApplication(app.id, { tailoredResume: assembled }).catch(console.error);
    }, [sectionStates, resumeText, app.id]);

                    // Re-initialize section originals when user switches to Section Builder tab
    const handleSwitchToSections = useCallback(() => {
        const parsed = parseResumeSections(resumeText);
        setSectionStates(prev => {
            const updated = { ...prev };
            (Object.keys(updated) as SectionName[]).forEach(name => {
                if (updated[name].status === 'idle' && !updated[name].tailored) {
                    updated[name] = { ...updated[name], original: parsed[name] || '' };
                }
            });
            return updated;
        });
        setOutputTab('sections');

        // Fire JD analysis if not done yet (adds ~2s upfront, improves all 6 sections)
        if (!jdAnalysis && !isAnalyzingJD && jobDescription) {
            setIsAnalyzingJD(true);
            fetch('/api/analyze-jd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobDescription,
                    apiKey: selectedProvider === 'gemini' ? undefined : undefined,
                    modelProvider: selectedProvider,
                    modelName: selectedModel || undefined,
                }),
            })
                .then(r => r.json())
                .then(data => { if (!data.error) setJdAnalysis(data); })
                .catch(err => console.warn('[analyze-jd]', err))
                .finally(() => setIsAnalyzingJD(false));
        }
    }, [resumeText, jdAnalysis, isAnalyzingJD, jobDescription, selectedProvider, selectedModel]);

    const isAnySectionGenerating = SECTION_ORDER.some(
        n => sectionStates[n as SectionName].status === 'generating'
    );
    const canAssembleSections = SECTION_ORDER.some(
        n => sectionStates[n as SectionName].accepted
    );

    // ─── RENDER ───


    return (
        <div className="flex h-[calc(100dvh-2rem)] flex-col gap-3 pb-[5.25rem] animate-in fade-in duration-500 lg:h-[calc(100vh-4rem)] lg:gap-4 lg:pb-0">

            <header className={cn(
                "shrink-0 overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm print:hidden lg:rounded-2xl",
                mobileTab === 'result' && "hidden lg:block"
            )}>
                <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-5 lg:py-4">
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:items-start">
                        <button
                            type="button"
                            onClick={() => setIsMobileNavOpen(true)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950 lg:hidden"
                            aria-label="Open workspace menu"
                        >
                            <Menu className="h-4 w-4" />
                        </button>
                        <Link
                            href="/"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:mt-1 lg:h-9 lg:w-9"
                            title="Back to dashboard"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Link>

                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                                <h1 className="min-w-0 truncate text-base font-semibold text-slate-950 sm:text-xl">
                                    {app.jobTitle || 'New Application'}
                                </h1>
                                <span className={cn(
                                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold sm:px-2.5 sm:text-[11px]",
                                    hasResult ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                                        hasResume ? "border-amber-200 bg-amber-50 text-amber-700" :
                                            "border-slate-200 bg-slate-100 text-slate-600"
                                )}>
                                    {hasResult ? <CheckCircle2 className="h-3.5 w-3.5" /> : hasResume ? <FileText className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">{hasResult ? 'Tailored' : hasResume ? 'In progress' : 'Draft'}</span>
                                </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                <span className="max-w-[55vw] truncate sm:max-w-none">{app.companyName || 'Company not set'}</span>
                                {app.jobUrl ? <span className="hidden max-w-[360px] truncate sm:inline">{app.jobUrl}</span> : null}
                                <span className={cn("inline-flex items-center gap-1", hasUnsavedChanges ? "text-amber-700" : "text-emerald-700")}>
                                    {hasUnsavedChanges ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    {saveStatusLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
                        <div className="hidden md:block">
                            <ModelSelector estimatedInputTokens={estimatedModelInputTokens} />
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || loading || !hasUnsavedChanges}
                            className={cn(
                                "inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:h-10",
                                hasUnsavedChanges
                                    ? "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            )}
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : hasUnsavedChanges ? <Save className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                            <span className="hidden sm:inline">{hasUnsavedChanges ? 'Save changes' : 'Saved'}</span>
                        </button>
                        <button
                            onClick={handleTailor}
                            disabled={!canTailor}
                            title={inputTooShort ? 'Resume must be at least 200 characters and job description at least 100 characters' : undefined}
                            className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:min-w-[150px]"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                            <span className="hidden sm:inline">{tailorButtonLabel}</span>
                            <span className="sm:hidden">{loading ? 'Working' : 'Tailor'}</span>
                        </button>
                    </div>
                </div>


            </header>

            {/* ━━━ Premium Glass Header ━━━ */}
            <div className="hidden">
                {/* Subtle gradient glow inside header */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent pointer-events-none" />

                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 relative z-10">
                    <Link
                        href="/"
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-white/50 hover:bg-white text-slate-500 hover:text-indigo-600 transition-all shadow-sm border border-slate-200/50 shrink-0"
                        title="Back to Dashboard"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Link>

                    <div className="h-6 w-px bg-slate-200/60 shrink-0 hidden sm:block" />

                    <div className="min-w-0 flex items-center gap-3 flex-1">
                        <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight truncate drop-shadow-sm">
                            {app.jobTitle || 'New Application'}
                        </h1>
                        {/* Status Badge */}
                        <span className={cn(
                            "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md border",
                            hasResult ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" :
                                hasResume ? "bg-amber-500/10 text-amber-700 border-amber-500/20" :
                                    "bg-slate-500/10 text-slate-600 border-slate-500/20"
                        )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full shadow-sm", hasResult ? "bg-emerald-500" : hasResume ? "bg-amber-500" : "bg-slate-400")} />
                            <span className="hidden sm:inline">{hasResult ? 'Tailored' : hasResume ? 'In Progress' : 'Draft'}</span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0 relative z-10">
                    <div className="hidden sm:block">
                        <ModelSelector estimatedInputTokens={estimatedModelInputTokens} />
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || loading}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white/60 backdrop-blur-md px-4 py-2 text-xs font-bold text-slate-700 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> : <Save className="h-4 w-4 text-slate-500" />}
                        <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                        onClick={handleTailor}
                        disabled={!canTailor}
                        title={inputTooShort ? 'Resume must be at least 200 characters and job description at least 100 characters' : undefined}
                        className="relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-slate-900/20 hover:shadow-xl hover:from-slate-700 hover:to-slate-800 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed transition-all min-w-[140px] justify-center overflow-hidden group"
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
                        
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-indigo-300 relative z-10" />}
                        <span className="relative z-10 hidden sm:inline">
                            {loading && tailorPhase === 'extracting' ? 'Extracting...' :
                                loading && tailorPhase === 'tailoring' ? 'Tailoring...' :
                                    loading && tailorPhase === 'verifying' ? 'Verifying...' :
                                        loading && tailorPhase === 'gap_check' ? 'Optimizing...' :
                                            loading && tailorPhase === 'analyzing' ? 'Analyzing...' :
                                                'Tailor Resume'}
                        </span>
                        <span className="relative z-10 sm:hidden">
                            {loading ? 'Working...' : 'Tailor'}
                        </span>
                    </button>
                </div>
            </div>

            {/* ━━━ Mobile Bottom Tab Bar ━━━ */}
            <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 ring-1 ring-slate-900/5 backdrop-blur-lg print:hidden lg:hidden">
                <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
                    {([
                        { id: 'job', label: 'Job', icon: Briefcase, ready: jobReady },
                        { id: 'resume', label: 'Resume', icon: FileText, ready: resumeReady },
                        { id: 'result', label: 'Review', icon: FileCheck2, ready: tailoredReady },
                    ] as const).map(tab => {
                        const isActive = mobileTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setMobileTab(tab.id);
                                    if (tab.id !== 'result') setActiveTab(tab.id as 'job' | 'resume');
                                }}
                                className={cn(
                                    "relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors",
                                    isActive
                                        ? "bg-slate-950 text-white shadow-sm"
                                        : "bg-slate-100 text-slate-500 active:bg-slate-200"
                                )}
                            >
                                {tab.ready && (
                                    <span className={cn(
                                        "absolute right-3 top-2 h-1.5 w-1.5 rounded-full",
                                        isActive ? "bg-emerald-300" : "bg-emerald-500"
                                    )} />
                                )}
                                <tab.icon className="h-5 w-5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>



            {/* ━━━ Error Banner ━━━ */}
            {error && (
                <div className="animate-fade-in-up flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 print:hidden" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                    <p className="min-w-0 flex-1 truncate text-xs"><span className="font-semibold">Action needed:</span> {error}</p>
                    <button onClick={() => setError(null)} className="shrink-0 rounded p-1 transition-colors hover:bg-red-100">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

                        {/* ━━━ SSE Incomplete Warning ━━━ */}
            {sseIncomplete && (
                <div className="animate-fade-in-up flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                    <p className="min-w-0 flex-1 text-xs">
                        <span className="font-semibold">Tailoring may be incomplete.</span> The process was interrupted. Try tailoring again if anything looks off.
                    </p>
                    <button onClick={() => setSseIncomplete(false)} className="shrink-0 rounded p-1 transition-colors hover:bg-amber-100">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* ━━━ Main Workspace ━━━ */}
            <div className="relative flex min-h-0 flex-1 flex-col gap-3 transition-all duration-300 ease-in-out lg:flex-row lg:gap-4">

                {/* ── Left Panel (Pane 1): Input (JD & Resume) ── */}
                <div
                    className={cn(
                        "transition-all duration-300 ease-in-out shrink-0 flex flex-col gap-3 lg:h-full",
                        // Mobile: Full width with explicit height, visible only if tab is job or resume
                        mobileTab === 'result' ? "hidden lg:flex" : "flex h-full w-full min-h-0",
                        // Desktop: Controlled by isLeftPanelOpen
                        isLeftPanelOpen ? "lg:w-[360px] xl:w-[420px] opacity-100" : "lg:w-0 lg:opacity-0 lg:p-0 lg:overflow-hidden"
                    )}
                >
                    {/* Segmented Control (Desktop Only) */}
                    <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm print:hidden lg:flex">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-950">Input workspace</p>
                            <p className="text-xs text-slate-500">Review the job and resume before generating.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                            <button
                                onClick={() => setActiveTab('job')}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200",
                                    activeTab === 'job' 
                                        ? "bg-white text-slate-950 shadow-sm" 
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <Briefcase className="h-3.5 w-3.5" />
                                Job
                            </button>
                            <button
                                onClick={() => setActiveTab('resume')}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all duration-200",
                                    activeTab === 'resume' 
                                        ? "bg-white text-slate-950 shadow-sm" 
                                        : "text-slate-500 hover:text-slate-700"
                                )}
                            >
                                <FileText className="h-3.5 w-3.5" />
                                Resume
                            </button>
                        </div>
                        <button
                            onClick={() => setIsLeftPanelOpen(false)}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                            title="Collapse panel"
                        >
                            <PanelLeftClose className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Panel Content - Made it a glass card that fills remaining height */}
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:rounded-2xl">

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
                                <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-500">Step 1</p>
                                        <h3 className="text-sm font-semibold text-slate-950">
                                            {viewMode === 'raw' ? 'Raw Text' : 'Job Analysis'}
                                        </h3>
                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                            {jobDetails ? 'Select relevant features for tailoring' : 'Paste or scrape the job description'}
                                        </p>
                                    </div>
                                    <div className="scrollbar-hide flex w-full shrink-0 items-center gap-2 overflow-x-auto sm:w-auto">
                                        {!jobDetails && jobDescription && (
                                            <button
                                                onClick={scrapeJob}
                                                disabled={isScraping}
                                                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                                            >
                                                {isScraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                                                Analyze
                                            </button>
                                        )}
                                        <button
                                            onClick={scrapeJob}
                                            disabled={isScraping}
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                                            title="Re-analyze"
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${isScraping ? 'animate-spin' : ''}`} />
                                        </button>

                                        {jobDetails && (
                                            <div className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
                                                <button
                                                    onClick={() => setViewMode('analysis')}
                                                    className={cn(
                                                        "rounded-md px-2 py-1 text-[11px] font-semibold transition-all",
                                                        viewMode === 'analysis' 
                                                            ? "bg-white text-slate-950 shadow-sm" 
                                                            : "text-slate-500 hover:text-slate-700"
                                                    )}
                                                >
                                                    Analysis
                                                </button>
                                                <button
                                                    onClick={() => setViewMode('raw')}
                                                    className={cn(
                                                        "rounded-md px-2 py-1 text-[11px] font-semibold transition-all",
                                                        viewMode === 'raw' 
                                                            ? "bg-white text-slate-950 shadow-sm" 
                                                            : "text-slate-500 hover:text-slate-700"
                                                    )}
                                                >
                                                    Raw
                                                </button>
                                            </div>
                                        )}

                                        {jobDetails && viewMode === 'analysis' && (
                                            <button
                                                onClick={() => setSelectedJobDetails(prev => ({ ...prev, useFullDescription: !prev.useFullDescription }))}
                                                className={cn(
                                                    "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-all",
                                                    selectedJobDetails.useFullDescription
                                                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                                                )}
                                            >
                                                {selectedJobDetails.useFullDescription ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                                                Full Description
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
                                    {jobDetails && viewMode === 'analysis' ? (
                                                <div className="custom-scrollbar flex-1 space-y-5 overflow-auto p-3 pb-6 sm:p-4 lg:pb-4">
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
                                                    {/* Required Skills */}
                                                    {selectedJobDetails.requiredSkills.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2.5">
                                                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Required Skills</h4>
                                                                <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                                    {selectedJobDetails.requiredSkills.length}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {selectedJobDetails.requiredSkills.map((skill, i) => {
                                                                    const isSelected = selectedJobDetails.skills.includes(skill);
                                                                    return (
                                                                        <button
                                                                            key={`req-${i}`}
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

                                                    {/* Preferred Skills */}
                                                    {selectedJobDetails.preferredSkills.length > 0 && (
                                                        <div>
                                                            <div className="flex items-center justify-between mb-2.5">
                                                                <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Preferred Skills</h4>
                                                                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                                    {selectedJobDetails.preferredSkills.length}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {selectedJobDetails.preferredSkills.map((skill, i) => {
                                                                    const isSelected = selectedJobDetails.skills.includes(skill);
                                                                    return (
                                                                        <button
                                                                            key={`pref-${i}`}
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

                                                    {/* Fallback: legacy flat skills */}
                                                    {selectedJobDetails.requiredSkills.length === 0 && selectedJobDetails.preferredSkills.length === 0 && jobDetails.skills && jobDetails.skills.length > 0 && (
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
                                                                            className={`group flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-all duration-200 ${isSelected
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
                                                                    <span className={`min-w-0 break-words text-[13px] leading-relaxed ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>
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
                                                                            <span className={`min-w-0 break-words text-[13px] leading-relaxed ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>
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
                                            {(selectedJobDetails.useFullDescription || (!jobDetails.skills?.length && !(jobDetails as any).requiredSkills?.length && !jobDetails.requirements?.length)) && (
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
                                            className="h-full w-full resize-none overflow-y-auto bg-white p-4 font-mono text-base text-slate-800 outline-none placeholder:text-slate-300 sm:text-[13px]"
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
                                <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-500">Step 2</p>
                                        <h3 className="text-sm font-semibold text-slate-950">Resume source</h3>
                                        <p className="mt-0.5 text-[11px] text-slate-500">Paste, upload, or sync your master profile.</p>
                                    </div>
                                    <div className="scrollbar-hide flex w-full items-center gap-1 overflow-x-auto sm:w-auto">
                                        <Popover open={isSyncPopoverOpen} onOpenChange={setIsSyncPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <button
                                                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
                                                    title="Sync from Master Profile"
                                                >
                                                    <UserCheck className="h-3.5 w-3.5" />
                                                    Sync Profile
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64 p-3" align="end">
                                                <div className="space-y-3">
                                                    <div>
                                                        <h4 className="text-xs font-semibold text-slate-900">Select Sections to Sync</h4>
                                                        <p className="text-[10px] text-slate-500">Choose which parts of your Master Profile to copy over.</p>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {Object.entries({
                                                            basics: "Basics & Summary",
                                                            experience: "Experience",
                                                            education: "Education",
                                                            skills: "Skills",
                                                            projects: "Projects",
                                                            certifications: "Certifications"
                                                        }).map(([key, label]) => (
                                                            <label key={key} className="flex items-center gap-2 cursor-pointer group">
                                                                <button
                                                                    type="button"
                                                                    className={`flex h-4 w-4 items-center justify-center rounded border ${selectedSyncSections[key as keyof typeof selectedSyncSections] ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 group-hover:border-indigo-400'}`}
                                                                    onClick={() => setSelectedSyncSections(prev => ({ ...prev, [key]: !prev[key as keyof typeof selectedSyncSections] }))}
                                                                >
                                                                    {selectedSyncSections[key as keyof typeof selectedSyncSections] && <Check className="h-3 w-3" />}
                                                                </button>
                                                                <span className="text-xs font-medium text-slate-700 select-none group-hover:text-slate-900 transition-colors">
                                                                    {label}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <div className="pt-2 border-t border-slate-100">
                                                        <button
                                                            onClick={handleSyncProfile}
                                                            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold py-1.5 rounded-md transition-colors shadow-sm"
                                                        >
                                                            Confirm Sync
                                                        </button>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                        <div className="h-4 w-px bg-slate-200" />
                                        <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950">
                                            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                            Upload PDF
                                            <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                </div>

                                {/* Editor or Dropzone */}
                                {!resumeText ? (
                                    <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
                                        <label className="group flex w-full max-w-sm cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 p-6 transition-all hover:border-indigo-300 hover:bg-indigo-50/30 sm:p-8">
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
                                        className="custom-scrollbar w-full flex-1 resize-none overflow-y-auto bg-white p-4 font-mono text-base text-slate-800 outline-none placeholder:text-slate-300 sm:text-[13px] lg:min-h-0"
                                        placeholder="Paste your resume content here..."
                                        value={resumeText}
                                        onChange={(e) => setResumeText(e.target.value)}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Center Panel (Pane 2): Editor Workspace ── */}
                <div className={cn(
                    "relative h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ease-in-out lg:rounded-2xl",
                    mobileTab !== 'result' ? "hidden lg:flex" : "flex min-h-0"
                )}>
                    {/* ─ IDE Style Top Tabs ─ */}
                    <div className="shrink-0 border-b border-slate-200 bg-white px-2 py-2 sm:px-3 sm:py-3">
                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsMobileNavOpen(true)}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950 lg:hidden"
                                    aria-label="Open workspace menu"
                                >
                                    <Menu className="h-4 w-4" />
                                </button>
                                <div className="scrollbar-hide flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                                <button
                                    onClick={() => setOutputTab('resume')}
                                    className={cn(
                                        "flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-all sm:h-10",
                                        outputTab === 'resume'
                                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                                    )}
                                >
                                    <FileText className="h-4 w-4" /> Full Resume
                                </button>
                                <button
                                    onClick={handleSwitchToSections}
                                    className={cn(
                                        "flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-all sm:h-10",
                                        outputTab === 'sections'
                                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                                    )}
                                >
                                    <Layers className="h-4 w-4" /> Section Builder
                                </button>
                                <button
                                    onClick={() => setOutputTab('coverLetter')}
                                    className={cn(
                                        "flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-all sm:h-10",
                                        outputTab === 'coverLetter'
                                            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                                    )}
                                >
                                    <Mail className="h-4 w-4" /> Cover Letter
                                </button>
                                </div>
                            </div>

                            <div className="flex w-full flex-col gap-1.5 sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:overflow-x-auto">
                            {/* Panel Toggle if closed */}
                            {!isLeftPanelOpen && (
                                <button 
                                    onClick={() => setIsLeftPanelOpen(true)}
                                    className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950"
                                    title="Open Job Details"
                                >
                                    <PanelLeftOpen className="h-4 w-4" />
                                </button>
                            )}
                            <div className="hidden h-5 w-px bg-slate-200 sm:block" />
                            {/* Editor Sub-actions based on active tab */}
                            {outputTab === 'resume' && tailoredResume && (
                                <div className="grid w-full shrink-0 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 sm:flex sm:w-auto sm:items-center">
                                    <div className="grid grid-cols-3 rounded-md bg-white p-0.5 sm:w-auto">
                                        <button
                                            onClick={() => setResultViewMode('preview')}
                                            className={cn("flex h-8 items-center justify-center gap-1 rounded px-2 text-[11px] font-semibold sm:h-9", resultViewMode === 'preview' ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-950")}
                                            title="Preview"
                                        >
                                            <Eye className="h-3.5 w-3.5" /> <span>Preview</span>
                                        </button>
                                        <button
                                            onClick={() => setResultViewMode('edit')}
                                            className={cn("flex h-8 items-center justify-center gap-1 rounded px-2 text-[11px] font-semibold sm:h-9", resultViewMode === 'edit' ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-950")}
                                            title="Edit"
                                        >
                                            <PenLine className="h-3.5 w-3.5" /> <span>Edit</span>
                                        </button>
                                        <button
                                            onClick={() => setResultViewMode('diff')}
                                            className={cn("flex h-8 items-center justify-center gap-1 rounded px-2 text-[11px] font-semibold sm:h-9", resultViewMode === 'diff' ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-950")}
                                            title="Diff"
                                        >
                                            <GitCompare className="h-3.5 w-3.5" /> <span>Diff</span>
                                        </button>
                                    </div>
                                    <div className={cn(
                                        "grid gap-1 sm:flex sm:items-center",
                                        resultViewMode === 'preview'
                                            ? "grid-cols-[minmax(0,1fr)_auto_auto]"
                                            : hasInsights && !activeAnalysisTab
                                                ? "grid-cols-2"
                                                : "grid-cols-1"
                                    )}>
                                        {resultViewMode === 'preview' && (
                                            <>
                                                <select
                                                    value={selectedTemplate}
                                                    onChange={(e) => setSelectedTemplate(e.target.value as typeof selectedTemplate)}
                                                    className="h-8 min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold capitalize text-slate-700 outline-none sm:hidden"
                                                    aria-label="Resume template"
                                                >
                                                    {(['modern', 'classic', 'minimal'] as const).map((t) => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                                <div className="hidden rounded-md bg-white p-0.5 sm:flex">
                                                    {(['modern', 'classic', 'minimal'] as const).map((t) => (
                                                        <button key={t} onClick={() => setSelectedTemplate(t)} className={cn("h-8 rounded px-2 text-[11px] font-semibold capitalize", selectedTemplate === t ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:text-slate-950")}>
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                        <button onClick={handleDownloadPDF} disabled={pdfGenerating} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50 sm:h-9 sm:px-3" title="Download PDF">
                                            {pdfGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                            PDF
                                        </button>
                                        {hasInsights && !activeAnalysisTab && (
                                            <button
                                                onClick={() => setActiveAnalysisTab('changes')}
                                                className="inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-950 sm:h-9 sm:bg-slate-950 sm:px-3 sm:text-white sm:hover:bg-slate-800 sm:hover:text-white"
                                            >
                                                <ListChecks className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">Analysis</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {outputTab === 'coverLetter' && coverLetter && (
                                <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
                                    <button onClick={() => setIsEditingCoverLetter(!isEditingCoverLetter)} className={cn("px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 shadow-sm transition-all", isEditingCoverLetter ? "bg-indigo-100 text-indigo-700" : "bg-white text-slate-600 hover:bg-slate-50")}>
                                        <PenLine className="h-3.5 w-3.5" /> Edit
                                    </button>
                                    <button onClick={handleCopyCoverLetter} className="px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 bg-white text-slate-600 hover:bg-slate-50 shadow-sm transition-all">
                                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
                                    </button>
                                    <button onClick={handleDownloadCoverLetterTxt} className="px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1.5 bg-white text-slate-600 hover:bg-slate-50 shadow-sm transition-all" title="Download TXT">
                                        <Download className="h-3.5 w-3.5" /> TXT
                                    </button>
                                </div>
                            )}

                            </div>
                        </div>
                    </div>

                    {/* Loading Overlay */}
                    {(loading || coverLetterLoading) && (
                        <div className="absolute inset-0 z-30 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-b-2xl">
                            <div className="mx-4 flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-xl animate-fade-in-up sm:p-8">
                                <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg sm:h-16 sm:w-16", coverLetterLoading ? 'from-violet-500 to-purple-600' : 'from-indigo-500 to-violet-500')}>
                                    {coverLetterLoading ? <Mail className="h-7 w-7 text-white animate-spin" style={{ animationDuration: '3s' }} /> : <Sparkles className="h-7 w-7 text-white animate-spin" style={{ animationDuration: '3s' }} />}
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-800">{coverLetterLoading ? 'Writing your cover letter' : 'Tailoring your resume'}</p>
                                    <p className="text-xs text-slate-500 mt-1">{coverLetterLoading ? 'Crafting a personalized letter...' : 'AI is optimizing for this role...'}</p>
                                </div>
                                <div className="w-48 h-1.5 rounded-full overflow-hidden bg-slate-100"><div className="h-full animate-shimmer rounded-full bg-indigo-500" /></div>
                            </div>
                        </div>
                    )}

                    {/* Editor Content Wrapper */}
                    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-slate-100/70">
                        {/* ── Section Builder tab ── */}
                        {outputTab === 'sections' && (
                            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                <SectionWiseEditor
                                    sections={sectionStates}
                                    fullOriginalResume={resumeText}
                                    jdAnalysisTitle={jdAnalysis?.targetTitle}
                                    onGenerate={handleGenerateSection}
                                    onGenerateAll={handleGenerateAllSections}
                                    onAccept={handleAcceptSection}
                                    onReset={handleResetSection}
                                    onTailoredChange={handleSectionTailoredChange}
                                    onSetPreferences={handleSetPreferences}
                                    onSetCustomInstruction={handleSetCustomInstruction}
                                    onAssemble={handleAssembleResume}
                                    isAnyGenerating={isAnySectionGenerating}
                                    canAssemble={canAssembleSections}
                                />
                            </div>
                        )}

                        {/* ── Resume / Cover Letter tabs ── */}
                        {outputTab !== 'sections' && (
                            <div id="print-container" className="custom-scrollbar flex-1 overflow-auto p-1.5 pb-6 print:overflow-visible print:p-0 sm:p-4 md:p-6 lg:pb-6">
                                {outputTab === 'resume' ? (
                                    tailoredResume ? (
                                        resultViewMode === 'diff' ? (
                                            <div className="h-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><DiffViewer oldText={resumeText} newText={tailoredResume} /></div>
                                        ) : resultViewMode === 'edit' ? (
                                            <div className="group/editor relative z-20 mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                                                <textarea
                                                    className="custom-scrollbar w-full flex-1 resize-none p-4 pb-20 font-mono text-base leading-6 text-slate-800 outline-none placeholder:text-slate-300 sm:p-6 sm:text-sm"
                                                    placeholder="Edit your tailored resume here..."
                                                    value={tailoredResume}
                                                    onChange={(e) => setTailoredResume(e.target.value)}
                                                    spellCheck={false}
                                                />
                                                <button onClick={() => setResultViewMode('preview')} className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 sm:bottom-6 sm:right-6">
                                                    <Check className="h-4 w-4 text-emerald-300" /> Done editing
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="mx-auto min-h-full w-full max-w-[900px]">
                                                <div className="mb-2 hidden flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm sm:flex sm:mb-3">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <FileCheck2 className="h-4 w-4 text-emerald-600" />
                                                        <span className="font-semibold text-slate-700">Resume preview</span>
                                                        <span className="truncate">{selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)} template</span>
                                                    </div>
                                                    <span className="text-[11px]">{hasUnsavedChanges ? 'Save before export for the latest copy.' : saveStatusLabel}</span>
                                                </div>
                                                <div className="min-h-[78vh] rounded-xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:min-h-[900px] sm:px-10 sm:py-10 lg:min-h-[1050px] lg:px-16 print:min-h-0 print:border-0 print:p-0 print:shadow-none">
                                                    <ResumePreview content={tailoredResume} title={null} company={null} template={selectedTemplate} />
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center px-4 text-slate-500">
                                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                                                <FileText className="h-9 w-9 text-slate-400" />
                                            </div>
                                            <p className="mb-2 text-lg font-semibold text-slate-800">No tailored resume yet</p>
                                            <p className="max-w-sm text-center text-sm text-slate-500">Complete the job and resume inputs, then run tailoring. The finished resume, edit mode, diff view, and PDF export stay here.</p>
                                            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                                                <button onClick={() => { setMobileTab('job'); setActiveTab('job'); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                                    <Briefcase className="h-4 w-4" /> Job input
                                                </button>
                                                <button onClick={() => { setMobileTab('resume'); setActiveTab('resume'); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                                    <FileText className="h-4 w-4" /> Resume input
                                                </button>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    /* Cover Letter output */
                                    coverLetter && !coverLetterLoading ? (
                                        isEditingCoverLetter ? (
                                            <div className="h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                                <textarea
                                                    className="w-full h-full resize-none outline-none font-serif text-[15px] text-slate-800 leading-relaxed p-6 lg:p-10 custom-scrollbar"
                                                    value={coverLetter}
                                                    onChange={(e) => setCoverLetter(e.target.value)}
                                                    onBlur={async () => { await updateApplication(app.id, { coverLetter }); }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="mx-auto max-w-3xl rounded-xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8 lg:p-12">
                                                <div className="font-serif text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">{coverLetter}</div>
                                            </div>
                                        )
                                    ) : !coverLetterLoading ? (
                                        <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-2 py-6 sm:px-0 sm:py-8">
                                            <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-6">
                                                <Mail className="h-8 w-8 text-violet-600" />
                                            </div>
                                            <h2 className="text-xl font-bold text-slate-800 mb-2">AI Cover Letter Generator</h2>
                                            <p className="text-slate-500 text-sm text-center mb-8">Craft a personalized, high-converting cover letter based on your tailored resume and the target job description.</p>
                                            
                                            <div className="w-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
                                                <h3 className="text-sm font-bold text-slate-700 mb-4">1. Choose a Tone & Style</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                                    {([
                                                        { id: 'professional' as const, label: 'Professional', desc: 'Balanced & standard', icon: BookOpen },
                                                        { id: 'concise' as const, label: 'Concise', desc: 'Short & direct', icon: Zap },
                                                        { id: 'storytelling' as const, label: 'Storytelling', desc: 'Narrative-driven', icon: PenLine },
                                                        { id: 'executive' as const, label: 'Executive', desc: 'Leadership focus', icon: Crown },
                                                    ]).map(s => {
                                                        const Icon = s.icon;
                                                        const isActive = coverLetterStyle === s.id;
                                                        return (
                                                            <button key={s.id} onClick={() => setCoverLetterStyle(s.id)} className={cn("flex items-start gap-3 rounded-xl border p-3 text-left transition-all", isActive ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>
                                                                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", isActive ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500")}><Icon className="h-4 w-4" /></div>
                                                                <div>
                                                                    <p className={cn("text-sm font-semibold", isActive ? "text-white" : "text-slate-800")}>{s.label}</p>
                                                                    <p className={cn("mt-0.5 text-xs", isActive ? "text-slate-300" : "text-slate-500")}>{s.desc}</p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mb-6">
                                                    <label className="text-sm font-bold text-slate-700 mb-2 block">2. Custom Instructions <span className="text-slate-400 font-normal">(optional)</span></label>
                                                    <textarea className="custom-scrollbar h-24 w-full resize-none rounded-xl border border-slate-200 p-3 text-base text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-violet-300 focus:ring-4 focus:ring-violet-100 sm:text-sm" placeholder='e.g., "Emphasize my experience leading remote teams" or "Mention my passion for AI"' value={coverLetterInstructions} onChange={(e) => setCoverLetterInstructions(e.target.value)} />
                                                </div>
                                                <button onClick={handleGenerateCoverLetter} disabled={coverLetterLoading || !resumeText || !jobDescription} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                                                    <Sparkles className="h-4 w-4 text-violet-400" /> Generate Cover Letter
                                                </button>
                                            </div>
                                        </div>
                                    ) : null
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right Panel (Pane 3): AI Insights ── */}
                {((changes.length > 0) || keywordCoverage) && tailoredResume && (
                    <>
                        {/* Mobile: Bottom Sheet Overlay */}
                        <div className={cn("fixed inset-0 z-40 bg-slate-950/35 transition-opacity lg:hidden", activeAnalysisTab ? "opacity-100" : "pointer-events-none opacity-0")} onClick={() => setActiveAnalysisTab(null)} />
                        
                        <div className={cn(
                            "z-[60] flex h-full shrink-0 flex-col gap-3 transition-all duration-300 ease-in-out lg:z-auto",
                            // Mobile: Fixed bottom sheet
                            "fixed bottom-0 left-0 right-0 max-h-[calc(100dvh-4rem)] rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl lg:static lg:max-h-none lg:rounded-2xl lg:bg-transparent lg:pb-0 lg:shadow-none",
                            // Desktop width handling
                            activeAnalysisTab ? "translate-y-0 lg:w-[320px] xl:w-[350px] opacity-100" : "translate-y-full lg:translate-y-0 lg:w-0 lg:opacity-0 lg:p-0 lg:overflow-hidden lg:hidden"
                        )}>
                            {/* Mobile Drag Handle */}
                            <div className="lg:hidden flex justify-center pt-3 pb-2 cursor-grab" onClick={() => setActiveAnalysisTab(null)}>
                                <div className="w-12 h-1.5 rounded-full bg-slate-200" />
                            </div>

                            <div className="relative flex flex-1 flex-col overflow-hidden border border-slate-200 bg-white shadow-sm lg:rounded-2xl">
                                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-lg bg-slate-900 p-1.5 text-white"><ListChecks className="h-4 w-4" /></div>
                                        <div>
                                            <span className="text-sm font-semibold text-slate-950">What Changed</span>
                                            {changes.length > 0 && (
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    {[...new Set(changes.map(c => c.section).filter(Boolean))].length} sections · {changes.length} improvements
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button onClick={() => setActiveAnalysisTab(null)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950">
                                        <ChevronRight className="h-4 w-4 lg:rotate-0" />
                                    </button>
                                </div>

                                {/* Persistent Tabs */}
                                <div className="flex shrink-0 gap-2 px-3 pb-2 pt-3">
                                    <button onClick={() => setActiveAnalysisTab('changes')} className={cn("flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-all", (!activeAnalysisTab || activeAnalysisTab === 'changes') ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:text-slate-950")}>
                                        Changes
                                    </button>
                                    {keywordCoverage && (
                                        <button onClick={() => setActiveAnalysisTab('coverage')} className={cn("flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-all", activeAnalysisTab === 'coverage' ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:text-slate-950")}>
                                            ATS Match
                                        </button>
                                    )}
                                </div>

                                {/* Scrollable Insights Content */}
                                <div className="custom-scrollbar flex-1 overflow-y-auto bg-slate-50 p-3">
                                    {(!activeAnalysisTab || activeAnalysisTab === 'changes') && (() => {
                                        const sectionColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
                                            summary:    { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200', dot: 'bg-indigo-400' },
                                            experience: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   dot: 'bg-blue-400' },
                                            skills:     { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200', dot: 'bg-violet-400' },
                                            education:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',dot: 'bg-emerald-400' },
                                            projects:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-400' },
                                            other:      { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',   dot: 'bg-rose-400' },
                                        };
                                        const defaultColor = { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };

                                        function getKeywordDelta(original: string | undefined, newText: string | undefined) {
                                            if (!original || !newText) return { added: [], removed: [] };
                                            const origWords = new Set(original.toLowerCase().match(/\b[a-z][a-z0-9+#.]{2,}\b/g) || []);
                                            const newWords = new Set(newText.toLowerCase().match(/\b[a-z][a-z0-9+#.]{2,}\b/g) || []);
                                            const stopWords = new Set(['the','and','for','with','this','that','from','into','over','have','been','will','your','our','their','which','when','were','are','was','its','has','had','not','but','can','may','also','each','both','more','such','than','then','them','they','some','very','just','about','after','before','would','could','should','through','within','across','using','based','other','these','those','where','while','there']);
                                            const added = [...newWords].filter(w => !origWords.has(w) && !stopWords.has(w) && w.length >= 3).slice(0, 6);
                                            const removed = [...origWords].filter(w => !newWords.has(w) && !stopWords.has(w) && w.length >= 3).slice(0, 4);
                                            return { added, removed };
                                        }

                                        if (changes.length === 0) return (
                                            <div className="text-center py-12 text-slate-400">
                                                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-3"><Sparkles className="h-5 w-5 text-slate-300" /></div>
                                                <p className="text-xs font-semibold">No changes recorded.</p>
                                            </div>
                                        );

                                        const grouped: Record<string, AnalysisChange[]> = {};
                                        changes.forEach(c => {
                                            const key = (c.section || 'general').toLowerCase();
                                            if (!grouped[key]) grouped[key] = [];
                                            grouped[key].push(c);
                                        });

                                        return (
                                            <div className="space-y-3">
                                                {Object.entries(grouped).map(([section, sectionChanges]) => {
                                                    const color = sectionColors[section] || defaultColor;
                                                    return (
                                                        <div key={section} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                                                            <div className={cn('flex items-center gap-2 px-3 py-2 border-b', color.bg, color.border)}>
                                                                <div className={cn('w-2 h-2 rounded-full shrink-0', color.dot)} />
                                                                <span className={cn('text-[10px] font-black uppercase tracking-widest', color.text)}>{section}</span>
                                                                <span className={cn('ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full border', color.bg, color.text, color.border)}>
                                                                    {sectionChanges.length} edit{sectionChanges.length > 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                            <div className="divide-y divide-slate-50">
                                                                {sectionChanges.map((change, ci) => {
                                                                    const delta = getKeywordDelta(change.original, change.new);
                                                                    return (
                                                                        <div key={ci} className="px-3 py-2.5">
                                                                            <p className="text-[12px] font-semibold text-slate-800 leading-snug">
                                                                                {change.reason || 'Content updated for role alignment.'}
                                                                            </p>
                                                                            {(delta.added.length > 0 || delta.removed.length > 0) && (
                                                                                <div className="mt-1.5 flex flex-wrap gap-1">
                                                                                    {delta.added.map((kw, ki) => (
                                                                                        <span key={`add-${ki}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                                            <ArrowRight className="h-2 w-2" />{kw}
                                                                                        </span>
                                                                                    ))}
                                                                                    {delta.removed.map((kw, ki) => (
                                                                                        <span key={`rm-${ki}`} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 text-slate-400 border border-slate-200 line-through">
                                                                                            {kw}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {activeAnalysisTab === 'coverage' && keywordCoverage && (
                                        <div className="space-y-4">
                                            {atsScore && (
                                                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                                                    <ScoreRing score={atsScore.after} size={64} strokeWidth={6} />
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ATS Score</p>
                                                        <p className="text-2xl font-black text-slate-800 leading-none mt-1">{atsScore.after}</p>
                                                        <p className="text-[11px] font-semibold text-emerald-600 mt-1 inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md">+{atsScore.after - atsScore.before} improvement</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs font-bold text-slate-800">Required Skills</span>
                                                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                        {keywordCoverage.required.matched.length}/{keywordCoverage.required.total}
                                                    </span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                                                    <div className={cn("h-full rounded-full transition-all duration-1000", keywordCoverage.required.score >= 80 ? "bg-emerald-500" : keywordCoverage.required.score >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${keywordCoverage.required.score}%` }} />
                                                </div>
                                                <div className="space-y-3">
                                                    {keywordCoverage.required.matched.length > 0 && (
                                                        <div>
                                                            <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block mb-1.5 flex items-center gap-1"><Check className="h-3 w-3" /> Matched</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {keywordCoverage.required.matched.map((kw, i) => <span key={i} className="px-2 py-1 text-[10px] bg-emerald-50 text-emerald-700 rounded-md font-semibold">{kw}</span>)}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {keywordCoverage.required.missing.length > 0 && (
                                                        <div className="pt-2 border-t border-slate-100">
                                                            <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1"><X className="h-3 w-3" /> Missing</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {keywordCoverage.required.missing.map((kw, i) => <span key={i} className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded-md font-semibold">{kw}</span>)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {gapFixResults && gapFixResults.injected.length > 0 && (
                                                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-4 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="h-16 w-16 text-indigo-500" /></div>
                                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-2 relative z-10">Auto-Injected Skills</span>
                                                    <ul className="space-y-2 relative z-10">
                                                        {gapFixResults.injected.map((item, i) => (
                                                            <li key={i} className="text-[11px] font-semibold text-slate-700 pl-2.5 border-l-2 border-indigo-400 bg-white/50 py-1.5 rounded-r-md">{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Mobile/Hidden Desktop Toggle Buttons */}
            {!isLeftPanelOpen && (
                <button onClick={() => setIsLeftPanelOpen(true)} className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-white shadow-xl border border-slate-200 rounded-r-xl hover:pl-4 transition-all z-20 group" title="Expand Input Panel">
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
                </button>
            )}

            {/* Mobile Side Menu Overlay */}
            {isMobileNavOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden flex justify-start">
                    <div 
                        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300" 
                        onClick={() => setIsMobileNavOpen(false)} 
                    />
                    <div className="relative w-[280px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100">
                            <span className="font-bold text-slate-900">Workspace Menu</span>
                            <button 
                                onClick={() => setIsMobileNavOpen(false)}
                                className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {([
                                { href: '/', label: 'Dashboard', Icon: Home },
                                { href: '/profile', label: 'Master Profile', Icon: UserCheck },
                                { href: '/new', label: 'New Application', Icon: PlusCircle },
                                { href: '/settings', label: 'Settings', Icon: Settings },
                            ] as const).map(({ href, label, Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={() => setIsMobileNavOpen(false)}
                                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-600 group"
                                >
                                    <Icon className="h-5 w-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                    {label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}



