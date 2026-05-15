"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { createGeminiHealthyStatus, GeminiHealthStatus, parseGeminiHealthError } from '@/lib/gemini-quota';

export type AIProvider = 'gemini' | 'local' | 'custom';

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
    const [selectedProvider, setProviderState] = useState<AIProvider>('gemini');
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
        const savedProvider = localStorage.getItem('resume_alter_provider') as AIProvider;
        if (savedProvider) setProviderState(savedProvider);

        const savedModel = localStorage.getItem('resume_alter_model');
        if (savedModel) setModelState(savedModel);

        const savedCustomConfig = localStorage.getItem('resume_alter_custom_config');
        if (savedCustomConfig) {
            try {
                setCustomConfigState(JSON.parse(savedCustomConfig));
            } catch (error) {
                console.error('Failed to parse custom config', error);
            }
        }

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
                    } else if (!currentExists) {
                        setAvailableModels(prev => {
                            if (prev.some(model => model.name === selectedModel)) return prev;
                            return [
                                {
                                    name: selectedModel,
                                    displayName: selectedModel,
                                    description: 'Previously selected model',
                                    family: selectedModel.includes('pro') ? 'pro' : 'flash',
                                    stability: 'stable',
                                    bestFor: 'Previously selected',
                                },
                                ...models,
                            ];
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to load models', error);
            } finally {
                setIsLoadingModels(false);
            }
        }

        fetchModels();
    }, [selectedModel]);

    const setSelectedProvider = (provider: AIProvider) => {
        setProviderState(provider);
        localStorage.setItem('resume_alter_provider', provider);
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
