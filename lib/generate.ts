import { getGeminiModel } from './gemini';
import { generateWithLocal } from './ollama';
import { generateWithCustom } from './custom_llm';

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

/**
 * Unified text generation across all providers (Gemini, Local/Ollama, Custom LLM).
 * Centralises system instruction, temperature, JSON mode, and fallback logic.
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

    const defaultModel = 'gemini-flash-latest';

    if (provider === 'custom') {
        const result = await generateWithCustom(prompt, customConfig?.customUrl, customConfig?.customKey);
        return result.response.text();
    }

    if (provider === 'local') {
        const localModel = customConfig?.localModel || modelName || 'llama3';
        const result = await generateWithLocal(prompt, localModel, customConfig?.localUrl);
        return result.response.text();
    }

    // ── Gemini ──
    try {
        const model = getGeminiModel(apiKey, modelName, {
            temperature,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
        }, systemInstruction);

        if (!model) throw new Error('Gemini API Key missing or invalid');

        const result = await model.generateContent(prompt);
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
            const result = await fallbackModel.generateContent(prompt);
            return result.response.text();
        }
        throw error;
    }
}

/**
 * Strip markdown fences and isolate the JSON object from LLM output.
 */
export function cleanJson(text: string): string {
    let jsonString = text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();

    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }

    return jsonString;
}
