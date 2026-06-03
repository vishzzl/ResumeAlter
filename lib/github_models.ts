import { executeWithRateLimits } from './github-rate-limiter';

const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions';

export interface GitHubMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface GitHubOptions {
    model: string;
    messages: GitHubMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
    apiKey?: string;
    caller?: string;
}

/**
 * Normalizes model names to match the exact vendor-prefixed identifiers expected by the GitHub Models API.
 * e.g., 'gpt-4o-mini' -> 'openai/gpt-4o-mini', 'meta-llama-3.1-70b-instruct' -> 'meta/meta-llama-3.1-70b-instruct'
 */
function normalizeModelIdentifier(model: string): string {
    const m = model.toLowerCase();
    if (m === 'gpt-4o-mini' || m === 'openai/gpt-4o-mini') return 'openai/gpt-4o-mini';
    if (m === 'gpt-4o' || m === 'openai/gpt-4o') return 'openai/gpt-4o';
    if (m === 'meta-llama-3.1-70b-instruct' || m === 'meta/meta-llama-3.1-70b-instruct' || m === 'meta/llama-3.1-70b-instruct') {
        return 'meta/meta-llama-3.1-70b-instruct';
    }
    if (m === 'meta-llama-3.1-405b-instruct' || m === 'meta/meta-llama-3.1-405b-instruct' || m === 'meta/llama-3.1-405b-instruct' || m.includes('405b')) {
        return 'meta/Meta-Llama-3.1-405B-Instruct';
    }
    if (m.includes('cohere-command-r-plus') || m.includes('command-r-plus')) {
        return 'Cohere-command-r-plus';
    }
    return model; // Pass through custom or already normalized names
}

/**
 * Sends a chat completion request to the GitHub Models endpoint.
 * Wrapped in the custom rate limiter to strictly guarantee no rate limit violations.
 */
export async function callGitHubModels(options: GitHubOptions): Promise<string> {
    const apiKey = options.apiKey || process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_KEY;
    if (!apiKey) {
        throw new Error(
            'GITHUB_TOKEN or GITHUB_MODELS_KEY is not set in environment variables or settings. ' +
            'Please generate a GitHub Personal Access Token (PAT) with Copilot/Models access and add it to your browser settings.'
        );
    }

    const rawModel = options.model || 'gpt-4o-mini';
    const modelName = normalizeModelIdentifier(rawModel);

    const normalized = modelName.toLowerCase();
    let poolModelId: any = null;
    if (normalized.includes('cohere-command-r-plus') || normalized.includes('command-r-plus')) {
        poolModelId = 'cohere-command-r-plus';
    } else if (normalized.includes('405b')) {
        poolModelId = 'meta-llama-3.1-405b';
    }

    if (poolModelId && options.caller !== 'model-pool') {
        try {
            const { modelPoolManager } = require('./model-pool');
            modelPoolManager.recordCall(poolModelId);
        } catch (e) {
            console.warn('[GitHub Models API] Failed to record call in model pool:', e);
        }
    }

    try {
        // Wrap the fetch request in the rate limiter logic
        return await executeWithRateLimits(modelName, async () => {
            const body: Record<string, unknown> = {
                model: modelName,
                messages: options.messages,
                temperature: options.temperature ?? 0.7,
            };

            // Guarantee ample output headroom (max 4000 tokens) to prevent Llama/Cohere JSON truncation
            body.max_tokens = options.max_tokens || 4000;

            // Only include response_format if using a model that strictly supports structured output
            // (OpenAI and Cohere models support this, Llama 3 models on GitHub sometimes require it inside the prompt).
            if (options.response_format) {
                body.response_format = options.response_format;
            }

            console.log(`[GitHub Models API] Sending request to Azure/GitHub endpoint for model: ${modelName}`);

            const res = await fetch(GITHUB_MODELS_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error(`[GitHub Models API] Error [${res.status}]:`, errorText);
                throw new Error(`GitHub Models API Error: ${res.status} — ${errorText.slice(0, 250)}`);
            }

            const data = await res.json();
            const content = data?.choices?.[0]?.message?.content;
            
            if (!content) {
                throw new Error('[GitHub Models API] Returned empty or malformed response');
            }

            return content;
        });
    } catch (err: any) {
        const is429 =
            err?.status === 429 ||
            err?.message?.includes('429') ||
            err?.message?.includes('rate limit') ||
            err?.message?.includes('RateLimit');
        if (is429 && poolModelId && options.caller !== 'model-pool') {
            try {
                const { modelPoolManager } = require('./model-pool');
                modelPoolManager.markAsExhausted(poolModelId);
            } catch (e) {
                console.warn('[GitHub Models API] Failed to mark as exhausted in model pool:', e);
            }
        }
        throw err;
    }
}

/**
 * Curated list of free tier models available on GitHub Marketplace / Models
 */
export const GITHUB_FREE_MODELS = [
    {
        name: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini (GitHub)',
        description: 'Blazing fast, highly accurate, and extremely safe on rate limits.',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'flash' as const,
        stability: 'stable' as const,
        bestFor: 'Low tier: Ideal for fast, concurrent resume tailoring operations',
    },
    {
        name: 'gpt-4o',
        displayName: 'GPT-4o (GitHub)',
        description: 'Elite reasoning and narrative quality, restricted to 10 RPM / 50 RPD.',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'pro' as const,
        stability: 'stable' as const,
        bestFor: 'High tier: Deep ATS verification and advanced custom cover letters',
    },
    {
        name: 'meta-llama-3.1-70b-instruct',
        displayName: 'Llama 3.1 70B (GitHub)',
        description: 'Open weight powerhouse from Meta, balanced and robust.',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'pro' as const,
        stability: 'stable' as const,
        bestFor: 'Low tier: Excellent general resume structuring and bullet points',
    },
    {
        name: 'Cohere-command-r-plus',
        displayName: 'Cohere Command R+ (GitHub)',
        description: 'Highly optimized for long context document search and structured parsing.',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'pro' as const,
        stability: 'stable' as const,
        bestFor: 'High tier: Outstanding for Phase 0 keyword extraction',
    },
    {
        name: 'meta/Meta-Llama-3.1-405B-Instruct',
        displayName: 'Llama 3.1 405B (GitHub)',
        description: 'Elite open weights model with massive reasoning power (restricted limits).',
        inputTokenLimit: 8000,
        outputTokenLimit: 4000,
        family: 'pro' as const,
        stability: 'stable' as const,
        bestFor: 'High tier: Masterful structural edits and deep complex verification',
    }
];
