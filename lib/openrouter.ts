/**
 * OpenRouter API Client — calls free models via the OpenAI-compatible endpoint.
 * No SDK needed, just fetch.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface OpenRouterOptions {
    model: string;
    messages: OpenRouterMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' };
}

/**
 * Send a chat completion request to OpenRouter.
 * Returns the raw text content from the first choice.
 */
export async function callOpenRouter(options: OpenRouterOptions): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not set in environment variables. Get a free key at https://openrouter.ai');
    }

    const body: Record<string, unknown> = {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
    };

    if (options.max_tokens) {
        body.max_tokens = options.max_tokens;
    }
    if (options.response_format) {
        body.response_format = options.response_format;
    }

    const res = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://resumealter.dev',
            'X-OpenRouter-Title': 'ResumeAlter Ensemble',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`OpenRouter Error [${res.status}]:`, errorText);
        throw new Error(`OpenRouter API Error: ${res.status} — ${errorText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('OpenRouter returned empty response');
    }
    return content;
}

/**
 * Pre-configured free models for the ensemble pipeline.
 */
export const FREE_MODELS = {
    // InclusionAI Ring — strong general-purpose free model
    PRIMARY: 'inclusionai/ring-2.6-1t:free',
    // Poolside Laguna — code-savvy free model
    LAGUNA: 'poolside/laguna-m.1:free',
    // Fact-checking model
    FACTCHECK: 'inclusionai/ring-2.6-1t:free',
    // Fallback: the OpenRouter auto-router for free models
    AUTO_FREE: 'openrouter/auto',
};
