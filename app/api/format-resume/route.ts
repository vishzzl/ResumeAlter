import { NextRequest, NextResponse } from 'next/server';
import { formatResumeToMarkdown } from '@/lib/resume-formatter';
import { CustomConfig } from '@/lib/generate';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { text, apiKey, modelProvider, modelName, customConfig } = body;

        if (!text || typeof text !== 'string' || text.trim().length < 20) {
            return NextResponse.json({ error: 'Resume text is required (min 20 chars)' }, { status: 400 });
        }

        const customUrl = process.env.CUSTOM_LLM_URL;
        let provider = modelProvider;
        if (!provider) {
            if (apiKey || process.env.GEMINI_API_KEY) provider = 'gemini';
            else if (customUrl) provider = 'custom';
            else provider = 'local';
        }

        const result = await formatResumeToMarkdown(text, {
            provider,
            apiKey,
            modelName,
            customConfig: customConfig as CustomConfig | undefined,
        });

        return NextResponse.json({
            formatted: result.formatted,
            wasPlainText: result.wasPlainText,
            detectedSections: result.detectedSections,
        });
    } catch (error) {
        console.error('[format-resume] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to format resume' },
            { status: 500 }
        );
    }
}
