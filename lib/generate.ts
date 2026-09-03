import { getGeminiModel } from './gemini';
import { generateWithLocal } from './ollama';
import { generateWithCustom } from './custom_llm';
import { callGitHubModels } from './github_models';


export interface CustomConfig {
    localUrl?: string;
    localModel?: string;
    customUrl?: string;
    customKey?: string;
}

export interface GenerateOptions {
    prompt: string;
    systemInstruction?: string;
    provider: string;
    apiKey?: string;
    modelName?: string;
    customConfig?: CustomConfig;
    temperature?: number;
    jsonMode?: boolean;
}

export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new TimeoutError(errorMessage)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// ── Retry helper ──────────────────────────────────────────────────────────────
const RETRY_DELAYS_MS = [1000, 2000]; // 2 retries: wait 1s then 2s


function isRetryable(error: any): boolean {
    const msg: string = error?.message ?? '';
    return msg.includes('429') || msg.includes('503') || msg.includes('500');
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt < RETRY_DELAYS_MS.length && isRetryable(err)) {
                console.warn(`LLM call failed (attempt ${attempt + 1}), retrying in ${RETRY_DELAYS_MS[attempt]}ms...`);
                await new Promise(res => setTimeout(res, RETRY_DELAYS_MS[attempt]));
            } else {
                break;
            }
        }
    }
    throw lastError;
}

/**
 * Unified text generation across all providers (Gemini, Local/Ollama, Custom LLM).
 * Centralises system instruction, temperature, JSON mode, and fallback logic.
 * Includes exponential-backoff retry on transient errors (429, 503, 500).
 */
export async function generateText(opts: GenerateOptions): Promise<string> {
    const {
        prompt,
        systemInstruction,
        provider,
        apiKey,
        modelName,
        customConfig,
        temperature = 1.0,
        jsonMode = false,
    } = opts;

    const defaultModel = 'gemini-2.5-flash';
    const TIMEOUT_MS = 60000; // 60 seconds

    if (provider === 'custom') {
        return withRetry(async () => {
            const result = await withTimeout(
                generateWithCustom(prompt, customConfig?.customUrl, customConfig?.customKey),
                TIMEOUT_MS,
                `Custom model timed out after 60s`
            );
            return result.response.text();
        });
    }

    if (provider === 'local') {
        const localModel = customConfig?.localModel || modelName || 'llama3';
        return withRetry(async () => {
            const result = await withTimeout(
                generateWithLocal(prompt, localModel, customConfig?.localUrl),
                TIMEOUT_MS,
                `Local model timed out after 60s`
            );
            return result.response.text();
        });
    }

    if (provider === 'github') {
        const githubModel = modelName || 'gpt-4o-mini';
        return withRetry(async () => {
            const messages: any[] = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            messages.push({ role: 'user', content: prompt });

            const result = await withTimeout(
                callGitHubModels({
                    model: githubModel,
                    messages,
                    temperature,
                    apiKey,
                    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
                }),
                TIMEOUT_MS,
                `GitHub Model ${githubModel} timed out after 60s`
            );
            return result;
        });
    }

    // ── Gemini ──
    return withRetry(async () => {
        try {
            const model = getGeminiModel(apiKey, modelName, {
                temperature,
                ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
            }, systemInstruction);

            if (!model) throw new Error('Gemini API Key missing or invalid');

            const result = await withTimeout(
                model.generateContent(prompt),
                TIMEOUT_MS,
                `Gemini model ${modelName} timed out after 60s`
            );
            return result.response.text();
        } catch (error: any) {
            console.error(`Model ${modelName} failed. Error: ${error.message}`);

            const isTransient = error.message?.includes('429') || error.message?.includes('503');
            const isNotFound = error.message?.includes('404');

            if (modelName !== defaultModel && (isTransient || isNotFound)) {
                console.log(`Falling back to ${defaultModel}...`);
                const fallbackModel = getGeminiModel(apiKey, defaultModel, {
                    temperature,
                    ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
                }, systemInstruction);

                if (!fallbackModel) throw new Error('Gemini API Key missing or invalid (Fallback)');
                const result = await withTimeout(
                    fallbackModel.generateContent(prompt),
                    TIMEOUT_MS,
                    `Gemini fallback model ${defaultModel} timed out after 60s`
                );
                return result.response.text();
            }
            throw error;
        }
    });
}

// ── JSON sanitisation helpers ─────────────────────────────────────────────────

