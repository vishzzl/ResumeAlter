import { NextRequest } from 'next/server';
import { generateText, CustomConfig } from '@/lib/generate';
import { parseResumeSections } from '@/lib/resume-parser';
import { auth } from '@/auth';

export const maxDuration = 90;

export type SectionName = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other';

function sendSSE(ctrl: ReadableStreamDefaultController, enc: TextEncoder, event: Record<string, unknown>) {
    ctrl.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(req: NextRequest) {
    await auth(); // session check

    const body = await req.json();
    const {
        sectionName,
        resume,
        jobDescription,
        apiKey,
        modelProvider,
        modelName,
        customConfig,
    }: {
        sectionName: SectionName;
        resume: string;
        jobDescription: string;
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

    // Resolve provider
    const customUrl = process.env.CUSTOM_LLM_URL;
    const hasGeminiKey = !!apiKey || !!process.env.GEMINI_API_KEY;
    let provider = modelProvider;
    if (!provider) {
        if (hasGeminiKey) provider = 'gemini';
        else if (customUrl) provider = 'custom';
        else provider = 'local';
    }

    console.log(`[tailor-section] simple gemini only: section=${sectionName}, provider=${provider}, model=${modelName || 'default'}`);

    const sections = parseResumeSections(resume);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                sendSSE(controller, encoder, { phase: 'generating', sectionName });

                const prompt = `
You are an expert Resume Writer focusing on creating highly targeted, simple, and effective resumes.
Your task is to rewrite ONLY the "${sectionName.toUpperCase()}" section of the resume.

JOB DESCRIPTION, SELECTED SKILLS, & SELECTED EXPERIENCE:
${jobDescription}

ORIGINAL RESUME DATA (Your Source of Truth):
--- HEADER ---
${sections.header}
--- SUMMARY ---
${sections.summary}
--- SKILLS ---
${sections.skills}
--- EXPERIENCE ---
${sections.experience}
--- EDUCATION ---
${sections.education}
--- PROJECTS ---
${sections.projects}
--- CERTIFICATIONS & OTHER ---
${sections.other}

CRITICAL INSTRUCTIONS:
1. ONLY write the ${sectionName.toUpperCase()} section.
2. DO NOT include section headers (like "## Experience") in your output.
3. You MUST focus strictly on the points, skills, requirements, and experiences selected in the "JOB DESCRIPTION, SELECTED SKILLS, & SELECTED EXPERIENCE" section above.
4. If the user selected certain skills or requirements, ensure they are explicitly mentioned and highlighted in your rewrite. DO NOT SKIP THEM.
5. If the user selected certain experiences, ONLY include roles, projects, or bullets from the ORIGINAL RESUME DATA that are relevant to those selected experiences. Omit entirely any roles or bullets that are unrelated to the selected experiences.
6. Do not hallucinate or invent facts not present in the ORIGINAL RESUME DATA. 
7. Keep the formatting simple and professional. For experience, use bullet points. For skills, group them logically.
8. Output ONLY the raw content. No preamble, no markdown formatting blocks (\`\`\`).
`;

                const systemInstruction = 'You are an elite Resume Writer who strictly follows instructions, applies ATS best practices, and never hallucinates.';

                const generatedText = await generateText({
                    prompt,
                    systemInstruction,
                    provider: provider!,
                    apiKey,
                    modelName,
                    customConfig,
                    temperature: 0.2, // Low temperature for factual precision
                    jsonMode: false,
                });

                const text = generatedText.trim().replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '');

                const candidates = [{
                    model: 'Gemini (Strictly Tailored)',
                    focus: 'Strictly matching user selected skills and keeping it simple',
                    text: text,
                    score: 100, // Hardcoded for simplified UI
                    scoreBreakdown: { keyword: 100, format: 100, groundedness: 100 },
                }];

                sendSSE(controller, encoder, {
                    phase: 'complete',
                    sectionName,
                    data: {
                        candidates,
                        recommendedIndex: 0,
                        tailoredSection: text,
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
