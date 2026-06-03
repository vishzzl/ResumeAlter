import { GoogleGenerativeAI } from '@google/generative-ai';

const envApiKey = process.env.GEMINI_API_KEY;

export const genAI = envApiKey ? new GoogleGenerativeAI(envApiKey) : null;
// Default model
export const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-flash-latest' }) : null;

if (model) {
    console.log('Initializing Gemini with default model: gemini-flash-latest');
} else {
    console.log('Gemini API key not found, skipping Gemini initialization');
}

export function getGeminiModel(
    apiKey?: string,
    modelName: string = 'gemini-flash-latest',
    generationConfig?: Record<string, any>,
    systemInstruction?: string
) {
    const key = apiKey || envApiKey;
    let actualModel = modelName;
    if (actualModel === 'gemini-1.5-flash') {
        actualModel = 'gemini-flash-latest';
    }
    if (key) {
        const genAI = new GoogleGenerativeAI(key);
        console.log(`Initializing Gemini with model: ${actualModel}`);
        return genAI.getGenerativeModel({
            model: actualModel,
            ...(generationConfig ? { generationConfig } : {}),
            ...(systemInstruction ? { systemInstruction } : {}),
        });
    }
    return model;
}
