
import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const apiKey = searchParams.get('apiKey') || process.env.GEMINI_API_KEY;
    const modelName = searchParams.get('modelName') || 'gemini-1.5-flash';

    if (!apiKey) {
        return NextResponse.json({
            status: 'error',
            message: 'No API Key found. Please configure your key.',
            quotaExceeded: false,
            model: modelName
        }, { status: 400 });
    }

    try {
        const model = getGeminiModel(apiKey, modelName);
        if (!model) {
            throw new Error('Failed to initialize model');
        }

        // Minimal generation to check quota
        const result = await model.generateContent("Ping");
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({
            status: 'ok',
            message: 'Service is operational.',
            quotaExceeded: false,
            model: modelName,
            latency: 'Normal' // Placeholder
        });

    } catch (error: any) {
        console.error("Quota check failed:", error);

        const isQuota = error.message?.includes('429') || error.message?.includes('Quota exceeded');
        const isAuth = error.message?.includes('403') || error.message?.includes('API key not valid');
        const isModel = error.message?.includes('404') || error.message?.includes('not found');

        let message = 'Unknown error occurred.';
        if (isQuota) message = 'Quota exceeded. Please check your usage limits.';
        else if (isAuth) message = 'Invalid API Key or permissions.';
        else if (isModel) message = `Model ${modelName} not found or not supported.`;

        return NextResponse.json({
            status: 'error',
            message: message,
            quotaExceeded: isQuota,
            model: modelName,
            rawError: error.message
        }, { status: 200 }); // Return 200 so UI can handle the JSON body, or use 429/400? 
        // Better to return 200 with error details for this specific "check" endpoint
    }
}
