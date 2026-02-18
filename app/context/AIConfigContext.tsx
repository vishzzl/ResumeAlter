
"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export type AIProvider = 'gemini' | 'local' | 'custom';

interface AIConfigContextType {
    selectedModel: string;
    setSelectedModel: (model: string) => void;

    selectedProvider: AIProvider;
    setSelectedProvider: (provider: AIProvider) => void;

    // For Local/Custom
    customModelConfig: {
        localUrl: string;
        localModel: string;
        customUrl: string;
        customKey: string;
    };
    updateCustomConfig: (config: Partial<AIConfigContextType['customModelConfig']>) => void;

    availableModels: Model[];
    isLoadingModels: boolean;
}

interface Model {
    name: string;
    displayName: string;
    description?: string;
}

const AIConfigContext = createContext<AIConfigContextType | undefined>(undefined);

export function AIConfigProvider({ children }: { children: React.ReactNode }) {
    // State
    const [selectedProvider, setProviderState] = useState<AIProvider>('gemini');
    const [selectedModel, setModelState] = useState<string>('gemini-1.5-flash');
    const [customModelConfig, setCustomConfigState] = useState({
        localUrl: 'http://localhost:11434',
        localModel: 'llama3',
        customUrl: '',
        customKey: ''
    });

    const [availableModels, setAvailableModels] = useState<Model[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(true);

    // Load from localStorage on mount
    useEffect(() => {
        const savedProvider = localStorage.getItem('resume_alter_provider') as AIProvider;
        if (savedProvider) setProviderState(savedProvider);

        const savedModel = localStorage.getItem('resume_alter_model');
        if (savedModel) setModelState(savedModel);

        const savedCustomConfig = localStorage.getItem('resume_alter_custom_config');
        if (savedCustomConfig) {
            try {
                setCustomConfigState(JSON.parse(savedCustomConfig));
            } catch (e) {
                console.error("Failed to parse custom config", e);
            }
        }
    }, []);

    // Fetch Gemini models
    useEffect(() => {
        async function fetchModels() {
            try {
                const res = await fetch('/api/models');
                const data = await res.json();
                if (data.models && Array.isArray(data.models) && data.models.length > 0) {
                    setAvailableModels(data.models);

                    // Default logic only if no local storage for model
                    if (!localStorage.getItem('resume_alter_model')) {
                        const preferred = data.models.find((m: Model) => m.name.includes('flash'));
                        const best = preferred ? preferred.name : data.models[0].name;
                        setModelState(best);
                    }
                }
            } catch (e) {
                console.error("Failed to load models", e);
            } finally {
                setIsLoadingModels(false);
            }
        }
        fetchModels();
    }, []);

    // Setters with Persistence
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

    return (
        <AIConfigContext.Provider value={{
            selectedModel,
            setSelectedModel,
            selectedProvider,
            setSelectedProvider,
            customModelConfig,
            updateCustomConfig,
            availableModels,
            isLoadingModels
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
