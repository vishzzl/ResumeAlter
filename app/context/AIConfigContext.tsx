"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createGeminiHealthyStatus, GeminiHealthStatus, parseGeminiHealthError } from '@/lib/gemini-quota';

export type AIProvider = 'gemini' | 'local' | 'custom' | 'github';

const GITHUB_FREE_MODELS: Model[] = [
    {
        name: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini (GitHub)',
        description: 'Blazing fast, highly accurate, and extremely safe on rate limits.',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'flash',
        stability: 'stable',
        bestFor: 'Low tier: Ideal for fast, concurrent resume tailoring operations',
    },
    {
        name: 'gpt-4o',
        displayName: 'GPT-4o (GitHub)',
        description: 'Elite reasoning and narrative quality, restricted to 10 RPM / 50 RPD.',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'pro',
        stability: 'stable',
        bestFor: 'High tier: Deep ATS verification and advanced custom cover letters',
    },
    {
        name: 'meta-llama-3.1-70b-instruct',
        displayName: 'Llama 3.1 70B (GitHub)',
        description: 'Open weight powerhouse from Meta, balanced and robust.',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'pro',
        stability: 'stable',
        bestFor: 'Low tier: Excellent general resume structuring and bullet points',
    },
    {
        name: 'Cohere-command-r-plus',
        displayName: 'Cohere Command R+ (GitHub)',
        description: 'Highly optimized for long context document search and structured parsing.',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'pro',
        stability: 'stable',
        bestFor: 'High tier: Outstanding for Phase 0 keyword extraction',
    },
    {
        name: 'meta/Meta-Llama-3.1-405B-Instruct',
        displayName: 'Llama 3.1 405B (GitHub)',
        description: 'Elite open weights model with massive reasoning power (restricted limits).',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'pro',
        stability: 'stable',
        bestFor: 'High tier: Masterful structural edits and deep complex verification',
    }
];


export interface Model {
    name: string;
    displayName: string;
    description?: string;
    inputTokenLimit?: number | null;
    outputTokenLimit?: number | null;
    family?: 'flash' | 'pro' | 'ultra' | 'experimental';
    stability?: 'stable' | 'preview' | 'experimental';
    bestFor?: string;
}

interface AIConfigContextType {
    selectedModel: string;
    setSelectedModel: (model: string) => void;
    selectedProvider: AIProvider;
    setSelectedProvider: (provider: AIProvider) => void;
    customModelConfig: {
        localUrl: string;
        localModel: string;
        customUrl: string;
        customKey: string;
    };
    updateCustomConfig: (config: Partial<AIConfigContextType['customModelConfig']>) => void;
    availableModels: Model[];
    isLoadingModels: boolean;
    geminiStatuses: Record<string, GeminiHealthStatus>;
    refreshGeminiStatus: (modelName?: string) => Promise<GeminiHealthStatus | null>;
    reportGeminiIssue: (rawError: string, modelName?: string) => void;
    markGeminiHealthy: (modelName?: string) => void;
}

const AIConfigContext = createContext<AIConfigContextType | undefined>(undefined);

const MODEL_STATUS_STORAGE_KEY = 'resume_alter_gemini_statuses';

function persistStatuses(statuses: Record<string, GeminiHealthStatus>) {
    localStorage.setItem(MODEL_STATUS_STORAGE_KEY, JSON.stringify(statuses));
}

