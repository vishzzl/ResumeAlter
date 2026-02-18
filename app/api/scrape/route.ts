import { NextRequest, NextResponse } from 'next/server';
import { scrapeJobDescription } from '@/lib/scraper';
import { parseJobDescriptionWithAI } from '@/lib/parser';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { url, text, apiKey, modelProvider, modelName, customConfig } = await req.json();

        if (!url && !text) {
            return NextResponse.json({ error: 'URL or text content is required' }, { status: 400 });
        }

        let rawDescription = text;

        if (!rawDescription && url) {
            const { content, error: scrapeError } = await scrapeJobDescription(url);

            if (!content) {
                return NextResponse.json({
                    error: `Failed to scrape job description: ${scrapeError || 'Unknown error'}`
                }, { status: 500 });
            }
            rawDescription = content;
        }

        // Parse with AI
        const structuredData = await parseJobDescriptionWithAI(rawDescription, apiKey, modelProvider, modelName, customConfig);

        return NextResponse.json({
            description: rawDescription, // Keep raw description for backward compatibility or reference
            details: structuredData
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
