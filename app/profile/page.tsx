'use client';

import { useState, useEffect } from 'react';
import { getProfile, createProfile, updateProfile } from '@/lib/actions';
import { useAIConfig } from '@/app/context/AIConfigContext';
import { useParse } from '@/app/context/ParseContext';
import { toast } from 'sonner';
import { Loader2, Save, Upload, User, Briefcase, GraduationCap, Code, ChevronRight, FileText, Settings, CheckCircle2, AlertCircle, Sparkles, Trash2, Plus, Award, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Flatten categorized skills [{category, items}] into a flat string[] for the textarea editor */
function flattenSkills(skills: any[]): string[] {
    if (!Array.isArray(skills) || skills.length === 0) return [];
    // Already flat strings
    if (typeof skills[0] === 'string') return skills;
    // Categorized: [{category, items}]
    const flat: string[] = [];
    for (const group of skills) {
        if (group.category && Array.isArray(group.items)) {
            flat.push(`--- ${group.category} ---`);
            flat.push(...group.items);
        } else if (typeof group === 'string') {
            flat.push(group);
        }
    }
    return flat;
}

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [resumeText, setResumeText] = useState('');
    const { isParsingGlobal, parsedData, parseResumeGlobal, clearParsedData } = useParse();
    const [isUploading, setIsUploading] = useState(false);

    // Global AI Config
    const { selectedModel, selectedProvider, customModelConfig } = useAIConfig();

    const [activeTab, setActiveTab] = useState('basics');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [showImport, setShowImport] = useState(false);

    useEffect(() => {
        loadProfile();
        // Removed local storage model loading as it is handled by context
    }, []);

    useEffect(() => {
        // Only apply parsed data after the initial DB profile has loaded
        if (!loading && parsedData) {
            setProfile((prev: any) => ({
                ...prev,
                ...parsedData.basics,
                experience: parsedData.experience || [],
                education: parsedData.education || [],
                // Flatten categorized skills into strings for editor compatibility
                skills: flattenSkills(parsedData.skills || []),
                projects: parsedData.projects || [],
                certifications: parsedData.certifications || [],
            }));
            clearParsedData();
            // Show a small notification to inform user that parsed data was applied
            toast.success('Applied parsed data to your profile!');
        }
    }, [parsedData, clearParsedData, loading]);

    const loadProfile = async () => {
        try {
            const data = await getProfile();
            if (data) {
                setProfile({
                    ...data,
                    experience: data.experience ? JSON.parse(data.experience) : [],
                    education: data.education ? JSON.parse(data.education) : [],
                    skills: data.skills ? JSON.parse(data.skills) : [],
                    projects: data.projects ? JSON.parse(data.projects) : [],
                    certifications: data.certifications ? JSON.parse(data.certifications) : [],
                });
            } else {
                setProfile({
                    name: '', email: '', phone: '', linkedin: '', website: '', summary: '',
                    experience: [], education: [], skills: [], projects: [], certifications: []
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.text) {
                setResumeText(data.text);
            } else {
                alert('Failed to extract text from file');
            }
        } catch (err) {
            console.error('Upload failed', err);
            alert('Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleParseResume = async () => {
        if (!resumeText) return;
        await parseResumeGlobal(resumeText);
    };

    const handleSave = async () => {
        setSaveStatus('saving');
        try {
            const payload = {
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                linkedin: profile.linkedin,
                website: profile.website,
                summary: profile.summary,
                experience: JSON.stringify(profile.experience),
                education: JSON.stringify(profile.education),
                skills: JSON.stringify(profile.skills),
                projects: JSON.stringify(profile.projects),
                certifications: JSON.stringify(profile.certifications),
            };

            if (profile.id) {
                await updateProfile(profile.id, payload);
            } else {
                const newProfile = await createProfile(payload);
                setProfile((prev: any) => ({ ...prev, id: newProfile.id }));
            }
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err) {
            console.error('Save failed', err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    if (loading && !profile) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
                    <p className="text-gray-500 font-medium">Loading your profile...</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'basics', label: 'Basics', icon: User },
        { id: 'experience', label: 'Experience', icon: Briefcase },
        { id: 'education', label: 'Education', icon: GraduationCap },
        { id: 'skills', label: 'Skills', icon: Code },
        { id: 'projects', label: 'Projects', icon: LayoutGrid },
        { id: 'certifications', label: 'Certifications', icon: Award },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 pb-24 md:pb-16 font-sans text-slate-900 animate-in fade-in duration-500">
            {/* Top Bar */}
            <header className="bg-white/80 border-b border-slate-200/60 sticky top-14 z-30 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
                <div className="w-full px-4 sm:px-8 lg:px-12 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link href="/" className="group flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors shrink-0">
                            <ChevronRight className="h-4 w-4 rotate-180 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </Link>
                        <div className="h-4 w-px bg-slate-200" />
                        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate flex items-center gap-2">
                            <User className="h-4 w-4 text-indigo-500" />
                            Master Profile
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowImport(!showImport)}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all border",
                                showImport
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                            )}
                        >
                            <Upload className="h-4 w-4" />
                            <span className="hidden sm:inline">Import Resume</span>
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={saveStatus === 'saving'}
                            className={cn(
                                "inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-md transition-all focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shrink-0 transform active:scale-95",
                                saveStatus === 'saved' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" :
                                    saveStatus === 'error' ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" :
                                        "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-500/25"
                            )}
                        >
                            {saveStatus === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> :
                                    saveStatus === 'error' ? <AlertCircle className="h-4 w-4" /> :
                                        <Save className="h-4 w-4" />}
                            <span>
                                {saveStatus === 'saving' ? 'Saving...' :
                                    saveStatus === 'saved' ? 'Saved!' :
                                        saveStatus === 'error' ? 'Error' : 'Save'}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Import Panel — Collapsible */}
            {showImport && (
                <div className="w-full bg-white border-b border-slate-200/60 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="w-full px-4 sm:px-8 lg:px-12 py-6">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center gap-2 mb-5">
                                <FileText className="h-5 w-5 text-indigo-500" />
                                <h2 className="font-bold text-slate-900">Import Resume</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Upload */}
                                <div className="relative group">
                                    <input
                                        type="file"
                                        accept=".pdf,.txt"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className={cn(
                                        "border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300",
                                        isUploading
                                            ? "border-indigo-400 bg-indigo-50/50"
                                            : "border-slate-200 group-hover:border-indigo-400 group-hover:bg-indigo-50/10"
                                    )}>
                                        <div className={cn(
                                            "mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all",
                                            isUploading ? "bg-white text-indigo-600" : "bg-indigo-50 text-indigo-500 group-hover:scale-110"
                                        )}>
                                            <Upload className="h-5 w-5" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-700">
                                            {isUploading ? 'Extracting text...' : 'Upload PDF or TXT'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1">Max 5MB • Drag or click</p>
                                    </div>
                                </div>

                                {/* Paste */}
                                <div className="space-y-3">
                                    <textarea
                                        className="w-full h-32 p-4 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition-all placeholder:text-slate-400"
                                        placeholder="Or paste your full resume text here..."
                                        value={resumeText}
                                        onChange={e => setResumeText(e.target.value)}
                                    />
                                    <button
                                        onClick={handleParseResume}
                                        disabled={isParsingGlobal || !resumeText}
                                        className="w-full flex justify-center items-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                                    >
                                        {isParsingGlobal ? <Loader2 className="animate-spin h-4 w-4" /> :
                                            <>
                                                <Sparkles className="h-4 w-4 text-indigo-300" />
                                                Auto-Parse with AI
                                            </>
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Tab Navigation */}
            <div className={cn(
                "sticky z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/40",
                showImport ? "top-[7rem]" : "top-[7rem]"
            )}>
                <div className="w-full px-4 sm:px-8 lg:px-12">
                    {/* Mobile: Scrollable Tabs */}
                    <div className="sm:hidden flex gap-1 overflow-x-auto py-2 no-scrollbar -mx-1 px-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                                    activeTab === tab.id
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                        : "bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                                )}
                            >
                                <tab.icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {/* Desktop: Full-width Pill Tabs */}
                    <div className="hidden sm:flex items-center gap-1 py-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap",
                                    activeTab === tab.id
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                )}
                            >
                                <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-indigo-200" : "text-slate-400")} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content — Full Width */}
            <main className="w-full px-4 sm:px-8 lg:px-12 py-8">
                <div className="w-full max-w-6xl mx-auto">
                    {/* Section Header */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                            {tabs.find(t => t.id === activeTab)?.label}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {activeTab === 'basics' && "Your personal information and contact details."}
                            {activeTab === 'experience' && "Your professional work history and client engagements."}
                            {activeTab === 'education' && "Academic background and qualifications."}
                            {activeTab === 'skills' && "Technical and soft skills — one per line."}
                            {activeTab === 'projects' && "Notable projects, open-source contributions, or portfolio pieces."}
                            {activeTab === 'certifications' && "Professional certifications and licenses."}
                        </p>
                    </div>

                    {/* ===== BASICS ===== */}
                    {activeTab === 'basics' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6">Contact Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-600">Full Name</label>
                                        <input
                                            type="text"
                                            className="w-full text-sm p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                            value={profile.name || ''}
                                            onChange={e => setProfile({ ...profile, name: e.target.value })}
                                            placeholder="e.g. Jane Doe"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-600">Email Address</label>
                                        <input
                                            type="email"
                                            className="w-full text-sm p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                            value={profile.email || ''}
                                            onChange={e => setProfile({ ...profile, email: e.target.value })}
                                            placeholder="e.g. jane@example.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-600">Phone Number</label>
                                        <input
                                            type="tel"
                                            className="w-full text-sm p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                            value={profile.phone || ''}
                                            onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                            placeholder="e.g. +1 (555) 000-0000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-600">LinkedIn URL</label>
                                        <input
                                            type="url"
                                            className="w-full text-sm p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                            value={profile.linkedin || ''}
                                            onChange={e => setProfile({ ...profile, linkedin: e.target.value })}
                                            placeholder="https://linkedin.com/in/..."
                                        />
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="block text-sm font-medium text-slate-600">Website / Portfolio</label>
                                        <input
                                            type="url"
                                            className="w-full text-sm p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                            value={profile.website || ''}
                                            onChange={e => setProfile({ ...profile, website: e.target.value })}
                                            placeholder="https://janedoe.com"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6">Professional Summary</h3>
                                <textarea
                                    className="w-full text-sm h-44 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-y transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white leading-relaxed"
                                    value={profile.summary || ''}
                                    onChange={e => setProfile({ ...profile, summary: e.target.value })}
                                    placeholder="Brief overview of your professional background and key achievements..."
                                />
                            </div>
                        </div>
                    )}

                    {/* ===== EXPERIENCE ===== */}
                    {activeTab === 'experience' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
                            {profile.experience.map((exp: any, i: number) => (
                                <div key={i} className="group bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-200/60 transition-all">
                                    {/* Experience Header */}
                                    <div className="p-6 sm:p-8 relative">
                                        <button
                                            onClick={() => {
                                                const newExp = [...profile.experience];
                                                newExp.splice(i, 1);
                                                setProfile({ ...profile, experience: newExp });
                                            }}
                                            className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100 opacity-100"
                                            title="Remove Position"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pr-10">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Job Title</label>
                                                <input
                                                    className="w-full text-lg font-bold text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 transition-all"
                                                    value={exp.role}
                                                    placeholder="e.g. Senior Software Engineer"
                                                    onChange={e => {
                                                        const newExp = [...profile.experience];
                                                        newExp[i].role = e.target.value;
                                                        setProfile({ ...profile, experience: newExp });
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Company</label>
                                                <input
                                                    className="w-full text-lg font-bold text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 transition-all"
                                                    value={exp.company}
                                                    placeholder="e.g. Google"
                                                    onChange={e => {
                                                        const newExp = [...profile.experience];
                                                        newExp[i].company = e.target.value;
                                                        setProfile({ ...profile, experience: newExp });
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dates</label>
                                                <input
                                                    className="w-full max-w-sm text-sm font-medium text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-400 transition-all"
                                                    value={exp.dates}
                                                    placeholder="e.g. Jan 2020 - Present"
                                                    onChange={e => {
                                                        const newExp = [...profile.experience];
                                                        newExp[i].dates = e.target.value;
                                                        setProfile({ ...profile, experience: newExp });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* General Description */}
                                    <div className="border-t border-slate-100 px-6 sm:px-8 py-5">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">General Description</label>
                                        <textarea
                                            className="w-full text-sm leading-relaxed text-slate-700 bg-slate-50/30 border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-y transition-all placeholder:text-slate-400 min-h-[120px]"
                                            value={exp.description}
                                            placeholder="• General responsibilities and achievements (not tied to a specific client)..."
                                            onChange={e => {
                                                const newExp = [...profile.experience];
                                                newExp[i].description = e.target.value;
                                                setProfile({ ...profile, experience: newExp });
                                            }}
                                        />
                                    </div>

                                    {/* Clients Section */}
                                    <div className="border-t border-slate-100 bg-slate-50/20">
                                        {(exp.clients || []).length > 0 && (
                                            <div className="px-6 sm:px-8 pt-6 pb-3 flex items-center gap-2">
                                                <div className="h-6 w-1 bg-indigo-500 rounded-full"></div>
                                                <h4 className="text-sm font-bold text-slate-800 tracking-wide">Clients & Projects</h4>
                                            </div>
                                        )}

                                        <div className="space-y-4 px-6 sm:px-8 pb-6">
                                            {(exp.clients || []).map((client: any, ci: number) => (
                                                <div key={ci} className="relative bg-white border border-indigo-100/60 shadow-sm rounded-xl p-5 sm:p-6 space-y-5 group/client hover:border-indigo-200 transition-all">
                                                    <button
                                                        onClick={() => {
                                                            const newExp = [...profile.experience];
                                                            const newClients = [...(newExp[i].clients || [])];
                                                            newClients.splice(ci, 1);
                                                            newExp[i].clients = newClients;
                                                            setProfile({ ...profile, experience: newExp });
                                                        }}
                                                        className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/client:opacity-100"
                                                        title="Remove Client"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pr-8">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Client Name</label>
                                                            <input
                                                                className="w-full text-sm font-semibold text-slate-800 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-400 transition-all"
                                                                value={client.name || ''}
                                                                placeholder="e.g. PharmaCorp"
                                                                onChange={e => {
                                                                    const newExp = [...profile.experience];
                                                                    const newClients = [...(newExp[i].clients || [])];
                                                                    newClients[ci] = { ...newClients[ci], name: e.target.value };
                                                                    newExp[i].clients = newClients;
                                                                    setProfile({ ...profile, experience: newExp });
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Domain / Industry</label>
                                                            <input
                                                                className="w-full text-sm font-medium text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-400 transition-all"
                                                                value={client.domain || ''}
                                                                placeholder="e.g. Healthcare"
                                                                onChange={e => {
                                                                    const newExp = [...profile.experience];
                                                                    const newClients = [...(newExp[i].clients || [])];
                                                                    newClients[ci] = { ...newClients[ci], domain: e.target.value };
                                                                    newExp[i].clients = newClients;
                                                                    setProfile({ ...profile, experience: newExp });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description</label>
                                                        <textarea
                                                            className="w-full text-sm leading-relaxed text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl p-4 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-y transition-all placeholder:text-slate-400 min-h-[100px]"
                                                            value={client.description || ''}
                                                            placeholder="• Describe specific projects, responsibilities, or achievements for this client..."
                                                            onChange={e => {
                                                                const newExp = [...profile.experience];
                                                                const newClients = [...(newExp[i].clients || [])];
                                                                newClients[ci] = { ...newClients[ci], description: e.target.value };
                                                                newExp[i].clients = newClients;
                                                                setProfile({ ...profile, experience: newExp });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}

                                            <button
                                                onClick={() => {
                                                    const newExp = [...profile.experience];
                                                    const newClients = [...(newExp[i].clients || []), { name: '', domain: '', description: '' }];
                                                    newExp[i].clients = newClients;
                                                    setProfile({ ...profile, experience: newExp });
                                                }}
                                                className="w-full py-3.5 border-2 border-dashed border-indigo-200/60 rounded-xl text-sm font-medium text-indigo-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2"
                                            >
                                                <div className="p-1 rounded bg-indigo-50">
                                                    <Plus className="h-4 w-4" />
                                                </div>
                                                Add Client or Project
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={() => setProfile({ ...profile, experience: [...profile.experience, { role: '', company: '', dates: '', description: '', clients: [], highlights: [] }] })}
                                className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-2 group"
                            >
                                <div className="p-2.5 rounded-full bg-slate-100 group-hover:bg-indigo-100 transition-colors">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <span>Add New Position</span>
                            </button>
                        </div>
                    )}

                    {/* ===== SKILLS ===== */}
                    {activeTab === 'skills' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex gap-3 text-indigo-700 text-sm">
                                <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                                <p>Enter your skills one per line. Use <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs font-mono">--- Category ---</code> syntax to group them.</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8">
                                <textarea
                                    className="w-full min-h-[400px] p-4 border border-slate-200 rounded-xl font-mono text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-y transition-all placeholder:text-slate-400 bg-slate-50/30 focus:bg-white"
                                    value={Array.isArray(profile.skills) ? profile.skills.join('\n') : profile.skills}
                                    onChange={e => setProfile({ ...profile, skills: e.target.value.split('\n') })}
                                    placeholder={"--- Programming Languages ---\nJava\nPython\nTypeScript\n\n--- Frameworks ---\nReact\nNext.js\nSpring Boot"}
                                />
                            </div>
                        </div>
                    )}

                    {/* ===== EDUCATION ===== */}
                    {activeTab === 'education' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
                            {profile.education.map((edu: any, i: number) => (
                                <div key={i} className="group bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 hover:shadow-md hover:border-indigo-200/60 transition-all relative">
                                    <button
                                        onClick={() => {
                                            const newEdu = [...profile.education];
                                            newEdu.splice(i, 1);
                                            setProfile({ ...profile, education: newEdu });
                                        }}
                                        className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all"
                                        title="Remove Education"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pr-10">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Institution</label>
                                            <input
                                                className="w-full text-sm font-bold bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 text-slate-900 transition-all"
                                                value={edu.institution || ''}
                                                placeholder="University Name"
                                                onChange={e => {
                                                    const newEdu = [...profile.education];
                                                    newEdu[i].institution = e.target.value;
                                                    setProfile({ ...profile, education: newEdu });
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Degree</label>
                                            <input
                                                className="w-full text-sm font-bold bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 text-slate-900 transition-all"
                                                value={edu.degree || ''}
                                                placeholder="Degree (e.g. BS CS)"
                                                onChange={e => {
                                                    const newEdu = [...profile.education];
                                                    newEdu[i].degree = e.target.value;
                                                    setProfile({ ...profile, education: newEdu });
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dates</label>
                                            <input
                                                className="w-full max-w-sm text-sm text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 transition-all"
                                                value={edu.dates || ''}
                                                placeholder="e.g. 2018 - 2022"
                                                onChange={e => {
                                                    const newEdu = [...profile.education];
                                                    newEdu[i].dates = e.target.value;
                                                    setProfile({ ...profile, education: newEdu });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={() => setProfile({ ...profile, education: [...profile.education, { institution: '', degree: '', dates: '' }] })}
                                className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 group"
                            >
                                <div className="p-1.5 rounded bg-slate-100 group-hover:bg-indigo-100"><Plus className="h-4 w-4" /></div>
                                Add New Education
                            </button>
                        </div>
                    )}

                    {/* ===== PROJECTS ===== */}
                    {activeTab === 'projects' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
                            {profile.projects.map((proj: any, i: number) => (
                                <div key={i} className="group bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 hover:shadow-md hover:border-indigo-200/60 transition-all relative">
                                    <button
                                        onClick={() => {
                                            const newProj = [...profile.projects];
                                            newProj.splice(i, 1);
                                            setProfile({ ...profile, projects: newProj });
                                        }}
                                        className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all"
                                        title="Remove Project"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>

                                    <div className="space-y-5 pr-10">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Project Name</label>
                                            <input
                                                className="w-full text-sm font-bold bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 text-slate-900 transition-all"
                                                value={proj.name || ''}
                                                placeholder="e.g. E-Commerce Platform"
                                                onChange={e => {
                                                    const newProj = [...profile.projects];
                                                    newProj[i].name = e.target.value;
                                                    setProfile({ ...profile, projects: newProj });
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Description</label>
                                            <textarea
                                                className="w-full text-sm leading-relaxed text-slate-700 bg-slate-50/50 border border-slate-200 rounded-xl p-4 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-400 resize-y min-h-[100px] transition-all"
                                                value={proj.description || ''}
                                                placeholder="Describe the project, technologies used, and your role..."
                                                onChange={e => {
                                                    const newProj = [...profile.projects];
                                                    newProj[i].description = e.target.value;
                                                    setProfile({ ...profile, projects: newProj });
                                                }}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">URL / Repository Link</label>
                                            <input
                                                className="w-full text-sm text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 transition-all"
                                                value={proj.link || ''}
                                                placeholder="https://github.com/..."
                                                onChange={e => {
                                                    const newProj = [...profile.projects];
                                                    newProj[i].link = e.target.value;
                                                    setProfile({ ...profile, projects: newProj });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={() => setProfile({ ...profile, projects: [...profile.projects, { name: '', description: '', link: '' }] })}
                                className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 group"
                            >
                                <div className="p-1.5 rounded bg-slate-100 group-hover:bg-indigo-100"><Plus className="h-4 w-4" /></div>
                                Add New Project
                            </button>
                        </div>
                    )}

                    {/* ===== CERTIFICATIONS ===== */}
                    {activeTab === 'certifications' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
                            {profile.certifications.map((cert: any, i: number) => (
                                <div key={i} className="group bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8 hover:shadow-md hover:border-indigo-200/60 transition-all relative">
                                    <button
                                        onClick={() => {
                                            const newCerts = [...profile.certifications];
                                            newCerts.splice(i, 1);
                                            setProfile({ ...profile, certifications: newCerts });
                                        }}
                                        className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all"
                                        title="Remove Certification"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>

                                    <div className="space-y-5 pr-10">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Certification Name</label>
                                            <input
                                                className="w-full text-sm font-bold bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 text-slate-900 transition-all"
                                                value={cert.name || ''}
                                                placeholder="e.g. AWS Certified Solutions Architect"
                                                onChange={e => {
                                                    const newCerts = [...profile.certifications];
                                                    newCerts[i].name = e.target.value;
                                                    setProfile({ ...profile, certifications: newCerts });
                                                }}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Issuer</label>
                                                <input
                                                    className="w-full text-sm text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 transition-all"
                                                    value={cert.issuer || ''}
                                                    placeholder="e.g. Amazon Web Services"
                                                    onChange={e => {
                                                        const newCerts = [...profile.certifications];
                                                        newCerts[i].issuer = e.target.value;
                                                        setProfile({ ...profile, certifications: newCerts });
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Date</label>
                                                <input
                                                    className="w-full text-sm text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 transition-all"
                                                    value={cert.date || ''}
                                                    placeholder="e.g. 2023"
                                                    onChange={e => {
                                                        const newCerts = [...profile.certifications];
                                                        newCerts[i].date = e.target.value;
                                                        setProfile({ ...profile, certifications: newCerts });
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">URL (Optional)</label>
                                            <input
                                                className="w-full text-sm text-slate-600 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-300 transition-all"
                                                value={cert.url || ''}
                                                placeholder="https://..."
                                                onChange={e => {
                                                    const newCerts = [...profile.certifications];
                                                    newCerts[i].url = e.target.value;
                                                    setProfile({ ...profile, certifications: newCerts });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={() => setProfile({ ...profile, certifications: [...profile.certifications, { name: '', issuer: '', date: '', url: '' }] })}
                                className="w-full py-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-semibold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 group"
                            >
                                <div className="p-1.5 rounded bg-slate-100 group-hover:bg-indigo-100"><Plus className="h-4 w-4" /></div>
                                Add New Certification
                            </button>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