/**
 * Fix the most common LLM JSON encoding mistakes:
 *   1. Trailing commas before ] or }
 *   2. Raw control characters (newline, tab, CR) embedded inside JSON strings
 *      — these cause "Expected ',' or ']' after array element" parse errors
 *   3. Any other ASCII control char (0x00–0x1F) inside a string
 */
function sanitizeJson(raw: string): string {
    // 1. Remove trailing commas before ] or }
    const s = raw.replace(/,\s*([}\]])/g, '$1');

    // 2. Fix raw control characters and unescaped quotes embedded inside string values.
    //    We scan char-by-char so we only touch content actually inside a JSON string.
    let result = '';
    let inStr = false;
    let esc = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (esc) { result += ch; esc = false; continue; }
        if (ch === '\\' && inStr) { result += ch; esc = true; continue; }
        
        if (ch === '"') {
            if (inStr) {
                // Smart Lookahead: Is this quote followed by a JSON structural separator?
                let isClosing = false;
                let j = i + 1;
                while (j < s.length) {
                    const nextCh = s[j];
                    if (/\s/.test(nextCh)) { j++; continue; }
                    if (nextCh === ':') {
                        isClosing = true;
                    } else if (nextCh === '}' || nextCh === ']') {
                        isClosing = true;
                    } else if (nextCh === ',') {
                        // After a comma, we expect a new key (starts with '"') or new value item ('"', '[', '{', number, boolean, null)
                        let k = j + 1;
                        let nextToken = '';
                        while (k < s.length) {
                            const nCh = s[k];
                            if (/\s/.test(nCh)) { k++; continue; }
                            nextToken = nCh;
                            break;
                        }
                        if (nextToken === '"' || nextToken === '{' || nextToken === '[' || nextToken === '}' || nextToken === ']' || /[0-9tfn\-]/.test(nextToken)) {
                            isClosing = true;
                        }
                    }
                    break;
                }

                if (isClosing) {
                    inStr = false;
                    result += ch;
                } else {
                    // It's an unescaped inner quote inside a string! Escape it.
                    result += '\\"';
                }
            } else {
                inStr = true;
                result += ch;
            }
            continue;
        }

        if (inStr) {
            if (ch === '\n') { result += '\\n'; continue; }
            if (ch === '\r') { result += '\\r'; continue; }
            if (ch === '\t') { result += '\\t'; continue; }
            if (ch.charCodeAt(0) < 0x20) continue; // strip other control chars
        }
        result += ch;
    }
    return result;
}

/**
 * Extract the first balanced JSON object or array from LLM output.
 *
 * Handles:
 *   - Markdown code fences (```json ... ```)
 *   - Extra prose before/after the JSON
 *   - Nested objects/arrays (balanced-brace walk, not lastIndexOf)
 *   - Common LLM encoding mistakes via sanitizeJson:
 *       trailing commas, raw newlines inside strings, control chars
 */
export function cleanJson(text: string): string {
    // Strip markdown fences
    const str = text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

    const firstBrace = str.indexOf('{');
    const firstBracket = str.indexOf('[');

    if (firstBrace === -1 && firstBracket === -1) return str;

    let startChar: string;
    let endChar: string;
    let startIdx: number;

    if (firstBrace === -1 || (firstBracket !== -1 && firstBracket < firstBrace)) {
        startChar = '['; endChar = ']'; startIdx = firstBracket;
    } else {
        startChar = '{'; endChar = '}'; startIdx = firstBrace;
    }

    // Balanced-brace walk (respects strings and escape sequences)
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIdx; i < str.length; i++) {
        const ch = str[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (ch === startChar) depth++;
        else if (ch === endChar) {
            depth--;
            if (depth === 0) {
                const extracted = str.substring(startIdx, i + 1);

                // Pass 1: try raw extracted JSON
                try { JSON.parse(extracted); return extracted; } catch { /* fall through */ }

                // Pass 2: sanitize (fix control chars, trailing commas) then retry
                const sanitized = sanitizeJson(extracted);
                try { JSON.parse(sanitized); return sanitized; } catch { /* fall through */ }

                // Pass 3: sanitize the whole string in case the balance walk was off
                const sanitizedFull = sanitizeJson(str);
                try { JSON.parse(sanitizedFull); return sanitizedFull; } catch { /* fall through */ }

                // Give up — return best effort so the caller gets a meaningful parse error
                return sanitized;
            }
        }
    }

    // Never found balanced end — sanitize and return
    return sanitizeJson(str);
}