function normalizeStatusMap(value: unknown): Record<string, GeminiHealthStatus> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const entries = Object.entries(value as Record<string, GeminiHealthStatus>);
    return Object.fromEntries(entries.filter(([, status]) => status && typeof status === 'object'));
}

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
    const [selectedProvider] = useState<AIProvider>('gemini');
    const [selectedModel, setModelState] = useState<string>('gemini-1.5-flash');
    const [customModelConfig, setCustomConfigState] = useState({
        localUrl: 'http://localhost:11434',
        localModel: 'llama3',
        customUrl: '',
        customKey: '',
    });

    const [availableModels, setAvailableModels] = useState<Model[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);
    const [geminiStatuses, setGeminiStatuses] = useState<Record<string, GeminiHealthStatus>>({});

    useEffect(() => {
        const savedModel = localStorage.getItem('resume_alter_model');
        if (savedModel) setModelState(savedModel);

        const savedStatuses = localStorage.getItem(MODEL_STATUS_STORAGE_KEY);
        if (savedStatuses) {
            try {
                setGeminiStatuses(normalizeStatusMap(JSON.parse(savedStatuses)));
            } catch (error) {
                console.error('Failed to parse Gemini model statuses', error);
            }
        }
    }, []);

    useEffect(() => {
        async function fetchModels() {
            try {
                const savedKey = localStorage.getItem('gemini_api_key') || undefined;
                const res = await fetch('/api/models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: savedKey }),
                });
                const data = await res.json();
                if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                    const models = data.models as Model[];
                    setAvailableModels(models);

                    const currentExists = models.some(model => model.name === selectedModel);
                    if (!localStorage.getItem('resume_alter_model')) {
                        const preferred = models.find(model => model.name.includes('2.5-flash'))
                            || models.find(model => model.name.includes('flash'));
                        const best = preferred ? preferred.name : models[0].name;
                        setModelState(best);
                    }
                }
            } catch (error) {
                console.error('Failed to load Gemini models', error);
            } finally {
                setIsLoadingModels(false);
            }
        }

        fetchModels();
    }, [selectedModel]);

    const setSelectedProvider = (_provider: AIProvider) => {
        // Restricted strictly to Google Gemini
    };

    const setSelectedModel = (model: string) => {
        setModelState(model);
        localStorage.setItem('resume_alter_model', model);
    };

    const updateCustomConfig = (config: Partial<typeof customModelConfig>) => {
        setCustomConfigState(prev => {
            const next = { ...prev, ...config };
            localStorage.setItem('resume_alter_custom_config', JSON.stringify(next));
            return next;
        });
    };

    const refreshGeminiStatus = async (modelName?: string) => {
        const targetModel = modelName || selectedModel;
        setGeminiStatuses(prev => {
            const checkingStatus: GeminiHealthStatus = {
                ...(prev[targetModel] || parseGeminiHealthError('checking', targetModel, 'manual')),
                state: 'checking',
                message: 'Checking Gemini health...',
                detail: 'Sending a lightweight ping to verify availability.',
                checkedAt: Date.now(),
                source: 'manual',
            };
            const next = {
                ...prev,
                [targetModel]: checkingStatus,
            };
            persistStatuses(next);
            return next;
        });

        try {
            const apiKey = localStorage.getItem('gemini_api_key') || undefined;
            const res = await fetch('/api/quota', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelName: targetModel, apiKey }),
            });
            const data = await res.json();
            const status = data as GeminiHealthStatus;
            setGeminiStatuses(prev => {
                const next = { ...prev, [targetModel]: status };
                persistStatuses(next);
                return next;
            });
            return status;
        } catch (error) {
            const rawError = error instanceof Error ? error.message : String(error);
            const status = parseGeminiHealthError(rawError, targetModel, 'manual');
            setGeminiStatuses(prev => {
                const next = { ...prev, [targetModel]: status };
                persistStatuses(next);
                return next;
            });
            return status;
        }
    };

    const reportGeminiIssue = (rawError: string, modelName?: string) => {
        const targetModel = modelName || selectedModel;
        const status = parseGeminiHealthError(rawError, targetModel, 'runtime_error');
        setGeminiStatuses(prev => {
            const next = { ...prev, [targetModel]: status };
            persistStatuses(next);
            return next;
        });
    };

    const markGeminiHealthy = (modelName?: string) => {
        const targetModel = modelName || selectedModel;
        const status = createGeminiHealthyStatus(targetModel, 'runtime_error');
        setGeminiStatuses(prev => {
            const next = { ...prev, [targetModel]: status };
            persistStatuses(next);
            return next;
        });
    };

    return (
        <AIConfigContext.Provider value={{
            selectedModel,
            setSelectedModel,
            selectedProvider,
            setSelectedProvider,
            customModelConfig,
            updateCustomConfig,
            availableModels,
            isLoadingModels,
            geminiStatuses,
            refreshGeminiStatus,
            reportGeminiIssue,
            markGeminiHealthy,
        }}>
            {children}
        </AIConfigContext.Provider>
    );
}

export function useAIConfig() {
    const context = useContext(AIConfigContext);
    if (context === undefined) {
        throw new Error('useAIConfig must be used within an AIConfigProvider');
    }
    return context;
}
