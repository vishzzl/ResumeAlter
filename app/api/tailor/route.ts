import { NextRequest } from 'next/server';
import { generateText, CustomConfig } from '@/lib/generate';
import { parseResumeSections } from '@/lib/resume-parser';
import { db } from '@/lib/db';
import { applications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import {
    TAILORING_SYSTEM_INSTRUCTION,
    buildGapFixPrompt,
    buildTailoringPrompt,
    buildVerificationPrompt,
    enforceImmutableSections,
    mergeJDAnalysis,
    parseGapFixResponse,
    parseTailoringResponse,
    parseVerificationResponse,
    reconstructResume,
} from '@/lib/tailoring-prompts';
import {
    calculateAtsScore,
    calculateCoverageSet,
    computeSectionChanges,
    evidencedMissingKeywords,
    extractKeywordHints,
} from '@/lib/ats-scoring';

export const maxDuration = 180;

function sendSSE(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: Record<string, unknown>) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

async function setTailorStatus(appId: number, status: string, userId: number | null) {
    if (userId) {
        await db.update(applications).set({ tailorStatus: status }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
    } else {
        await db.update(applications).set({ tailorStatus: status }).where(eq(applications.id, appId));
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    const userId = session?.user?.id ? parseInt(session.user.id) : null;

    const body = await req.json();
    const { resume, jobDescription, apiKey, modelProvider, modelName, customConfig, applicationId } = body;

    const appId = applicationId ? parseInt(applicationId) : null;

    if (appId && !userId) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized to update application' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (!resume || !jobDescription) {
        return new Response(
            JSON.stringify({ error: 'Resume and Job Description are required' }),
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

    console.log(`[tailor] Using guarded tailoring pipeline: provider=${provider}, model=${modelName || 'default'}`);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const sections = parseResumeSections(resume);
                const keywordHints = extractKeywordHints(jobDescription);

                sendSSE(controller, encoder, { phase: 'extracting' });
                if (appId) await setTailorStatus(appId, 'tailoring', userId);

                sendSSE(controller, encoder, { phase: 'tailoring' });

                const tailoringText = await generateText({
                    prompt: buildTailoringPrompt(sections, jobDescription, keywordHints),
                    systemInstruction: TAILORING_SYSTEM_INSTRUCTION,
                    provider: provider!,
                    apiKey,
                    modelName,
                    customConfig: customConfig as CustomConfig,
                    temperature: 0.2,
                    jsonMode: true,
                });

                const tailoringResult = parseTailoringResponse(tailoringText, sections);
                const jdAnalysis = mergeJDAnalysis(keywordHints, tailoringResult.jdAnalysis);
                const generatedSections = enforceImmutableSections(sections, tailoringResult.tailoredSections);

                sendSSE(controller, encoder, { phase: 'verifying' });

                let verifiedSections = generatedSections;
                let verificationWarnings = [...tailoringResult.warnings];
                try {
                    const verificationText = await generateText({
                        prompt: buildVerificationPrompt(sections, generatedSections, jdAnalysis),
                        systemInstruction: TAILORING_SYSTEM_INSTRUCTION,
                        provider: provider!,
                        apiKey,
                        modelName,
                        customConfig: customConfig as CustomConfig,
                        temperature: 0.1,
                        jsonMode: true,
                    });
                    const verification = parseVerificationResponse(verificationText, generatedSections);
                    verifiedSections = enforceImmutableSections(sections, verification.correctedSections);
                    verificationWarnings = [...verificationWarnings, ...verification.warnings, ...verification.corrections];
                } catch (error) {
                    console.warn('[tailor] Verification pass failed; using generated sections with deterministic invariants.', error);
                    verificationWarnings.push('Verification pass failed; deterministic header and education safeguards were applied.');
                }

                const preFixResume = reconstructResume(verifiedSections);
                const preFixCoverage = calculateCoverageSet(
                    preFixResume,
                    jdAnalysis.requiredSkills,
                    jdAnalysis.preferredSkills
                );

                sendSSE(controller, encoder, { phase: 'gap_check', data: { preFixCoverage } });

                const missing = evidencedMissingKeywords(resume, preFixCoverage);
                let finalSections = verifiedSections;
                let injectedKeywords: string[] = [];
                const skippedKeywords: string[] = missing.unsupported.map(keyword => `${keyword} - not evidenced in original resume`);

                if (missing.evidenced.length > 0) {
                    try {
                        const gapFixText = await generateText({
                            prompt: buildGapFixPrompt({
                                originalSections: sections,
                                currentSections: verifiedSections,
                                jdAnalysis,
                                evidencedMissingKeywords: missing.evidenced,
                            }),
                            systemInstruction: TAILORING_SYSTEM_INSTRUCTION,
                            provider: provider!,
                            apiKey,
                            modelName,
                            customConfig: customConfig as CustomConfig,
                            temperature: 0.15,
                            jsonMode: true,
                        });
                        const gapFix = parseGapFixResponse(gapFixText, verifiedSections);
                        finalSections = enforceImmutableSections(sections, gapFix.tailoredSections);
                        injectedKeywords = gapFix.injectedKeywords;
                        skippedKeywords.push(...gapFix.skippedKeywords);
                        verificationWarnings.push(...gapFix.warnings);
                    } catch (error) {
                        console.warn('[tailor] Gap fix pass failed; using verified resume.', error);
                        skippedKeywords.push(...missing.evidenced.map(keyword => `${keyword} - gap fix failed`));
                    }
                }

                const tailoredResume = reconstructResume(finalSections);
                const finalCoverage = calculateCoverageSet(
                    tailoredResume,
                    jdAnalysis.requiredSkills,
                    jdAnalysis.preferredSkills
                );

                sendSSE(controller, encoder, {
                    phase: 'gap_fix_result',
                    data: { injected: injectedKeywords, skipped: skippedKeywords },
                });

                sendSSE(controller, encoder, {
                    phase: 'tailored',
                    data: {
                        tailoredResume,
                        keywordCoverage: finalCoverage,
                    },
                });

                if (appId && userId) {
                    await db.update(applications).set({
                        tailoredResume,
                        tailorStatus: 'analyzing',
                    }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
                }

                sendSSE(controller, encoder, { phase: 'analyzing' });

                const { atsScore } = calculateAtsScore({
                    originalResume: resume,
                    tailoredResume,
                    requiredKeywords: jdAnalysis.requiredSkills,
                    preferredKeywords: jdAnalysis.preferredSkills,
                });
                const changes = computeSectionChanges(resume, tailoredResume, tailoringResult.changeLog);

                if (verificationWarnings.length > 0) {
                    atsScore.analysis += ` Notes: ${verificationWarnings.slice(0, 3).join(' ')}`;
                }

                sendSSE(controller, encoder, {
                    phase: 'complete',
                    data: {
                        atsScore,
                        changes,
                    },
                });

                if (appId && userId) {
                    await db.update(applications).set({
                        analysis: JSON.stringify({
                            changes,
                            atsScore,
                        }),
                        tailorStatus: 'complete',
                    }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
                }

            } catch (error) {
                console.error('Streaming API Error:', error);
                sendSSE(controller, encoder, {
                    phase: 'error',
                    error: error instanceof Error ? error.message : 'Internal Server Error',
                });
                if (appId) await setTailorStatus(appId, 'error', userId);
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
