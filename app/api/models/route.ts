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

const FALLBACK_MODELS: GeminiModelEntry[] = [
    {
        name: 'gemini-1.5-flash',
        displayName: 'Gemini 1.5 Flash',
        description: 'Fast and inexpensive for everyday tailoring flows.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: 'Fast resume tailoring and retries',
    },
    {
        name: 'gemini-1.5-pro',
        displayName: 'Gemini 1.5 Pro',
        description: 'Stronger reasoning with higher latency and higher quota risk.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'pro',
        stability: 'stable',
        bestFor: 'Heavier analysis and nuanced rewriting',
    },
    {
        name: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        description: 'Modern fast model with good balance for structured JSON tasks.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'preview',
        bestFor: 'Fast structured generation',
    },
    {
        name: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        description: 'High-speed Gemini with a larger context window and better reasoning.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'flash',
        stability: 'stable',
        bestFor: 'Recommended default for long resume + JD inputs',
    },
    {
        name: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        description: 'Strongest reasoning, but more likely to hit free-tier request and token limits.',
        inputTokenLimit: 1_000_000,
        outputTokenLimit: 8_192,
        family: 'pro',
        stability: 'stable',
        bestFor: 'Deep reasoning when quota allows',
    },
];

function normalizeModelName(name: string): string {
    return name.replace(/^models\//, '');
}

function inferFamily(name: string): GeminiModelEntry['family'] {
    if (/ultra/i.test(name)) return 'ultra';
    if (/pro/i.test(name)) return 'pro';
    if (/exp|experimental/i.test(name)) return 'experimental';
    return 'flash';
}

function inferStability(name: string): GeminiModelEntry['stability'] {
    if (/exp|experimental/i.test(name)) return 'experimental';
    if (/preview|beta/i.test(name)) return 'preview';
    return 'stable';
}

function inferBestFor(family: GeminiModelEntry['family']): string {
    switch (family) {
        case 'pro':
            return 'Highest reasoning quality';
        case 'ultra':
            return 'Premium generation quality';
        case 'experimental':
            return 'Preview testing and exploration';
        case 'flash':
        default:
            return 'Speed and lower timeout risk';
    }
}

function mergeWithFallback(entry: Partial<GeminiModelEntry> & { name: string; displayName: string }): GeminiModelEntry {
    const existing = FALLBACK_MODELS.find(model => model.name === entry.name);
    if (existing) {
        return {
            ...existing,
            ...entry,
            description: entry.description || existing.description,
            inputTokenLimit: entry.inputTokenLimit ?? existing.inputTokenLimit ?? null,
            outputTokenLimit: entry.outputTokenLimit ?? existing.outputTokenLimit ?? null,
            family: entry.family || existing.family,
            stability: entry.stability || existing.stability,
            bestFor: entry.bestFor || existing.bestFor,
        };
    }

    const family = entry.family || inferFamily(entry.name);
    return {
        name: entry.name,
        displayName: entry.displayName,
        description: entry.description || '',
        inputTokenLimit: entry.inputTokenLimit ?? null,
        outputTokenLimit: entry.outputTokenLimit ?? null,
        family,
        stability: entry.stability || inferStability(entry.name),
        bestFor: entry.bestFor || inferBestFor(family),
    };
}

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
    const apiKey = await resolveApiKey(req);

    if (!apiKey) {
        return NextResponse.json({ models: FALLBACK_MODELS });
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let models = Array.isArray(data.models) ? data.models : [];

        models = models.filter((model: any) =>
            Array.isArray(model.supportedGenerationMethods)
            && model.supportedGenerationMethods.includes('generateContent')
        );

        const allowedPattern = /^gemini-(1\.[5-9]|[2-9]\.\d+)-(flash|pro|ultra|exp).*$/;

        const cleanModels: GeminiModelEntry[] = models
            .map((model: any): GeminiModelEntry => {
                const name = normalizeModelName(model.name || '');
                return mergeWithFallback({
                    name,
                    displayName: model.displayName || name,
                    description: model.description,
                    inputTokenLimit: typeof model.inputTokenLimit === 'number' ? model.inputTokenLimit : null,
                    outputTokenLimit: typeof model.outputTokenLimit === 'number' ? model.outputTokenLimit : null,
                    family: inferFamily(name),
                    stability: inferStability(name),
                    bestFor: inferBestFor(inferFamily(name)),
                });
            })
            .filter((model: GeminiModelEntry) => allowedPattern.test(model.name))
            .sort((a: GeminiModelEntry, b: GeminiModelEntry) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
            .reverse();

        const mergedFallbacks = FALLBACK_MODELS.filter(
            fallback => !cleanModels.some((model: GeminiModelEntry) => model.name === fallback.name)
        );

        return NextResponse.json({
            models: [...cleanModels, ...mergedFallbacks],
        });

    } catch (error) {
        console.error('Error fetching models:', error);
        return NextResponse.json({
            models: FALLBACK_MODELS,
            error: 'Failed to fetch Gemini catalog, using curated fallback list.',
        });
    }
}

export async function GET(req: NextRequest) {
    return handler(req);
}

export async function POST(req: NextRequest) {
    return handler(req);
}
