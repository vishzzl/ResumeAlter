import { NextRequest } from 'next/server';
import { generateText, CustomConfig } from '@/lib/generate';
import { parseResumeSections } from '@/lib/resume-parser';
import { callOpenRouter, FREE_MODELS } from '@/lib/openrouter';
import { auth } from '@/auth';
import type { JDAnalysis } from '@/app/api/analyze-jd/route';

export const maxDuration = 90;

export type SectionName = 'summary' | 'skills' | 'experience' | 'education' | 'projects' | 'other';

// ─── Section-aware temperatures ──────────────────────────────────────────────
// Skills/Education are factual lists — low temp prevents hallucinated entries.
// Experience/Summary need creative phrasing — slightly higher.
const SECTION_TEMPS: Record<SectionName, { gemini: number; ring: number; laguna: number }> = {
    summary:    { gemini: 0.40, ring: 0.40, laguna: 0.45 },
    skills:     { gemini: 0.15, ring: 0.18, laguna: 0.20 },
    experience: { gemini: 0.45, ring: 0.45, laguna: 0.52 },
    education:  { gemini: 0.10, ring: 0.10, laguna: 0.12 },
    projects:   { gemini: 0.35, ring: 0.35, laguna: 0.40 },
    other:      { gemini: 0.15, ring: 0.15, laguna: 0.18 },
};

// ─── Multi-signal scoring ─────────────────────────────────────────────────────

