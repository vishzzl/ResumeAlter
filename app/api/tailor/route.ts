import { NextRequest, NextResponse } from 'next/server';
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

    // 3. Dangerous: Attempt to fix unescaped newlines in JSON values
    // This regex looks for newlines that are NOT followed by a quote or } or , or ]
    // It's a heuristic and might break valid JSON but helps with "bad" LLM output
    // jsonString = jsonString.replace(/(?<!\\)\n/g, '\\n'); 

    return jsonString;
}

export async function POST(req: NextRequest) {
    try {
        const { resume, jobDescription, apiKey, modelProvider, modelName, customConfig } = await req.json();

        if (!resume || !jobDescription) {
            return NextResponse.json(
                { error: 'Resume and Job Description are required' },
                { status: 400 }
            );
        }

        // Determine model source
        const customUrl = process.env.CUSTOM_LLM_URL;
        const forceLocal = process.env.USE_LOCAL_MODEL === 'true';
        const hasGeminiKey = !!apiKey || !!process.env.GEMINI_API_KEY;

        let provider = modelProvider;
        if (!provider) {
            // Priority: Gemini (Fastest) > Custom > Local
            if (hasGeminiKey) provider = 'gemini';
            else if (customUrl) provider = 'custom';
            else provider = 'local';
        }

        console.log(`Using Model Provider for Tailoring: ${provider}, Model: ${modelName || 'default'}`);

        // Parsing Resume Sections
        const sections = parseResumeSections(resume);

        // ---------------------------------------------------------
        // STEP 1: TAILOR (Rewrite Summary, Experience, Skills in ONE go)
        // ---------------------------------------------------------

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
           - **Escape all newlines** within the JSON string values (use \\n). 
           - **Do NOT** output literal newlines inside the JSON strings, as this breaks parsing.
        
        2. **Header**: 
           - **Name**: Format as \`# Name\`.
           - **Contact**: Provide email, phone, location, and links on a single line, separated by \` • \`.
           - **Style**: Use Markdown.

        3. **Summary**: 
           - Write a 3-4 sentence professional summary.
           - **ATS Hack**: Include the exact job title from the JD in the first sentence.
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
             - **Example**: "Matched keywords...\\n* Increased sales by 20%...\\n* Led team of 5..."
           - **Content**:
             - Use the **STAR Method** (Situation, Task, Action, Result).
             - Quantify results (e.g., "reduced latency by 50%", "managed $1M budget").
             - **Remove** irrelevant duties that don't match the JD.

        OUTPUT FORMAT (JSON ONLY):
        {
            "header": "# Name\\nEmail • Phone • Location",
            "summary": "Professional summary...",
            "skills": "**Tech**: A, B, C\\n**Soft Skills**: X, Y, Z",
            "experience": "**Company** | **Role** | **Date**\\n* Achievement 1\\n* Achievement 2..."
        }
        `;

        let tailoredSections = { ...sections };

        try {
            console.log("Step 1: Tailoring Content...");
            const tailoredText = await generateText(tailoringPrompt, provider, apiKey, modelName, customConfig);
            // console.log("Raw Tailored Text:", tailoredText); // Debugging

            const cleanText = cleanJson(tailoredText);
            const data = JSON.parse(cleanText);

            // Normalize: Convert any remaining literal \n (backslash+n as text) into real newlines
            // The AI sometimes double-escapes newlines in JSON, leaving them as literal text after parse
            const normalizeNewlines = (s: string) => s.replace(/\\n/g, '\n');

            if (data.header) tailoredSections.header = normalizeNewlines(data.header);
            if (data.summary) tailoredSections.summary = normalizeNewlines(data.summary);
            if (data.skills) tailoredSections.skills = normalizeNewlines(data.skills);
            if (data.experience) tailoredSections.experience = normalizeNewlines(data.experience);

        } catch (e) {
            console.error("Failed to tailor content", e);
            // Fallback: keep original logic if parsing fails, but we already have originals in tailoredSections
        }

        // Reconstruct Full Resume with Conditional Headers
        // Ensure double newlines between sections for clean Markdown rendering
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


        // ---------------------------------------------------------
        // STEP 2: ANALYZE (ATS Score & Changes)
        // ---------------------------------------------------------

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

        let analysisData = { atsScore: null, changes: [] };
        try {
            console.log("Step 2: Analyzing...");
            const analysisText = await generateText(analysisPrompt, provider, apiKey, modelName, customConfig);
            const cleanAnalysis = cleanJson(analysisText);
            analysisData = JSON.parse(cleanAnalysis);
        } catch (e) {
            console.error("Failed to generate analysis", e);
        }

        return NextResponse.json({
            tailoredResume,
            atsScore: analysisData.atsScore,
            changes: analysisData.changes
        });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 500 });
    }
}
