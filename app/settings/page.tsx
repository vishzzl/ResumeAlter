'use client';

import { useState, useEffect } from 'react';
import { Save, CheckCircle, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import { getResumeDownloadLink } from '@/lib/actions';
import { toast } from 'sonner';

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [downloadLink, setDownloadLink] = useState('');
    const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'docx' | 'markdown' | 'text'>('pdf');

    useEffect(() => {
        // Load key from localStorage on mount
        const stored = localStorage.getItem('gemini_api_key');
        // eslint-disable-next-line
        if (stored) setApiKey(stored);

        // Load secure resume download link
        getResumeDownloadLink().then((link) => {
            if (link && typeof window !== 'undefined') {
                setDownloadLink(`${window.location.origin}${link}`);
            }
        });
    }, []);

    const formattedDownloadLink = downloadLink ? `${downloadLink}&format=${downloadFormat}` : '';

    const handleSave = () => {
        setStatus('saving');
        localStorage.setItem('gemini_api_key', apiKey);

        // Simulate network delay for better UX feel
        setTimeout(() => {
            setStatus('saved');

            // Reset status after a few seconds
            setTimeout(() => setStatus('idle'), 3000);
        }, 500);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 px-4 py-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
                <p className="mt-2 text-base text-slate-600 dark:text-slate-400">Manage your API keys and application preferences.</p>
            </div>

            {/* Gemini API Configuration */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 dark:bg-slate-950 dark:border-slate-800">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">Gemini API Configuration</h2>
                <div className="space-y-6">
                    <div>
                        <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Google Gemini API Key
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                id="apiKey"
                                name="apiKey"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base py-3 px-4 border dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100"
                                placeholder="sk-..."
                            />
                        </div>
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                            Your API key is stored securely in your browser's local storage and is never sent to our servers.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSave}
                            disabled={status === 'saving'}
                            className={`inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all
                ${status === 'saved' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {status === 'saving' ? (
                                <>Saving...</>
                            ) : status === 'saved' ? (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </button>

                        {status === 'saved' && (
                            <span className="text-sm text-green-600 font-medium animate-in fade-in slide-in-from-left-2 duration-300 flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                Settings saved successfully
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Portfolio API Integration */}
            {downloadLink && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 dark:bg-slate-950 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 mb-4">
                        <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Portfolio API Integration</h2>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Use this cryptographically signed link to integrate your master profile resume directly into your static portfolio or external websites. The resume compiles dynamically in real time when requested.
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                        Choose the format below to update the generated URL instantly. You can still modify the `format` query parameter directly if needed.
                    </p>

                    <div className="space-y-6">
                        <div>
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Resume format
                                    </label>
                                    <select
                                        value={downloadFormat}
                                        onChange={(e) => setDownloadFormat(e.target.value as typeof downloadFormat)}
                                        className="rounded-lg border-slate-300 bg-white text-sm py-2.5 px-3 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                                    >
                                        <option value="pdf">PDF</option>
                                        <option value="docx">Word (.docx)</option>
                                        <option value="markdown">Markdown</option>
                                        <option value="text">Plain text</option>
                                    </select>
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    The URL below updates automatically with the chosen format.
                                </p>
                            </div>

                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Secure resume link
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={formattedDownloadLink}
                                    className="block flex-1 rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2.5 px-4 border bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 font-mono text-slate-600"
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(formattedDownloadLink);
                                        toast.success('Resume link copied to clipboard!');
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all"
                                    title="Copy link"
                                >
                                    <Copy className="h-4 w-4" />
                                    Copy
                                </button>
                                <a
                                    href={formattedDownloadLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                    title="Test download"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Test
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
