
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure this key is always fresh

export async function GET() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        // Return default list if no server-side key
        return NextResponse.json({
            models: [
                { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash (Default)', description: 'Fast and versatile' },
                { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', description: 'High reasoning capability' },
                { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash (Preview)', description: 'Next-gen speed' },
                { name: 'gemini-1.0-pro', displayName: 'Gemini 1.0 Pro', description: 'Stable legacy model' }
            ]
        });
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let models = data.models || [];

        // Filter for models that support 'generateContent'
        models = models.filter((m: any) =>
            m.supportedGenerationMethods &&
            m.supportedGenerationMethods.includes("generateContent")
        );

        // Sort by display name or name
        models.sort((a: any, b: any) => (a.displayName || a.name).localeCompare(b.displayName || b.name));

        // Map to a cleaner format
        const cleanModels = models.map((m: any) => ({
            name: m.name.replace('models/', ''),
            displayName: m.displayName,
            description: m.description
        }));

        return NextResponse.json({ models: cleanModels });

    } catch (error) {
        console.error("Error fetching models:", error);
        // Fallback to a static list if API fails
        return NextResponse.json({
            models: [
                { name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash' },
                { name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro' },
                { name: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' }
            ],
            error: 'Failed to fetch from API, using fallback list.'
        });
    }
}
