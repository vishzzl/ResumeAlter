import { NextResponse } from 'next/server';

const DEFAULT_API_URL = 'http://127.0.0.1:11434';
const DEFAULT_LOCAL_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:latest';

interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
}

export async function generateWithLocal(prompt: string, modelName: string = DEFAULT_LOCAL_MODEL, baseUrl: string = DEFAULT_API_URL) {
    try {
        // Ensure base URL doesn't have trailing slash
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        const apiUrl = `${cleanBaseUrl}/api/generate`;

        console.log(`Sending request to local model: ${modelName} at ${apiUrl}`);

        // Optimize prompt for Llama 3/Mistral to return JSON
        const systemPrompt = "You are a helpful assistant that outputs ONLY valid JSON.";
        const fullPrompt = `${systemPrompt}\n\n${prompt}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelName,
                prompt: fullPrompt,
                stream: false,
                format: "json",
                options: {
                    num_ctx: 4096,
                },
                keep_alive: "5m",
            }),
        }).catch(err => {
            throw new Error(`Failed to connect to Ollama at ${apiUrl}. Is it running? (Error: ${err.message})`);
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json() as OllamaResponse;

        // Use a structure compatible with Gemini's response format to minimize changes in route.ts
        return {
            response: {
                text: () => data.response
            }
        };

    } catch (error) {
        console.error('Local Generation Error:', error);
        throw error;
    }
}
