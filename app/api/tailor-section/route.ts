import { NextRequest } from 'next/server';
import { generateText, CustomConfig } from '@/lib/generate';
import { parseResumeSections } from '@/lib/resume-parser';
import { auth } from '@/auth';
import {
    JDAnalysis,
    SECTION_SYSTEM_INSTRUCTION,
    TailorableSectionName,
    SectionPreference,
    buildSectionTailoringPrompt,
    mergeJDAnalysis,
    parseSectionResponse,
} from '@/lib/tailoring-prompts';
import { extractKeywordHints } from '@/lib/ats-scoring';

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
        preferences,
        customInstruction,
        apiKey,
        modelProvider,
        modelName,
        customConfig,
    }: {
        sectionName: SectionName;
        resume: string;
        jobDescription: string;
        jdAnalysis?: Partial<JDAnalysis>;
        preferences?: SectionPreference[];
        customInstruction?: string;
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

    const prefLabels = (preferences || ['quantify', 'keywords']).join('+');
    console.log(`[tailor-section] section=${sectionName}, provider=${provider}, prefs=${prefLabels}`);

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
                        preferences,
                        customInstruction,
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
                    parsed = parseSectionResponse(raw);
                } catch {
                    parsed = {
                        text: stripFences(raw),
                        warnings: ['Model did not return expected JSON format.'],
                    };
                }

                const finalText = parsed.text || sections[sectionName] || '';

                sendSSE(controller, encoder, {
                    phase: 'complete',
                    sectionName,
                    data: {
                        tailoredSection: finalText,
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
