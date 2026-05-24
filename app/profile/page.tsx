'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type ElementType, type ReactNode } from 'react';
import Link from 'next/link';
import {
    AlertCircle,
    Award,
    BadgeCheck,
    Briefcase,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Code,
    Edit2,
    FileText,
    FolderKanban,
    GraduationCap,
    Globe2,
    LayoutGrid,
    Loader2,
    Mail,
    Phone,
    Plus,
    Save,
    Sparkles,
    Target,
    Trash2,
    Upload,
    User,
    Users2,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAIConfig } from '@/app/context/AIConfigContext';
import { useParse } from '@/app/context/ParseContext';
import { createProfile, deleteProfile, getProfile, getProfiles, updateProfile, getResumeDownloadLink } from '@/lib/actions';
import { cn } from '@/lib/utils';

type TabId = 'basics' | 'experience' | 'skills' | 'education' | 'projects' | 'certifications';

type TabItem = {
    id: TabId;
    label: string;
    description: string;
    icon: ElementType;
};

type SkillGroup = {
    title: string;
    items: string[];
};

const tabs: TabItem[] = [
    { id: 'basics', label: 'Basics', description: 'Identity, contact details, and summary.', icon: User },
    { id: 'experience', label: 'Experience', description: 'Roles, client projects, and measurable work.', icon: Briefcase },
    { id: 'skills', label: 'Skills', description: 'Grouped keywords for resume tailoring.', icon: Code },
    { id: 'education', label: 'Education', description: 'Degrees, schools, and study dates.', icon: GraduationCap },
    { id: 'projects', label: 'Projects', description: 'Portfolio pieces and technical proof.', icon: LayoutGrid },
    { id: 'certifications', label: 'Certifications', description: 'Credentials, issuers, and verification URLs.', icon: Award },
];

const inputClass =
    'min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600 dark:hover:border-slate-700';

const textareaClass =
    'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600 dark:hover:border-slate-700';

const iconButtonClass =
    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100';

/** Flatten categorized skills [{category, items}] into a flat string[] for the textarea editor. */
function flattenSkills(skills: any[]): string[] {
    if (!Array.isArray(skills) || skills.length === 0) return [];
    if (typeof skills[0] === 'string') return skills;

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

function parseArrayField(value: unknown) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || value.trim() === '') return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function cleanLines(value: unknown) {
    const lines = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
    return lines.map((item) => String(item).trim()).filter(Boolean);
}

function isSkillCategory(line: string) {
    return /^---\s*.+?\s*---$/.test(line);
}

function getSkillGroups(skills: unknown): SkillGroup[] {
    const lines = cleanLines(skills);
    const groups: SkillGroup[] = [];
    let current: SkillGroup = { title: 'Core Skills', items: [] };

    for (const line of lines) {
        if (isSkillCategory(line)) {
            if (current.items.length) groups.push(current);
            current = { title: line.replace(/^---\s*/, '').replace(/\s*---$/, ''), items: [] };
            continue;
        }

        current.items.push(line);
    }

    if (current.items.length) groups.push(current);
    return groups;
}

function countSkills(skills: unknown) {
    return cleanLines(skills).filter((line) => !isSkillCategory(line)).length;
}

function Field({
    label,
    icon: Icon,
    children,
    className,
    isMissing,
}: {
    label: string;
    icon?: ElementType;
    children: ReactNode;
    className?: string;
    isMissing?: boolean;
}) {
    return (
        <label className={cn('block min-w-0 space-y-2', className)}>
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
                <span className="truncate">{label}</span>
                {isMissing && (
                    <span className="ml-auto text-[10px] font-semibold text-amber-600 dark:text-amber-500 lowercase tracking-normal shrink-0">
                        empty
                    </span>
                )}
            </span>
            {children}
        </label>
    );
}

function Panel({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950', className)}>
            {children}
        </section>
    );
}

function EmptyState({
    icon: Icon,
    title,
    body,
}: {
    icon: ElementType;
    title: string;
    body: string;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-slate-950 dark:text-indigo-300">
                <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{body}</p>
        </div>
    );
}

function AddButton({
    children,
    onClick,
}: {
    children: ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-bold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-200"
        >
            <Plus className="h-4 w-4" />
            {children}
        </button>
    );
}

