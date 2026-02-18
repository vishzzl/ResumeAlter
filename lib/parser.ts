import { model, getGeminiModel } from './gemini';
import { generateWithLocal } from './ollama';
import { generateWithCustom } from './custom_llm';

export interface JobDetails {
    description: string;
    requirements: string[];
    skills: string[];
    experience: string[];
    jobType: string;
    company: string;
    title: string;
}

interface CustomConfig {
    localUrl?: string;
    localModel?: string;
    customUrl?: string;
    customKey?: string;
}

export async function parseJobDescriptionWithAI(text: string, apiKey?: string, provider: 'gemini' | 'local' | 'custom' = 'gemini', modelName: string = 'gemini-1.5-flash', customConfig?: CustomConfig): Promise<JobDetails | null> {
    // Uses gemini-2.0-flash from lib/gemini.ts
    // const aiModel = getGeminiModel(apiKey);

    // if (!aiModel) {
    //     console.error('Gemini model not initialized');
    //     return null;
    // }

    try {
        const prompt = `
        You are an expert job description analyzer.
        Extract the following details from the job description below:
        1. Requirements (list of bullet points)
        2. Skills (list of specific skills)
        3. Experience (list of experience requirements)
        4. Job Type (Full-time, Part-time, Contract, etc.)
        5. Company Name (The name of the hiring company)
        6. Job Title (The official title of the role)
        7. Cleaned Job Description (the main body of the text, cleaned of clutter)

        Output ONLY valid JSON with the following structure:
        {
            "description": "Cleaned description text",
            "requirements": ["req1", "req2"],
            "skills": ["skill1", "skill2"],
            "experience": ["exp1", "exp2"],
            "jobType": "Type",
            "company": "Company Name",
            "title": "Job Title"
        }

        Job Description:
        ${text}
        `;

        let responseText = '';

        if (provider === 'local') {
            const localModel = customConfig?.localModel || modelName || 'llama3';
            const result = await generateWithLocal(prompt, localModel, customConfig?.localUrl);
            responseText = result.response.text();
        } else if (provider === 'custom') {
            const result = await generateWithCustom(prompt, customConfig?.customUrl, customConfig?.customKey);
            responseText = result.response.text();
        } else {
            // Default to Gemini
            const aiModel = getGeminiModel(apiKey, modelName);
            if (!aiModel) {
                console.error('Gemini model not initialized');
                return null;
            }
            const result = await aiModel.generateContent(prompt);
            const response = await result.response;
            responseText = response.text();
        }

        // Clean up markdown code blocks if Gemini adds them
        const jsonString = responseText.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();

        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error parsing job description with AI:', error);
        return null;
    }
}
