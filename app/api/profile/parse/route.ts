import { NextRequest, NextResponse } from 'next/server';
import { getGeminiModel } from '@/lib/gemini';
import { generateWithLocal } from '@/lib/ollama';
import { generateWithCustom } from '@/lib/custom_llm';

export const maxDuration = 60; // Allow 60 seconds

interface CustomConfig {
  localUrl?: string;
  localModel?: string;
  customUrl?: string;
  customKey?: string;
}

async function generateText(prompt: string, provider: string, apiKey?: string, modelName?: string, customConfig?: CustomConfig) {
  // Use a model that is available via alias
  const defaultModel = 'gemini-flash-latest';

  if (provider === 'custom') {
    const result = await generateWithCustom(prompt, customConfig?.customUrl, customConfig?.customKey);
    return result.response.text();
  } else if (provider === 'local') {
    // modelName from request might be empty if not passed, try customConfig or fallback
    const localModel = customConfig?.localModel || modelName || 'llama3';
    const result = await generateWithLocal(prompt, localModel, customConfig?.localUrl);
    return result.response.text();
  } else {
    // Try with selected model
    try {
      const model = getGeminiModel(apiKey, modelName);
      if (!model) throw new Error("Gemini API Key missing");

      // Ensure we are using requested model
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error: any) {
      console.error(`Primary model ${modelName} failed. Error:`, error.message);

      // Fallback
      if (modelName !== defaultModel) {
        console.log(`Falling back to ${defaultModel}...`);
        try {
          const fallbackModel = getGeminiModel(apiKey, defaultModel);
          if (fallbackModel) {
            const result = await fallbackModel.generateContent(prompt);
            return result.response.text();
          }
        } catch (fbError: any) {
          console.error(`Fallback model ${defaultModel} also failed:`, fbError.message);
        }
      }
      throw error;
    }
  }
}

function cleanJson(text: string) {
  // Remove markdown code blocks
  let jsonString = text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();

  // Find the first '{'
  const firstBrace = jsonString.indexOf('{');
  if (firstBrace >= 0) {
    jsonString = jsonString.substring(firstBrace);
    // Find the last '}'
    const lastBrace = jsonString.lastIndexOf('}');
    if (lastBrace > 0) jsonString = jsonString.substring(0, lastBrace + 1);
  }

  return jsonString;
}

export async function POST(req: NextRequest) {
  try {
    const { resumeText, apiKey, modelProvider, modelName, customConfig } = await req.json();

    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    // Determine model source
    const customUrl = process.env.CUSTOM_LLM_URL;
    const forceLocal = process.env.USE_LOCAL_MODEL === 'true';
    const hasGeminiKey = !!apiKey || !!process.env.GEMINI_API_KEY;

    let provider = modelProvider;
    if (!provider) {
      // Priority: Gemini (Fastest & Best) > Custom > Local
      if (hasGeminiKey) provider = 'gemini';
      else if (customUrl) provider = 'custom';
      else provider = 'local';
    }

    console.log(`Parsing Profile with Provider: ${provider}, Model from Request: ${modelName}, Resolved Model: ${modelName || 'default'} (Single-Pass Strategy)`);
    console.log(`Debug Info - API Key Present: ${hasGeminiKey}, Custom URL: ${customUrl}`);

    // Unified Prompt for Single-Pass Extraction
    const unifiedPrompt = `
        You are an expert resume parser.
        Your task is to Extract ALL information from the resume below into a structured JSON format.

        RESUME:
        ${resumeText}

        INSTRUCTIONS:
        1. **Experience Section**:
           - Extract **EVERY SINGLE BULLET POINT** for each role. Do not summarize or truncate.
           - The "description" field MUST contain the full content of the role, including the summary AND all bullet points.
           - Format the "description" with newlines for each bullet point (e.g., "Summary text...\\n• Achievement 1\\n• Achievement 2").
           - Do NOT use a separate "highlights" array. Put everything in "description".
        
        2. **Education Section**:
           - Extract all education entries.
           - Include degree, institution, and dates.

        OUTPUT FORMAT (JSON ONLY, NO MARKDOWN):
        {
          "basics": {
            "name": "Full Name",
            "email": "email@example.com",
            "phone": "phone number",
            "linkedin": "linkedin url",
            "website": "website url",
            "summary": "Professional summary"
          },
          "experience": [
            {
              "company": "Company Name",
              "role": "Job Title",
              "dates": "Start - End Date",
              "description": "Full role description including ALL bullet points.\\n• Bullet 1\\n• Bullet 2..."
            }
          ],
           "education": [
            {
              "institution": "University Name",
              "degree": "Degree Name",
              "dates": "Dates attended"
            }
          ],
          "skills": ["Skill 1", "Skill 2"],
          "projects": [
            {
              "name": "Project Name",
              "description": "Project description",
              "technologies": ["Tech 1", "Tech 2"]
            }
          ]
        }
    `;

    try {
      // Execute Single Request
      const generatedText = await generateText(unifiedPrompt, provider, apiKey, modelName, customConfig);

      let parsedData = {};
      try {
        parsedData = JSON.parse(cleanJson(generatedText));
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        console.error("Raw Text:", generatedText);
        return NextResponse.json({ error: 'Failed to parse LLM response', raw: generatedText }, { status: 500 });
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
