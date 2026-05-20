import { NextRequest, NextResponse } from 'next/server';
import { evaluateAtsLLM } from '@/lib/llm-ats-scoring';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { resume, tailoredResume, jobDescription } = body;

        if (!tailoredResume || !jobDescription) {
            return NextResponse.json(
                { error: 'tailoredResume and jobDescription are required' },
                { status: 400 }
            );
        }

        const { atsScore, beforeCoverage, afterCoverage, groundedness, formatting } = await evaluateAtsLLM({
            originalResume: resume || tailoredResume,
            tailoredResume,
            jobDescription,
        });

        return NextResponse.json({
            atsScore,
            keywordCoverage: afterCoverage,
            beforeCoverage,
            groundedness,
            formatting,
            breakdown: atsScore.breakdown,
        });
    } catch (error) {
        console.error('[ats-score] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
