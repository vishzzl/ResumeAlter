const fs = require('fs');
const path = require('path');

// Try to load .env.local manually
const envPath = path.resolve(__dirname, '..', '.env.local');
let apiKey = process.env.GEMINI_API_KEY;

if (!apiKey && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.startsWith('GEMINI_API_KEY=')) {
            apiKey = line.split('=')[1].trim();
            // Remove quotes if present
            if (apiKey.startsWith('"') && apiKey.endsWith('"')) {
                apiKey = apiKey.slice(1, -1);
            }
            break;
        }
    }
}

if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not found in environment or .env.local");
    process.exit(1);
}


async function formatModelSort(models) {
    // Sort by display name or name
    return models.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
}

async function listModels() {
    try {
        console.log("Fetching available models...");
        // For GoogleGenerativeAI, currently there isn't a direct listModels method exposed in the helper 
        // in some versions, but let's try the standard way or fallback to a known list if it fails.
        // Actually the SDK might not expose listModels directly on the client instance in all versions.
        // Let's try to infer if we can, or just try to generate with a few known ones to check validity.

        // Wait, the SDK *does* have makeRequest or similar, but let's see if we can just test a few common ones.
        // The user's error message said: "Call ListModels to see the list of available models"
        // This implies the API supports it. Code references usually use `genAI.getGenerativeModel`.
        // There is no `listModels` on `GoogleGenerativeAI` class directly in some versions.

        // However, we can use the `GenerativeModel` to run a prompt.
        // But to *list* them, we might need to use the REST API or look for a specific method.

        // Let's try to just use valid known models:
        // gemini-1.5-flash
        // gemini-1.5-pro
        // gemini-1.0-pro

        // But the user specifically asked to "list the models".
        // Use a simple fetch to the API endpoint if the SDK doesn't support it easily.

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const models = data.models || [];

        console.log(`Found ${models.length} models:`);

        // Filter for 'generateContent' support
        const supported = models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));

        const sortedModels = await formatModelSort(supported);

        sortedModels.forEach(m => {
            console.log(`- ${m.name.replace('models/', '')} (${m.displayName})`);
            // console.log(`  Description: ${m.description}`);
        });

        return sortedModels;

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