/** Signal 1: keyword coverage (existing logic) */
function scoreKeywordCoverage(text: string, keywords: string[]): number {
    if (!keywords.length) return 100;
    const lower = text.toLowerCase();
    const matched = keywords.filter(kw => {
        const lk = kw.toLowerCase().trim();
        if (!lk) return false;
        if (lk.length <= 3) return new RegExp(`\\b${lk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
        return lower.includes(lk);
    });
    return Math.round((matched.length / keywords.filter(k => k.trim()).length) * 100);
}

/** Signal 2: format compliance — did the model follow the section template? */
function scoreFormatCompliance(text: string, section: SectionName): number {
    switch (section) {
        case 'experience': {
            const hasBold    = /\*\*[^*]{2,}\*\*/.test(text);
            const hasBullets = /^[\u2022\-\*•]/m.test(text);
            const hasDates   = /\d{4}/.test(text);
            const bCount     = (text.match(/^[\u2022\-\*•]/gm) || []).length;
            const goodCount  = bCount >= 2 && bCount <= 20;
            return Math.round([hasBold, hasBullets, hasDates, goodCount].filter(Boolean).length / 4 * 100);
        }
        case 'skills': {
            const hasBold    = /\*\*[A-Za-z\/& ]+\*\*/.test(text);
            const hasItems   = text.includes(',') || text.split('\n').length > 2;
            const lineCount  = text.split('\n').filter(l => l.trim()).length;
            const goodLen    = lineCount >= 2 && lineCount <= 15;
            return Math.round([hasBold, hasItems, goodLen].filter(Boolean).length / 3 * 100);
        }
        case 'summary': {
            const sentences  = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
            const goodSents  = sentences.length >= 2 && sentences.length <= 4;
            const words      = text.split(/\s+/).length;
            const goodWords  = words >= 20 && words <= 90;
            return Math.round([goodSents, goodWords].filter(Boolean).length / 2 * 100);
        }
        case 'education': {
            const hasBold = /\*\*[^*]+\*\*/.test(text);
            const hasYear = /\d{4}/.test(text);
            return hasBold && hasYear ? 100 : hasBold || hasYear ? 65 : 40;
        }
        case 'projects': {
            const hasBold = /\*\*[^*]+\*\*/.test(text);
            const hasDesc = /^[\u2022\-\*•]/m.test(text);
            return Math.round([hasBold, hasDesc].filter(Boolean).length / 2 * 100);
        }
        case 'other':
            return /\*\*[^*]+\*\*/.test(text) ? 100 : 60;
        default:
            return 70;
    }
}

/** Signal 3: groundedness — what fraction of proper nouns & numbers in output exist in original? */
function scoreGroundedness(generated: string, originalResume: string): number {
    if (!originalResume || !generated) return 75;
    const origLower = originalResume.toLowerCase();

    // Extract numbers + units from generated
    const numbers = [
        ...(generated.match(/\b\d+\.?\d*\s*(%|ms|\bk\b|\bM\b|\bB\b|\bx\b)/gi) || []),
        ...(generated.match(/\b\d{2,}\b/g) || []),
    ];

    // Extract proper nouns (capitalized, not at sentence start, not common verbs)
    const skip = new Set(['The','This','These','With','From','Into','Over','Under','Using',
        'Led','Built','Developed','Implemented','Designed','Managed','Delivered',
        'Improved','Reduced','Increased','Enabled','Deployed','Integrated','Architected',
        'Optimized','Spearheaded','Pioneered','Scaled','Transformed','Championed']);
    const propNouns: string[] = [];
    const pat = /(?<![.!?\n]\s)\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?)\b/g;
    let m: RegExpExecArray | null;
    while ((m = pat.exec(generated)) !== null) {
        const w = m[1];
        if (!skip.has(w) && w.length >= 4) propNouns.push(w);
    }

    const all = [...new Set([...numbers, ...propNouns])];
    if (all.length === 0) return 85;

    const verified = all.filter(item => origLower.includes(item.toLowerCase().trim()));
    return Math.max(30, Math.round((verified.length / all.length) * 70 + 30));
}

/** Combined 3-signal score */
function scoreCandidate(
    text: string,
    originalResume: string,
    jdKeywords: string[],
    section: SectionName
): { total: number; keyword: number; format: number; groundedness: number } {
    const keyword     = scoreKeywordCoverage(text, jdKeywords);
    const format      = scoreFormatCompliance(text, section);
    const groundedness = scoreGroundedness(text, originalResume);
    const total = Math.round(keyword * 0.40 + format * 0.30 + groundedness * 0.30);
    return { total, keyword, format, groundedness };
}

// ─── The system instruction used for all three model calls ────────────────────
const SYSTEM_INSTRUCTION =
    'You are an elite Executive Career Coach and Expert Resume Writer. ' +
    'You produce concise, high-impact professional content with ATS precision. ' +
    'You NEVER fabricate skills, metrics, technologies, or experiences that are not explicitly present in the original resume. ' +
    'Fact-fidelity is your highest priority. Output ONLY the requested section content — no JSON, no section headers, no preamble.';

// ─── Section-specific tailoring prompts ──────────────────────────────────────
function buildSectionPrompt(
    sectionName: SectionName,
    sections: ReturnType<typeof parseResumeSections>,
    jobDescription: string,
    modelFocus: 'balanced' | 'keywords' | 'impact',
    jdAnalysis?: JDAnalysis | null,
): string {
    // Pre-digested JD intel block — injected before raw JD so models don’t have to re-parse
    const JD_INTEL = jdAnalysis ? `
PRE-ANALYZED JD INTEL (use this — already extracted for you):
  Target Title    : ${jdAnalysis.targetTitle}
  Seniority       : ${jdAnalysis.seniority}
  Domain          : ${jdAnalysis.companyDomain}
  Required Skills : ${jdAnalysis.requiredSkills.join(', ')}
  Preferred Skills: ${jdAnalysis.preferredSkills.join(', ')}
  Key Verbs       : ${jdAnalysis.keyVerbs.join(', ')}
  Key Phrases     : ${jdAnalysis.keyPhrases.join(' | ')}
` : '';

    const TRUTH_HEADER = `
═══════════════════════════════════════════════════════════
ANTI-HALLUCINATION RULE (ABSOLUTE — overrides all else):
You may ONLY use facts, skills, technologies, metrics, company names,
job titles, and experiences that appear in the ORIGINAL RESUME below.
Do NOT invent, infer, or embellish anything not in the original.
═══════════════════════════════════════════════════════════
${JD_INTEL}
JOB DESCRIPTION (full text — for additional context):
${jobDescription}

ORIGINAL RESUME — THE ABSOLUTE SOURCE OF TRUTH:
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
`;

    // Per-section focus variants — each model gets meaningfully different ordering/emphasis
    // so the 3 candidates are actually distinct and worth comparing.
    const focusNotes: Record<SectionName, Record<'balanced' | 'keywords' | 'impact', string>> = {
        summary: {
            balanced: '',
            keywords: '\nFOCUS: Maximize coverage of exact JD keywords. Use the JD\'s exact phrasing for every matching skill and technology in the summary.',
            impact: '\nFOCUS: Lead with the single most impressive achievement or impact. Executive, results-first tone.',
        },
        skills: {
            balanced: '',
            keywords: '\nFOCUS: Prioritize skills that match the JD\'s required section verbatim. List the most keyword-dense combination first.',
            impact: '\nFOCUS: Group by strategic value. Lead with highest-impact capability areas (cloud, architecture, leadership) before individual tools.',
        },
        experience: {
            balanced: '',
            keywords: `
VARIANT FOCUS — KEYWORD DENSITY:
When writing bullets, prioritize using the EXACT technical terms and action verbs from the JD's required skills list.
If the JD says "architected microservices" and the original resume shows similar work, use "architected microservices" in the bullet.
Order bullets within each role: lead with the bullet that contains the most JD keywords.
This variant should feel like the resume was written specifically for this job listing.`,
            impact: `
VARIANT FOCUS — EXECUTIVE IMPACT:
When writing bullets, lead each role with the highest-scale, highest-stakes achievement first.
Prioritize: team sizes led, revenue/cost impact, user scale, system reliability (uptime, latency improvements), or major deliverables shipped.
Use aggressive executive verbs: Spearheaded, Pioneered, Scaled, Transformed, Overhauled, Drove, Championed.
This variant should feel like a VP-level candidate wrote it.`,
        },
        education: {
            balanced: '',
            keywords: '\nFOCUS: If the JD mentions specific degree requirements, make sure the matching degree line is first.',
            impact: '\nFOCUS: Same as balanced — education section rarely benefits from heavy rewriting.',
        },
        projects: {
            balanced: '',
            keywords: '\nFOCUS: In each project description, use the exact technical terms from the JD. If JD says "distributed systems" and the project involved similar work, use that phrase.',
            impact: '\nFOCUS: Lead with the project that demonstrates the highest impact or most advanced technical depth. Describe scope (e.g., scale, users, complexity).',
        },
        other: {
            balanced: '',
            keywords: '\nFOCUS: Surface certs/awards that directly match JD-required qualifications first.',
            impact: '\nFOCUS: Same as balanced — certifications section is fact-based, minimal rewriting needed.',
        },
    };

    const focusNote = focusNotes[sectionName][modelFocus];

    const SECTION_TASKS: Record<SectionName, string> = {
        summary: `${TRUTH_HEADER}${focusNote}

TASK: Rewrite ONLY the SUMMARY section.
- Exactly 2–3 sentences. No more.
- Sentence 1: Use the EXACT job title from the JD + the candidate's years of experience (only if stated in original).
- Sentences 2–3: Naturally incorporate 3–5 required JD keywords. Focus on VALUE delivered, not objectives.
- Do NOT mention any skill or achievement not present in the ORIGINAL RESUME.
- Do NOT include a section header in output.

OUTPUT: Return ONLY the rewritten summary paragraph. No headers. No preamble.`,

        skills: `${TRUTH_HEADER}${focusNote}

TASK: Rewrite ONLY the SKILLS section.
- Group by: **Languages**, **Frameworks**, **Cloud/DevOps**, **Databases**, **Tools**
- Include ONLY skills demonstrable from the ORIGINAL RESUME (any section).
- Use the EXACT keyword phrasing from the JD where the candidate has that skill.
- Prioritize skills that appear in the JD's required/preferred section.
- Do NOT invent skills. Do NOT include the section header "Skills" in output.

OUTPUT: Return ONLY the formatted skills content. No headers. No preamble.`,

        experience: `${TRUTH_HEADER}${focusNote}

══════════════════════════════════════════════════════════
TASK: Rewrite the EXPERIENCE section for the target role.
══════════════════════════════════════════════════════════

STEP 1 — IDENTIFY ROLES
From the "--- EXPERIENCE ---" block above, extract ALL roles. Include every company, job title, and date range EXACTLY as written. Do not drop or merge any role.

STEP 2 — DETECT CONSULTING/AGENCY ROLES
If a role is at a consulting firm, staffing agency, or shows multiple named clients listed under one employer:
→ Treat each named CLIENT as its own sub-section under the parent employer.
→ Use the CLIENT sub-section format shown in STEP 4b below.
→ Never merge client work into a single block.

STEP 3 — SELECT JD-ALIGNED KEYWORDS
From the JOB DESCRIPTION above, extract the top 8–12 action-oriented verbs (e.g., "architected", "optimized", "led", "deployed", "integrated") and 6–10 technical nouns (e.g., "microservices", "CI/CD pipeline", "REST APIs"). You will weave these into the bullets — but ONLY where the original resume provides the underlying fact.

STEP 4 — WRITE THE BULLETS

BULLET FORMULA (use this exactly):
  [Strong JD-aligned verb], [what you built/did], [using what tools/tech from original], [resulting in what outcome from original].

Examples of GOOD bullets:
  • Architected a real-time event ingestion pipeline using Apache Kafka and Python, reducing data latency from 8 s to 400 ms for 50 000 daily active users.
  • Led cross-functional squads of 6 engineers to deliver 3 microservices on AWS Lambda, cutting infrastructure costs by 35% quarter-over-quarter.
  • Refactored monolithic Django API into domain-driven modules, improving test coverage from 42% to 91% and enabling independent deployment of each service.

Rules for bullets:
  • 3–4 bullets per role (or per client sub-section if consulting). Never fewer than 2, never more than 4.
  • Every bullet = exactly 1 sentence, 15–25 words.
  • Start with a PAST-TENSE action verb. Never start with "I", "We", "Responsible for", "Worked on", or "Helped".
  • Include at least ONE technical keyword from the JD per bullet (only if the original resume supports it).
  • Include a metric or outcome in at least 2 of the 4 bullets — but ONLY if a number appears in the original resume for that role/client. If no numbers exist, describe a concrete outcome instead (e.g., "enabling zero-downtime deployments" not "improving performance by X%").
  • DO NOT invent metrics. DO NOT fabricate client names, tech stacks, team sizes, or outcomes.

STEP 5 — FORMAT THE OUTPUT

FORMAT 4a — Standard (non-consulting) role:
**[Company Name]** | **[Job Title]** | *[Start Month Year – End Month Year or Present]*
• [bullet 1]
• [bullet 2]
• [bullet 3]
• [bullet 4]

FORMAT 4b — Consulting role with named clients:
**[Consulting Firm / Agency]** | **[Your Title]** | *[Start Month Year – End Month Year or Present]*

  **Client:** [Client Name] — [Industry or Domain]
  • [bullet 1]
  • [bullet 2]
  • [bullet 3]

  **Client:** [Next Client Name] — [Industry or Domain]
  • [bullet 1]
  • [bullet 2]
  • [bullet 3]

HARD CONSTRAINTS — VIOLATIONS WILL FAIL:
  ✗ DO NOT add any company, client, or employer name not in the original resume.
  ✗ DO NOT use the hiring company name from the JD anywhere in the output.
  ✗ DO NOT invent a metric, percentage, or number not present in the original.
  ✗ DO NOT invent a technology, framework, or tool not present in the original.
  ✗ DO NOT add a role title that doesn't match the original.
  ✗ DO NOT include "Experience" or any section heading in the output.
  ✗ DO NOT add a preamble, explanation, or closing note.

OUTPUT: Return ONLY the formatted experience markdown following the templates above. Start directly with the first **[Company]** line.`,

        education: `${TRUTH_HEADER}${focusNote}

TASK: Rewrite ONLY the EDUCATION section.
- Keep content EXACTLY as in the original — do not change institution names, degrees, or dates.
- Format: **[Degree]** | **[Institution]** | **[Dates]**
- You may reorder to put the most relevant/highest degree first.
- Do NOT add, remove, or embellish any entry. Do NOT include the section header in output.

OUTPUT: Return ONLY the formatted education content. No headers. No preamble.`,

        projects: `${TRUTH_HEADER}${focusNote}

TASK: Rewrite ONLY the PROJECTS section.
- Limit to 5 most relevant projects (relevance = JD skill overlap).
- Format: **[Project Name]** | [Link](URL)
  * [1-sentence description using JD-aligned language]
- Only use project names, technologies, and descriptions from the ORIGINAL RESUME.
- Do NOT invent project details, links, or technologies. Do NOT include the section header in output.

OUTPUT: Return ONLY the formatted projects content. No headers. No preamble.`,

        other: `${TRUTH_HEADER}${focusNote}

TASK: Rewrite ONLY the CERTIFICATIONS / OTHER section.
- Keep ALL certifications/awards from the original — do NOT drop any.
- Format: **[Cert/Award Name]** | [Issuer] | [Date]
- Reorder to place the most JD-relevant certifications first.
- Do NOT invent or modify any certification details. Do NOT include the section header in output.

OUTPUT: Return ONLY the formatted certifications content. No headers. No preamble.`,
    };

    return SECTION_TASKS[sectionName];
}

// ─── SSE helper ───────────────────────────────────────────────────────────────
function sendSSE(ctrl: ReadableStreamDefaultController, enc: TextEncoder, event: Record<string, unknown>) {
    ctrl.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
}

// ─── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    await auth(); // session check (optional — same as existing routes)

    const body = await req.json();
    const {
        sectionName,
        resume,
        jobDescription,
        jdAnalysis,
        apiKey,
        modelProvider,
        modelName,
        customConfig,
    }: {
        sectionName: SectionName;
        resume: string;
        jobDescription: string;
        jdAnalysis?: JDAnalysis | null;
        apiKey?: string;
        modelProvider?: string;
        modelName?: string;
        customConfig?: CustomConfig;
    } = body;

    const validSections: SectionName[] = ['summary', 'skills', 'experience', 'education', 'projects', 'other'];
    if (!sectionName || !validSections.includes(sectionName)) {
        return new Response(
            JSON.stringify({ error: `Invalid sectionName. Must be one of: ${validSections.join(', ')}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
    if (!resume || !jobDescription) {
        return new Response(
            JSON.stringify({ error: 'resume and jobDescription are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Resolve provider
    const customUrl = process.env.CUSTOM_LLM_URL;
    const hasGeminiKey = !!apiKey || !!process.env.GEMINI_API_KEY;
    let provider = modelProvider;
    if (!provider) {
        if (hasGeminiKey) provider = 'gemini';
        else if (customUrl) provider = 'custom';
        else provider = 'local';
    }

    console.log(`[tailor-section] section=${sectionName}, provider=${provider}, model=${modelName || 'default'}`);

    const sections = parseResumeSections(resume);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                sendSSE(controller, encoder, { phase: 'generating', sectionName });

                const temps = SECTION_TEMPS[sectionName];

                const geminiPrompt = buildSectionPrompt(sectionName, sections, jobDescription, 'balanced', jdAnalysis);
                const ringPrompt   = buildSectionPrompt(sectionName, sections, jobDescription, 'keywords', jdAnalysis);
                const lagunaPrompt = buildSectionPrompt(sectionName, sections, jobDescription, 'impact',   jdAnalysis);

                const [geminiResult, ringResult, lagunaResult] = await Promise.allSettled([
                    generateText({
                        prompt: geminiPrompt,
                        systemInstruction: SYSTEM_INSTRUCTION,
                        provider: provider!,
                        apiKey,
                        modelName,
                        customConfig,
                        temperature: temps.gemini,
                        jsonMode: false,
                    }),
                    callOpenRouter({
                        model: FREE_MODELS.PRIMARY,
                        messages: [
                            { role: 'system', content: SYSTEM_INSTRUCTION + ' Prioritize exact JD keyword phrasing and ATS keyword density.' },
                            { role: 'user',   content: ringPrompt },
                        ],
                        temperature: temps.ring,
                        max_tokens: 2048,
                    }).catch(err => { console.warn(`[tailor-section] Ring failed:`, err.message); return null; }),
                    callOpenRouter({
                        model: FREE_MODELS.LAGUNA,
                        messages: [
                            { role: 'system', content: SYSTEM_INSTRUCTION + ' Prioritize executive tone, strong action verbs, and impact-first phrasing.' },
                            { role: 'user',   content: lagunaPrompt },
                        ],
                        temperature: temps.laguna,
                        max_tokens: 2048,
                    }).catch(err => { console.warn(`[tailor-section] Laguna failed:`, err.message); return null; }),
                ]);

                const jdKeywords = extractKeywordsFromJD(jobDescription, jdAnalysis);
                const candidates: Array<{
                    model: string; focus: string; text: string;
                    score: number; scoreBreakdown: { keyword: number; format: number; groundedness: number };
                }> = [];

                if (geminiResult.status === 'rejected') {
                    throw new Error(`Primary model failed: ${geminiResult.reason}`);
                }
                const geminiText = geminiResult.value.trim();
                const geminiScores = scoreCandidate(geminiText, resume, jdKeywords, sectionName);
                candidates.push({
                    model: 'Gemini (Balanced)',
                    focus: 'Balanced ATS alignment + executive tone',
                    text: geminiText,
                    score: geminiScores.total,
                    scoreBreakdown: { keyword: geminiScores.keyword, format: geminiScores.format, groundedness: geminiScores.groundedness },
                });

                if (ringResult.status === 'fulfilled' && ringResult.value) {
                    const text = ringResult.value.trim();
                    const s = scoreCandidate(text, resume, jdKeywords, sectionName);
                    candidates.push({
                        model: 'Ring (Keyword-Dense)',
                        focus: 'Maximum JD keyword coverage + exact phrasing',
                        text,
                        score: s.total,
                        scoreBreakdown: { keyword: s.keyword, format: s.format, groundedness: s.groundedness },
                    });
                }

                if (lagunaResult.status === 'fulfilled' && lagunaResult.value) {
                    const text = lagunaResult.value.trim();
                    const s = scoreCandidate(text, resume, jdKeywords, sectionName);
                    candidates.push({
                        model: 'Laguna (Impact)',
                        focus: 'Executive tone + impact verbs + achievements first',
                        text,
                        score: s.total,
                        scoreBreakdown: { keyword: s.keyword, format: s.format, groundedness: s.groundedness },
                    });
                }

                // Sort by keyword score descending — highest keyword coverage wins
                candidates.sort((a, b) => b.score - a.score);
                const recommendedIndex = 0;

                console.log(`[tailor-section] ${sectionName} — ${candidates.length} candidates:`);
                candidates.forEach(c => console.log(`  ${c.model}: ${c.score}%`));

                sendSSE(controller, encoder, {
                    phase: 'complete',
                    sectionName,
                    data: {
                        candidates,
                        recommendedIndex,
                        // Convenience: the winning section text
                        tailoredSection: candidates[recommendedIndex].text,
                    },
                });

            } catch (error) {
                console.error(`[tailor-section] Error for section=${sectionName}:`, error);
                sendSSE(controller, encoder, {
                    phase: 'error',
                    sectionName,
                    error: error instanceof Error ? error.message : 'Section generation failed',
                });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}

// ─── Lightweight JD keyword extractor ────────────────────────────────────────
// Extracts likely technical keywords from the job description without an extra API call.
// Captures: capitalized tech terms, quoted phrases, common tech patterns.
function extractKeywordsFromJD(jd: string, analysis?: JDAnalysis | null): string[] {
    const keywords = new Set<string>();

    // If we have pre-analyzed JD intel, use the extracted skills directly—more accurate than regex
    if (analysis) {
        [...analysis.requiredSkills, ...analysis.preferredSkills, ...analysis.keyVerbs]
            .forEach(k => keywords.add(k));
    }

    // Also run regex patterns to catch anything the analyzer may have missed
    const techPatterns = [
        /\b(React|Vue|Angular|Next\.js|Nuxt|Svelte)\b/gi,
        /\b(Node\.js|Express|FastAPI|Django|Flask|Spring|Rails|Laravel)\b/gi,
        /\b(TypeScript|JavaScript|Python|Java|Go|Rust|C\+\+|C#|Ruby|Kotlin|Swift)\b/gi,
        /\b(AWS|GCP|Azure|Kubernetes|Docker|Terraform|Helm|CI\/CD|DevOps)\b/gi,
        /\b(PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|DynamoDB|SQLite|Cassandra)\b/gi,
        /\b(GraphQL|REST|gRPC|WebSocket|Kafka|RabbitMQ|Celery)\b/gi,
        /\b(Git|GitHub|GitLab|Bitbucket|Jenkins|GitHub Actions|CircleCI)\b/gi,
        /\b(LLM|RAG|NLP|ML|AI|TensorFlow|PyTorch|Langchain|OpenAI|Gemini)\b/gi,
        /\b(Agile|Scrum|JIRA|Confluence|Notion|Linear)\b/gi,
        /\b(Figma|Sketch|Tailwind|CSS|SCSS|Sass|Bootstrap)\b/gi,
        /\b(Microservices|Serverless|Lambda|API Gateway|Load Balancer)\b/gi,
    ];

    for (const pattern of techPatterns) {
        const matches = jd.match(pattern) || [];
        for (const m of matches) keywords.add(m);
    }

    // Also capture capitalized multi-word phrases
    const phrasePat = /\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){1,3})\b/g;
    let m: RegExpExecArray | null;
    while ((m = phrasePat.exec(jd)) !== null) {
        const phrase = m[1];
        if (phrase.length > 4 && !['You Will', 'We Are', 'You Have', 'The Team', 'Our Team', 'This Role'].includes(phrase)) {
            keywords.add(phrase);
        }
    }

    return Array.from(keywords).slice(0, 60);
}
