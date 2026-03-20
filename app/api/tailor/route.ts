import { NextRequest } from 'next/server';
import { generateText, cleanJson, CustomConfig } from '@/lib/generate';
import { parseResumeSections } from '@/lib/resume-parser';
import { db } from '@/lib/db';
import { applications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';

export const maxDuration = 120;

// Helper to send an SSE event through the stream
function sendSSE(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: Record<string, unknown>) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

// Helper to update tailor status in the DB (for dashboard visibility)
async function setTailorStatus(appId: number, status: string, userId: number | null) {
    if (userId) {
        await db.update(applications).set({ tailorStatus: status }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
    } else {
        await db.update(applications).set({ tailorStatus: status }).where(eq(applications.id, appId));
    }
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
    const session = await auth();
    // Allow anonymous usage if no appId is provided, but if an appId IS provided, the route
    // must verify session ownership to prevent IDOR.
    const userId = session?.user?.id ? parseInt(session.user.id) : null;

    const body = await req.json();
    const { resume, jobDescription, apiKey, modelProvider, modelName, customConfig, applicationId } = body;

    const appId = applicationId ? parseInt(applicationId) : null;

    if (appId && !userId) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized to update application' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

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

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const sections = parseResumeSections(resume);

                // ═══ PHASE 0, 1, 1.5, 1.7: MASTER TAILORING PASS ═══
                sendSSE(controller, encoder, { phase: 'extracting' });
                if (appId) await setTailorStatus(appId, 'tailoring', userId);

                // ── Fix 1: Full persona lives in systemInstruction (not here)
                // ── Fix 2: Structured "reasoning" scratchpad before output
                // ── Fix 3: Explicit priority hierarchy
                // ── Fix 4: All instructions are positive (tell what TO do)
                // ── Fix 5: Nested structured experience JSON schema
                // ── Fix 9: jobTitle restored to extracted fields
                const masterTailoringPrompt = `
PRIORITY HIERARCHY (in case of conflict, resolve in this order):
1. TRUTH — Only include facts, skills, and metrics from the ORIGINAL RESUME.
2. ATS MATCH — Maximize coverage of extracted keywords from the JD.
3. EXECUTIVE TONE — Use powerful, authoritative language throughout.
4. ONE PAGE — Keep total content concise enough to fit a single printed page.

JOB DESCRIPTION:
${jobDescription}

ORIGINAL RESUME (The absolute source of truth — do not invent anything outside of this):
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

═══ STEP 1: ANALYZE ═══
Before writing anything, analyze the JD and resume. Extract:
1. requiredKeywords: Every hard technical skill in the JD (technologies, tools, languages, platforms). Technical terms only.
2. preferredKeywords: "Nice to have" or "preferred" hard technical skills.
3. actionVerbs: Strongest action verbs from the JD responsibility statements.
4. jobTitle: The exact target job title from the JD.

═══ STEP 2: REWRITE ═══
Rewrite each resume section following these rules precisely:

HEADER:
- Line 1: # [Candidate Name] (H1 markdown, name exactly as in original)
- Line 2: email | phone | location | [LinkedIn](url) | [GitHub](url) — pipe-separated, all on one line, use Markdown link format for URLs.

SUMMARY (2–3 sentences maximum):
- Sentence 1: Incorporate the exact jobTitle extracted from the JD and the candidate's years of experience.
- Sentences 2–3: Include 3–5 top required keywords naturally, focusing on value delivered — not objectives.

SKILLS:
- Group by category: **Languages**, **Frameworks**, **Cloud/DevOps**, **Databases**, **Tools**.
- Include every required keyword the candidate has demonstrated anywhere in their original resume.
- Use exact keyword phrasing from the JD (e.g., if JD says "Node.js", use "Node.js" not "NodeJS").

EXPERIENCE (HIGHEST PRIORITY SECTION):
- Format each role as a structured entry:
  { "company": "...", "role": "...", "dates": "...", "clients": [], "bullets": [] }
- CONSULTING / AGENCY ROLES: If the original resume shows multiple clients under one employer, each client becomes a separate entry inside "clients" with its own bullets.
  { "name": "Client Name", "domain": "e.g. FinTech", "bullets": ["..."] }
- Each bullet: exactly 1 sentence, follows STAR method (Action + Task + Result), uses an executive action verb from the JD.
- Use only metrics that are present in the original resume — do not add new numbers.
- Use only company names from the original resume, never the hiring company's name from the JD.
- Maximum 3 roles. Maximum 3–4 bullets per role or per client.

EDUCATION: Keep exactly as original. Format: **Degree** | **Institution** | **Dates** (no bullet points).

PROJECTS: Limit to 5 items. Format: **Project Name** | [Link](URL)\\\\n* 1-sentence description.

CERTIFICATIONS: Format: **Cert Name** | Issuer | Date

═══ STEP 3: VERIFY ═══
Before producing output, perform a fast internal audit:
- Any skill not demonstrable from the ORIGINAL RESUME → remove it.
- Any metric not present in the ORIGINAL RESUME → remove it.
- Education and header contact details → must match original exactly.
- Confirm all client entries from the original are present in the output.

═══ OUTPUT FORMAT (JSON ONLY) ═══
Use \\\\n for newlines in string fields. No markdown outside of JSON.
{
    "reasoning": "Brief internal audit: confirm jobTitle used, list skills added/removed vs original, confirm clients preserved.",
    "extractedKeywords": {
        "requiredKeywords": ["Python", "React", "AWS"],
        "preferredKeywords": ["GraphQL", "Terraform"],
        "actionVerbs": ["architect", "scale", "deploy"],
        "jobTitle": "Senior Software Engineer"
    },
    "tailoredSections": {
        "header": "# Name\\\\nemail | phone | location | [LinkedIn](url)",
        "summary": "...",
        "skills": "**Languages**: Python, JavaScript\\\\n**Frameworks**: React, FastAPI",
        "experience": [
            {
                "company": "Accenture",
                "role": "Senior Developer",
                "dates": "Jan 2022 – Present",
                "bullets": ["General role bullet if no clients."],
                "clients": [
                    { "name": "HDFC Bank", "domain": "FinTech", "bullets": ["Architected real-time payment gateway..."] },
                    { "name": "Reliance Jio", "domain": "Telecom", "bullets": ["Engineered microservices platform..."] }
                ]
            }
        ],
        "education": "**B.Tech Computer Science** | IIT Bombay | 2018–2022",
        "projects": "**ResumeAI** | [GitHub](https://github.com/...)\\\\n* Built an LLM-powered resume tailoring tool...",
        "other": "**AWS Solutions Architect** | Amazon | 2023"
    }
}`;

                // ── Fix 7: Higher temperature (0.45) for creative professional rewriting

                let jdKeywords = {
                    requiredKeywords: [] as string[],
                    preferredKeywords: [] as string[],
                    actionVerbs: [] as string[],
                };
                let tailoredSections = { ...sections };

                try {
                    console.log("Phase 1: Master Tailoring Pass (Extraction + Tailoring + Verification)...");
                    
                    let masterText: string;
                    const t1 = setTimeout(() => sendSSE(controller, encoder, { phase: 'tailoring' }), 3000);
                    const t2 = setTimeout(() => sendSSE(controller, encoder, { phase: 'verifying' }), 8000);

                    try {
                        masterText = await generateText({
                            prompt: masterTailoringPrompt,
                            // Fix 1: Full, precise persona lives here — user prompt is data + tasks only
                            systemInstruction: 'You are an elite Executive Career Coach, Expert Resume Writer, and uncompromising Fact-Checker. You craft high-impact, results-driven professional narratives with ATS precision. You NEVER fabricate skills, metrics, or experiences. You ONLY output strictly valid JSON.',
                            provider,
                            apiKey,
                            modelName,
                            customConfig: customConfig as CustomConfig,
                            temperature: 0.45, // Fix 7: Higher temp for varied, compelling language in rewrites
                            jsonMode: true,
                        });
                    } finally {
                        clearTimeout(t1);
                        clearTimeout(t2);
                    }

                    const data = JSON.parse(cleanJson(masterText));

                    if (data.reasoning) {
                        console.log('[Prompt Reasoning Audit]', data.reasoning);
                    }
                    
                    if (data.extractedKeywords) {
                        jdKeywords = {
                            requiredKeywords: data.extractedKeywords.requiredKeywords || [],
                            preferredKeywords: data.extractedKeywords.preferredKeywords || [],
                            actionVerbs: data.extractedKeywords.actionVerbs || [],
                        };
                        // Fix 9: Restore jobTitle used in Summary sentence
                        if (data.extractedKeywords.jobTitle) {
                            (jdKeywords as typeof jdKeywords & { jobTitle?: string }).jobTitle = data.extractedKeywords.jobTitle;
                        }
                    }

                    const normalizeNewlines = (s: string) => s.replace(/\\n/g, '\n');
                    if (data.tailoredSections) {
                        const ts = data.tailoredSections;
                        if (ts.header) tailoredSections.header = normalizeNewlines(ts.header);
                        if (ts.summary) tailoredSections.summary = normalizeNewlines(ts.summary);
                        if (ts.skills) tailoredSections.skills = normalizeNewlines(ts.skills);
                        if (ts.education) tailoredSections.education = normalizeNewlines(ts.education);
                        if (ts.projects) tailoredSections.projects = normalizeNewlines(ts.projects);
                        if (ts.other) tailoredSections.other = normalizeNewlines(ts.other);

                        // Fix 5: Reconstruct experience from nested JSON schema
                        if (Array.isArray(ts.experience)) {
                            const expLines: string[] = [];
                            for (const role of ts.experience) {
                                expLines.push(`**${role.company}** | **${role.role}** | **${role.dates}**`);
                                // General role bullets (when no clients exist)
                                if (role.bullets?.length > 0 && (!role.clients || role.clients.length === 0)) {
                                    expLines.push('');
                                    for (const b of role.bullets) expLines.push(`* ${b}`);
                                }
                                // Client sub-sections (consulting/agency roles)
                                if (role.clients?.length > 0) {
                                    for (const client of role.clients) {
                                        expLines.push('');
                                        expLines.push(`**Client:** ${client.name} - ${client.domain}`);
                                        expLines.push('');
                                        for (const b of client.bullets) expLines.push(`* ${b}`);
                                    }
                                }
                                expLines.push('');
                            }
                            tailoredSections.experience = expLines.join('\n').trim();
                        } else if (typeof ts.experience === 'string') {
                            // Fallback: model returned flat string
                            tailoredSections.experience = normalizeNewlines(ts.experience);
                        }
                    }
                } catch (e) {
                    console.error("Master Tailoring Pass failed", e);
                    throw new Error(e instanceof Error ? e.message : 'Tailoring failed');
                }

                const fullTailoredTextForCoverage = [
                    tailoredSections.header, tailoredSections.summary, tailoredSections.skills,
                    tailoredSections.experience, tailoredSections.education,
                    tailoredSections.projects, tailoredSections.other,
                ].join('\n');

                const initialRequiredCoverage = calculateKeywordCoverage(fullTailoredTextForCoverage, jdKeywords.requiredKeywords || []);
                const initialPreferredCoverage = calculateKeywordCoverage(fullTailoredTextForCoverage, jdKeywords.preferredKeywords || []);

                // Send preFixCoverage for gap_check UI phase compatibility
                sendSSE(controller, encoder, {
                    phase: 'gap_check',
                    data: {
                        preFixCoverage: {
                            required: { score: initialRequiredCoverage.score, matched: initialRequiredCoverage.matched, missing: initialRequiredCoverage.missing, total: jdKeywords.requiredKeywords.length },
                            preferred: { score: initialPreferredCoverage.score, matched: initialPreferredCoverage.matched, missing: initialPreferredCoverage.missing, total: jdKeywords.preferredKeywords.length },
                        }
                    }
                });

                // We skip gap injection to save API calls, so emit empty result immediately
                sendSSE(controller, encoder, {
                    phase: 'gap_fix_result',
                    data: { injected: [], skipped: [] }
                });

                const allKeywords = [...(jdKeywords.requiredKeywords || []), ...(jdKeywords.preferredKeywords || [])];

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
                if (appId && userId) {
                    await db.update(applications).set({
                        tailoredResume,
                        tailorStatus: 'analyzing',
                    }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
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

                // ── Deterministic score components ──
                // keyword match (40%) and skills alignment (20%) and formatting (10%) are calculated
                // programmatically. Only experienceRelevance (30%) comes from the LLM.
                const originalKeywordScore = originalRequiredCoverage.score;
                const tailoredKeywordScore = finalRequiredCoverage.score;
                const originalSkillsScore = originalAllCoverage.score;
                const tailoredSkillsScore = finalAllCoverage.score;
                // Estimate original formatting score similarly
                const hasOriginalHeader = /^#\s+/.test(resume);
                const hasOriginalSections = (resume.match(/^##\s+/gm) || []).length >= 3;
                const hasOriginalBullets = (resume.match(/^\s*\*/gm) || []).length >= 5;
                const originalFormattingScore = (hasOriginalHeader ? 30 : 0) + (hasOriginalSections ? 40 : 0) + (hasOriginalBullets ? 30 : 0);

                // Fix 6: Send only Experience + Summary (not full resume) to trim token load
                const originalExcerpt = [
                    sections.summary ? `SUMMARY:\n${sections.summary}` : '',
                    sections.experience ? `EXPERIENCE:\n${sections.experience}` : '',
                ].filter(Boolean).join('\n\n');

                const tailoredExcerpt = [
                    tailoredSections.summary ? `SUMMARY:\n${tailoredSections.summary}` : '',
                    tailoredSections.experience ? `EXPERIENCE:\n${tailoredSections.experience}` : '',
                ].filter(Boolean).join('\n\n');

                const analysisPrompt = `
You are assessing a single dimension: Experience Relevance (0–100).
Do not compute any other ATS scores — those are calculated separately.

JOB DESCRIPTION (Requirements only — focus on role, seniority, responsibilities):
${jobDescription}

ORIGINAL CANDIDATE EXCERPTS (Summary + Experience only):
${originalExcerpt}

TAILORED CANDIDATE EXCERPTS (Summary + Experience only):
${tailoredExcerpt}

SCORING CRITERIA:
- Score based on: role alignment, industry depth, seniority match, strength of achievements, and keyword integration quality.
- Score the original resume fairly — do not assume it is weak just because it was tailored.
- Score the tailored resume on demonstrated improvement in professional narrative and ATS alignment.

OUTPUT FORMAT (JSON ONLY):
{
    "experienceRelevance": {"before": 50, "after": 85},
    "analysis": "Two-sentence executive summary — state what specifically improved in the tailored version and why it resonates better with this role.",
    "changes": [
        { "section": "Experience", "original": "Worked on backend services", "new": "Architected event-driven microservices platform handling 2M daily transactions", "reason": "Elevated to a results-driven, JD-aligned achievement demonstrating scale and technical ownership." }
    ]
}`;

                let analysisData = { experienceRelevance: null as any, analysis: '' as string, changes: [] as any[] };
                try {
                    console.log("Phase 2: Analyzing (Deterministic + LLM Hybrid)...");
                    const analysisText = await generateText({
                        prompt: analysisPrompt,
                        // Fix 1: Precise, aligned system persona for the analysis call
                        systemInstruction: 'You are a Senior Technical Recruiter and ATS Evaluation Expert. You assess resume-to-JD fit with precision and objectivity. You output ONLY strictly valid JSON.',
                        provider,
                        apiKey,
                        modelName,
                        customConfig: customConfig as CustomConfig,
                        temperature: 0.1, // Keep low for scoring — we want consistent, calibrated scores
                        jsonMode: true,
                    });
                    analysisData = JSON.parse(cleanJson(analysisText));
                } catch (e) {
                    console.error("Failed to generate analysis", e);
                }

                // ── Deterministic composite ATS score calculation ──
                // LLM only provides experienceRelevance (30%). Everything else is math.
                const expRelBefore = analysisData.experienceRelevance?.before ?? 50;
                const expRelAfter = analysisData.experienceRelevance?.after ?? 70;

                const calcScore = (kw: number, skills: number, fmt: number, expRel: number) =>
                    Math.round(0.40 * kw + 0.20 * skills + 0.10 * fmt + 0.30 * expRel);

                const deterministicAtsScore = {
                    before: calcScore(originalKeywordScore, originalSkillsScore, originalFormattingScore, expRelBefore),
                    after: calcScore(tailoredKeywordScore, tailoredSkillsScore, formattingScore, expRelAfter),
                    breakdown: {
                        keywordMatch: { before: originalKeywordScore, after: tailoredKeywordScore },
                        experienceRelevance: { before: expRelBefore, after: expRelAfter },
                        skillsAlignment: { before: originalSkillsScore, after: tailoredSkillsScore },
                        formatting: { before: originalFormattingScore, after: formattingScore },
                    },
                    analysis: analysisData.analysis || '',
                };

                // Send final result via SSE
                sendSSE(controller, encoder, {
                    phase: 'complete',
                    data: {
                        atsScore: deterministicAtsScore,
                        changes: analysisData.changes
                    }
                });

                // Persist final result to DB
                if (appId && userId) {
                    await db.update(applications).set({
                        analysis: JSON.stringify({
                            changes: analysisData.changes || [],
                            atsScore: deterministicAtsScore,
                        }),
                        tailorStatus: 'complete',
                    }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
                }

            } catch (error) {
                console.error('Streaming API Error:', error);
                sendSSE(controller, encoder, {
                    phase: 'error',
                    error: error instanceof Error ? error.message : 'Internal Server Error'
                });
                if (appId) await setTailorStatus(appId, 'error', userId);
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
