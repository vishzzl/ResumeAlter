import { NextRequest, NextResponse } from 'next/server';
import { generateText, cleanJson, CustomConfig } from '@/lib/generate';

export const maxDuration = 60; // Allow 60 seconds

export async function POST(req: NextRequest) {
  try {
    const { resumeText, apiKey, modelProvider, modelName, customConfig } = await req.json();

    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
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

    console.log(`Parsing Profile with Provider: ${provider}, Model: ${modelName || 'default'}`);

    const systemInstruction = `You are an expert resume parser. You ALWAYS output valid JSON and never add commentary outside the JSON object. The resume text may have formatting artifacts from PDF extraction (broken lines, merged columns, garbled characters). Use context and heuristics to reconstruct the intended structure.`;

    const unifiedPrompt = `
Extract ALL information from the resume below into a structured JSON format.

RESUME:
${resumeText}

INSTRUCTIONS:
1. **Experience Section**:
   - Extract EVERY SINGLE BULLET POINT for each role. Do not summarize or truncate.
   - The "description" field MUST contain the full content of the role, including the summary AND all bullet points.
   - Format the "description" with newlines for each bullet point (e.g., "Summary text...\\n• Achievement 1\\n• Achievement 2").
   - Do NOT use a separate "highlights" array. Put everything in "description".
   - If a role mentions client engagements, extract them into a "clients" array with name, domain, and description.

2. **Education Section**:
   - Extract all education entries with degree, institution, and dates.

3. **Skills Section**:
   - Group skills into categories (e.g., Languages, Frameworks, Cloud, Databases, Tools).
   - Each category object has "category" (string) and "items" (string array).

4. **Projects Section**:
   - Extract name, description, technologies, and also url and dates if available.

5. **Certifications Section**:
   - Extract name, issuer, date, and url if provided.

6. **Basics**:
   - Calculate totalYearsOfExperience by looking at the earliest experience start date and the latest end date (or "Present").
   - Extract location (city/state) if mentioned.

OUTPUT FORMAT (JSON ONLY, NO MARKDOWN):
{
  "basics": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number",
    "linkedin": "linkedin url",
    "website": "website url",
    "location": "City, State",
    "summary": "Professional summary",
    "totalYearsOfExperience": 5
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "dates": "Start - End Date",
      "description": "Full role description including ALL bullet points.\\n• Bullet 1\\n• Bullet 2...",
      "clients": [
        {
          "name": "Client Name (if any, else omit this array)",
          "domain": "Client Industry",
          "description": "Work done for this client with ALL bullet points"
        }
      ]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Name",
      "dates": "Dates attended"
    }
  ],
  "skills": [
    { "category": "Languages", "items": ["Python", "Java"] },
    { "category": "Frameworks", "items": ["React", "Spring Boot"] }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Project description",
      "technologies": ["Tech 1", "Tech 2"],
      "url": "Project URL if any",
      "dates": "Project dates if any"
    }
  ],
  "certifications": [
    {
      "name": "Certification Name",
      "issuer": "Issuing Organization",
      "date": "Date obtained",
      "url": "Certificate URL (if any)"
    }
  ]
}`;

    const attemptParse = async (retryPrompt?: string): Promise<any> => {
      const generatedText = await generateText({
        prompt: retryPrompt || unifiedPrompt,
        systemInstruction,
        provider,
        apiKey,
        modelName,
        customConfig: customConfig as CustomConfig,
        temperature: 0.2,
        jsonMode: true,
      });

      return JSON.parse(cleanJson(generatedText));
    };

    try {
      let parsedData: any;

      try {
        parsedData = await attemptParse();
      } catch (firstError) {
        console.warn('First parse attempt failed, retrying with repair prompt...', firstError);
        // Retry with explicit error feedback
        const retryPrompt = `Your previous output was malformed JSON. Please re-read the resume below and return ONLY a valid JSON object matching the schema. No commentary, no markdown fences.

RESUME:
${resumeText}

Return the JSON object with keys: basics, experience, education, skills, projects, certifications.`;

        try {
          parsedData = await attemptParse(retryPrompt);
        } catch (retryError) {
          console.error('Retry also failed:', retryError);
          return NextResponse.json({ error: 'Failed to parse LLM response after retry' }, { status: 500 });
        }
      }

      // ── Validation: ensure minimum viable structure ──
      if (!parsedData.basics || !parsedData.basics.name) {
        console.warn('Parsed data missing basics.name, structure may be incomplete');
      }

      // Normalize skills: if the model returned flat array, convert to categorized
      if (Array.isArray(parsedData.skills) && parsedData.skills.length > 0) {
        if (typeof parsedData.skills[0] === 'string') {
          // Flat string array → wrap in a single "Other" category
          parsedData.skills = [{ category: 'Skills', items: parsedData.skills }];
        }
      }

      // Ensure totalYearsOfExperience is a number
      if (parsedData.basics && typeof parsedData.basics.totalYearsOfExperience === 'string') {
        const num = parseFloat(parsedData.basics.totalYearsOfExperience);
        parsedData.basics.totalYearsOfExperience = isNaN(num) ? 0 : num;
      }

      return NextResponse.json(parsedData);

    } catch (e) {
      console.error('Generation Error', e);
      return NextResponse.json({ error: 'Failed to generate profile data' }, { status: 500 });
    }

  } catch (error) {
    console.error('Profile Parse Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
