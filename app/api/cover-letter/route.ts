import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { generateWithLocal } from '@/lib/ollama';
import { generateWithCustom } from '@/lib/custom_llm';

export const maxDuration = 60;

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
        try {
            const model = getGeminiModel(apiKey, modelName);
            if (!model) throw new Error("Gemini API Key missing or invalid");
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error: any) {
            console.error(`Model ${modelName} failed. Error: ${error.message}`);
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

// Style presets for cover letter customization
const STYLE_PRESETS: Record<string, { lengthGuide: string; toneGuide: string; structureGuide: string }> = {
    professional: {
        lengthGuide: '3-4 paragraphs, approximately 300-350 words',
        toneGuide: 'Professional and confident, demonstrating expertise and enthusiasm',
        structureGuide: `
            - Opening: Strong hook connecting you to the company/role
            - Body (1-2 paragraphs): Highlight 2-3 key achievements that match the JD
            - Closing: Call to action and availability`,
    },
    concise: {
        lengthGuide: '2-3 short paragraphs, approximately 150-200 words',
        toneGuide: 'Direct and impactful, every sentence earns its place',
        structureGuide: `
            - Opening: One compelling sentence about fit
            - Body: 3-4 bullet points of key qualifications
            - Closing: Brief call to action`,
    },
    storytelling: {
        lengthGuide: '3-4 paragraphs, approximately 300-400 words',
        toneGuide: 'Engaging and narrative-driven, weaving a career story',
        structureGuide: `
            - Opening: Start with a relevant anecdote or career moment
            - Body: Connect your journey to this opportunity
            - Closing: Forward-looking statement about contributions`,
    },
    executive: {
        lengthGuide: '3 paragraphs, approximately 250-300 words',
        toneGuide: 'Authoritative and strategic, emphasizing leadership and impact',
        structureGuide: `
            - Opening: Value proposition statement
            - Body: Strategic achievements with quantified results
            - Closing: Vision for the role`,
    },
};

export async function POST(req: NextRequest) {
    try {
        const {
            resume,
            jobDescription,
            companyName,
            jobTitle,
            apiKey,
            modelProvider,
            modelName,
            customConfig,
            style = 'professional',
            customInstructions,
        } = await req.json();

        if (!resume || !jobDescription) {
            return NextResponse.json(
                { error: 'Resume and Job Description are required' },
                { status: 400 }
            );
        }

        // Resolve style preset
        const preset = STYLE_PRESETS[style] || STYLE_PRESETS.professional;

        // Determine model provider
        const customUrl = process.env.CUSTOM_LLM_URL;
        const forceLocal = process.env.USE_LOCAL_MODEL === 'true';
        const hasGeminiKey = !!apiKey || !!process.env.GEMINI_API_KEY;

        let provider = modelProvider;
        if (!provider) {
            if (hasGeminiKey) provider = 'gemini';
            else if (customUrl) provider = 'custom';
            else provider = 'local';
        }

        console.log(`Using Model Provider for Cover Letter: ${provider}, Style: ${style}`);

        const prompt = `
You are an expert Career Coach and Cover Letter Writer.
Write a cover letter for the candidate based on their resume and the job description.

COMPANY: ${companyName || 'the company'}
POSITION: ${jobTitle || 'the position'}

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resume}

STYLE: ${style.toUpperCase()}
- Length: ${preset.lengthGuide}
- Tone: ${preset.toneGuide}
- Structure: ${preset.structureGuide}

${customInstructions ? `ADDITIONAL INSTRUCTIONS FROM USER:\n${customInstructions}\n` : ''}

RULES:
1. **Be specific**: Reference actual skills, projects, and achievements from the resume. Never use generic filler.
2. **Match keywords**: Use exact terminology from the job description where the candidate's experience aligns.
3. **No lies**: Only reference experience and skills that exist in the resume. Do not fabricate.
4. **Quantify**: Include numbers and metrics from the resume wherever possible.
5. **Company research**: If the company name is provided, personalize the opening to show genuine interest.
6. **Format**: 
   - Do NOT include a date, address block, or "Dear Hiring Manager" — start directly with the opening paragraph.
   - Use clean paragraphs separated by blank lines.
   - End with "Sincerely," followed by the candidate's name (extracted from resume).
7. **ATS-friendly**: Use standard formatting, no special characters or tables.

OUTPUT: Return ONLY the cover letter text. No markdown headers, no JSON, no code blocks. Just the plain text cover letter.
`;

        const coverLetterText = await generateText(prompt, provider, apiKey, modelName, customConfig);

        // Clean up: remove any markdown artifacts the model might add
        const cleaned = coverLetterText
            .replace(/^```[\s\S]*?\n/, '')
            .replace(/\n```$/, '')
            .replace(/^#+\s.*\n/gm, '')
            .trim();

        return NextResponse.json({ coverLetter: cleaned });

    } catch (error) {
        console.error('Cover Letter API Error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 500 });
    }
}
