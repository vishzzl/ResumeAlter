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
            const { content, error: scrapeError, scrapeBlocked } = await scrapeJobDescription(url);

            if (scrapeBlocked) {
                // Surface auth-wall detection to the client so the UI can auto-show the paste field
                return NextResponse.json({
                    scrapeBlocked: true,
                    error: scrapeError || 'The job page requires a login or is blocking automated access. Please paste the job description manually.',
                }, { status: 200 }); // 200 so the client can distinguish from network errors
            }

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
            description: rawDescription,
            details: structuredData
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
