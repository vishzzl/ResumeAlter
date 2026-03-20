
const DEFAULT_CUSTOM_URL = process.env.CUSTOM_LLM_URL;

export async function generateWithCustom(prompt: string, apiUrl?: string, apiKey?: string) {
    const targetUrl = apiUrl || DEFAULT_CUSTOM_URL;

    if (!targetUrl) {
        throw new Error("Custom LLM URL is not defined");
    }

    try {
        let endpoint = targetUrl;
        console.log(`Sending request to Custom LLM at: ${endpoint}`);

        // Simple logic to append /generate if it looks like a base URL and not a full endpoint
        // This is heuristic and might strictly not be needed if user provides full URL
        if (!endpoint.endsWith('/generate') && !endpoint.includes('/v1/chat/completions')) {
            // Only append if it looks like the python script endpoint
            // If user provides standard OpenAI compat url, we might need different handling
            // For now, keep existing logic but respect user input
            // Check if user input looks like it needs the suffix
            // endpoint = endpoint.replace(/\/$/, '') + '/generate';
            // Commenting out auto-append for now to trust user input more, 
            // OR check if we are in 'legacy' mode.
            // Let's assume user provides full URL for custom.
        }

        // However, the legacy code enforced /generate. Let's keep it safe:
        if (targetUrl === process.env.CUSTOM_LLM_URL && !endpoint.endsWith('/generate')) {
            endpoint = endpoint.replace(/\/$/, '') + '/generate';
        }


        // Construct headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['x-api-key'] = apiKey; // Try both standard formats
        }

        // ... matches Colab script expectations ...
        console.log(JSON.stringify({
            prompt: prompt,
        }, null, 2))
        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                prompt: prompt,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Custom LLM API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log('Custom LLM Response:', JSON.stringify(data, null, 2)); // Log nicely for debugging

        let text = data.generated_text;
        if (!text && data.response) {
            text = data.response;
        }

        if (!text) {
            console.error('Custom LLM Response Invalid. Raw Data:', JSON.stringify(data, null, 2));
            throw new Error(`Invalid response format from Custom LLM: missing 'generated_text' or 'response'. Check your terminal logs for the raw response.`);
        }

        return {
            response: {
                text: () => text
            }
        };

    } catch (error) {
        console.error('Custom LLM Generation Error:', error);
        throw error;
    }
}
