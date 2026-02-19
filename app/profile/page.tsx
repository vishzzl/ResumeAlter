'use client';

import { useState, useEffect } from 'react';
import { getProfile, createProfile, updateProfile } from '@/lib/actions';
import { useAIConfig } from '@/app/context/AIConfigContext';
import { Loader2, Save, Upload, User, Briefcase, GraduationCap, Code, ChevronRight, FileText, Settings, CheckCircle2, AlertCircle, Sparkles, Trash2, Plus, Award } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';


export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [resumeText, setResumeText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Global AI Config
    const { selectedModel, selectedProvider, customModelConfig } = useAIConfig();

    const [activeTab, setActiveTab] = useState('basics');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    useEffect(() => {
        loadProfile();
        // Removed local storage model loading as it is handled by context
    }, []);

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
        setIsParsing(true);
        try {
            const res = await fetch('/api/profile/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // Use selectedModel from context. modelProvider defaults to 'gemini' in backend if key is present.
                body: JSON.stringify({
                    resumeText,
                    modelProvider: selectedProvider,
                    modelName: selectedModel,
                    customConfig: customModelConfig
                }),
            });
            const data = await res.json();
            if (res.ok && data.basics) {
                setProfile({
                    ...profile,
                    ...data.basics,
                    experience: data.experience || [],
                    education: data.education || [],
                    skills: data.skills || [],
                    projects: data.projects || [],
                    certifications: data.certifications || [],
                });
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err: any) {
            console.error('Parsing failed', err);
            alert(`Failed to parse resume: ${err.message}`);
        } finally {
            setIsParsing(false);
        }
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
        { id: 'certifications', label: 'Certifications', icon: Award },
    ];

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20 md:pb-12 font-sans text-slate-900 animate-in fade-in duration-500">
            {/* Header — Desktop Only (sticky sub-header) */}
            <header className="hidden lg:flex bg-white/80 border-b border-indigo-100/50 sticky top-14 z-30 px-6 lg:px-8 h-14 items-center justify-between backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                    <Link href="/" className="group flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors shrink-0">
                        <ChevronRight className="h-4 w-4 rotate-180 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        <span>Dashboard</span>
                    </Link>
                    <div className="h-4 w-px bg-slate-200" />
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight truncate flex items-center gap-2">
                        <User className="h-4 w-4 text-indigo-500" />
                        Master Profile
                    </h1>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saveStatus === 'saving'}
                    className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shrink-0 transform active:scale-95",
                        saveStatus === 'saved' ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20" :
                            saveStatus === 'error' ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" :
                                "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    )}
                >
                    {saveStatus === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                        saveStatus === 'saved' ? <CheckCircle2 className="h-4 w-4" /> :
                            saveStatus === 'error' ? <AlertCircle className="h-4 w-4" /> :
                                <Save className="h-4 w-4" />}
                    <span>
                        {saveStatus === 'saving' ? 'Saving...' :
                            saveStatus === 'saved' ? 'Saved' :
                                saveStatus === 'error' ? 'Error' : 'Save Changes'}
                    </span>
                </button>
            </header>

            <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-8">
                {/* Mobile Inline Header — replaces the sticky sub-header */}
                <div className="lg:hidden flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <Link href="/" className="p-1.5 -ml-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                            <ChevronRight className="h-4 w-4 rotate-180" />
                        </Link>
                        <h1 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-indigo-500" />
                            Master Profile
                        </h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saveStatus === 'saving'}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all active:scale-95",
                            saveStatus === 'saved' ? "bg-emerald-500" :
                                saveStatus === 'error' ? "bg-red-500" :
                                    "bg-slate-900"
                        )}
                    >
                        {saveStatus === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                            saveStatus === 'saved' ? <CheckCircle2 className="h-3 w-3" /> :
                                saveStatus === 'error' ? <AlertCircle className="h-3 w-3" /> :
                                    <Save className="h-3 w-3" />}
                        {saveStatus === 'saving' ? 'Saving' :
                            saveStatus === 'saved' ? 'Saved' :
                                saveStatus === 'error' ? 'Error' : 'Save'}
                    </button>
                </div>

                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-5 sm:gap-8 items-start">

                    {/* Left Column (Bottom on Mobile): Import & Settings */}
                    <div className="lg:col-span-4 space-y-6 w-full">
                        {/* Import Card */}
                        <div className="glass-card bg-white/60 overflow-hidden">
                            <div className="p-4 border-b border-indigo-50/50 bg-indigo-50/30 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-indigo-500" />
                                <h2 className="font-semibold text-slate-900 text-sm">Resume Source</h2>
                            </div>
                            <div className="p-4 sm:p-5 space-y-4 sm:space-y-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 sm:mb-3">
                                        Import from File
                                    </label>
                                    <div className="relative group">
                                        <input
                                            type="file"
                                            accept=".pdf,.txt"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div className={cn(
                                            "border-2 border-dashed rounded-xl p-4 sm:p-6 text-center transition-all duration-300",
                                            isUploading
                                                ? "border-indigo-400 bg-indigo-50/50"
                                                : "border-slate-200 group-hover:border-indigo-400 group-hover:bg-indigo-50/10"
                                        )}>
                                            <div className={cn(
                                                "mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 sm:mb-3 transition-colors",
                                                isUploading ? "bg-white text-indigo-600" : "bg-indigo-50 text-indigo-500 group-hover:scale-110"
                                            )}>
                                                <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                                            </div>
                                            <p className="text-xs sm:text-sm font-medium text-slate-700">
                                                {isUploading ? 'Extracting text...' : 'Upload PDF or TXT'}
                                            </p>
                                            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">Max 5MB</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-slate-100" />
                                    <div className="relative flex justify-center">
                                        <span className="bg-white/50 backdrop-blur-sm px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">or paste text</span>
                                    </div>
                                </div>

                                <div>
                                    <textarea
                                        className="w-full h-32 sm:h-48 p-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition-all placeholder:text-slate-400 custom-scrollbar"
                                        placeholder="Paste your full resume text here..."
                                        value={resumeText}
                                        onChange={e => setResumeText(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={handleParseResume}
                                    disabled={isParsing || !resumeText}
                                    className="w-full flex justify-center items-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98]"
                                >
                                    {isParsing ? <Loader2 className="animate-spin h-4 w-4" /> :
                                        <>
                                            <Sparkles className="h-4 w-4 text-indigo-300" />
                                            Auto-Parse with AI
                                        </>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Top on Mobile): Editor */}
                    <div className="lg:col-span-8 flex flex-col gap-6 w-full">
                        {/* Sticky Tabs Navigation */}
                        <div className="sticky top-12 lg:top-[7.5rem] z-20 -mx-3 px-3 sm:mx-0 sm:px-0 bg-gradient-to-b from-slate-50/90 via-slate-50/90 to-transparent pb-3 sm:pb-4 pt-1 sm:pt-2 supports-[backdrop-filter]:from-slate-50/60 supports-[backdrop-filter]:via-slate-50/60 backdrop-blur-sm">
                            {/* Mobile: Compact Grid Tabs */}
                            <div className="sm:hidden bg-slate-100/80 rounded-xl p-1">
                                <div className="grid grid-cols-4 gap-1">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                setActiveTab(tab.id);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className={cn(
                                                "flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-all duration-200 min-w-0",
                                                activeTab === tab.id
                                                    ? "bg-white text-indigo-700 shadow-sm"
                                                    : "text-slate-500 hover:text-slate-700"
                                            )}
                                        >
                                            <tab.icon className={cn("h-4 w-4 shrink-0", activeTab === tab.id ? "text-indigo-600" : "text-slate-400")} />
                                            <span className="text-[10px] font-semibold truncate w-full text-center leading-tight">{tab.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Desktop: Pill Tabs */}
                            <div className="hidden sm:inline-flex bg-white/80 backdrop-blur-md rounded-2xl border border-indigo-100/50 p-1.5 shadow-sm w-full">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
                                            activeTab === tab.id
                                                ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-indigo-600" : "text-slate-400")} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Editor Content */}
                        <div className="glass-card-solid bg-white rounded-xl sm:rounded-2xl border border-slate-200/60 shadow-sm min-h-[400px] sm:min-h-[600px] flex flex-col overflow-hidden">
                            {/* Tab Header */}
                            <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-slate-100 bg-slate-50/30">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                                    {tabs.find(t => t.id === activeTab)?.label}
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                                    {activeTab === 'basics' && "Personal information and contact details."}
                                    {activeTab === 'experience' && "Your professional work history."}
                                    {activeTab === 'education' && "Academic background and qualifications."}
                                    {activeTab === 'skills' && "Technical and soft skills."}
                                    {activeTab === 'certifications' && "Professional certifications and licenses."}
                                </p>
                            </div>

                            <div className="p-3 sm:p-7 flex-1">
                                {activeTab === 'basics' && (
                                    <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="block text-sm font-medium text-slate-700">Full Name</label>
                                                <input
                                                    type="text"
                                                    className="w-full text-base md:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                                    value={profile.name || ''}
                                                    onChange={e => setProfile({ ...profile, name: e.target.value })}
                                                    placeholder="e.g. Jane Doe"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-sm font-medium text-slate-700">Email Address</label>
                                                <input
                                                    type="email"
                                                    className="w-full text-base md:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                                    value={profile.email || ''}
                                                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                                                    placeholder="e.g. jane@example.com"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-sm font-medium text-slate-700">Phone Number</label>
                                                <input
                                                    type="tel"
                                                    className="w-full text-base md:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                                    value={profile.phone || ''}
                                                    onChange={e => setProfile({ ...profile, phone: e.target.value })}
                                                    placeholder="e.g. +1 (555) 000-0000"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="block text-sm font-medium text-slate-700">LinkedIn URL</label>
                                                <input
                                                    type="url"
                                                    className="w-full text-base md:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                                    value={profile.linkedin || ''}
                                                    onChange={e => setProfile({ ...profile, linkedin: e.target.value })}
                                                    placeholder="https://linkedin.com/in/..."
                                                />
                                            </div>
                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="block text-sm font-medium text-slate-700">Website / Portfolio</label>
                                                <input
                                                    type="url"
                                                    className="w-full text-base md:text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                                    value={profile.website || ''}
                                                    onChange={e => setProfile({ ...profile, website: e.target.value })}
                                                    placeholder="https://janedoe.com"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 pt-2">
                                            <label className="block text-sm font-medium text-slate-700">Professional Summary</label>
                                            <textarea
                                                className="w-full text-base md:text-sm h-40 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-y transition-all placeholder:text-slate-400 bg-slate-50/50 focus:bg-white leading-relaxed"
                                                value={profile.summary || ''}
                                                onChange={e => setProfile({ ...profile, summary: e.target.value })}
                                                placeholder="Brief overview of your professional background and key achievements..."
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'experience' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        {profile.experience.map((exp: any, i: number) => (
                                            <div key={i} className="group relative bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden hover:border-indigo-200">

                                                {/* Card Header */}
                                                <div className="p-3 sm:p-5 border-b border-slate-100 bg-white relative">
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-start justify-between pr-8">
                                                            <div className="flex-1 space-y-1">
                                                                <input
                                                                    className="w-full text-base sm:text-lg font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 focus:ring-0 outline-none placeholder:text-slate-300 transition-all px-0 py-0.5"
                                                                    value={exp.role}
                                                                    placeholder="Job Title"
                                                                    onChange={e => {
                                                                        const newExp = [...profile.experience];
                                                                        newExp[i].role = e.target.value;
                                                                        setProfile({ ...profile, experience: newExp });
                                                                    }}
                                                                />
                                                                <div className="flex items-center gap-2 text-slate-600">
                                                                    <Briefcase className="h-4 w-4 text-indigo-400" />
                                                                    <input
                                                                        className="text-sm font-medium bg-transparent border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 focus:ring-0 outline-none placeholder:text-slate-300 transition-all w-full max-w-sm px-0 py-0.5"
                                                                        value={exp.company}
                                                                        placeholder="Company Name"
                                                                        onChange={e => {
                                                                            const newExp = [...profile.experience];
                                                                            newExp[i].company = e.target.value;
                                                                            setProfile({ ...profile, experience: newExp });
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 pt-1">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded">Dates</span>
                                                            <input
                                                                className="text-xs sm:text-sm font-medium text-slate-600 bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none placeholder:text-slate-400 w-full max-w-xs transition-all"
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

                                                    <button
                                                        onClick={() => {
                                                            const newExp = [...profile.experience];
                                                            newExp.splice(i, 1);
                                                            setProfile({ ...profile, experience: newExp });
                                                        }}
                                                        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100 opacity-100"
                                                        title="Remove Position"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>

                                                {/* Card Body */}
                                                <div className="p-0 bg-slate-50/30">
                                                    <textarea
                                                        className="w-full text-base md:text-sm leading-relaxed text-slate-700 bg-transparent p-3 sm:p-5 border-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/10 outline-none resize-y transition-all placeholder:text-slate-400 min-h-[120px] sm:min-h-[160px]"
                                                        value={exp.description}
                                                        placeholder="• Describe your key responsibilities and achievements..."
                                                        onChange={e => {
                                                            const newExp = [...profile.experience];
                                                            newExp[i].description = e.target.value;
                                                            setProfile({ ...profile, experience: newExp });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            onClick={() => setProfile({ ...profile, experience: [...profile.experience, { role: '', company: '', dates: '', description: '', highlights: [] }] })}
                                            className="w-full py-4 sm:py-6 border-2 border-dashed border-slate-200 rounded-xl sm:rounded-2xl text-slate-500 font-medium hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-2 group"
                                        >
                                            <div className="p-2.5 rounded-full bg-slate-100 group-hover:bg-indigo-100 transition-colors">
                                                <Plus className="h-5 w-5" />
                                            </div>
                                            <span>Add New Position</span>
                                        </button>
                                    </div>
                                )}

                                {activeTab === 'skills' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 h-full flex flex-col">
                                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-700 text-sm">
                                            <div className="mt-0.5"><Sparkles className="h-4 w-4" /></div>
                                            <p>Enter your skills one per line. The AI uses these to match keywords in job descriptions.</p>
                                        </div>
                                        <textarea
                                            className="w-full flex-1 min-h-[250px] sm:min-h-[400px] p-3 sm:p-5 border border-slate-200 rounded-xl font-mono text-base md:text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-slate-400 bg-slate-50/30 focus:bg-white"
                                            value={Array.isArray(profile.skills) ? profile.skills.join('\n') : profile.skills}
                                            onChange={e => setProfile({ ...profile, skills: e.target.value.split('\n') })}
                                            placeholder="Java&#10;Python&#10;React&#10;Project Management&#10;..."
                                        />
                                    </div>
                                )}

                                {activeTab === 'education' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        {profile.education.map((edu: any, i: number) => (
                                            <div key={i} className="group relative p-4 sm:p-6 border border-slate-200 rounded-xl bg-slate-50/30 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all">
                                                <button
                                                    onClick={() => {
                                                        const newEdu = [...profile.education];
                                                        newEdu.splice(i, 1);
                                                        setProfile({ ...profile, education: newEdu });
                                                    }}
                                                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all"
                                                    title="Remove Education"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-5 mb-3 sm:mb-5">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Institution</label>
                                                        <input
                                                            className="w-full text-base font-bold bg-transparent border-b border-slate-200 hover:border-indigo-300 focus:border-indigo-500 outline-none placeholder:text-slate-300 text-slate-900 transition-colors pb-1"
                                                            value={edu.institution || ''}
                                                            placeholder="University Name"
                                                            onChange={e => {
                                                                const newEdu = [...profile.education];
                                                                newEdu[i].institution = e.target.value;
                                                                setProfile({ ...profile, education: newEdu });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Degree</label>
                                                        <input
                                                            className="w-full text-base font-bold bg-transparent border-b border-slate-200 hover:border-indigo-300 focus:border-indigo-500 outline-none placeholder:text-slate-300 text-slate-900 transition-colors pb-1"
                                                            value={edu.degree || ''}
                                                            placeholder="Degree (e.g. BS CS)"
                                                            onChange={e => {
                                                                const newEdu = [...profile.education];
                                                                newEdu[i].degree = e.target.value;
                                                                setProfile({ ...profile, education: newEdu });
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dates</label>
                                                    <input
                                                        className="w-full text-sm text-slate-600 bg-transparent border-b border-slate-200 hover:border-indigo-300 focus:border-indigo-500 outline-none placeholder:text-slate-300 pb-1"
                                                        value={edu.dates || ''}
                                                        placeholder="Dates Attended (e.g. 2018 - 2022)"
                                                        onChange={e => {
                                                            const newEdu = [...profile.education];
                                                            newEdu[i].dates = e.target.value;
                                                            setProfile({ ...profile, education: newEdu });
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <button
                                            onClick={() => setProfile({ ...profile, education: [...profile.education, { institution: '', degree: '', dates: '' }] })}
                                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-medium hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <div className="p-1.5 rounded bg-slate-100 group-hover:bg-indigo-100"><Plus className="h-4 w-4" /></div>
                                            Add New Education
                                        </button>
                                    </div>
                                )}

                                {activeTab === 'certifications' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        {profile.certifications.map((cert: any, i: number) => (
                                            <div key={i} className="group relative p-4 sm:p-6 border border-slate-200 rounded-xl bg-slate-50/30 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all">
                                                <button
                                                    onClick={() => {
                                                        const newCerts = [...profile.certifications];
                                                        newCerts.splice(i, 1);
                                                        setProfile({ ...profile, certifications: newCerts });
                                                    }}
                                                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-all"
                                                    title="Remove Certification"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>

                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Certification Name</label>
                                                        <input
                                                            className="w-full text-base font-bold bg-transparent border-b border-slate-200 hover:border-indigo-300 focus:border-indigo-500 outline-none placeholder:text-slate-300 text-slate-900 transition-colors pb-1"
                                                            value={cert.name || ''}
                                                            placeholder="e.g. AWS Certified Solutions Architect"
                                                            onChange={e => {
                                                                const newCerts = [...profile.certifications];
                                                                newCerts[i].name = e.target.value;
                                                                setProfile({ ...profile, certifications: newCerts });
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issuer</label>
                                                            <input
                                                                className="w-full text-sm text-slate-600 bg-transparent border-b border-slate-200 hover:border-indigo-300 focus:border-indigo-500 outline-none placeholder:text-slate-300 pb-1"
                                                                value={cert.issuer || ''}
                                                                placeholder="e.g. Amazon Web Services"
                                                                onChange={e => {
                                                                    const newCerts = [...profile.certifications];
                                                                    newCerts[i].issuer = e.target.value;
                                                                    setProfile({ ...profile, certifications: newCerts });
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</label>
                                                            <input
                                                                className="w-full text-sm text-slate-600 bg-transparent border-b border-slate-200 hover:border-indigo-300 focus:border-indigo-500 outline-none placeholder:text-slate-300 pb-1"
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

                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL (Optional)</label>
                                                        <input
                                                            className="w-full text-sm text-slate-600 bg-transparent border-b border-slate-200 hover:border-indigo-300 focus:border-indigo-500 outline-none placeholder:text-slate-300 pb-1"
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
                                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-medium hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <div className="p-1.5 rounded bg-slate-100 group-hover:bg-indigo-100"><Plus className="h-4 w-4" /></div>
                                            Add New Certification
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

