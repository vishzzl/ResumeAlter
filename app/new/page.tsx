'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createApplication, getProfile } from '@/lib/actions';
import { Loader2, Link as LinkIcon, AlertCircle } from 'lucide-react';

export default function NewApplicationPage() {
    const [url, setUrl] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [showPasteText, setShowPasteText] = useState(false);

    // Resume Source State
    const [resumeSource, setResumeSource] = useState<'profile' | 'upload' | 'paste'>('profile');
    const [uploadedResumeText, setUploadedResumeText] = useState('');
    const [pastedResumeText, setPastedResumeText] = useState('');
    const [profile, setProfile] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    useEffect(() => {
        // Load profile on mount
        getProfile().then(data => {
            if (data) {
                setProfile(data);
                setResumeSource('profile');
            } else {
                setResumeSource('paste'); // Default to paste if no profile
            }
        });
    }, []);

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
            const data = await res.json();
            if (data.text) {
                setUploadedResumeText(data.text);
            }
        } catch (err) {
            console.error('Upload failed', err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Basic URL validation
            if (!url.startsWith('http')) {
                throw new Error('Please enter a valid URL starting with http:// or https://');
            }

            // Determine base resume content
            let baseResumeToSend = undefined;
            if (resumeSource === 'profile' && profile) {
                const { formatProfileToText } = await import('@/lib/utils');
                baseResumeToSend = formatProfileToText(profile);
            } else if (resumeSource === 'upload') {
                baseResumeToSend = uploadedResumeText;
            } else if (resumeSource === 'paste') {
                baseResumeToSend = pastedResumeText;
            }

            // Pass the job description if the user opted to paste it
            const descriptionToSend = showPasteText ? jobDescription : undefined;

            const id = await createApplication(url, descriptionToSend, baseResumeToSend);
            router.push(`/applications/${id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl px-4 py-12">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">New Application</h1>
                <p className="mt-4 text-lg text-gray-600">
                    Paste the job posting URL below to get started. We'll extract the details for you.
                </p>
            </div>

            <div className="rounded-xl border bg-white p-8 shadow-sm space-y-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Job Details Section */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Job Details</h2>
                        <div>
                            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                                Job URL <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <LinkIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                </div>
                                <input
                                    type="url"
                                    name="url"
                                    id="url"
                                    className="block w-full rounded-md border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm py-3 border shadow-sm outline-none transition-all"
                                    placeholder="https://www.linkedin.com/jobs/view/..."
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="relative flex items-start">
                            <div className="flex h-6 items-center">
                                <input
                                    id="paste-text-toggle"
                                    name="paste-text-toggle"
                                    type="checkbox"
                                    checked={showPasteText}
                                    onChange={(e) => setShowPasteText(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                                />
                            </div>
                            <div className="ml-3 text-sm leading-6">
                                <label htmlFor="paste-text-toggle" className="font-medium text-gray-900">
                                    Paste Job Description Manually
                                </label>
                                <p className="text-gray-500">
                                    If the URL scraping fails or is behind a login, you can paste the text here.
                                </p>
                            </div>
                        </div>

                        {showPasteText && (
                            <div className="space-y-2">
                                <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700">
                                    Job Description Text
                                </label>
                                <textarea
                                    id="jobDescription"
                                    rows={6}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border outline-none"
                                    placeholder="Paste the full job description here..."
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Resume Source Section */}
                    <div className="space-y-6 pt-6">
                        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Resume Source</h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setResumeSource('profile')}
                                disabled={!profile}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border text-sm font-medium transition-all ${resumeSource === 'profile'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    } ${!profile ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span className="mb-1">Master Profile</span>
                                <span className="text-xs font-normal text-gray-500">{profile ? 'Recommended' : 'Not set up'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setResumeSource('upload')}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border text-sm font-medium transition-all ${resumeSource === 'upload'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="mb-1">Upload PDF</span>
                                <span className="text-xs font-normal text-gray-500">Extract from file</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setResumeSource('paste')}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border text-sm font-medium transition-all ${resumeSource === 'paste'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="mb-1">Paste Text</span>
                                <span className="text-xs font-normal text-gray-500">Manual entry</span>
                            </button>
                        </div>

                        {resumeSource === 'profile' && profile && (
                            <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700">
                                <p>Using data from your Master Profile. You can see this data in the profile section.</p>
                            </div>
                        )}

                        {resumeSource === 'upload' && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Upload Resume (PDF/TXT)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept=".pdf,.txt"
                                        onChange={handleFileUpload}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {isUploading && <Loader2 className="h-4 w-4 animate-spin text-gray-500" />}
                                </div>
                                {uploadedResumeText && (
                                    <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                                        Resume text extracted successfully
                                    </div>
                                )}
                            </div>
                        )}

                        {resumeSource === 'paste' && (
                            <div className="space-y-2">
                                <label htmlFor="resumeText" className="block text-sm font-medium text-gray-700">
                                    Resume Text
                                </label>
                                <textarea
                                    id="resumeText"
                                    rows={8}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border outline-none"
                                    placeholder="Paste your base resume text here..."
                                    value={pastedResumeText}
                                    onChange={(e) => setPastedResumeText(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-md bg-red-50 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                                    <div className="mt-2 text-sm text-red-700">
                                        <p>{error}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !url || (resumeSource === 'paste' && !pastedResumeText) || (resumeSource === 'upload' && !uploadedResumeText)}
                        className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating Application...
                            </>
                        ) : (
                            'Create Application'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
