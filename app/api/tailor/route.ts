import { NextRequest } from 'next/server';
import { generateText, cleanJson, CustomConfig } from '@/lib/generate';
import { parseResumeSections } from '@/lib/resume-parser';
import { db } from '@/lib/db';
import { applications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const maxDuration = 120;

// Helper to send an SSE event through the stream
function sendSSE(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: Record<string, unknown>) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

// Helper to update tailor status in the DB (for dashboard visibility)
async function setTailorStatus(appId: number, status: string) {
    await db.update(applications).set({ tailorStatus: status }).where(eq(applications.id, appId));
}

// ─── Programmatic keyword coverage calculator ───
function calculateKeywordCoverage(text: string, keywords: string[]): { matched: string[]; missing: string[]; score: number } {
    const lowerText = text.toLowerCase();
    const matched: string[] = [];
    const missing: string[] = [];

    for (const kw of keywords) {
        const lowerKw = kw.toLowerCase().trim();
        if (!lowerKw) continue;

        if (lowerKw.length <= 3) {
            const regex = new RegExp(`\\b${lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (regex.test(text)) {
                matched.push(kw);
            } else {
                missing.push(kw);
            }
        } else {
            if (lowerText.includes(lowerKw)) {
                matched.push(kw);
            } else {
                missing.push(kw);
            }
        }
    }

    const total = keywords.filter(k => k.trim()).length;
    const score = total > 0 ? Math.round((matched.length / total) * 100) : 100;

    return { matched, missing, score };
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { resume, jobDescription, apiKey, modelProvider, modelName, customConfig, applicationId } = body;

    if (!resume || !jobDescription) {
        return new Response(
            JSON.stringify({ error: 'Resume and Job Description are required' }),
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

    console.log(`Using Model Provider for Tailoring: ${provider}, Model: ${modelName || 'default'}`);

    const appId = applicationId ? parseInt(applicationId) : null;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const sections = parseResumeSections(resume);

                // ═══ PHASE 0: KEYWORD EXTRACTION ═══
                sendSSE(controller, encoder, { phase: 'extracting' });
                if (appId) await setTailorStatus(appId, 'tailoring');

                const keywordExtractionPrompt = `
You are an ATS keyword extraction engine. Analyze the following Job Description and extract ALL keywords that an ATS system would scan for.

JOB DESCRIPTION:
${jobDescription}

INSTRUCTIONS:
1. **requiredKeywords**: Extract every hard skill, technology, tool, framework, platform, certification, methodology, and domain term that is explicitly required. Include exact phrasing from the JD.
2. **preferredKeywords**: Extract skills/tools listed as "nice to have", "preferred", "bonus", or "plus".
3. **actionVerbs**: Extract strong action verbs used in the JD's responsibilities section.
4. **jobTitle**: The exact job title from the JD.
5. **industry**: The industry/domain.

Be EXHAUSTIVE. Include variations (e.g., both "JavaScript" and "JS" if both appear).

OUTPUT FORMAT (JSON ONLY):
{
    "requiredKeywords": ["Python", "React", "AWS", "CI/CD", "Docker"],
    "preferredKeywords": ["Kubernetes", "GraphQL", "Terraform"],
    "actionVerbs": ["architect", "optimize", "lead", "deploy", "scale"],
    "jobTitle": "Senior Software Engineer",
    "industry": "fintech"
}`;

                let jdKeywords = {
                    requiredKeywords: [] as string[],
                    preferredKeywords: [] as string[],
                    actionVerbs: [] as string[],
                    jobTitle: '',
                    industry: '',
                };

                try {
                    console.log("Phase 0: Extracting JD Keywords...");
                    const kwText = await generateText({
                        prompt: keywordExtractionPrompt,
                        systemInstruction: 'You are an ATS keyword extraction engine. Output ONLY valid JSON. Be exhaustive.',
                        provider,
                        apiKey,
                        modelName,
                        customConfig: customConfig as CustomConfig,
                        temperature: 0.1,
                        jsonMode: true,
                    });
                    jdKeywords = JSON.parse(cleanJson(kwText));
                    console.log(`Extracted ${jdKeywords.requiredKeywords?.length || 0} required keywords, ${jdKeywords.preferredKeywords?.length || 0} preferred keywords`);
                } catch (e) {
                    console.error("Failed to extract keywords, continuing with basic tailoring", e);
                }

                // ═══ PHASE 1: TAILORING (ATS-Optimized) ═══
                sendSSE(controller, encoder, { phase: 'tailoring' });

                const allKeywords = [...(jdKeywords.requiredKeywords || []), ...(jdKeywords.preferredKeywords || [])];
                const requiredKeywordList = (jdKeywords.requiredKeywords || []).join(', ');
                const actionVerbList = (jdKeywords.actionVerbs || []).join(', ');

                const tailoringSystemInstruction = `You are an expert Resume Writer and Career Coach, specialized in ATS optimization. You output ONLY valid JSON. You never fabricate skills, metrics, or experiences that are not in the original resume. Your #1 goal is to maximize ATS keyword match while keeping the resume truthful.`;

                const tailoringPrompt = `
Your goal is to rewrite the resume sections to MAXIMIZE ATS keyword match against the Job Description (JD) while maintaining the candidate's authentic experience.

First, identify the JD's industry/domain: ${jdKeywords.industry || 'Determine from context'}

═══ CRITICAL ATS KEYWORD TARGETS ═══
You MUST incorporate as many of these keywords as possible into the resume.

REQUIRED KEYWORDS (MUST appear at least once each): ${requiredKeywordList || 'See JD below'}
PREFERRED KEYWORDS (include where truthful): ${(jdKeywords.preferredKeywords || []).join(', ') || 'See JD below'}
STRONG ACTION VERBS (use these where they fit naturally): ${actionVerbList || 'Use standard action verbs'}
TARGET JOB TITLE: ${jdKeywords.jobTitle || 'Determine from JD'}

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

--- EDUCATION ---
${sections.education}

--- PROJECTS ---
${sections.projects}

--- CERTIFICATIONS & OTHER ---
${sections.other}

═══ ATS-OPTIMIZED INSTRUCTIONS ═══

1. **Header**: 
   - **Name**: MUST start with \`# \` followed by the candidate's name (Markdown H1 format). Do NOT omit the \`# \`.
   - **Contact**: On the SECOND line, provide email, phone, location, and links EXACTLY separated by \` | \`. Do NOT use bullet points. Do NOT use multiple lines for contact info.
   - You MUST output EXACTLY 2 lines for the header. Example:
     # John Doe
     john@email.com | (555) 123-4567 | San Francisco, CA | [LinkedIn](https://linkedin.com/in/johndoe) | [GitHub](https://github.com)

2. **Summary** (ATS CRITICAL — front-load keywords here):
   - Write a 3-4 sentence professional summary.
   - MUST include the exact job title "${jdKeywords.jobTitle || 'from the JD'}" in the first sentence.
   - MUST mention 3-5 of the top required keywords naturally in the summary.
   - CRITICAL: Do NOT mention the company name from the JD.

3. **Skills** (ATS CRITICAL — this section gets scanned first):
   - Group into categories (e.g., **Languages**: ..., **Frameworks**: ..., **Cloud/DevOps**: ...).
   - MUST include EVERY required keyword from the list above that the candidate has demonstrated ANYWHERE in their resume.
   - Use EXACT keyword phrasing from the JD.
   - Limit to 10-15 skills maximum, prioritizing JD keywords. Be selective — only the most relevant skills.

4. **Experience** (ATS CRITICAL — keyword density matters here):
   - **Primary Structure** (COMPANY FIRST, then role, then dates):
     **Company Name** | **Role** | **Start - End**

     * General achievement bullet 1
     * General achievement bullet 2
   - **Client Sub-sections** (REQUIRED if the original resume has \`**Client:**\` entries):
     - If the EXPERIENCE section contains lines like \`**Client:** Name - Domain\`, you MUST preserve ALL of them.
     - Output each client exactly as:
       **Client:** Client Name - Client Domain

       * Tailored bullet about work done for this client
   - **Formatting**: Use a star \`*\` for bullet points. CRITICAL: There MUST be a BLANK LINE (an extra \\n) between the company/role header line and the first bullet point. Each bullet MUST start on its own line. In JSON output, use \\n\\n before the first bullet.
   - **Content**:
     - For each role, include 2-4 bullets ordered by relevance to the JD.
     - WEAVE required keywords into bullet points where truthful.
     - Use action verbs from the JD: ${actionVerbList || 'standard strong verbs'}
     - Do NOT mention the company name from the JD.
     - Use the STAR Method and quantify results.
     - NEVER drop a client entry that appears in the original.

5. **Education** (NO BULLET POINTS — clean and minimal):
   - Keep all education entries.
   - Do NOT use bullet points or stars.
   - **Format** (each entry on its own line):
     **Degree** | **Institution** | **Dates**
   - If there is a GPA or honors, append to the same line.

6. **Projects**:
   - Limit to a MAXIMUM of 5 bullet points or items ALL TOGETHER.
   - **Format**: **Project Name** | [Link](URL)\\n* Description bullet

7. **Certifications** (just "Certifications", NOT "Certifications & Other"):
   - **Format**: **Certification Name** | Issuer | Date

═══ KEYWORD PLACEMENT RULES ═══
- The SKILLS section must contain the HIGHEST density of JD keywords
- The SUMMARY must front-load with the job title and 3-5 top keywords
- EXPERIENCE bullets must weave in keywords naturally
- If a keyword from the required list matches something the candidate has done (even if phrased differently), USE THE JD'S EXACT PHRASING

DO NOT:
- Invent metrics, numbers, or percentages not in the original resume.
- Copy JD sentences verbatim as resume achievements.
- Add skills the candidate has never demonstrated.
- Insert the hiring company's name anywhere.

OUTPUT FORMAT (JSON ONLY, use \\\\n for newlines inside strings):
{
    "header": "# Name\\\\nemail@example.com | (555) 123-4567 | City, ST | [LinkedIn](url)",
    "summary": "Professional summary...",
    "skills": "**Languages**: A, B, C\\\\n**Frameworks**: X, Y, Z",
    "experience": "**Company** | **Role** | **Date**\\\\n\\\\n* Achievement 1\\\\n* Achievement 2...",
    "education": "**Degree** | **University** | **Dates**",
    "projects": "**Project Name** | [Link](URL)\\\\n\\\\n* Description...",
    "other": "**Cert** | Issuer | Date"
}`;

                let tailoredSections = { ...sections };

                try {
                    console.log("Phase 1: Tailoring Content (ATS-Optimized)...");
                    const tailoredText = await generateText({
                        prompt: tailoringPrompt,
                        systemInstruction: tailoringSystemInstruction,
                        provider,
                        apiKey,
                        modelName,
                        customConfig: customConfig as CustomConfig,
                        temperature: 0.3,
                        jsonMode: true,
                    });

                    const data = JSON.parse(cleanJson(tailoredText));
                    const normalizeNewlines = (s: string) => s.replace(/\\n/g, '\n');

                    if (data.header) tailoredSections.header = normalizeNewlines(data.header);
                    if (data.summary) tailoredSections.summary = normalizeNewlines(data.summary);
                    if (data.skills) tailoredSections.skills = normalizeNewlines(data.skills);
                    if (data.experience) tailoredSections.experience = normalizeNewlines(data.experience);
                    if (data.education) tailoredSections.education = normalizeNewlines(data.education);
                    if (data.projects) tailoredSections.projects = normalizeNewlines(data.projects);
                    if (data.other) tailoredSections.other = normalizeNewlines(data.other);

                } catch (e) {
                    console.error("Failed to tailor content", e);
                }

                // ═══ PHASE 1.5: CHAIN OF VERIFICATION (CoVe) ═══
                sendSSE(controller, encoder, { phase: 'verifying' });
                if (appId) await setTailorStatus(appId, 'verifying');

                const verificationPrompt = `
You are an uncompromising strict Fact-Checker and Auditor.
Your job is to compare a "Tailored Resume" against the "Original Resume" and eliminate ANY hallucinations.
IMPORTANT: Do NOT remove keywords or skills that were REPHRASED from the original. Only remove truly FABRICATED content.

ORIGINAL RESUME (The absolute truth — section by section):
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

TAILORED RESUME (Contains potential hallucinations):
--- HEADER ---
${tailoredSections.header}
--- SUMMARY ---
${tailoredSections.summary}
--- SKILLS ---
${tailoredSections.skills}
--- EXPERIENCE ---
${tailoredSections.experience}
--- EDUCATION ---
${tailoredSections.education}
--- PROJECTS ---
${tailoredSections.projects}
--- CERTIFICATIONS & OTHER ---
${tailoredSections.other}

INSTRUCTIONS:
1. **Skills**: If the Tailored Resume lists a skill NOT even remotely implied in the Original Resume, REMOVE IT. However, if a skill is a SYNONYM or INDUSTRY TERM for something in the original (e.g., "CI/CD" for someone who mentions "Jenkins"), KEEP IT.
2. **Experience & Projects**: 
   - Ensure no bullets were fabricated entirely.
   - If the original says "improved by 20%", the tailored version must not claim more than 25%. If no number existed in the original, none should appear.
   - Ensure the target company's name (from the JD) was NOT inserted.
   - CRITICAL: If the Original Resume experience section contains \`**Client:**\` sub-sections, they MUST appear in the output.
3. **Summary**: Ensure it accurately reflects the original resume's level of experience. Keyword inclusion is FINE.
4. **Education**: Ensure no degrees, institutions, or honors were fabricated.

OUTPUT FORMAT (JSON ONLY, use \\n for newlines inside strings. ONLY output the sections below):
{
    "summary": "...",
    "skills": "...",
    "experience": "...",
    "projects": "...",
    "corrections": [
        {"section": "skills", "action": "removed", "detail": "Kubernetes - not in original resume"}
    ]
}`;

                try {
                    console.log("Phase 1.5: Verifying Content (CoVe)...");
                    const verifiedText = await generateText({
                        prompt: verificationPrompt,
                        systemInstruction: 'You are an uncompromising Fact-Checker. Output ONLY valid JSON. Do NOT strip valid keyword rephrasings — only remove truly fabricated content.',
                        provider,
                        apiKey,
                        modelName,
                        customConfig: customConfig as CustomConfig,
                        temperature: 0.2,
                        jsonMode: true,
                    });
                    const data = JSON.parse(cleanJson(verifiedText));
                    const normalizeNewlines = (s: string) => s.replace(/\\n/g, '\n');

                    if (data.header) tailoredSections.header = normalizeNewlines(data.header);
                    if (data.summary) tailoredSections.summary = normalizeNewlines(data.summary);
                    if (data.skills) tailoredSections.skills = normalizeNewlines(data.skills);
                    if (data.experience) tailoredSections.experience = normalizeNewlines(data.experience);
                    if (data.education) tailoredSections.education = normalizeNewlines(data.education);
                    if (data.projects) tailoredSections.projects = normalizeNewlines(data.projects);
                    if (data.other) tailoredSections.other = normalizeNewlines(data.other);

                    if (data.corrections?.length > 0) {
                        console.log('CoVe Corrections:', JSON.stringify(data.corrections, null, 2));
                    }
                } catch (e) {
                    console.error("Failed during verification phase (CoVe).", e);
                }

                // ═══ PHASE 1.7: KEYWORD GAP CHECK & INJECTION ═══
                const fullTailoredText = [
                    tailoredSections.header, tailoredSections.summary, tailoredSections.skills,
                    tailoredSections.experience, tailoredSections.education,
                    tailoredSections.projects, tailoredSections.other,
                ].join('\n');

                const requiredCoverage = calculateKeywordCoverage(fullTailoredText, jdKeywords.requiredKeywords || []);
                const preferredCoverage = calculateKeywordCoverage(fullTailoredText, jdKeywords.preferredKeywords || []);

                console.log(`Keyword Coverage — Required: ${requiredCoverage.score}% (${requiredCoverage.matched.length}/${(jdKeywords.requiredKeywords || []).length}), Missing: [${requiredCoverage.missing.join(', ')}]`);

                // Send pre-fix coverage data to client
                sendSSE(controller, encoder, {
                    phase: 'gap_check',
                    data: {
                        preFixCoverage: {
                            required: { score: requiredCoverage.score, matched: requiredCoverage.matched, missing: requiredCoverage.missing, total: (jdKeywords.requiredKeywords || []).length },
                            preferred: { score: preferredCoverage.score, matched: preferredCoverage.matched, missing: preferredCoverage.missing, total: (jdKeywords.preferredKeywords || []).length },
                        }
                    }
                });

                if (requiredCoverage.missing.length > 0) {
                    try {
                        console.log(`Phase 1.7: Injecting ${requiredCoverage.missing.length} missing required keywords...`);

                        const gapFixPrompt = `
You are an ATS optimization specialist. The following tailored resume is MISSING some required keywords from the Job Description.

MISSING REQUIRED KEYWORDS: ${requiredCoverage.missing.join(', ')}
${preferredCoverage.missing.length > 0 ? `MISSING PREFERRED KEYWORDS: ${preferredCoverage.missing.join(', ')}` : ''}

ORIGINAL RESUME (for truth-checking):
--- SKILLS ---
${sections.skills}
--- EXPERIENCE ---
${sections.experience}
--- PROJECTS ---
${sections.projects}

CURRENT TAILORED RESUME SECTIONS:
--- SUMMARY ---
${tailoredSections.summary}
--- SKILLS ---
${tailoredSections.skills}
--- EXPERIENCE ---
${tailoredSections.experience}

INSTRUCTIONS:
1. For each missing keyword, determine if the candidate has ANY related experience in the ORIGINAL resume (even if phrased differently).
2. If YES: Add the keyword to the SKILLS section AND weave it into a relevant EXPERIENCE bullet.
3. If NO: Do NOT add it. Skip it entirely.
4. Prefer adding keywords to SKILLS first, then SUMMARY, then EXPERIENCE.
5. Do NOT remove any existing content — only ADD or REPHRASE.

OUTPUT FORMAT (JSON ONLY, use \\\\n for newlines inside strings):
{
    "summary": "...(updated summary)...",
    "skills": "...(updated skills)...",
    "experience": "...(updated experience)...",
    "injected": ["keyword1 - added to skills"],
    "skipped": ["keyword3 - no related experience"]
}`;

                        const gapFixText = await generateText({
                            prompt: gapFixPrompt,
                            systemInstruction: 'You are an ATS optimization specialist. Output ONLY valid JSON. Never fabricate experience.',
                            provider,
                            apiKey,
                            modelName,
                            customConfig: customConfig as CustomConfig,
                            temperature: 0.2,
                            jsonMode: true,
                        });

                        const gapData = JSON.parse(cleanJson(gapFixText));
                        const normalizeNewlines = (s: string) => s.replace(/\\n/g, '\n');

                        if (gapData.summary) tailoredSections.summary = normalizeNewlines(gapData.summary);
                        if (gapData.skills) tailoredSections.skills = normalizeNewlines(gapData.skills);
                        if (gapData.experience) tailoredSections.experience = normalizeNewlines(gapData.experience);

                        if (gapData.injected?.length > 0) console.log('Gap-fix injected:', gapData.injected);
                        if (gapData.skipped?.length > 0) console.log('Gap-fix skipped:', gapData.skipped);

                        // Send gap-fix results to client
                        sendSSE(controller, encoder, {
                            phase: 'gap_fix_result',
                            data: {
                                injected: gapData.injected || [],
                                skipped: gapData.skipped || [],
                            }
                        });

                    } catch (e) {
                        console.error("Failed during keyword gap-fix.", e);
                    }
                }

                // Reconstruct Full Resume
                let tailoredResume = `
${tailoredSections.header}

## Summary
${tailoredSections.summary}

## Experience
${tailoredSections.experience}

## Skills
${tailoredSections.skills}
`.trim();

                if (tailoredSections.education && tailoredSections.education.trim()) {
                    const content = tailoredSections.education.replace(/^#+\s*Education\s*/i, '').trim();
                    if (content) tailoredResume += `\n\n## Education\n${content}`;
                }

                if (tailoredSections.projects && tailoredSections.projects.trim()) {
                    const content = tailoredSections.projects.replace(/^#+\s*Projects\s*/i, '').trim();
                    if (content) tailoredResume += `\n\n## Projects\n${content}`;
                }

                if (tailoredSections.other && tailoredSections.other.trim()) {
                    const content = tailoredSections.other.replace(/^#+\s*(Certifications|Other|Certifications\s*&\s*Other)\s*/i, '').trim();
                    if (content) tailoredResume += `\n\n## Certifications\n${content}`;
                }

                // Calculate final keyword coverage after gap-fix
                const finalFullText = [tailoredSections.header, tailoredSections.summary, tailoredSections.skills,
                tailoredSections.experience, tailoredSections.education,
                tailoredSections.projects, tailoredSections.other].join('\n');
                const postFixRequired = calculateKeywordCoverage(finalFullText, jdKeywords.requiredKeywords || []);
                const postFixPreferred = calculateKeywordCoverage(finalFullText, jdKeywords.preferredKeywords || []);

                // Send tailored resume + final coverage
                sendSSE(controller, encoder, {
                    phase: 'tailored',
                    data: {
                        tailoredResume,
                        keywordCoverage: {
                            required: { score: postFixRequired.score, matched: postFixRequired.matched, missing: postFixRequired.missing, total: (jdKeywords.requiredKeywords || []).length },
                            preferred: { score: postFixPreferred.score, matched: postFixPreferred.matched, missing: postFixPreferred.missing, total: (jdKeywords.preferredKeywords || []).length },
                        }
                    }
                });

                // Persist to DB
                if (appId) {
                    await db.update(applications).set({
                        tailoredResume,
                        tailorStatus: 'analyzing',
                    }).where(eq(applications.id, appId));
                }

                // ═══ PHASE 2: ATS ANALYSIS (Deterministic + LLM Hybrid) ═══
                sendSSE(controller, encoder, { phase: 'analyzing' });

                const finalRequiredCoverage = calculateKeywordCoverage(tailoredResume, jdKeywords.requiredKeywords || []);
                const finalAllCoverage = calculateKeywordCoverage(tailoredResume, allKeywords);
                const originalRequiredCoverage = calculateKeywordCoverage(resume, jdKeywords.requiredKeywords || []);
                const originalAllCoverage = calculateKeywordCoverage(resume, allKeywords);

                const hasHeader = /^#\s+/.test(tailoredResume);
                const hasSections = (tailoredResume.match(/^##\s+/gm) || []).length >= 3;
                const hasBullets = (tailoredResume.match(/^\s*\*/gm) || []).length >= 5;
                const formattingScore = (hasHeader ? 30 : 0) + (hasSections ? 40 : 0) + (hasBullets ? 30 : 0);

                console.log(`Final ATS Metrics — Required KW: ${finalRequiredCoverage.score}%, All KW: ${finalAllCoverage.score}%, Formatting: ${formattingScore}%`);

                const analysisPrompt = `
You are an ATS (Applicant Tracking System) scoring algorithm.
Score BOTH the original and tailored resumes against the Job Description.

JOB DESCRIPTION:
${jobDescription}

ORIGINAL RESUME:
${resume}

TAILORED RESUME:
${tailoredResume}

═══ PRE-CALCULATED SCORES (use these as ground truth) ═══
ORIGINAL — Required Keyword Match: ${originalRequiredCoverage.score}%, Keywords found: ${originalRequiredCoverage.matched.length}/${(jdKeywords.requiredKeywords || []).length}
TAILORED — Required Keyword Match: ${finalRequiredCoverage.score}%, Keywords found: ${finalRequiredCoverage.matched.length}/${(jdKeywords.requiredKeywords || []).length}
TAILORED — Missing Required Keywords: [${finalRequiredCoverage.missing.join(', ')}]
TAILORED — All Keywords Match: ${finalAllCoverage.score}%, Found: ${finalAllCoverage.matched.length}/${allKeywords.length}
ORIGINAL — All Keywords Match: ${originalAllCoverage.score}%, Found: ${originalAllCoverage.matched.length}/${allKeywords.length}
TAILORED — Formatting Score: ${formattingScore}%

SCORING RUBRIC (weighted):
- **Keyword Match (40%)**: Use the pre-calculated Required Keyword Match scores above.
- **Experience Relevance (30%)**: How well does the experience align with the JD requirements?
- **Skills Alignment (20%)**: Use the pre-calculated All Keywords Match scores above.
- **Formatting (10%)**: Use the pre-calculated formatting score.

IMPORTANT: The overall scores MUST be consistent with the pre-calculated keyword coverage numbers.

OUTPUT FORMAT (JSON ONLY):
{
    "atsScore": {
        "before": 45,
        "after": 82,
        "breakdown": {
            "keywordMatch": {"before": 30, "after": 85},
            "experienceRelevance": {"before": 50, "after": 80},
            "skillsAlignment": {"before": 40, "after": 90},
            "formatting": {"before": 70, "after": 80}
        },
        "analysis": "Added 'React' and 'Node.js', quantified achievements."
    },
    "changes": [
        { "section": "Experience", "original": "Managed team...", "new": "Spearheaded team of 10...", "reason": "Added leadership keyword." }
    ]
}`;

                let analysisData = { atsScore: null as any, changes: [] as any[] };
                try {
                    console.log("Phase 2: Analyzing (Deterministic + LLM Hybrid)...");
                    const analysisText = await generateText({
                        prompt: analysisPrompt,
                        systemInstruction: 'You are an ATS scoring algorithm. Output ONLY valid JSON. Use the pre-calculated keyword scores as ground truth.',
                        provider,
                        apiKey,
                        modelName,
                        customConfig: customConfig as CustomConfig,
                        temperature: 0.2,
                        jsonMode: true,
                    });
                    analysisData = JSON.parse(cleanJson(analysisText));
                } catch (e) {
                    console.error("Failed to generate analysis", e);
                }

                // Send final result via SSE
                sendSSE(controller, encoder, {
                    phase: 'complete',
                    data: {
                        atsScore: analysisData.atsScore,
                        changes: analysisData.changes
                    }
                });

                // Persist final result to DB
                if (appId) {
                    await db.update(applications).set({
                        analysis: JSON.stringify({
                            changes: analysisData.changes || [],
                            atsScore: analysisData.atsScore || null,
                        }),
                        tailorStatus: 'complete',
                    }).where(eq(applications.id, appId));
                }

            } catch (error) {
                console.error('Streaming API Error:', error);
                sendSSE(controller, encoder, {
                    phase: 'error',
                    error: error instanceof Error ? error.message : 'Internal Server Error'
                });
                if (appId) await setTailorStatus(appId, 'error');
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
