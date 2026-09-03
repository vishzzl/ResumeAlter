import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface GeminiModelEntry {
    name: string;
    displayName: string;
    description?: string;
    inputTokenLimit?: number | null;
    outputTokenLimit?: number | null;
    family: 'flash' | 'pro' | 'ultra' | 'experimental';
    stability: 'stable' | 'preview' | 'experimental';
    bestFor: string;
}

const CURATED_USABLE_MODELS: GeminiModelEntry[] = [
    {
        name: 'gemini-3.8-flash',
        displayName: 'Gemini 3.8 Flash',
        description: 'Latest 3.8 Flash flagship for ultra-low latency & advanced reasoning.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: '⚡ Ultra-Fast Flagship Resume Tailoring',
    },
    {
        name: 'gemini-3.7-flash',
        displayName: 'Gemini 3.7 Flash',
        description: 'High-speed reasoning model for complex resume structuring.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: 'High-speed structured bullet rewrites',
    },
    {
        name: 'gemini-3.6-flash',
        displayName: 'Gemini 3.6 Flash',
        description: 'Optimized Flash model for real-time ATS optimization.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: 'Real-time keyword matching & ATS tailoring',
    },
    {
        name: 'gemini-3.5-flash',
        displayName: 'Gemini 3.5 Flash',
        description: 'Powerful price-performance Flash model.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: 'High volume tailoring & keyword optimization',
    },
    {
        name: 'gemini-3.5-flash-lite',
        displayName: 'Gemini 3.5 Flash-Lite',
        description: 'Lightweight low-latency model for rapid edits.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: 'Instant bullet rewrites & quick suggestions',
    },
    {
        name: 'gemini-3.1-flash-lite',
        displayName: 'Gemini 3.1 Flash-Lite',
        description: 'Efficient Flash-Lite variant with ultra-low quota footprint.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: 'Low quota footprint & high speed',
    },
    {
        name: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        description: 'Our best price-performance model for low-latency tasks requiring reasoning.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: 'Recommended Default (Low-latency & high reasoning)',
    },
    {
        name: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        description: 'Reliable classic Flash model with lightweight quota footprint.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: 'Everyday quick edits',
    },
];

async function resolveApiKey(req: NextRequest): Promise<string | undefined> {
    if (req.method === 'POST') {
        try {
            const body = await req.json();
            return body.apiKey || process.env.GEMINI_API_KEY;
        } catch {
            return process.env.GEMINI_API_KEY;
        }
    }

    return req.nextUrl.searchParams.get('apiKey') || process.env.GEMINI_API_KEY;
}

async function handler(req: NextRequest) {
    // Return exclusively curated, verified usable Gemini models
    return NextResponse.json({
        models: CURATED_USABLE_MODELS,
    });
}

export async function GET(req: NextRequest) {
    return handler(req);
}

export async function POST(req: NextRequest) {
    return handler(req);
}
