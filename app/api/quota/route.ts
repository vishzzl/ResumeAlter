import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { createGeminiHealthyStatus, parseGeminiHealthError } from '@/lib/gemini-quota';

export const dynamic = 'force-dynamic';

async function resolveRequest(req: NextRequest): Promise<{ apiKey?: string; modelName: string }> {
    if (req.method === 'POST') {
        const body = await req.json();
        return {
            apiKey: body.apiKey || process.env.GEMINI_API_KEY,
            modelName: body.modelName || 'gemini-1.5-flash',
        };
    }

    return {
        apiKey: req.nextUrl.searchParams.get('apiKey') || process.env.GEMINI_API_KEY,
        modelName: req.nextUrl.searchParams.get('modelName') || 'gemini-1.5-flash',
    };
}

async function handler(req: NextRequest) {
    const { apiKey, modelName } = await resolveRequest(req);

    if (!apiKey) {
        return NextResponse.json({
            ...parseGeminiHealthError('API key not valid', modelName, 'manual'),
            state: 'auth',
            message: 'No Gemini API key found.',
            detail: 'Add a Gemini API key in Settings to run live health checks.',
        }, { status: 200 });
    }

    try {
        const model = getGeminiModel(apiKey, modelName);
        if (!model) {
            throw new Error('Failed to initialize model');
        }

        const result = await model.generateContent('Ping');
        await result.response.text();

        return NextResponse.json(createGeminiHealthyStatus(modelName, 'live_check'));
    } catch (error: unknown) {
        console.error('Quota check failed:', error);
        const rawError = error instanceof Error ? error.message : String(error);
        return NextResponse.json(parseGeminiHealthError(rawError, modelName, 'live_check'), { status: 200 });
    }
}

export async function GET(req: NextRequest) {
    return handler(req);
}

export async function POST(req: NextRequest) {
    return handler(req);
}
