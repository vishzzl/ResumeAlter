import { generateText, cleanJson, CustomConfig } from './generate';

export interface JobDetails {
    description: string;
    requirements: string[];
    requiredSkills: string[];
    preferredSkills: string[];
    /** @deprecated Use requiredSkills / preferredSkills instead */
    skills: string[];
    experience: string[];
    experienceLevel: string;
    jobType: string;
    company: string;
    title: string;
    location: string;
    remote: boolean;
    salary: string;
}

export async function parseJobDescriptionWithAI(
    text: string,
    apiKey?: string,
    provider: 'gemini' | 'local' | 'custom' = 'gemini',
    modelName: string = 'gemini-1.5-flash',
    customConfig?: CustomConfig
): Promise<JobDetails | null> {
    try {
        const prompt = `
Extract the following details from the job description below.

EXAMPLE INPUT:
"""
Software Engineer II at Acme Corp (Remote, San Francisco, CA)
$130k-$160k/year
Requirements: 3+ years of experience in Python, React, AWS. Nice to have: Kubernetes, GraphQL.
"""

EXAMPLE OUTPUT:
{
    "description": "Software Engineer II role at Acme Corp focused on full-stack development...",
    "requirements": ["3+ years of experience in Python", "Experience with React", "AWS experience"],
    "requiredSkills": ["Python", "React", "AWS"],
    "preferredSkills": ["Kubernetes", "GraphQL"],
    "experience": ["3+ years of software engineering experience"],
    "experienceLevel": "Mid-level (3+ years)",
    "jobType": "Full-time",
    "company": "Acme Corp",
    "title": "Software Engineer II",
    "location": "San Francisco, CA",
    "remote": true,
    "salary": "$130k-$160k/year"
}

NOW EXTRACT FROM THIS JOB DESCRIPTION:
${text}

INSTRUCTIONS:
1. **requiredSkills**: Skills explicitly listed as required or mandatory.
2. **preferredSkills**: Skills listed as nice-to-have, preferred, or bonus.
3. **experienceLevel**: The seniority level and years required (e.g. "Senior (5+ years)", "Entry-level", "Mid-level (3-5 years)").
4. **location**: City/state/country, or "Not specified".
5. **remote**: true if fully remote or hybrid, false otherwise.
6. **salary**: Salary range if mentioned, or "Not specified".
7. **description**: The cleaned main body of the JD, without boilerplate/legal text.
8. Keep the legacy "skills" field as the union of requiredSkills + preferredSkills for backward compatibility.

Output ONLY valid JSON matching the structure above.`;

        const responseText = await generateText({
            prompt,
            systemInstruction: 'You are an expert job description analyzer. Output ONLY valid JSON.',
            provider,
            apiKey,
            modelName,
            customConfig,
            temperature: 0.2,
            jsonMode: true,
        });

        const parsed = JSON.parse(cleanJson(responseText));

        // Ensure backward compatibility: populate 'skills' from required + preferred if missing
        if (!parsed.skills && (parsed.requiredSkills || parsed.preferredSkills)) {
            parsed.skills = [...(parsed.requiredSkills || []), ...(parsed.preferredSkills || [])];
        }

        // Ensure new fields have defaults
        parsed.requiredSkills = parsed.requiredSkills || parsed.skills || [];
        parsed.preferredSkills = parsed.preferredSkills || [];
        parsed.experienceLevel = parsed.experienceLevel || 'Not specified';
        parsed.location = parsed.location || 'Not specified';
        parsed.remote = parsed.remote ?? false;
        parsed.salary = parsed.salary || 'Not specified';

        return parsed;
    } catch (error) {
        console.error('Error parsing job description with AI:', error);
        return null;
    }
}
