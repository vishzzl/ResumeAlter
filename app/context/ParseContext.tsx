'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { toast } from 'sonner';
import { useAIConfig } from './AIConfigContext';

interface ParseContextType {
    isParsingGlobal: boolean;
    parsedData: any | null;
    parseResumeGlobal: (resumeText: string) => Promise<void>;
    clearParsedData: () => void;
}

const ParseContext = createContext<ParseContextType | undefined>(undefined);

export function ParseProvider({ children }: { children: ReactNode }) {
    const [isParsingGlobal, setIsParsingGlobal] = useState(false);
    const [parsedData, setParsedData] = useState<any | null>(null);
    const { selectedProvider, selectedModel, customModelConfig } = useAIConfig();

    const parseResumeGlobal = async (resumeText: string) => {
        if (!resumeText) return;

        setIsParsingGlobal(true);
        toast.loading('Parsing resume in background...', { id: 'parse-resume' });

        try {
            const res = await fetch('/api/profile/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resumeText,
                    modelProvider: selectedProvider,
                    modelName: selectedModel,
                    customConfig: customModelConfig
                }),
            });
            const data = await res.json();
            if (res.ok && data.basics) {
                setParsedData(data);
                toast.success('Resume parsing complete!', { id: 'parse-resume' });
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err: any) {
            console.error('Parsing failed', err);
            toast.error(`Failed to parse resume: ${err.message}`, { id: 'parse-resume' });
        } finally {
            setIsParsingGlobal(false);
        }
    };

    const clearParsedData = () => {
        setParsedData(null);
    };

    return (
        <ParseContext.Provider value={{ isParsingGlobal, parsedData, parseResumeGlobal, clearParsedData }}>
            {children}
        </ParseContext.Provider>
    );
}

export function useParse() {
    const context = useContext(ParseContext);
    if (context === undefined) {
        throw new Error('useParse must be used within a ParseProvider');
    }
    return context;
}
