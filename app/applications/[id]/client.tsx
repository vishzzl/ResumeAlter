'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { Application, applications } from '@/lib/db/schema';
import { updateApplication, getProfile } from '@/lib/actions';
import {
    Loader2, Save, Wand2, Upload, FileText, ChevronLeft, ChevronRight,
    RefreshCw, Download, CheckSquare, Square, UserCheck, Briefcase,
    Sparkles, X, Eye, GitCompare, LayoutGrid, Mail, Copy, Check,
    PenLine, BookOpen, Zap, Crown, Award, Target, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { JobDetails } from '@/lib/parser';
import { useAIConfig } from '@/app/context/AIConfigContext';
import { ResumePreview } from '@/components/ResumePreview';
import { DiffViewer } from '@/components/DiffViewer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
    const [isSaving, setIsSaving] = useState(false); // separate from loading (which is used for tailoring)
    const [activeTab, setActiveTab] = useState<'job' | 'resume'>('job');
    const [mobileTab, setMobileTab] = useState<'job' | 'resume' | 'result'>('job');
    const router = useRouter();

    // Resume State
    const [resumeText, setResumeText] = useState(app.baseResume || '');
    const [isUploading, setIsUploading] = useState(false);
    const resumeAutoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const [changes, setChanges] = useState<any[]>(initialAnalysis.changes || []);
    const [atsScore, setAtsScore] = useState<{ before: number, after: number, analysis: string } | null>(initialAnalysis.atsScore || null);
    const [executionTime, setExecutionTime] = useState<number | null>(initialAnalysis.executionTime || null);
    const [resultViewMode, setResultViewMode] = useState<'preview' | 'diff' | 'edit'>('preview');
    const [tailorPhase, setTailorPhase] = useState<'extracting' | 'tailoring' | 'verifying' | 'gap_check' | 'analyzing' | 'complete' | null>(null);

    // Keyword Coverage State — pre-fix (before gap injection) and post-fix (final)
    const [preFixCoverage, setPreFixCoverage] = useState<{
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
    const [outputTab, setOutputTab] = useState<'resume' | 'coverLetter'>('resume');
    const [copied, setCopied] = useState(false);
    const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);

    // Global AI Config
    const { selectedModel, selectedProvider, customModelConfig } = useAIConfig();

    // UI State
    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [selectedTemplate, setSelectedTemplate] = useState<'modern' | 'classic' | 'minimal'>('modern');
    const [activeAnalysisTab, setActiveAnalysisTab] = useState<'changes' | 'coverage' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pdfGenerating, setPdfGenerating] = useState(false);

    // Workflow step status
    const hasJobData = !!(jobDescription || jobDetails);
    const hasResume = !!resumeText;
    const hasResult = !!tailoredResume;

    // Input validation — prevent tailoring with obviously insufficient data
    const inputTooShort = resumeText.length < 200 || jobDescription.length < 100;
    const canTailor = !loading && !!resumeText && !!jobDescription && !inputTooShort;

    // Certifications State
    const [profileCertifications, setProfileCertifications] = useState<any[]>([]);
    const [selectedCertifications, setSelectedCertifications] = useState<any[]>(
        app.selectedCertifications ? JSON.parse(app.selectedCertifications) : []
    );

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

    // Save selected certifications when changed
    useEffect(() => {
        const saveSelection = async () => {
            // Debounce or just save?
            // Since this might trigger on every click, maybe better to save in handleSave?
            // But for now let's keep it in sync with handleSave or update lazily.
            // Actually, the main handleSave should include it.
        };
    }, [selectedCertifications]);


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
            toast.success('Saved successfully!');
        } catch (err) {
            console.error('Save failed', err);
            toast.error('Save failed. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Debounced auto-save for resume text (saves 1.5s after the user stops typing)
    const handleResumeTextChange = (value: string) => {
        setResumeText(value);
        if (resumeAutoSaveRef.current) clearTimeout(resumeAutoSaveRef.current);
        resumeAutoSaveRef.current = setTimeout(async () => {
            try {
                await updateApplication(app.id, { baseResume: value });
            } catch (e) {
                console.error('Auto-save failed', e);
            }
        }, 1500);
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
                if (selectedJobDetails.requiredSkills.length > 0) {
                    parts.push(`\nRequired Skills:\n${selectedJobDetails.requiredSkills.map(s => `- ${s}`).join('\n')}`);
                }
                if (selectedJobDetails.preferredSkills.length > 0) {
                    parts.push(`\nPreferred Skills:\n${selectedJobDetails.preferredSkills.map(s => `- ${s}`).join('\n')}`);
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

                        let details = [];
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

        try {
            const apiKey = localStorage.getItem('gemini_api_key');
            let finalJobDescription = jobDescription;
            if (jobDetails && !selectedJobDetails.useFullDescription) {
                const parts = [];
                parts.push(`Job Title: ${jobDetails.title || app.jobTitle}`);
                parts.push(`Company: ${jobDetails.company || app.companyName}`);
                if (selectedJobDetails.requirements.length > 0) {
                    parts.push(`\nSelected Requirements: \n${selectedJobDetails.requirements.map(r => `- ${r}`).join('\n')}`);
                }
                if (selectedJobDetails.requiredSkills.length > 0) {
                    parts.push(`\nRequired Skills (must target): \n${selectedJobDetails.requiredSkills.map(s => `- ${s}`).join('\n')}`);
                }
                if (selectedJobDetails.preferredSkills.length > 0) {
                    parts.push(`\nPreferred Skills (nice to have): \n${selectedJobDetails.preferredSkills.map(s => `- ${s}`).join('\n')}`);
                }
                if (selectedJobDetails.experience.length > 0) {
                    parts.push(`\nSelected Experience: \n${selectedJobDetails.experience.map(e => `- ${e}`).join('\n')}`);
                }
                parts.push(`\nAdditional Context(Cleaned Description): \n${jobDetails.description || jobDescription}`);
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
                    customConfig: customModelConfig,
                    applicationId: app.id,
                }),
            });

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

        } catch (err) {
            console.error('Tailoring failed', err);
            setError(err instanceof Error ? err.message : 'Failed to tailor resume.');
            toast.error('❌ Tailoring failed. Please try again.', { id: 'tailor-status' });
        } finally {
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

    // ─── RENDER ───

    return (
        <div className="min-h-[calc(100vh-6rem)] lg:h-[calc(100vh-6rem)] flex flex-col gap-0">

            {/* ━━━ Header (Sticky on Mobile) ━━━ */}
            <div className="sticky top-12 md:top-14 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-3 sm:px-5 py-1.5 sm:py-2 flex items-center justify-between print:hidden flex-wrap gap-2 transition-all">
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
                        disabled={isSaving || loading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                        onClick={handleTailor}
                        disabled={!canTailor}
                        title={inputTooShort ? 'Resume must be at least 200 characters and job description at least 100 characters' : undefined}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-w-[120px] justify-center"
                    >
                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-indigo-300" />}
                        <span className="hidden sm:inline">
                            {loading && tailorPhase === 'extracting' ? 'Extracting...' :
                                loading && tailorPhase === 'tailoring' ? 'Tailoring...' :
                                    loading && tailorPhase === 'verifying' ? 'Verifying...' :
                                        loading && tailorPhase === 'gap_check' ? 'Optimizing...' :
                                            loading && tailorPhase === 'analyzing' ? 'Analyzing...' :
                                                'Tailor Resume'}
                        </span>
                        <span className="sm:hidden">
                            {loading && tailorPhase === 'extracting' ? 'Extracting...' :
                                loading && tailorPhase === 'tailoring' ? 'Tailoring...' :
                                    loading && tailorPhase === 'verifying' ? 'Verifying...' :
                                        loading && tailorPhase === 'gap_check' ? 'Optimizing...' :
                                            loading && tailorPhase === 'analyzing' ? 'Analyzing...' :
                                                'Tailor'}
                        </span>
                    </button>
                </div>
            </div>

            {/* ━━━ Mobile Bottom Tab Bar ━━━ */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-t border-slate-200 px-6 py-2 flex items-center justify-between shadow-lg ring-1 ring-slate-900/5 pb-safe print:hidden">
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

                        {/* ━━━ SSE Incomplete Warning ━━━ */}
            {sseIncomplete && (
                <div className="animate-fade-in-up mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm print:hidden" role="alert">
                    <span className="shrink-0">⚠️</span>
                    <p className="flex-1 min-w-0 text-xs">
                        <span className="font-semibold">Tailoring may be incomplete</span> — the process was interrupted. Try tailoring again if anything looks off.
                    </p>
                    <button onClick={() => setSseIncomplete(false)} className="p-1 rounded hover:bg-amber-100 transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* ━━━ Main Workspace ━━━ */}
            <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-auto lg:overflow-hidden relative transition-all duration-300 ease-in-out">

                {/* ── Left Panel: Input (JD & Resume) ── */}
                <div
                    className={cn(
                        "transition-all duration-300 ease-in-out shrink-0 flex flex-col gap-3",
                        // Mobile: Full width with explicit height, visible only if tab is job or resume
                        mobileTab === 'result' ? "hidden lg:flex" : "w-full min-h-[calc(100vh-11rem)] lg:min-h-0",
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
                    <div className="flex-1 glass-card-solid overflow-visible lg:overflow-hidden flex flex-col">

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
                                            <RefreshCw className={`h - 3.5 w - 3.5 ${isScraping ? 'animate-spin' : ''}`} />
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
                                                        className={`inline - flex items - center gap - 1 text - [11px] font - medium px - 2 py - 1 rounded - md border transition - all ${selectedJobDetails.useFullDescription
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
                                                                            className={`w - full flex items - start gap - 2.5 p - 2.5 rounded - lg text - left transition - all duration - 200 group ${isSelected
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
                                                                            <div className={`mt - 0.5 shrink - 0 ${isSelected ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                                                                {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                                                            </div>
                                                                            <span className={`text - [13px] leading - relaxed ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>
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
                                                                            className={`w - full flex items - start gap - 2.5 p - 2.5 rounded - lg text - left transition - all duration - 200 group ${isSelected
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
                                                                            <div className={`mt - 0.5 shrink - 0 ${isSelected ? 'text-indigo-500' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                                                                {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                                                            </div>
                                                                            <span className={`text - [13px] leading - relaxed ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}>
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
                                            className="w-full flex-1 min-h-[60vh] lg:min-h-0 p-4 resize-none outline-none font-mono text-[13px] sm:text-[13px] text-slate-800 bg-white placeholder:text-slate-300 overflow-y-auto"
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
                                        <Popover open={isSyncPopoverOpen} onOpenChange={setIsSyncPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <button
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
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
                                                                    className={`flex items - center justify - center h - 4 w - 4 rounded border ${selectedSyncSections[key as keyof typeof selectedSyncSections] ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 group-hover:border-indigo-400'}`}
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
                                        className="flex-1 w-full min-h-[60vh] lg:min-h-0 p-4 resize-none outline-none font-mono text-[13px] sm:text-[13px] text-slate-800 bg-white placeholder:text-slate-300 custom-scrollbar overflow-y-auto"
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
                    // Mobile: Visible only if tab is result — with minimum height
                    mobileTab !== 'result' ? "hidden lg:flex" : "flex min-h-[60vh] lg:min-h-0"
                )}>
                    {/* ─ Main Result Area (single card, no gaps above) ─ */}
                    <div className="flex-1 glass-card-solid overflow-hidden flex flex-col relative">
                        {/* ─ Unified Compact Toolbar ─ */}
                        <div className="bg-white border-b border-slate-100 px-2 sm:px-3 py-1.5 shrink-0 print:hidden">
                            {/* Row 1: Output Tab Toggle */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="segmented-control text-[11px] mr-auto">
                                    <button onClick={() => setOutputTab('resume')} className={outputTab === 'resume' ? 'active' : ''}>
                                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /><span className="hidden sm:inline">Resume</span><span className="sm:hidden">Resume</span></span>
                                    </button>
                                    <button onClick={() => setOutputTab('coverLetter')} className={outputTab === 'coverLetter' ? 'active' : ''}>
                                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /><span className="hidden sm:inline">Cover Letter</span><span className="sm:hidden">Letter</span></span>
                                    </button>
                                </div>

                                {/* ATS Score (compact on mobile) */}
                                {outputTab === 'resume' && atsScore && (
                                    <button
                                        onClick={() => setActiveAnalysisTab(prev => prev === 'coverage' ? null : 'coverage')}
                                        className="flex items-center gap-1.5 sm:gap-2 hover:bg-slate-50 px-2 py-1 -ml-2 rounded-lg transition-colors"
                                        title="View Keyword Coverage"
                                    >
                                        <ScoreRing score={atsScore.after} size={24} strokeWidth={3} />
                                        <span className="text-[11px] sm:text-xs font-bold text-slate-700">{atsScore.after}</span>
                                        <span className="text-[9px] sm:text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1 sm:px-1.5 py-0.5 rounded-full">+{atsScore.after - atsScore.before}</span>
                                    </button>
                                )}
                                {outputTab === 'resume' && !atsScore && (
                                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                        <Sparkles className="h-3 w-3 text-indigo-400" /> Result
                                    </span>
                                )}

                                {/* Cover Letter label */}
                                {outputTab === 'coverLetter' && (
                                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                        <Mail className="h-3 w-3 text-violet-400" /> Cover Letter
                                    </span>
                                )}
                            </div>

                            {/* Row 2: View Controls (only when there's content) */}
                            {outputTab === 'resume' && tailoredResume && (
                                <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 overflow-x-auto scrollbar-hide">
                                    {/* View toggle */}
                                    <div className="segmented-control text-[11px] shrink-0">
                                        <button onClick={() => setResultViewMode('preview')} className={resultViewMode === 'preview' ? 'active' : ''}>
                                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /><span className="hidden sm:inline">Preview</span></span>
                                        </button>
                                        <button onClick={() => setResultViewMode('edit')} className={resultViewMode === 'edit' ? 'active' : ''}>
                                            <span className="flex items-center gap-1"><PenLine className="h-3 w-3" /><span className="hidden sm:inline">Edit</span></span>
                                        </button>
                                        <button onClick={() => setResultViewMode('diff')} className={resultViewMode === 'diff' ? 'active' : ''}>
                                            <span className="flex items-center gap-1"><GitCompare className="h-3 w-3" /><span className="hidden sm:inline">Diff</span></span>
                                        </button>
                                    </div>

                                    {/* Template selector */}
                                    {resultViewMode === 'preview' && (
                                        <div className="segmented-control text-[11px] shrink-0">
                                            {(['modern', 'classic', 'minimal'] as const).map((t) => (
                                                <button key={t} onClick={() => setSelectedTemplate(t)} className={selectedTemplate === t ? 'active' : ''}>
                                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className="ml-auto shrink-0">
                                        <button
                                            onClick={handleDownloadPDF}
                                            disabled={pdfGenerating}
                                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {pdfGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                            <span className="hidden sm:inline">{pdfGenerating ? 'Generating...' : 'PDF'}</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Cover Letter action buttons */}
                            {outputTab === 'coverLetter' && coverLetter && (
                                <div className="flex items-center gap-1 mt-1.5">
                                    <button
                                        onClick={() => setIsEditingCoverLetter(!isEditingCoverLetter)}
                                        className={`inline - flex items - center gap - 1 text - [11px] font - medium px - 2 py - 1 rounded - md transition - colors ${isEditingCoverLetter ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                    >
                                        <PenLine className="h-3 w-3" /><span className="hidden sm:inline">Edit</span>
                                    </button>
                                    <button
                                        onClick={handleCopyCoverLetter}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                                    >
                                        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                        <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
                                    </button>
                                    <button
                                        onClick={handleDownloadCoverLetterTxt}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                                    >
                                        <Download className="h-3 w-3" /><span className="hidden sm:inline">TXT</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Loading Overlay */}
                        {(loading || coverLetterLoading) && (
                            <div className="loading-overlay">
                                <div className="flex flex-col items-center gap-4 animate-fade-in-up">
                                    <div className={`w - 16 h - 16 rounded - 2xl bg - gradient - to - br ${coverLetterLoading ? 'from-violet-500 to-purple-600' : 'from-indigo-500 to-violet-500'} flex items - center justify - center shadow - lg`}>
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
                            <div id="print-container" className="flex-1 overflow-auto p-3 sm:p-4 md:p-8 bg-white custom-scrollbar print:p-0 print:overflow-visible pb-20 lg:pb-8">
                                {outputTab === 'resume' ? (
                                    // Resume output
                                    tailoredResume ? (
                                        resultViewMode === 'diff' ? (
                                            <div className="h-full overflow-y-auto">
                                                <DiffViewer oldText={resumeText} newText={tailoredResume} />
                                            </div>
                                        ) : resultViewMode === 'edit' ? (
                                            <div className="w-full h-full flex flex-col relative z-20 group/editor">
                                                <textarea
                                                    className="flex-1 w-full p-4 resize-none outline-none font-mono text-[13px] sm:text-sm text-slate-800 bg-white placeholder:text-slate-300 overflow-y-auto"
                                                    placeholder="Edit your tailored resume here..."
                                                    value={tailoredResume}
                                                    onChange={(e) => setTailoredResume(e.target.value)}
                                                    spellCheck={false}
                                                />
                                                <button
                                                    onClick={() => setResultViewMode('preview')}
                                                    className="absolute top-4 right-6 bg-indigo-600 text-white shadow-md hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all opacity-50 hover:opacity-100"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    Done
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative group/preview min-h-full">
                                                <ResumePreview
                                                    content={tailoredResume}
                                                    title={null}
                                                    company={null}
                                                    template={selectedTemplate}
                                                />
                                                <button
                                                    onClick={() => setResultViewMode('edit')}
                                                    className="absolute top-2 right-2 opacity-0 group-hover/preview:opacity-100 transition-opacity bg-white/90 shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                                                >
                                                    <PenLine className="h-3.5 w-3.5" />
                                                    Edit
                                                </button>
                                            </div>
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
                                        <div className="h-full flex flex-col items-center justify-center px-4 sm:px-0">
                                            {/* Style Picker */}
                                            <div className="w-full max-w-lg mb-6 sm:mb-8">
                                                <h3 className="text-sm font-bold text-slate-700 mb-3 text-center">Choose a Style</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
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
                                                                className={`flex items - start gap - 3 p - 3 sm: p - 3.5 rounded - xl border - 2 text - left transition - all duration - 200 ${isActive
                                                                    ? `border-${s.color}-400 bg-${s.color}-50/50 shadow-sm`
                                                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                                                    } `}
                                                            >
                                                                <div className={`w - 8 h - 8 rounded - lg flex items - center justify - center shrink - 0 ${isActive ? `bg-${s.color}-100 text-${s.color}-600` : 'bg-slate-100 text-slate-400'
                                                                    } `}>
                                                                    <Icon className="h-4 w-4" />
                                                                </div>
                                                                <div>
                                                                    <p className={`text - [13px] sm: text - sm font - semibold ${isActive ? 'text-slate-800' : 'text-slate-600'} `}>{s.label}</p>
                                                                    <p className="text-[11px] text-slate-400 mt-0.5">{s.desc}</p>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Custom Instructions */}
                                            <div className="w-full max-w-lg mb-5 sm:mb-6">
                                                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Custom Instructions (optional)</label>
                                                <textarea
                                                    className="w-full h-20 p-3 resize-none rounded-xl border border-slate-200 text-[16px] sm:text-sm text-slate-700 placeholder:text-slate-300 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
                                                    placeholder='e.g., "Emphasize my leadership experience"'
                                                    value={coverLetterInstructions}
                                                    onChange={(e) => setCoverLetterInstructions(e.target.value)}
                                                />
                                            </div>

                                            {/* Generate Button */}
                                            <button
                                                onClick={handleGenerateCoverLetter}
                                                disabled={coverLetterLoading || !resumeText || !jobDescription}
                                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-violet-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                <Mail className="h-4 w-4" />
                                                Generate Cover Letter
                                            </button>

                                            {(!resumeText || !jobDescription) && (
                                                <p className="text-xs text-slate-400 mt-3 text-center">Add a resume and job description first</p>
                                            )}
                                        </div>
                                    ) : null
                                )}
                            </div>



                            {/* Combined Analysis — Desktop: Sidebar, Mobile: Bottom Sheet */}
                            {((changes.length > 0) || keywordCoverage) && activeAnalysisTab && resultViewMode === 'preview' && (
                                <>
                                    {/* Mobile: Bottom Sheet Overlay */}
                                    <div className="lg:hidden fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setActiveAnalysisTab(null)} />
                                    <div className={cn(
                                        "print:hidden transition-all duration-300 animate-slide-in-right",
                                        // Mobile: Fixed bottom sheet with flex layout
                                        "fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-t-2xl shadow-2xl flex flex-col",
                                        // Desktop: Side panel
                                        "lg:static lg:w-80 lg:max-h-none lg:rounded-none lg:shadow-none lg:z-auto",
                                        "border-l-0 lg:border-l border-slate-100 bg-white lg:bg-slate-50/70 shrink-0"
                                    )}>
                                        {/* Fixed Header — drag handle + title + close */}
                                        <div
                                            className="shrink-0 select-none touch-none bg-white lg:bg-transparent rounded-t-2xl"
                                            onTouchStart={(e) => {
                                                const startY = e.touches[0].clientY;
                                                const el = e.currentTarget.parentElement;
                                                if (!el) return;

                                                const handleMove = (ev: TouchEvent) => {
                                                    const deltaY = ev.touches[0].clientY - startY;
                                                    if (deltaY > 0) {
                                                        el.style.transform = `translateY(${deltaY}px)`;
                                                        el.style.transition = 'none';
                                                    }
                                                };

                                                const handleEnd = (ev: TouchEvent) => {
                                                    const deltaY = ev.changedTouches[0].clientY - startY;
                                                    el.style.transform = '';
                                                    el.style.transition = '';
                                                    if (deltaY > 80) {
                                                        setActiveAnalysisTab(null);
                                                    }
                                                    document.removeEventListener('touchmove', handleMove);
                                                    document.removeEventListener('touchend', handleEnd);
                                                };

                                                document.addEventListener('touchmove', handleMove, { passive: true });
                                                document.addEventListener('touchend', handleEnd, { passive: true });
                                            }}
                                        >
                                            {/* Drag indicator (mobile only) */}
                                            <div className="lg:hidden flex justify-center pt-3 pb-1 cursor-grab">
                                                <div className="w-10 h-1.5 rounded-full bg-slate-200" />
                                            </div>

                                            {/* Top Action Bar */}
                                            <div className="flex items-center justify-between px-4 pt-2 pb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Analysis</span>
                                                <button
                                                    onClick={() => setActiveAnalysisTab(null)}
                                                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>

                                            {/* Tabs Container */}
                                            <div className="flex px-3 pb-2 border-b border-slate-100 gap-2">
                                                <button
                                                    onClick={() => setActiveAnalysisTab('changes')}
                                                    className={cn(
                                                        "flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all",
                                                        activeAnalysisTab === 'changes'
                                                            ? "bg-indigo-50 text-indigo-700 shadow-sm"
                                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                                    )}
                                                >
                                                    AI Edits {changes.length > 0 && `(${changes.length})`}
                                                </button>
                                                {keywordCoverage && (
                                                    <button
                                                        onClick={() => setActiveAnalysisTab('coverage')}
                                                        className={cn(
                                                            "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md transition-all",
                                                            activeAnalysisTab === 'coverage'
                                                                ? "bg-indigo-50 text-indigo-700 shadow-sm"
                                                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                                        )}
                                                    >
                                                        <Target className="h-3 w-3" /> Keywords
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Scrollable Body */}
                                        <div className="flex-1 overflow-y-auto custom-scrollbar overscroll-contain p-4 pb-12 lg:pb-4">
                                            {activeAnalysisTab === 'changes' && (
                                                <div className="space-y-3 stagger-children">
                                                    {changes.map((change, i) => (
                                                        <div key={i} className="text-xs space-y-2 bg-white lg:bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                                            {change.section && (
                                                                <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                                                                    {change.section}
                                                                </span>
                                                            )}
                                                            <p className="font-semibold text-slate-800 leading-snug">{change.reason}</p>
                                                            {change.original && (
                                                                <div className="text-slate-400 line-through bg-red-50/60 p-2 rounded-lg text-[10px] leading-relaxed">
                                                                    {String(change.original || '').substring(0, 80)}...
                                                                </div>
                                                            )}
                                                            {change.new && (
                                                                <div className="text-slate-700 pl-2.5 border-l-2 border-emerald-400 bg-emerald-50/50 p-2 rounded-r-lg">
                                                                    <span className="font-semibold text-emerald-600 text-[10px]">Updated:</span>
                                                                    <span className="text-[10px] ml-1">{String(change.new || '').substring(0, 80)}...</span>
                                                                </div>
                                                            )}
                                                            {/* Fallbacks if oldText/new is used instead */}
                                                            {change.oldText && change.oldText.length > 0 && !change.original && (
                                                                <div className="relative pl-3 border-l-2 border-slate-200 mt-2 text-[11px] text-slate-500 italic before:content-[''] before:absolute before:-left-[5px] before:top-1.5 before:w-2 before:h-2 before:bg-white before:border-2 before:border-slate-200 before:rounded-full">
                                                                    {change.oldText.join('\n')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {changes.length === 0 && (
                                                        <div className="text-center py-8 text-slate-400 text-xs">No specific changes recorded.</div>
                                                    )}
                                                </div>
                                            )}

                                            {activeAnalysisTab === 'coverage' && keywordCoverage && (
                                                <div className="space-y-6">
                                                    {/* Required Keywords */}
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-bold text-slate-700">Required</span>
                                                            <span className="text-[11px] font-mono font-medium text-slate-500">
                                                                {keywordCoverage.required.matched.length}/{keywordCoverage.required.total} ({keywordCoverage.required.score}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all duration-500",
                                                                    keywordCoverage.required.score >= 80 ? "bg-emerald-500" :
                                                                        keywordCoverage.required.score >= 60 ? "bg-amber-500" : "bg-red-500"
                                                                )}
                                                                style={{ width: `${keywordCoverage.required.score}%` }}
                                                            />
                                                        </div>
                                                        {keywordCoverage.required.matched.length > 0 && (
                                                            <div className="mt-3">
                                                                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block mb-1.5">Matched</span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {keywordCoverage.required.matched.map((kw, i) => (
                                                                        <span key={i} className="px-2 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 font-medium">{kw}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {keywordCoverage.required.missing.length > 0 && (
                                                            <div className="mt-3">
                                                                <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider block mb-1.5">Missing</span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {keywordCoverage.required.missing.map((kw, i) => (
                                                                        <span key={i} className="px-2 py-0.5 text-[10px] bg-red-50 text-red-600 rounded-md border border-red-100 font-medium">{kw}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Preferred Keywords */}
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-bold text-slate-700">Preferred</span>
                                                            <span className="text-[11px] font-mono font-medium text-slate-500">
                                                                {keywordCoverage.preferred.matched.length}/{keywordCoverage.preferred.total} ({keywordCoverage.preferred.score}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all duration-500",
                                                                    keywordCoverage.preferred.score >= 80 ? "bg-blue-500" :
                                                                        keywordCoverage.preferred.score >= 60 ? "bg-blue-400" : "bg-blue-300"
                                                                )}
                                                                style={{ width: `${keywordCoverage.preferred.score}%` }}
                                                            />
                                                        </div>
                                                        {keywordCoverage.preferred.matched.length > 0 && (
                                                            <div className="mt-3">
                                                                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mb-1.5">Matched</span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {keywordCoverage.preferred.matched.map((kw, i) => (
                                                                        <span key={i} className="px-2 py-0.5 text-[10px] bg-blue-50 text-blue-700 rounded-md border border-blue-100 font-medium">{kw}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Gap-Fix Results */}
                                                    {gapFixResults && (gapFixResults.injected.length > 0 || gapFixResults.skipped.length > 0) && (
                                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mt-4">
                                                            <span className="text-[10px] font-bold text-slate-700 block mb-2">Auto-Optimization Results</span>
                                                            {gapFixResults.injected.length > 0 && (
                                                                <div className="mb-2">
                                                                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">✅ Added to Resume</span>
                                                                    <ul className="space-y-1">
                                                                        {gapFixResults.injected.map((item, i) => (
                                                                            <li key={i} className="text-[10px] text-slate-600 pl-2 border-l-2 border-emerald-400">{item}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {gapFixResults.skipped.length > 0 && (
                                                                <div className="mt-2">
                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">⏭️ Skipped (No Context)</span>
                                                                    <ul className="space-y-1">
                                                                        {gapFixResults.skipped.map((item, i) => (
                                                                            <li key={i} className="text-[10px] text-slate-400 pl-2 border-l-2 border-slate-200">{item}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
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

            {/* Show Analysis button when sidebar is hidden */}
            {((changes.length > 0) || keywordCoverage) && !activeAnalysisTab && tailoredResume && resultViewMode === 'preview' && (
                <>
                    {/* Mobile: Fixed FAB above bottom tab bar */}
                    {mobileTab === 'result' && (
                        <button
                            onClick={() => setActiveAnalysisTab('changes')}
                            className="lg:hidden fixed right-4 bottom-20 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 print:hidden animate-in fade-in slide-in-from-bottom-4"
                        >
                            <LayoutGrid className="h-4 w-4" />
                            <span className="text-xs font-bold">Analysis</span>
                        </button>
                    )}

                    {/* Desktop: Absolute icon button */}
                    <div className="hidden lg:block absolute right-6 top-40 z-10 print:hidden">
                        <button
                            onClick={() => setActiveAnalysisTab('changes')}
                            className="p-3 bg-white border border-slate-200 shadow-lg rounded-xl text-slate-600 hover:shadow-xl hover:text-indigo-600 hover:border-indigo-200 transition-all hover:scale-105 active:scale-95"
                            title="Show AI analysis"
                        >
                            <LayoutGrid className="h-5 w-5" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
