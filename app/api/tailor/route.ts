import { NextRequest } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { generateWithLocal } from '@/lib/ollama';
import { generateWithCustom } from '@/lib/custom_llm';
import { parseResumeSections } from '@/lib/resume-parser';

export const maxDuration = 60; // Allow 60 seconds for processing

interface CustomConfig {
    localUrl?: string;
    localModel?: string;
    customUrl?: string;
    customKey?: string;
}

async function generateText(prompt: string, provider: string, apiKey?: string, modelName?: string, customConfig?: CustomConfig) {
    const defaultModel = 'gemini-flash-latest';

    if (provider === 'custom') {
        const result = await generateWithCustom(prompt, customConfig?.customUrl, customConfig?.customKey);
        return result.response.text();
    } else if (provider === 'local') {
        const localModel = customConfig?.localModel || modelName || 'llama3';
        const result = await generateWithLocal(prompt, localModel, customConfig?.localUrl);
        return result.response.text();
    } else {
        // Try with selected model
        try {
            const model = getGeminiModel(apiKey, modelName);
            if (!model) throw new Error("Gemini API Key missing or invalid");
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error: any) {
            // Fallback logic for Gemini
            console.error(`Model ${modelName} failed. Error: ${error.message}`);

            // Should we fallback?
            // Only fallback if the error is 404 (model not found) or 429/503 (transient) AND we aren't already on the default
            const isTransient = error.message?.includes('429') || error.message?.includes('503');
            const isNotFound = error.message?.includes('404');

            if (modelName !== defaultModel && (isTransient || isNotFound)) {
                console.log(`Falling back to ${defaultModel}...`);
                const fallbackModel = getGeminiModel(apiKey, defaultModel);
                if (!fallbackModel) throw new Error("Gemini API Key missing or invalid (Fallback)");
                const result = await fallbackModel.generateContent(prompt);
                return result.response.text();
            }
            throw error;
        }
    }
}

function cleanJson(text: string) {
    // 1. Remove markdown code blocks
    let jsonString = text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();

    // 2. Find the first '{' and last '}' to isolate JSON object
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    }

    return jsonString;
}

