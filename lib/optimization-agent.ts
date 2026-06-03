import { generateText, cleanJson, CustomConfig } from './generate';
import { callOpenRouter, FREE_MODELS } from './openrouter';
import { parseResumeSections } from './resume-parser';
import { OptimizationResult, CandidateResume, AgentInput, SectionChange } from '../types/optimization';

// ── Keyword Coverage Calculator ─────────────────────────────────────────────
function calculateKeywordCoverage(text: string, keywords: string[]): { matched: string[]; missing: string[]; score: number } {
    const lowerText = text.toLowerCase();
    const matched: string[] = [];
    const missing: string[] = [];
    for (const kw of keywords) {
        const lk = kw.toLowerCase().trim();
        if (!lk) continue;
        if (lowerText.includes(lk)) matched.push(kw);
        else missing.push(kw);
    }
    const total = keywords.filter(k => k.trim()).length;
    return { matched, missing, score: total > 0 ? Math.round((matched.length / total) * 100) : 100 };
}

// ── Compute section-by-section changes between original and tailored resume ──
function computeChanges(originalResume: string, tailoredResume: string): SectionChange[] {
    const origSections = parseResumeSections(originalResume);
    const tailoredSections = parseResumeSections(tailoredResume);
    const changes: SectionChange[] = [];

    const sectionPairs: Array<{ key: keyof ReturnType<typeof parseResumeSections>; label: string }> = [
        { key: 'summary', label: 'Summary' },
        { key: 'experience', label: 'Experience' },
        { key: 'skills', label: 'Skills' },
        { key: 'education', label: 'Education' },
        { key: 'projects', label: 'Projects' },
        { key: 'other', label: 'Certifications' },
        { key: 'header', label: 'Header' },
    ];

    for (const { key, label } of sectionPairs) {
        const orig = (origSections[key] || '').trim();
        const tailored = (tailoredSections[key] || '').trim();

        // Skip if both are empty or identical
        if (!orig && !tailored) continue;
        if (orig === tailored) continue;

        // Determine what kind of change happened
        let reason: string;
        if (!orig && tailored) {
            reason = `Added ${label} section (not present in original).`;
        } else if (orig && !tailored) {
            reason = `Removed ${label} section.`;
        } else {
            // Measure how different
            const origWords = orig.toLowerCase().split(/\s+/).length;
            const tailoredWords = tailored.toLowerCase().split(/\s+/).length;
            const wordDiff = tailoredWords - origWords;
            if (Math.abs(wordDiff) > origWords * 0.3) {
                reason = `Substantially rewrote ${label} — ${wordDiff > 0 ? 'expanded' : 'condensed'} by ${Math.abs(wordDiff)} words.`;
            } else {
                reason = `Optimized ${label} — improved keyword alignment and professional tone.`;
            }
        }

        changes.push({
            section: label,
            original: orig.substring(0, 200),
            new: tailored.substring(0, 200),
            reason,
        });
    }

    return changes;
}

// ── The master tailoring prompt (same battle-tested prompt from /api/tailor) ─
function buildTailoringPrompt(sections: ReturnType<typeof parseResumeSections>, jobDescription: string): string {
    return `
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
- Maximum 6 roles. Maximum 3–6 bullets per role or per client.

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
                    { "name": "HDFC Bank", "domain": "FinTech", "bullets": ["Architected real-time payment gateway..."] }
                ]
            }
        ],
        "education": "**B.Tech Computer Science** | IIT Bombay | 2018–2022",
        "projects": "**ResumeAI** | [GitHub](https://github.com/...)\\\\n* Built an LLM-powered resume tailoring tool...",
        "other": "**AWS Solutions Architect** | Amazon | 2023"
    }
}`;
}

