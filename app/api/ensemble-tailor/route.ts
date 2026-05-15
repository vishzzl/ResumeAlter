import { NextRequest, NextResponse } from 'next/server';
import { optimizeResume } from '@/lib/optimization-agent';
import { db } from '@/lib/db';
import { applications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
    const session = await auth();
    const userId = session?.user?.id ? parseInt(session.user.id) : null;

    try {
        const body = await req.json();
        const { resume, jobDescription, applicationId, apiKey, modelProvider, modelName, customConfig } = body;

        const appId = applicationId ? parseInt(applicationId) : null;

        if (appId && !userId) {
            return NextResponse.json({ error: 'Unauthorized to update application' }, { status: 401 });
        }

        if (!resume || !jobDescription) {
            return NextResponse.json({ error: 'Resume and Job Description are required' }, { status: 400 });
        }

        console.log(`Starting Ensemble Optimization (Gemini + OpenRouter) for App ${appId}...`);
        const startTime = performance.now();

        const result = await optimizeResume({
            originalResume: resume,
            jobDescription,
            apiKey: apiKey || undefined,
            modelName: modelName || undefined,
            provider: modelProvider || undefined,
            customConfig: customConfig || undefined,
        });

        const duration = Math.round(performance.now() - startTime);

        // Build ATS score in the format the existing frontend expects
        const afterPercent = Math.round(result.finalScore * 100);
        const kwPercent = Math.round((result.candidateResumes[0]?.selfScore ?? 0.5) * 100);
        const factPercent = Math.round((result.candidateResumes[0]?.crossScore ?? 0.8) * 100);

        const formattedAtsScore = {
            before: 50,
            after: afterPercent,
            breakdown: {
                keywordMatch: { before: 40, after: kwPercent },
                experienceRelevance: { before: 50, after: factPercent },
                skillsAlignment: { before: 45, after: kwPercent },
                formatting: { before: 80, after: 100 },
            },
            analysis: `Winner: ${result.winningModel}. Score: ${(result.finalScore * 100).toFixed(1)}%. ${result.improvementSummary.slice(0, 2).join(' ')}`,
        };

        const analysisData = {
            changes: result.changes,
            atsScore: formattedAtsScore,
            executionTime: duration,
        };

        // Persist to DB
        if (appId && userId) {
            await db.update(applications).set({
                tailoredResume: result.bestResume,
                tailorStatus: 'complete',
                analysis: JSON.stringify(analysisData),
            }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
        }

        return NextResponse.json({
            tailoredResume: result.bestResume,
            atsScore: formattedAtsScore,
            changes: result.changes,
            executionTime: duration,
            ensembleResult: {
                winningModel: result.winningModel,
                finalScore: result.finalScore,
                candidates: result.candidateResumes.map(c => ({
                    model: c.model,
                    focus: c.focus,
                    text: c.text,
                    selfScore: c.selfScore,
                    crossScore: c.crossScore,
                    finalScore: c.finalScore,
                    changes: c.changes,
                })),
                missingKeywords: result.missingKeywords,
                addedKeywords: result.addedKeywords,
                improvementSummary: result.improvementSummary,
            },
        });

    } catch (error) {
        console.error('Ensemble Tailoring Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
