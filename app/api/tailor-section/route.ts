import { NextRequest } from 'next/server';
import { generateText, CustomConfig } from '@/lib/generate';
import { parseResumeSections } from '@/lib/resume-parser';
import { auth } from '@/auth';
import {
    JDAnalysis,
    SECTION_SYSTEM_INSTRUCTION,
    TailorableSectionName,
    buildSectionTailoringPrompt,
    mergeJDAnalysis,
    parseSectionCandidateResponse,
} from '@/lib/tailoring-prompts';
import {
    extractKeywordHints,
    scoreSectionCandidate,
} from '@/lib/ats-scoring';

export const maxDuration = 90;

export type SectionName = TailorableSectionName;

function sendSSE(ctrl: ReadableStreamDefaultController, enc: TextEncoder, event: Record<string, unknown>) {
    ctrl.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
}

function stripFences(text: string): string {
    return text.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
}

export async function POST(req: NextRequest) {
    await auth();

    const body = await req.json();
    const {
        sectionName,
        resume,
        jobDescription,
        jdAnalysis: incomingJdAnalysis,
        apiKey,
        modelProvider,
        modelName,
        customConfig,
    }: {
        sectionName: SectionName;
        resume: string;
        jobDescription: string;
        jdAnalysis?: Partial<JDAnalysis>;
        apiKey?: string;
        modelProvider?: string;
        modelName?: string;
        customConfig?: CustomConfig;
    } = body;

    const validSections: SectionName[] = ['summary', 'skills', 'experience', 'education', 'projects', 'other'];
    if (!sectionName || !validSections.includes(sectionName)) {
        return new Response(
            JSON.stringify({ error: `Invalid sectionName. Must be one of: ${validSections.join(', ')}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
    if (!resume || !jobDescription) {
        return new Response(
            JSON.stringify({ error: 'resume and jobDescription are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const customUrl = process.env.CUSTOM_LLM_URL;
    const hasGeminiKey = !!apiKey || !!process.env.GEMINI_API_KEY;
    let provider = modelProvider;
    if (!provider) {
        if (hasGeminiKey) provider = 'gemini';
        else if (customUrl) provider = 'custom';
        else provider = 'local';
    }

    console.log(`[tailor-section] guarded variants: section=${sectionName}, provider=${provider}, model=${modelName || 'default'}`);

    const sections = parseResumeSections(resume);
    const keywordHints = extractKeywordHints(jobDescription);
    const mergedJdAnalysis = mergeJDAnalysis(keywordHints, incomingJdAnalysis);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                sendSSE(controller, encoder, { phase: 'generating', sectionName });

                const raw = await generateText({
                    prompt: buildSectionTailoringPrompt({
                        sectionName,
                        sections,
                        jobDescription,
                        jdAnalysis: mergedJdAnalysis,
                    }),
                    systemInstruction: SECTION_SYSTEM_INSTRUCTION,
                    provider: provider!,
                    apiKey,
                    modelName,
                    customConfig,
                    temperature: 0.35,
                    jsonMode: true,
                });

                let parsed;
                try {
                    parsed = parseSectionCandidateResponse(raw);
                } catch {
                    parsed = {
                        candidates: [{
                            model: 'Balanced ATS',
                            focus: 'Fallback single variant from model text',
                            text: stripFences(raw),
                        }],
                        warnings: ['Model did not return JSON candidates.'],
                    };
                }

                const candidates = parsed.candidates
                    .slice(0, 3)
                    .map(candidate => {
                        const scored = scoreSectionCandidate({
                            sectionName,
                            candidateText: candidate.text,
                            originalResume: resume,
                            requiredKeywords: mergedJdAnalysis.requiredSkills,
                            preferredKeywords: mergedJdAnalysis.preferredSkills,
                        });
                        return {
                            model: candidate.model,
                            focus: candidate.focus,
                            text: candidate.text,
                            score: scored.score,
                            scoreBreakdown: scored.scoreBreakdown,
                        };
                    })
                    .sort((a, b) => b.score - a.score);

                const finalCandidates = candidates.length > 0
                    ? candidates
                    : [{
                        model: 'Original Section',
                        focus: 'No generated candidate was usable; preserved source content',
                        text: sections[sectionName],
                        score: 0,
                        scoreBreakdown: { keyword: 0, format: 0, groundedness: 100 },
                    }];

                sendSSE(controller, encoder, {
                    phase: 'complete',
                    sectionName,
                    data: {
                        candidates: finalCandidates,
                        recommendedIndex: 0,
                        tailoredSection: finalCandidates[0].text,
                        warnings: parsed.warnings,
                    },
                });

            } catch (error) {
                console.error(`[tailor-section] Error for section=${sectionName}:`, error);
                sendSSE(controller, encoder, {
                    phase: 'error',
                    sectionName,
                    error: error instanceof Error ? error.message : 'Section generation failed',
                });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