function SectionIntro({ tab }: { tab: TabItem }) {
    const Icon = tab.icon;

    return (
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <h2 className="truncate text-lg font-black tracking-tight text-slate-950 dark:text-white">{tab.label}</h2>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{tab.description}</p>
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [resumeText, setResumeText] = useState('');
    const [downloadLink, setDownloadLink] = useState('');
    const { isParsingGlobal, parsedData, parseResumeGlobal, clearParsedData } = useParse();
    const [isUploading, setIsUploading] = useState(false);

    useAIConfig();

    const [activeTab, setActiveTab] = useState<TabId>('basics');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [showImport, setShowImport] = useState(false);
    const [expandedExp, setExpandedExp] = useState<Set<number>>(new Set());
    const [expandedEdu, setExpandedEdu] = useState<Set<number>>(new Set());
    const [expandedProj, setExpandedProj] = useState<Set<number>>(new Set());
    const [expandedCert, setExpandedCert] = useState<Set<number>>(new Set());
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const [profilesList, setProfilesList] = useState<any[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const [cloneFromId, setCloneFromId] = useState<string>('none');
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');

    useEffect(() => {
        loadProfileData();
    }, []);

    useEffect(() => {
        if (!loading && parsedData) {
            setProfile((prev: any) => ({
                ...prev,
                ...parsedData.basics,
                experience: parsedData.experience || [],
                education: parsedData.education || [],
                skills: flattenSkills(parsedData.skills || []),
                projects: parsedData.projects || [],
                certifications: parsedData.certifications || [],
            }));
            clearParsedData();
            toast.success('Applied parsed data to your profile!');
        }
    }, [parsedData, clearParsedData, loading]);

    const loadProfileData = async (profileId?: number) => {
        setLoading(true);
        try {
            const allProfiles = await getProfiles();
            setProfilesList(allProfiles);

            let activeProfile = null;
            if (profileId) {
                activeProfile = allProfiles.find((p: any) => p.id === profileId) || null;
            }
            if (!activeProfile && allProfiles.length > 0) {
                activeProfile = allProfiles[0];
            }

            if (!activeProfile) {
                const defaultProf = await getProfile();
                if (defaultProf) {
                    activeProfile = defaultProf;
                    const updatedProfiles = await getProfiles();
                    setProfilesList(updatedProfiles);
                }
            }

            if (activeProfile) {
                setSelectedProfileId(activeProfile.id);
                setRenameValue(activeProfile.profileName || 'Default Profile');
                setProfile({
                    ...activeProfile,
                    experience: parseArrayField(activeProfile.experience),
                    education: parseArrayField(activeProfile.education),
                    skills: parseArrayField(activeProfile.skills),
                    projects: parseArrayField(activeProfile.projects),
                    certifications: parseArrayField(activeProfile.certifications),
                });
            } else {
                setProfile({
                    profileName: 'Default Profile',
                    name: '',
                    email: '',
                    phone: '',
                    linkedin: '',
                    website: '',
                    summary: '',
                    experience: [],
                    education: [],
                    skills: [],
                    projects: [],
                    certifications: [],
                });
            }

            // Fetch download link
            const link = await getResumeDownloadLink();
            if (link) {
                const absoluteLink = typeof window !== 'undefined'
                    ? `${window.location.origin}${link}`
                    : link;
                setDownloadLink(absoluteLink);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
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
                toast.error('Failed to extract text from file');
            }
        } catch (err) {
            console.error('Upload failed', err);
            toast.error('Upload failed');
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
                profileName: profile.profileName || 'Default Profile',
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
                setSelectedProfileId(newProfile.id);
            }

            const allProfiles = await getProfiles();
            setProfilesList(allProfiles);

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
            toast.success('Profile saved successfully!');
        } catch (err) {
            console.error('Save failed', err);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
            toast.error('Failed to save profile');
        }
    };

    const handleCreateProfile = async () => {
        if (!newProfileName.trim()) {
            toast.error('Please enter a profile name');
            return;
        }

        try {
            let baseData: any = {
                profileName: newProfileName.trim(),
                name: '',
                email: '',
                phone: '',
                linkedin: '',
                website: '',
                summary: '',
                experience: '[]',
                education: '[]',
                skills: '[]',
                projects: '[]',
                certifications: '[]',
            };

            if (cloneFromId !== 'none') {
                const sourceProfile = profilesList.find((p: any) => p.id === parseInt(cloneFromId));
                if (sourceProfile) {
                    baseData = {
                        ...baseData,
                        name: sourceProfile.name || '',
                        email: sourceProfile.email || '',
                        phone: sourceProfile.phone || '',
                        linkedin: sourceProfile.linkedin || '',
                        website: sourceProfile.website || '',
                        summary: sourceProfile.summary || '',
                        experience: sourceProfile.experience || '[]',
                        education: sourceProfile.education || '[]',
                        skills: sourceProfile.skills || '[]',
                        projects: sourceProfile.projects || '[]',
                        certifications: sourceProfile.certifications || '[]',
                    };
                }
            }

            const created = await createProfile(baseData);
            toast.success(`Profile "${newProfileName}" created!`);
            setShowCreateModal(false);
            setNewProfileName('');
            setCloneFromId('none');
            await loadProfileData(created.id);
        } catch (err) {
            console.error(err);
            toast.error('Failed to create profile');
        }
    };

    const handleDeleteProfile = async () => {
        if (!selectedProfileId) return;
        if (profilesList.length <= 1) {
            toast.error('You must keep at least one profile.');
            return;
        }

        const activeProfile = profilesList.find((p: any) => p.id === selectedProfileId);
        const name = activeProfile?.profileName || 'this profile';
        if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteProfile(selectedProfileId);
            toast.success(`Profile "${name}" deleted.`);
            const remaining = profilesList.filter((p) => p.id !== selectedProfileId);
            await loadProfileData(remaining[0]?.id);
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete profile');
        }
    };

    const handleRenameProfile = async () => {
        if (!selectedProfileId || !renameValue.trim()) return;
        try {
            await updateProfile(selectedProfileId, { profileName: renameValue.trim() });
            toast.success('Profile renamed successfully!');
            setIsRenaming(false);
            await loadProfileData(selectedProfileId);
        } catch (err) {
            console.error(err);
            toast.error('Failed to rename profile');
        }
    };

    const activeTabDetails = tabs.find((tab) => tab.id === activeTab) || tabs[0];
    const experience = Array.isArray(profile?.experience) ? profile.experience : [];
    const education = Array.isArray(profile?.education) ? profile.education : [];
    const projects = Array.isArray(profile?.projects) ? profile.projects : [];
    const certifications = Array.isArray(profile?.certifications) ? profile.certifications : [];
    const skillGroups = useMemo(() => getSkillGroups(profile?.skills), [profile?.skills]);
    const skillCount = useMemo(() => countSkills(profile?.skills), [profile?.skills]);
    const profileName = profile?.profileName || renameValue || 'Default Profile';
    const filledBasics = [profile?.name, profile?.email, profile?.phone, profile?.linkedin, profile?.website, profile?.summary].filter(
        (value) => String(value || '').trim().length > 0
    ).length;

    const missingBasics = useMemo(() => {
        const fields = [
            { key: 'name', label: 'Full name' },
            { key: 'email', label: 'Email address' },
            { key: 'phone', label: 'Phone number' },
            { key: 'linkedin', label: 'LinkedIn URL' },
            { key: 'website', label: 'Website or portfolio' },
            { key: 'summary', label: 'Professional summary' }
        ];
        return fields.filter(f => !String(profile?.[f.key] || '').trim()).map(f => f.label);
    }, [profile]);


    if (loading && !profile) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading your profile...</p>
                </div>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 pb-12 text-slate-950 dark:text-slate-100">
            <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:py-3">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left side: Title and active role profile selector */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 min-w-0 flex-1">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Link href="/" className="hover:text-indigo-600 transition">
                                    Dashboard
                                </Link>
                                <span>/</span>
                                <span className="text-slate-700 dark:text-slate-200">Master Profile</span>
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white mt-0.5 whitespace-nowrap">Master Profile</h1>
                        </div>

                        <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-800 shrink-0" />

                        {/* Active Profile Dropdown & Controls */}
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {isRenaming ? (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        className={cn(inputClass, 'min-h-9 py-1.5 px-3 text-xs w-36 sm:w-44')}
                                        placeholder="Profile name"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRenameProfile}
                                        className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white transition hover:bg-indigo-700 whitespace-nowrap"
                                    >
                                        Save
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsRenaming(false);
                                            const current = profilesList.find((p: any) => p.id === selectedProfileId);
                                            setRenameValue(current?.profileName || 'Default Profile');
                                        }}
                                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <div className="relative w-36 sm:w-44 min-w-0 shrink-0">
                                        <select
                                            value={selectedProfileId || ''}
                                            onChange={(e) => {
                                                const newId = parseInt(e.target.value);
                                                loadProfileData(newId);
                                            }}
                                            className={cn(inputClass, 'min-h-9 py-1.5 pl-3 pr-10 text-xs font-bold appearance-none')}
                                        >
                                            {profilesList.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.profileName || 'Default Profile'}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const current = profilesList.find((p: any) => p.id === selectedProfileId);
                                            setRenameValue(current?.profileName || 'Default Profile');
                                            setIsRenaming(true);
                                        }}
                                        className={cn(iconButtonClass, 'h-9 w-9 rounded-lg')}
                                        title="Rename profile"
                                    >
                                        <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeleteProfile}
                                        disabled={profilesList.length <= 1}
                                        className={cn(iconButtonClass, 'h-9 w-9 rounded-lg hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300')}
                                        title="Delete profile"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(true)}
                                        className={cn(iconButtonClass, 'h-9 w-9 rounded-lg')}
                                        title="New Profile"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Status pill with hover tooltip */}
                        <div className="group relative hidden xl:flex items-center rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 whitespace-nowrap cursor-help hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition">
                            <span className="flex items-center gap-1.5">
                                <span className={cn("h-1.5 w-1.5 rounded-full", filledBasics === 6 ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
                                <span>{filledBasics}/6 basics filled</span>
                            </span>
                            {missingBasics.length > 0 && (
                                <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-48 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-[11px] font-medium text-slate-700 shadow-lg opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                                    <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Missing Fields:</p>
                                    <ul className="space-y-1">
                                        {missingBasics.map((label) => (
                                            <li key={label} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                                                <span className="h-1 w-1 rounded-full bg-amber-500" />
                                                {label}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right side: Action buttons */}
                    <div className="flex items-center gap-2 lg:justify-end shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowImport((value) => !value)}
                            className={cn(
                                'inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition',
                                showImport
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'
                            )}
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Import Resume
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saveStatus === 'saving'}
                            className={cn(
                                'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-xs font-bold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-wait',
                                saveStatus === 'saved'
                                    ? 'bg-emerald-600 shadow-emerald-600/20'
                                    : saveStatus === 'error'
                                      ? 'bg-red-600 shadow-red-600/20'
                                      : 'bg-slate-950 shadow-slate-950/15 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500'
                            )}
                        >
                            {saveStatus === 'saving' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : saveStatus === 'saved' ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : saveStatus === 'error' ? (
                                <AlertCircle className="h-3.5 w-3.5" />
                            ) : (
                                <Save className="h-3.5 w-3.5" />
                            )}
                            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Retry Save' : 'Save Profile'}
                        </button>
                    </div>
                </div>
            </section>

            {showImport && (
                <Panel className="overflow-hidden">
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="truncate text-base font-black text-slate-950 dark:text-white">Import resume</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Upload or paste a resume, then let AI structure it into this profile.</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => setShowImport(false)} className={iconButtonClass} title="Close import panel">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="grid gap-4 p-5 dark:bg-slate-950 sm:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <label className="relative flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20">
                            <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} disabled={isUploading} className="sr-only" />
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-slate-950 dark:text-indigo-300">
                                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                            </div>
                            <p className="text-sm font-black text-slate-900 dark:text-white">{isUploading ? 'Extracting text...' : 'Upload PDF or TXT'}</p>
                            <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">The extracted text appears in the editor before parsing.</p>
                        </label>

                        <div className="flex min-w-0 flex-col gap-3">
                            <textarea
                                className={cn(textareaClass, 'min-h-52 resize-y font-mono text-xs leading-5 sm:text-sm')}
                                placeholder="Paste the full resume text here..."
                                value={resumeText}
                                onChange={(e) => setResumeText(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={handleParseResume}
                                disabled={isParsingGlobal || !resumeText}
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                            >
                                {isParsingGlobal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                {isParsingGlobal ? 'Parsing...' : 'Auto-Parse with AI'}
                            </button>
                        </div>
                    </div>
                </Panel>
            )}

            <div className={cn("relative grid min-w-0 gap-5 transition-all duration-300 ease-in-out", isSidebarCollapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[260px_minmax(0,1fr)]")}>
                <aside className="relative min-w-0 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)]">
                    {/* Floating Border Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="hidden lg:flex absolute -right-3 top-5 z-20 h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white transition-all active:scale-90 duration-200 cursor-pointer"
                        title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <ChevronRight className={cn("h-3 w-3 transition-transform duration-300", !isSidebarCollapsed && "rotate-180")} />
                    </button>

                    <div className={cn(
                        "scrollbar-hide -mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:space-y-1 lg:overflow-visible transition-all duration-300",
                        "lg:bg-slate-50/50 lg:dark:bg-slate-900/10 lg:border lg:border-slate-200/80 lg:dark:border-slate-800/80 lg:rounded-2xl lg:p-1.5"
                    )}>
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const active = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        'flex min-h-11 shrink-0 items-center rounded-xl transition-all duration-200 lg:w-full text-sm font-bold',
                                        isSidebarCollapsed 
                                            ? 'px-0 lg:justify-center lg:h-11 lg:w-11 lg:mx-auto gap-0' 
                                            : 'px-3.5 gap-2.5',
                                        active
                                            ? 'bg-slate-950 text-white shadow-sm dark:bg-indigo-600 dark:text-white'
                                            : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white'
                                    )}
                                    title={isSidebarCollapsed ? tab.label : undefined}
                                >
                                    <Icon className={cn('h-4 w-4 shrink-0 transition-transform duration-200', active ? 'text-white' : 'text-slate-400', isSidebarCollapsed && 'lg:scale-105')} />
                                    <span className={cn(
                                        'whitespace-nowrap transition-all duration-200 origin-left',
                                        isSidebarCollapsed ? 'lg:w-0 lg:opacity-0 lg:overflow-hidden lg:hidden' : 'lg:w-auto lg:opacity-100'
                                    )}>
                                        {tab.label}
                                    </span>
                                    {tab.id === 'basics' && filledBasics < 6 && (
                                        <span className={cn(
                                            "ml-auto h-2 w-2 rounded-full bg-amber-500",
                                            isSidebarCollapsed && "absolute right-2 top-2 lg:h-1.5 lg:w-1.5"
                                        )} title={`${6 - filledBasics} fields missing`} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <div className="min-w-0">
                    <Panel className="flex flex-col overflow-hidden lg:h-[calc(100vh-8rem)] lg:min-h-[500px]">
                        <SectionIntro tab={activeTabDetails} />
                        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
                            {activeTab === 'basics' && (
                                <div className="space-y-5">
                                    <div className="grid min-w-0 gap-4 md:grid-cols-2">
                                        <Field label="Full name" icon={User} isMissing={!String(profile.name || '').trim()}>
                                            <input
                                                type="text"
                                                className={inputClass}
                                                value={profile.name || ''}
                                                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                                placeholder="Jane Doe"
                                            />
                                        </Field>
                                        <Field label="Email address" icon={Mail} isMissing={!String(profile.email || '').trim()}>
                                            <input
                                                type="email"
                                                className={inputClass}
                                                value={profile.email || ''}
                                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                                placeholder="jane@example.com"
                                            />
                                        </Field>
                                        <Field label="Phone number" icon={Phone} isMissing={!String(profile.phone || '').trim()}>
                                            <input
                                                type="tel"
                                                className={inputClass}
                                                value={profile.phone || ''}
                                                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                                placeholder="+1 (555) 000-0000"
                                            />
                                        </Field>
                                        <Field label="LinkedIn URL" icon={Users2} isMissing={!String(profile.linkedin || '').trim()}>
                                            <input
                                                type="url"
                                                className={inputClass}
                                                value={profile.linkedin || ''}
                                                onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })}
                                                placeholder="https://linkedin.com/in/..."
                                            />
                                        </Field>
                                        <Field label="Website or portfolio" icon={Globe2} className="md:col-span-2" isMissing={!String(profile.website || '').trim()}>
                                            <input
                                                type="url"
                                                className={inputClass}
                                                value={profile.website || ''}
                                                onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                                                placeholder="https://janedoe.com"
                                            />
                                        </Field>
                                    </div>

                                    <Field label="Professional summary" icon={FileText} isMissing={!String(profile.summary || '').trim()}>
                                        <textarea
                                            className={cn(textareaClass, 'min-h-44 resize-y')}
                                            value={profile.summary || ''}
                                            onChange={(e) => setProfile({ ...profile, summary: e.target.value })}
                                            placeholder="Brief overview of your background, strengths, and career focus."
                                        />
                                    </Field>

                                    {downloadLink && (
                                        <div className="mt-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-purple-50/30 p-5 dark:border-indigo-950/60 dark:from-indigo-950/20 dark:to-purple-950/10">
                                            <div className="flex items-start gap-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300">
                                                    <BadgeCheck className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Secure Portfolio PDF Resume Link</h3>
                                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                        Use this secure link to link to or download your PDF resume directly from your static portfolio. Copy it below.
                                                    </p>
                                                    
                                                    <div className="mt-3 flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            readOnly
                                                            value={downloadLink}
                                                            className="h-10 flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(downloadLink);
                                                                toast.success('Resume link copied to clipboard!');
                                                            }}
                                                            className="inline-flex h-10 px-4 items-center justify-center rounded-xl bg-indigo-600 text-xs font-bold text-white transition hover:bg-indigo-700 active:scale-[0.98]"
                                                        >
                                                            Copy Link
                                                        </button>
                                                        <a
                                                            href={downloadLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex h-10 px-4 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                                                        >
                                                            Test Download
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'experience' && (
                                <div className="space-y-3">
                                    {experience.length === 0 && (
                                        <EmptyState
                                            icon={Briefcase}
                                            title="No experience added yet"
                                            body="Add roles once, then reuse them when tailoring resumes for each application."
                                        />
                                    )}

                                    {experience.map((exp: any, i: number) => {
                                        const isOpen = expandedExp.has(i);
                                        const toggleOpen = () => {
                                            setExpandedExp((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(i)) next.delete(i);
                                                else next.add(i);
                                                return next;
                                            });
                                        };

                                        return (
                                            <article key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                                {/* Compact clickable header */}
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={toggleOpen}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); } }}
                                                    className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60 sm:p-5"
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900">
                                                        <Briefcase className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="truncate text-sm font-black text-slate-950 dark:text-white">
                                                            {exp.role || 'Untitled role'}
                                                        </h3>
                                                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                                            {[exp.company, exp.dates].filter(Boolean).join(' · ') || 'No details yet'}
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newExp = [...experience];
                                                                newExp.splice(i, 1);
                                                                setExpandedExp((prev) => {
                                                                    const next = new Set<number>();
                                                                    prev.forEach((idx) => {
                                                                        if (idx < i) next.add(idx);
                                                                        else if (idx > i) next.add(idx - 1);
                                                                    });
                                                                    return next;
                                                                });
                                                                setProfile({ ...profile, experience: newExp });
                                                            }}
                                                            className={cn(iconButtonClass, 'h-8 w-8 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300')}
                                                            title="Remove position"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')} />
                                                    </div>
                                                </div>

                                                {/* Collapsible body */}
                                                {isOpen && (
                                                    <div className="border-t border-slate-200 dark:border-slate-800">
                                                        <div className="space-y-4 bg-slate-50/40 p-4 dark:bg-slate-900/30 sm:p-5">
                                                            <div className="grid min-w-0 gap-4 md:grid-cols-3">
                                                                <Field label="Job title" icon={Briefcase}>
                                                                    <input
                                                                        className={inputClass}
                                                                        value={exp.role || ''}
                                                                        placeholder="Senior Software Engineer"
                                                                        onChange={(e) => {
                                                                            const newExp = [...experience];
                                                                            newExp[i] = { ...newExp[i], role: e.target.value };
                                                                            setProfile({ ...profile, experience: newExp });
                                                                        }}
                                                                    />
                                                                </Field>
                                                                <Field label="Company" icon={Building2}>
                                                                    <input
                                                                        className={inputClass}
                                                                        value={exp.company || ''}
                                                                        placeholder="Company name"
                                                                        onChange={(e) => {
                                                                            const newExp = [...experience];
                                                                            newExp[i] = { ...newExp[i], company: e.target.value };
                                                                            setProfile({ ...profile, experience: newExp });
                                                                        }}
                                                                    />
                                                                </Field>
                                                                <Field label="Dates" icon={Calendar}>
                                                                    <input
                                                                        className={inputClass}
                                                                        value={exp.dates || ''}
                                                                        placeholder="Jan 2020 - Present"
                                                                        onChange={(e) => {
                                                                            const newExp = [...experience];
                                                                            newExp[i] = { ...newExp[i], dates: e.target.value };
                                                                            setProfile({ ...profile, experience: newExp });
                                                                        }}
                                                                    />
                                                                </Field>
                                                            </div>
                                                            <details className="group border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 overflow-hidden" open>
                                                                <summary className="flex items-center justify-between cursor-pointer px-4 py-3 font-bold text-sm text-slate-900 dark:text-slate-100 select-none list-none [&::-webkit-details-marker]:hidden bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100/70 dark:hover:bg-slate-900 transition">
                                                                    <div className="flex items-center gap-2">
                                                                        <FileText className="h-4 w-4 text-slate-400" />
                                                                        <span>General Description</span>
                                                                    </div>
                                                                    <ChevronDown className="h-4 w-4 text-slate-400 group-open:rotate-180 transition-transform duration-200" />
                                                                </summary>
                                                                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10">
                                                                    <textarea
                                                                        className={cn(textareaClass, 'min-h-28 resize-y')}
                                                                        value={exp.description || ''}
                                                                        placeholder="- Responsibilities, wins, metrics, or scope that apply across this role."
                                                                        onChange={(e) => {
                                                                            const newExp = [...experience];
                                                                            newExp[i] = { ...newExp[i], description: e.target.value };
                                                                            setProfile({ ...profile, experience: newExp });
                                                                        }}
                                                                    />
                                                                </div>
                                                            </details>

                                                            <details className="group border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 overflow-hidden" open>
                                                                <summary className="flex items-center justify-between cursor-pointer px-4 py-3 font-bold text-sm text-slate-900 dark:text-slate-100 select-none list-none [&::-webkit-details-marker]:hidden bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100/70 dark:hover:bg-slate-900 transition">
                                                                    <div className="flex items-center gap-2">
                                                                        <LayoutGrid className="h-4 w-4 text-slate-400" />
                                                                        <span>Clients and Projects ({(exp.clients || []).length})</span>
                                                                    </div>
                                                                    <ChevronDown className="h-4 w-4 text-slate-400 group-open:rotate-180 transition-transform duration-200" />
                                                                </summary>
                                                                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10 space-y-4">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400">Optional detail for consulting, agency, or project-based roles.</p>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newExp = [...experience];
                                                                                const newClients = [...(newExp[i].clients || []), { name: '', domain: '', description: '' }];
                                                                                newExp[i] = { ...newExp[i], clients: newClients };
                                                                                setProfile({ ...profile, experience: newExp });
                                                                            }}
                                                                            className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30"
                                                                        >
                                                                            <Plus className="h-3.5 w-3.5" />
                                                                            Add Client
                                                                        </button>
                                                                    </div>

                                                                    {(exp.clients || []).length > 0 && (
                                                                        <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                                                                            {(exp.clients || []).map((client: any, ci: number) => (
                                                                                <div key={ci} className="space-y-3 p-4 bg-slate-50/10">
                                                                                    <div className="flex items-center justify-between gap-3">
                                                                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Client {ci + 1}</p>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                const newExp = [...experience];
                                                                                                const newClients = [...(newExp[i].clients || [])];
                                                                                                newClients.splice(ci, 1);
                                                                                                newExp[i] = { ...newExp[i], clients: newClients };
                                                                                                setProfile({ ...profile, experience: newExp });
                                                                                            }}
                                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                                                                                            title="Remove client"
                                                                                        >
                                                                                            <Trash2 className="h-4 w-4" />
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="grid min-w-0 gap-3 md:grid-cols-2">
                                                                                        <Field label="Client name">
                                                                                            <input
                                                                                                className={cn(inputClass, 'min-h-9 py-1.5 px-3 text-xs')}
                                                                                                value={client.name || ''}
                                                                                                placeholder="Client or project name"
                                                                                                onChange={(e) => {
                                                                                                    const newExp = [...experience];
                                                                                                    const newClients = [...(newExp[i].clients || [])];
                                                                                                    newClients[ci] = { ...newClients[ci], name: e.target.value };
                                                                                                    newExp[i] = { ...newExp[i], clients: newClients };
                                                                                                    setProfile({ ...profile, experience: newExp });
                                                                                                }}
                                                                                            />
                                                                                        </Field>
                                                                                        <Field label="Domain or industry">
                                                                                            <input
                                                                                                className={cn(inputClass, 'min-h-9 py-1.5 px-3 text-xs')}
                                                                                                value={client.domain || ''}
                                                                                                placeholder="Healthcare, finance, SaaS..."
                                                                                                onChange={(e) => {
                                                                                                    const newExp = [...experience];
                                                                                                    const newClients = [...(newExp[i].clients || [])];
                                                                                                    newClients[ci] = { ...newClients[ci], domain: e.target.value };
                                                                                                    newExp[i] = { ...newExp[i], clients: newClients };
                                                                                                    setProfile({ ...profile, experience: newExp });
                                                                                                }}
                                                                                            />
                                                                                        </Field>
                                                                                        <Field label="Description" className="md:col-span-2">
                                                                                            <textarea
                                                                                                className={cn(textareaClass, 'min-h-24 resize-y text-xs')}
                                                                                                value={client.description || ''}
                                                                                                placeholder="- Work delivered, responsibilities, outcomes, or tools used."
                                                                                                onChange={(e) => {
                                                                                                    const newExp = [...experience];
                                                                                                    const newClients = [...(newExp[i].clients || [])];
                                                                                                    newClients[ci] = { ...newClients[ci], description: e.target.value };
                                                                                                    newExp[i] = { ...newExp[i], clients: newClients };
                                                                                                    setProfile({ ...profile, experience: newExp });
                                                                                                }}
                                                                                            />
                                                                                        </Field>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </details>
                                                        </div>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}

                                    <AddButton
                                        onClick={() => {
                                            const newIndex = experience.length;
                                            setExpandedExp((prev) => new Set(prev).add(newIndex));
                                            setProfile({
                                                ...profile,
                                                experience: [...experience, { role: '', company: '', dates: '', description: '', clients: [], highlights: [] }],
                                            });
                                        }}
                                    >
                                        Add New Position
                                    </AddButton>
                                </div>
                            )}

                            {activeTab === 'skills' && (
                                <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                                    <div className="space-y-3">
                                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm leading-6 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
                                            <div className="flex gap-3">
                                                <Sparkles className="mt-1 h-4 w-4 shrink-0" />
                                                <p>
                                                    Add one skill per line. Use <code className="rounded bg-white px-1.5 py-0.5 text-xs font-bold dark:bg-slate-950">--- Category ---</code> to create grouped resume sections.
                                                </p>
                                            </div>
                                        </div>
                                        <textarea
                                            className={cn(textareaClass, 'min-h-[420px] resize-y font-mono text-xs leading-5 sm:text-sm')}
                                            value={Array.isArray(profile.skills) ? profile.skills.join('\n') : profile.skills || ''}
                                            onChange={(e) => setProfile({ ...profile, skills: e.target.value.split('\n') })}
                                            placeholder={'--- Programming Languages ---\nJava\nPython\nTypeScript\n\n--- Frameworks ---\nReact\nNext.js\nSpring Boot'}
                                        />
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/30">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-950 dark:text-white">Skill preview</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">{skillCount} keywords</p>
                                            </div>
                                            <Code className="h-5 w-5 text-slate-400" />
                                        </div>

                                        {skillGroups.length === 0 ? (
                                            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                                Your grouped skills will appear here.
                                            </p>
                                        ) : (
                                            <div className="space-y-4">
                                                {skillGroups.map((group) => (
                                                    <div key={group.title} className="space-y-2">
                                                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{group.title}</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {group.items.slice(0, 18).map((item) => (
                                                                <span
                                                                    key={item}
                                                                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                                                                >
                                                                    {item}
                                                                </span>
                                                            ))}
                                                            {group.items.length > 18 && (
                                                                <span className="rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                                    +{group.items.length - 18}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'education' && (
                                <div className="space-y-3">
                                    {education.length === 0 && (
                                        <EmptyState icon={GraduationCap} title="No education added yet" body="Add degrees or programs that should be available when creating tailored resumes." />
                                    )}

                                    {education.map((edu: any, i: number) => {
                                        const isOpen = expandedEdu.has(i);
                                        const toggleOpen = () => {
                                            setExpandedEdu((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(i)) next.delete(i);
                                                else next.add(i);
                                                return next;
                                            });
                                        };

                                        return (
                                            <article key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={toggleOpen}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); } }}
                                                    className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60 sm:p-5"
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900">
                                                        <GraduationCap className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="truncate text-sm font-black text-slate-950 dark:text-white">
                                                            {edu.institution || 'Untitled education'}
                                                        </h3>
                                                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                                            {[edu.degree, edu.dates].filter(Boolean).join(' · ') || 'No details yet'}
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newEdu = [...education];
                                                                newEdu.splice(i, 1);
                                                                setExpandedEdu((prev) => {
                                                                    const next = new Set<number>();
                                                                    prev.forEach((idx) => {
                                                                        if (idx < i) next.add(idx);
                                                                        else if (idx > i) next.add(idx - 1);
                                                                    });
                                                                    return next;
                                                                });
                                                                setProfile({ ...profile, education: newEdu });
                                                            }}
                                                            className={cn(iconButtonClass, 'h-8 w-8 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300')}
                                                            title="Remove education"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')} />
                                                    </div>
                                                </div>

                                                {isOpen && (
                                                    <div className="border-t border-slate-200 dark:border-slate-800">
                                                        <div className="space-y-4 bg-slate-50/40 p-4 dark:bg-slate-900/30 sm:p-5">
                                                            <div className="grid min-w-0 gap-4 md:grid-cols-3">
                                                                <Field label="Institution" icon={Building2}>
                                                                    <input
                                                                        className={inputClass}
                                                                        value={edu.institution || ''}
                                                                        placeholder="University name"
                                                                        onChange={(e) => {
                                                                            const newEdu = [...education];
                                                                            newEdu[i] = { ...newEdu[i], institution: e.target.value };
                                                                            setProfile({ ...profile, education: newEdu });
                                                                        }}
                                                                    />
                                                                </Field>
                                                                <Field label="Degree" icon={GraduationCap}>
                                                                    <input
                                                                        className={inputClass}
                                                                        value={edu.degree || ''}
                                                                        placeholder="BS Computer Science"
                                                                        onChange={(e) => {
                                                                            const newEdu = [...education];
                                                                            newEdu[i] = { ...newEdu[i], degree: e.target.value };
                                                                            setProfile({ ...profile, education: newEdu });
                                                                        }}
                                                                    />
                                                                </Field>
                                                                <Field label="Dates" icon={Calendar}>
                                                                    <input
                                                                        className={inputClass}
                                                                        value={edu.dates || ''}
                                                                        placeholder="2018 - 2022"
                                                                        onChange={(e) => {
                                                                            const newEdu = [...education];
                                                                            newEdu[i] = { ...newEdu[i], dates: e.target.value };
                                                                            setProfile({ ...profile, education: newEdu });
                                                                        }}
                                                                    />
                                                                </Field>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}

                                    <AddButton onClick={() => {
                                        const newIndex = education.length;
                                        setExpandedEdu((prev) => new Set(prev).add(newIndex));
                                        setProfile({ ...profile, education: [...education, { institution: '', degree: '', dates: '' }] });
                                    }}>Add New Education</AddButton>
                                </div>
                            )}

                            {activeTab === 'projects' && (
                                <div className="space-y-3">
                                    {projects.length === 0 && (
                                        <EmptyState icon={FolderKanban} title="No projects added yet" body="Capture portfolio or delivery examples that prove your skills beyond job titles." />
                                    )}

                                    {projects.map((proj: any, i: number) => {
                                        const isOpen = expandedProj.has(i);
                                        const toggleOpen = () => {
                                            setExpandedProj((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(i)) next.delete(i);
                                                else next.add(i);
                                                return next;
                                            });
                                        };

                                        return (
                                            <article key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={toggleOpen}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); } }}
                                                    className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60 sm:p-5"
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900">
                                                        <FolderKanban className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="truncate text-sm font-black text-slate-950 dark:text-white">
                                                            {proj.name || 'Untitled project'}
                                                        </h3>
                                                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                                            {proj.link || 'No details yet'}
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newProj = [...projects];
                                                                newProj.splice(i, 1);
                                                                setExpandedProj((prev) => {
                                                                    const next = new Set<number>();
                                                                    prev.forEach((idx) => {
                                                                        if (idx < i) next.add(idx);
                                                                        else if (idx > i) next.add(idx - 1);
                                                                    });
                                                                    return next;
                                                                });
                                                                setProfile({ ...profile, projects: newProj });
                                                            }}
                                                            className={cn(iconButtonClass, 'h-8 w-8 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300')}
                                                            title="Remove project"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')} />
                                                    </div>
                                                </div>

                                                {isOpen && (
                                                    <div className="border-t border-slate-200 dark:border-slate-800">
                                                        <div className="space-y-4 bg-slate-50/40 p-4 dark:bg-slate-900/30 sm:p-5">
                                                            <Field label="Project name" icon={FolderKanban}>
                                                                <input
                                                                    className={inputClass}
                                                                    value={proj.name || ''}
                                                                    placeholder="E-commerce platform"
                                                                    onChange={(e) => {
                                                                        const newProj = [...projects];
                                                                        newProj[i] = { ...newProj[i], name: e.target.value };
                                                                        setProfile({ ...profile, projects: newProj });
                                                                    }}
                                                                />
                                                            </Field>
                                                            <Field label="Description" icon={FileText}>
                                                                <textarea
                                                                    className={cn(textareaClass, 'min-h-28 resize-y')}
                                                                    value={proj.description || ''}
                                                                    placeholder="What you built, your role, technologies, and impact."
                                                                    onChange={(e) => {
                                                                        const newProj = [...projects];
                                                                        newProj[i] = { ...newProj[i], description: e.target.value };
                                                                        setProfile({ ...profile, projects: newProj });
                                                                    }}
                                                                />
                                                            </Field>
                                                            <Field label="URL or repository" icon={Globe2}>
                                                                <input
                                                                    className={inputClass}
                                                                    value={proj.link || ''}
                                                                    placeholder="https://github.com/..."
                                                                    onChange={(e) => {
                                                                        const newProj = [...projects];
                                                                        newProj[i] = { ...newProj[i], link: e.target.value };
                                                                        setProfile({ ...profile, projects: newProj });
                                                                    }}
                                                                />
                                                            </Field>
                                                        </div>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}

                                    <AddButton onClick={() => {
                                        const newIndex = projects.length;
                                        setExpandedProj((prev) => new Set(prev).add(newIndex));
                                        setProfile({ ...profile, projects: [...projects, { name: '', description: '', link: '' }] });
                                    }}>Add New Project</AddButton>
                                </div>
                            )}

                            {activeTab === 'certifications' && (
                                <div className="space-y-3">
                                    {certifications.length === 0 && (
                                        <EmptyState icon={Award} title="No certifications added yet" body="Add credentials, licenses, and verification links recruiters may look for." />
                                    )}

                                    {certifications.map((cert: any, i: number) => {
                                        const isOpen = expandedCert.has(i);
                                        const toggleOpen = () => {
                                            setExpandedCert((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(i)) next.delete(i);
                                                else next.add(i);
                                                return next;
                                            });
                                        };

                                        return (
                                            <article key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={toggleOpen}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); } }}
                                                    className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60 sm:p-5"
                                                >
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-600 ring-1 ring-fuchsia-100 dark:bg-fuchsia-950/30 dark:text-fuchsia-300 dark:ring-fuchsia-900">
                                                        <Award className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="truncate text-sm font-black text-slate-950 dark:text-white">
                                                            {cert.name || 'Untitled certification'}
                                                        </h3>
                                                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                                            {[cert.issuer, cert.date].filter(Boolean).join(' · ') || 'No details yet'}
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const newCerts = [...certifications];
                                                                newCerts.splice(i, 1);
                                                                setExpandedCert((prev) => {
                                                                    const next = new Set<number>();
                                                                    prev.forEach((idx) => {
                                                                        if (idx < i) next.add(idx);
                                                                        else if (idx > i) next.add(idx - 1);
                                                                    });
                                                                    return next;
                                                                });
                                                                setProfile({ ...profile, certifications: newCerts });
                                                            }}
                                                            className={cn(iconButtonClass, 'h-8 w-8 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900 dark:hover:bg-red-950/30 dark:hover:text-red-300')}
                                                            title="Remove certification"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform duration-200', isOpen && 'rotate-180')} />
                                                    </div>
                                                </div>

                                                {isOpen && (
                                                    <div className="border-t border-slate-200 dark:border-slate-800">
                                                        <div className="space-y-4 bg-slate-50/40 p-4 dark:bg-slate-900/30 sm:p-5">
                                                            <Field label="Certification name" icon={Award}>
                                                                <input
                                                                    className={inputClass}
                                                                    value={cert.name || ''}
                                                                    placeholder="AWS Certified Solutions Architect"
                                                                    onChange={(e) => {
                                                                        const newCerts = [...certifications];
                                                                        newCerts[i] = { ...newCerts[i], name: e.target.value };
                                                                        setProfile({ ...profile, certifications: newCerts });
                                                                    }}
                                                                />
                                                            </Field>
                                                            <div className="grid min-w-0 gap-4 md:grid-cols-2">
                                                                <Field label="Issuer" icon={Building2}>
                                                                    <input
                                                                        className={inputClass}
                                                                        value={cert.issuer || ''}
                                                                        placeholder="Amazon Web Services"
                                                                        onChange={(e) => {
                                                                            const newCerts = [...certifications];
                                                                            newCerts[i] = { ...newCerts[i], issuer: e.target.value };
                                                                            setProfile({ ...profile, certifications: newCerts });
                                                                        }}
                                                                    />
                                                                </Field>
                                                                <Field label="Date" icon={Calendar}>
                                                                    <input
                                                                        className={inputClass}
                                                                        value={cert.date || ''}
                                                                        placeholder="2024"
                                                                        onChange={(e) => {
                                                                            const newCerts = [...certifications];
                                                                            newCerts[i] = { ...newCerts[i], date: e.target.value };
                                                                            setProfile({ ...profile, certifications: newCerts });
                                                                        }}
                                                                    />
                                                                </Field>
                                                            </div>
                                                            <Field label="Verification URL" icon={Globe2}>
                                                                <input
                                                                    className={inputClass}
                                                                    value={cert.url || ''}
                                                                    placeholder="https://..."
                                                                    onChange={(e) => {
                                                                        const newCerts = [...certifications];
                                                                        newCerts[i] = { ...newCerts[i], url: e.target.value };
                                                                        setProfile({ ...profile, certifications: newCerts });
                                                                    }}
                                                                />
                                                            </Field>
                                                        </div>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}

                                    <AddButton onClick={() => {
                                        const newIndex = certifications.length;
                                        setExpandedCert((prev) => new Set(prev).add(newIndex));
                                        setProfile({ ...profile, certifications: [...certifications, { name: '', issuer: '', date: '', url: '' }] });
                                    }}>Add New Certification</AddButton>
                                </div>
                            )}
                        </div>
                    </Panel>
                </div>
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-black text-slate-950 dark:text-white">Create Role Profile</h3>
                                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Set up a distinct profile for a target role or career track.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewProfileName('');
                                    setCloneFromId('none');
                                }}
                                className={iconButtonClass}
                                title="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <Field label="Profile name">
                                <input
                                    type="text"
                                    value={newProfileName}
                                    onChange={(e) => setNewProfileName(e.target.value)}
                                    placeholder="Frontend Engineer, Product Manager..."
                                    className={inputClass}
                                    autoFocus
                                />
                            </Field>

                            <Field label="Copy details from">
                                <div className="relative">
                                    <select value={cloneFromId} onChange={(e) => setCloneFromId(e.target.value)} className={cn(inputClass, 'appearance-none pr-10')}>
                                        <option value="none">Start blank</option>
                                        {profilesList.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                Clone: {p.profileName || 'Default Profile'}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                </div>
                            </Field>
                        </div>

                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewProfileName('');
                                    setCloneFromId('none');
                                }}
                                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateProfile}
                                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-700"
                            >
                                Create Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
