
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
                { name: 'gemini-2.0-pro-exp', displayName: 'Gemini 2.0 Pro (Experimental)', description: 'Latest experimental model' }
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

        // Strict filtering for high-quality models (1.5, 2.0, 2.5, 3.0)
        // Regex matches: gemini-1.5-*, gemini-2.0-*, gemini-2.5-*, gemini-3.0-*
        // And ensures it's a flash, pro, or ultra variant (or experimental)
        const allowedPattern = /^gemini-(1\.[5-9]|[2-9]\.\d+)-(flash|pro|ultra|exp).*$/;

        models = models.filter((m: any) => {
            const name = m.name.replace('models/', '');
            return allowedPattern.test(name);
        });

        // Sort by version (descending) then by capability (Ultra > Pro > Flash)
        models.sort((a: any, b: any) => {
            const nameA = a.name.replace('models/', '');
            const nameB = b.name.replace('models/', '');
            return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
        });

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
