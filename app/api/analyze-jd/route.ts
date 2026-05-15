import { NextRequest } from 'next/server';
import { generateText, CustomConfig } from '@/lib/generate';
import { auth } from '@/auth';

export const maxDuration = 30;

export interface JDAnalysis {
    targetTitle: string;
    seniority: 'junior' | 'mid' | 'senior' | 'staff' | 'principal' | 'lead' | 'executive';
    requiredSkills: string[];
    preferredSkills: string[];
    keyVerbs: string[];
    companyDomain: string;
    keyPhrases: string[];
}

export async function POST(req: NextRequest) {
    await auth();
    const body = await req.json();
    const { jobDescription, apiKey, modelProvider, modelName, customConfig }: {
        jobDescription: string;
        apiKey?: string;
        modelProvider?: string;
        modelName?: string;
        customConfig?: CustomConfig;
    } = body;

    if (!jobDescription) {
        return Response.json({ error: 'jobDescription is required' }, { status: 400 });
    }

    const hasGeminiKey = !!apiKey || !!process.env.GEMINI_API_KEY;
    const customUrl = process.env.CUSTOM_LLM_URL;
    let provider = modelProvider;
    if (!provider) {
        if (hasGeminiKey) provider = 'gemini';
        else if (customUrl) provider = 'custom';
        else provider = 'local';
    }

    const prompt = `Analyze this job description for resume tailoring. Extract structured information.

JOB DESCRIPTION:
${jobDescription}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "targetTitle": "exact job title from the JD",
  "seniority": "junior|mid|senior|staff|principal|lead|executive",
  "requiredSkills": ["up to 12 skills from required/must-have sections"],
  "preferredSkills": ["up to 8 skills from preferred/nice-to-have sections"],
  "keyVerbs": ["up to 10 action verbs from responsibilities, e.g. architect, deploy, lead, scale"],
  "companyDomain": "one-word domain: fintech|healthcare|ecommerce|saas|gaming|consulting|enterprise|edtech",
  "keyPhrases": ["up to 8 exact multi-word phrases candidates should mirror, e.g. distributed systems at scale"]
}`;

    try {
        const raw = await generateText({
            prompt,
            systemInstruction: 'You are a precise JSON extractor. Return only valid JSON with no markdown fences.',
            provider: provider!,
            apiKey,
            modelName,
            customConfig,
            temperature: 0.1,
            jsonMode: true,
        });

        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        const result: JDAnalysis = {
            targetTitle: parsed.targetTitle || 'Target Role',
            seniority: parsed.seniority || 'senior',
            requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.slice(0, 12) : [],
            preferredSkills: Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills.slice(0, 8) : [],
            keyVerbs: Array.isArray(parsed.keyVerbs) ? parsed.keyVerbs.slice(0, 10) : [],
            companyDomain: parsed.companyDomain || 'technology',
            keyPhrases: Array.isArray(parsed.keyPhrases) ? parsed.keyPhrases.slice(0, 8) : [],
        };

        return Response.json(result);
    } catch (error) {
        console.error('[analyze-jd]', error);
        return Response.json({ error: 'JD analysis failed' }, { status: 500 });
    }
}
