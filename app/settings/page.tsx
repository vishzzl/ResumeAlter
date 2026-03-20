'use client';

import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => {
        // Load key from localStorage on mount
        const stored = localStorage.getItem('gemini_api_key');
        // eslint-disable-next-line
        if (stored) setApiKey(stored);
    }, []);

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
                <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
                <p className="mt-2 text-base text-slate-600">Manage your API keys and application preferences.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">Gemini API Configuration</h2>
                <div className="space-y-6">
                    <div>
                        <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700 mb-2">
                            Google Gemini API Key
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                id="apiKey"
                                name="apiKey"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base py-3 px-4 border"
                                placeholder="sk-..."
                            />
                        </div>
                        <p className="mt-3 text-sm text-slate-500">
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
        </div>
    );
}