// Helper to send an SSE event through the stream
function sendSSE(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: Record<string, unknown>) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { resume, jobDescription, apiKey, modelProvider, modelName, customConfig } = body;

    if (!resume || !jobDescription) {
        return new Response(
            JSON.stringify({ error: 'Resume and Job Description are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Determine model source
    const customUrl = process.env.CUSTOM_LLM_URL;
    const hasGeminiKey = !!apiKey || !!process.env.GEMINI_API_KEY;

    let provider = modelProvider;
    if (!provider) {
        if (hasGeminiKey) provider = 'gemini';
        else if (customUrl) provider = 'custom';
        else provider = 'local';
    }

    console.log(`Using Model Provider for Tailoring: ${provider}, Model: ${modelName || 'default'}`);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // ─── PHASE 1: TAILORING ───
                sendSSE(controller, encoder, { phase: 'tailoring' });

                const sections = parseResumeSections(resume);

                const tailoringPrompt = `
        You are an expert Resume Writer and Career Coach, specialized in ATS optimization.
        Your goal is to rewrite the resume to match the Job Description (JD) perfectly while maintaining the candidate's authentic experience.

        JOB DESCRIPTION:
        ${jobDescription}
        
        CURRENT RESUME SECTIONS:
        
        --- HEADER ---
        ${sections.header}

        --- SUMMARY ---
        ${sections.summary}

        --- SKILLS ---
        ${sections.skills}
        
        --- EXPERIENCE ---
        ${sections.experience}
        
        INSTRUCTIONS:
        1. **Format for Machines & Humans**:
           - **IMPORTANT**: Return valid JSON.
           - **Escape all newlines** within the JSON string values (use \\\\n). 
           - **Do NOT** output literal newlines inside the JSON strings, as this breaks parsing.
        
        2. **Header**: 
           - **Name**: Format as \`# Name\`.
           - **Contact**: Provide email, phone, location, and links on a single line, separated by \` • \`.
           - **Style**: Use Markdown.

        3. **Summary**: 
           - Write a 3-4 sentence professional summary.
           - **ATS Hack**: Include the exact job title from the JD in the first sentence.
           - **CRITICAL**: Do NOT mention the company name from the JD. You are writing the candidate's history, not a cover letter.
           - Focus on *achievements* relevant to the JD.

        4. **Skills**:
           - Group into categories (e.g., **Languages**: ...).
           - **ATS Hack**: Include *exact keywords* from the JD. If the JD says "Python", do not just say "Coding".
           - Limit to the most relevant 15-20 skills.

        5. **Experience** (CRITICAL):
           - **Structure**:
             **Company Name** | **Role** | **Dates**
             *   Action verb + context + result (Quantified)
             *   Action verb + context + result
           - **Formatting**:
             - **MUST** use a star \`*\` for bullet points.
             - **MUST** place every bullet point on a **NEW LINE**.
             - **Example**: "Matched keywords...\\\\n* Increased sales by 20%...\\\\n* Led team of 5..."
           - **Content**:
             - Use the **STAR Method** (Situation, Task, Action, Result).
             - Quantify results (e.g., "reduced latency by 50%", "managed $1M budget").
             - **CRITICAL**: Do NOT mention the company name from the JD in any bullet points. modifying the past history to include the target company is strictly forbidden.
             - **Remove** irrelevant duties that don't match the JD.

        OUTPUT FORMAT (JSON ONLY):
        {
            "header": "# Name\\\\nEmail • Phone • Location",
            "summary": "Professional summary...",
            "skills": "**Tech**: A, B, C\\\\n**Soft Skills**: X, Y, Z",
            "experience": "**Company** | **Role** | **Date**\\\\n* Achievement 1\\\\n* Achievement 2..."
        }
        `;

                let tailoredSections = { ...sections };

                try {
                    console.log("Step 1: Tailoring Content...");
                    const tailoredText = await generateText(tailoringPrompt, provider, apiKey, modelName, customConfig);

                    const cleanText = cleanJson(tailoredText);
                    const data = JSON.parse(cleanText);

                    // Normalize: Convert any remaining literal \n (backslash+n as text) into real newlines
                    const normalizeNewlines = (s: string) => s.replace(/\\n/g, '\n');

                    if (data.header) tailoredSections.header = normalizeNewlines(data.header);
                    if (data.summary) tailoredSections.summary = normalizeNewlines(data.summary);
                    if (data.skills) tailoredSections.skills = normalizeNewlines(data.skills);
                    if (data.experience) tailoredSections.experience = normalizeNewlines(data.experience);

                } catch (e) {
                    console.error("Failed to tailor content", e);
                    // Fallback: keep original sections
                }

                // Reconstruct Full Resume
                let tailoredResume = `
${tailoredSections.header}

### Summary
${tailoredSections.summary}

### Experience
${tailoredSections.experience}

### Skills
${tailoredSections.skills}
`.trim();

                if (tailoredSections.education && tailoredSections.education.trim()) {
                    tailoredResume += `\n\n### Education\n${tailoredSections.education}`;
                }

                if (tailoredSections.projects && tailoredSections.projects.trim()) {
                    tailoredResume += `\n\n### Projects\n${tailoredSections.projects}`;
                }

                if (tailoredSections.other && tailoredSections.other.trim()) {
                    tailoredResume += `\n\n${tailoredSections.other}`;
                }

                // Send the tailored resume immediately — user sees the result before analysis finishes
                sendSSE(controller, encoder, {
                    phase: 'tailored',
                    data: { tailoredResume }
                });

                // ─── PHASE 2: ATS ANALYSIS ───
                sendSSE(controller, encoder, { phase: 'analyzing' });

                const analysisPrompt = `
        You are an ATS (Applicant Tracking System) Algorithm. 
        Analyze the resume below against the Job Description.

        JOB DESCRIPTION:
        ${jobDescription}
        
        RESUME:
        ${tailoredResume}
        
        INSTRUCTIONS:
        1. Calculate an **ATS Match Score** (0-100) based on keyword matching, experience relevance, and formatting.
        2. Identify specific changes made to improve the score.
        3. Be strict. A score of 85+ requires near-perfect alignment.

        OUTPUT FORMAT (JSON ONLY):
        {
            "atsScore": {
                "before": 40, 
                "after": 85,
                "analysis": "Added 'React' and 'Node.js', quantified sales achievements."
            },
            "changes": [
                 { "section": "Experience", "original": "Managed team...", "new": "Spearheaded team of 10...", "reason": "Added leadership keyword and team size." }
            ]
        }
        `;

                let analysisData = { atsScore: null as any, changes: [] as any[] };
                try {
                    console.log("Step 2: Analyzing...");
                    const analysisText = await generateText(analysisPrompt, provider, apiKey, modelName, customConfig);
                    const cleanAnalysis = cleanJson(analysisText);
                    analysisData = JSON.parse(cleanAnalysis);
                } catch (e) {
                    console.error("Failed to generate analysis", e);
                }

                // Send final result
                sendSSE(controller, encoder, {
                    phase: 'complete',
                    data: {
                        atsScore: analysisData.atsScore,
                        changes: analysisData.changes
                    }
                });

            } catch (error) {
                console.error('Streaming API Error:', error);
                sendSSE(controller, encoder, {
                    phase: 'error',
                    error: error instanceof Error ? error.message : 'Internal Server Error'
                });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