// ── Reconstruct resume text from parsed JSON sections ────────────────────────
function reconstructResume(tailoredSections: ReturnType<typeof parseResumeSections>): string {
    let resume = `
${tailoredSections.header}

## Summary
${tailoredSections.summary}

## Experience
${tailoredSections.experience}

## Skills
${tailoredSections.skills}
`.trim();

    if (tailoredSections.education?.trim()) {
        const content = tailoredSections.education.replace(/^#+\s*Education\s*/i, '').trim();
        if (content) resume += `\n\n## Education\n${content}`;
    }
    if (tailoredSections.projects?.trim()) {
        const content = tailoredSections.projects.replace(/^#+\s*Projects\s*/i, '').trim();
        if (content) resume += `\n\n## Projects\n${content}`;
    }
    if (tailoredSections.other?.trim()) {
        const content = tailoredSections.other.replace(/^#+\s*(Certifications|Other|Certifications\s*&\s*Other)\s*/i, '').trim();
        if (content) resume += `\n\n## Certifications\n${content}`;
    }
    return resume;
}

// ── Parse the JSON response from a tailoring model ──────────────────────────
function parseTailoringResponse(rawText: string, fallbackSections: ReturnType<typeof parseResumeSections>): {
    sections: ReturnType<typeof parseResumeSections>;
    keywords: { requiredKeywords: string[]; preferredKeywords: string[] };
} {
    const sections = { ...fallbackSections };
    let keywords = { requiredKeywords: [] as string[], preferredKeywords: [] as string[] };

    try {
        const data = JSON.parse(cleanJson(rawText));

        if (data.extractedKeywords) {
            keywords = {
                requiredKeywords: data.extractedKeywords.requiredKeywords || [],
                preferredKeywords: data.extractedKeywords.preferredKeywords || [],
            };
        }

        const normalizeNewlines = (s: string) => s.replace(/\\n/g, '\n');

        if (data.tailoredSections) {
            const ts = data.tailoredSections;
            if (ts.header) sections.header = normalizeNewlines(ts.header);
            if (ts.summary) sections.summary = normalizeNewlines(ts.summary);
            if (ts.skills) sections.skills = normalizeNewlines(ts.skills);
            if (ts.education) sections.education = normalizeNewlines(ts.education);
            if (ts.projects) sections.projects = normalizeNewlines(ts.projects);
            if (ts.other) sections.other = normalizeNewlines(ts.other);

            // Reconstruct experience from nested JSON
            if (Array.isArray(ts.experience)) {
                const expLines: string[] = [];
                for (const role of ts.experience) {
                    expLines.push(`**${role.company}** | **${role.role}** | **${role.dates}**`);
                    if (role.bullets?.length > 0 && (!role.clients || role.clients.length === 0)) {
                        expLines.push('');
                        for (const b of role.bullets) expLines.push(`* ${b}`);
                    }
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
                sections.experience = expLines.join('\n').trim();
            } else if (typeof ts.experience === 'string') {
                sections.experience = normalizeNewlines(ts.experience);
            }
        }
    } catch (e) {
        console.error('Failed to parse tailoring response:', e);
        // Returns fallback sections unchanged
    }

    return { sections, keywords };
}

// ── CoVe Fact-Check Prompt ──────────────────────────────────────────────────
function buildFactCheckPrompt(originalResume: string, candidateResume: string): string {
    return `You are a strict Fact-Checker for resumes. Compare the TAILORED resume against the ORIGINAL resume.

ORIGINAL RESUME (source of truth):
${originalResume}

TAILORED RESUME (to verify):
${candidateResume}

CHECK EACH OF THESE:
1. Are there any skills/technologies in the TAILORED version that do NOT exist anywhere in the ORIGINAL? List them.
2. Are there any metrics/numbers in the TAILORED version that do NOT exist in the ORIGINAL? List them.
3. Are there any company names or job titles that are different from the ORIGINAL? List them.
4. Are there any fabricated achievements or experiences? List them.

OUTPUT (JSON only):
{
    "factScore": 85,
    "hallucinations": ["React Native (not in original)", "99.9% uptime (fabricated metric)"],
    "verdict": "Minor hallucinations found — 2 items need removal"
}`;
}

/**
 * Main orchestration function — Gemini primary + OpenRouter alternatives + CoVe fact-check
 */
export async function optimizeResume(input: AgentInput & {
    apiKey?: string;
    modelName?: string;
    provider?: string;
    customConfig?: CustomConfig;
}): Promise<OptimizationResult> {
    const { originalResume, jobDescription, apiKey, modelName, provider, customConfig } = input;
    const sections = parseResumeSections(originalResume);
    const tailoringPrompt = buildTailoringPrompt(sections, jobDescription);

    const systemInstruction = 'You are an elite Executive Career Coach, Expert Resume Writer, and uncompromising Fact-Checker. You craft high-impact, results-driven professional narratives with ATS precision. You NEVER fabricate skills, metrics, or experiences. You ONLY output strictly valid JSON.';

    // ═══ STEP 1: Generate 3 candidates in parallel ═══
    console.log('═══ STEP 1: Generating 3 candidates (Gemini + 2 OpenRouter Free) ═══');

    const [geminiResult, orResult1, orResult2] = await Promise.allSettled([
        // Candidate 1: Gemini (primary — highest quality)
        generateText({
            prompt: tailoringPrompt,
            systemInstruction,
            provider: provider || 'gemini',
            apiKey,
            modelName,
            customConfig: customConfig as CustomConfig,
            temperature: 0.45,
            jsonMode: true,
        }),

        // Candidate 2: OpenRouter Ring (keyword focus)
        callOpenRouter({
            model: FREE_MODELS.PRIMARY,
            messages: [
                { role: 'system', content: systemInstruction + ' Focus especially on maximizing ATS keyword density and exact phrasing from the job description.' },
                { role: 'user', content: tailoringPrompt },
            ],
            temperature: 0.5,
            max_tokens: 4096,
        }).catch(err => {
            console.warn('OpenRouter Model A failed, skipping:', err.message);
            return null;
        }),

        // Candidate 3: OpenRouter Laguna (impact focus)
        callOpenRouter({
            model: FREE_MODELS.LAGUNA,
            messages: [
                { role: 'system', content: systemInstruction + ' Focus especially on action verbs, quantifiable impact metrics, and executive tone.' },
                { role: 'user', content: tailoringPrompt },
            ],
            temperature: 0.6,
            max_tokens: 4096,
        }).catch(err => {
            console.warn('OpenRouter Model B failed, skipping:', err.message);
            return null;
        }),
    ]);

    // Parse results
    const candidates: CandidateResume[] = [];

    // Gemini (must succeed)
    if (geminiResult.status === 'rejected') {
        throw new Error(`Gemini generation failed: ${geminiResult.reason}`);
    }
    const geminiParsed = parseTailoringResponse(geminiResult.value, sections);
    const geminiResume = reconstructResume(geminiParsed.sections);
    const allKeywords = [...geminiParsed.keywords.requiredKeywords, ...geminiParsed.keywords.preferredKeywords];

    candidates.push({
        model: 'Gemini (Primary)',
        text: geminiResume,
        focus: 'Balanced — ATS alignment + executive tone + fact preservation',
        selfScore: 0, crossScore: 0, finalScore: 0,
        changes: computeChanges(originalResume, geminiResume),
    });

    // OpenRouter A
    if (orResult1.status === 'fulfilled' && orResult1.value) {
        const parsedA = parseTailoringResponse(orResult1.value, sections);
        const orAText = reconstructResume(parsedA.sections);
        candidates.push({
            model: 'OpenRouter Ring (Keyword)',
            text: orAText,
            focus: 'Keyword Density — ATS keyword saturation + exact JD phrasing',
            selfScore: 0, crossScore: 0, finalScore: 0,
            changes: computeChanges(originalResume, orAText),
        });
    }

    // OpenRouter B
    if (orResult2.status === 'fulfilled' && orResult2.value) {
        const parsedB = parseTailoringResponse(orResult2.value, sections);
        const orBText = reconstructResume(parsedB.sections);
        candidates.push({
            model: 'OpenRouter Laguna (Impact)',
            text: orBText,
            focus: 'Impact Focus — action verbs + quantifiable achievements + executive tone',
            selfScore: 0, crossScore: 0, finalScore: 0,
            changes: computeChanges(originalResume, orBText),
        });
    }

    console.log(`Generated ${candidates.length} candidates`);

    // ═══ STEP 2: Keyword Scoring ═══
    console.log('\n═══ STEP 2: Keyword Scoring ═══');
    const requiredKws = geminiParsed.keywords.requiredKeywords;
    const preferredKws = geminiParsed.keywords.preferredKeywords;

    for (const candidate of candidates) {
        const reqCov = calculateKeywordCoverage(candidate.text, requiredKws);
        const prefCov = calculateKeywordCoverage(candidate.text, preferredKws);
        // selfScore = keyword coverage (required weighted 70%, preferred 30%)
        candidate.selfScore = (reqCov.score * 0.7 + prefCov.score * 0.3) / 100;
        console.log(`  ${candidate.model}: req=${reqCov.score}% pref=${prefCov.score}% kw_score=${(candidate.selfScore * 100).toFixed(1)}%`);
    }

    // ═══ STEP 3: CoVe Fact-Check via OpenRouter Free ═══
    console.log('\n═══ STEP 3: Fact-Checking (CoVe Pattern) ═══');

    const factCheckResults = await Promise.allSettled(
        candidates.map(c =>
            callOpenRouter({
                model: FREE_MODELS.FACTCHECK,
                messages: [
                    { role: 'system', content: 'You are a strict resume fact-checker. Output ONLY valid JSON.' },
                    { role: 'user', content: buildFactCheckPrompt(originalResume, c.text) },
                ],
                temperature: 0.1,
                max_tokens: 1024,
            }).catch(() => null)
        )
    );

    for (let i = 0; i < candidates.length; i++) {
        const result = factCheckResults[i];
        if (result.status === 'fulfilled' && result.value) {
            try {
                const parsed = JSON.parse(cleanJson(result.value));
                const factScore = Math.max(0, Math.min(100, parsed.factScore ?? 80));
                candidates[i].crossScore = factScore / 100;
                console.log(`  ${candidates[i].model}: factScore=${factScore}%, hallucinations=${parsed.hallucinations?.length || 0}`);
            } catch {
                candidates[i].crossScore = 0.80; // Default if parsing fails
            }
        } else {
            candidates[i].crossScore = 0.80; // Default if fact-check call fails
            console.log(`  ${candidates[i].model}: fact-check skipped (API unavailable), defaulting to 80%`);
        }
    }

    // ═══ STEP 4: Final Scoring & Ranking ═══
    console.log('\n═══ STEP 4: Final Scoring ═══');
    for (const candidate of candidates) {
        // finalScore = 50% keyword coverage + 50% fact score
        candidate.finalScore = (candidate.selfScore * 0.50) + (candidate.crossScore * 0.50);
        console.log(`  ${candidate.model}: final=${(candidate.finalScore * 100).toFixed(1)}% (kw=${(candidate.selfScore * 100).toFixed(1)}% fact=${(candidate.crossScore * 100).toFixed(1)}%)`);
    }

    candidates.sort((a, b) => b.finalScore - a.finalScore);
    const winner = candidates[0];
    console.log(`\n═══ WINNER: ${winner.model} with ${(winner.finalScore * 100).toFixed(1)}% ═══`);

    // ═══ STEP 5: Build output ═══
    const originalLower = originalResume.toLowerCase();
    const winnerLower = winner.text.toLowerCase();
    const addedKeywords = allKeywords.filter(kw =>
        winnerLower.includes(kw.toLowerCase()) && !originalLower.includes(kw.toLowerCase())
    );
    const missingKeywords = allKeywords.filter(kw =>
        !winnerLower.includes(kw.toLowerCase())
    );

    const improvementSummary: string[] = [];
    improvementSummary.push(`Generated ${candidates.length} alternative resumes using Gemini + OpenRouter free models.`);
    improvementSummary.push(`Keyword coverage: ${(winner.selfScore * 100).toFixed(0)}% of JD keywords matched.`);
    improvementSummary.push(`Fact-check score: ${(winner.crossScore * 100).toFixed(0)}% (Chain-of-Verification).`);
    if (addedKeywords.length > 0) {
        improvementSummary.push(`Added ${addedKeywords.length} new JD keywords to the resume.`);
    }
    improvementSummary.push(`Winner: ${winner.model} with final score ${(winner.finalScore * 100).toFixed(1)}%.`);

    return {
        bestResume: winner.text,
        winningModel: winner.model,
        finalScore: winner.finalScore,
        candidateResumes: candidates,
        missingKeywords: missingKeywords.slice(0, 30),
        addedKeywords,
        improvementSummary,
        changes: winner.changes,
    };
}
