import { NextRequest } from 'next/server';
import { generateText, cleanJson, CustomConfig } from '@/lib/generate';
import { parseResumeSections } from '@/lib/resume-parser';
import { classifyJD } from '@/lib/jd-classifier';
import { jdCache, normalizeJD, computeJDHash } from '@/lib/jd-cache';
import { db } from '@/lib/db';
import { applications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/auth';
import {
    TAILORING_SYSTEM_INSTRUCTION,
    buildGapFixPrompt,
    buildTailoringPrompt,
    buildVerificationPrompt,
    enforceImmutableSections,
    mergeJDAnalysis,
    parseGapFixResponse,
    parseTailoringResponse,
    parseVerificationResponse,
    reconstructResume,
    detectOptimalSectionOrder,
    deduplicateBullets,
    warnRepeatedVerbs,
    auditContactLeakage,
    auditExperienceBullets,
} from '@/lib/tailoring-prompts';
import {
    calculateAtsScore,
    calculateCoverageSet,
    computeSectionChanges,
    evidencedMissingKeywords,
    extractKeywordHints,
    containsKeyword,
} from '@/lib/ats-scoring';
import { buildSummaryPrompt } from '@/lib/prompts/buildSummaryPrompt';
import { buildSkillsPrompt } from '@/lib/prompts/buildSkillsPrompt';
import { buildExperiencePrompt } from '@/lib/prompts/buildExperiencePrompt';
import { parseExperienceMarkdown, extractMetrics, MetricIntegrityError } from '@/lib/experience-helper';
import { detectHallucinations } from '@/lib/hallucination-detector';
import { scoreBullet, buildSingleBulletRewritePrompt } from '@/lib/bullet-scorer';
import { modelPoolManager } from '@/lib/model-pool';
import { formatResumeToMarkdown, isLikelyPlainText } from '@/lib/resume-formatter';

export const maxDuration = 180;

function sendSSE(controller: ReadableStreamDefaultController, encoder: TextEncoder, event: Record<string, unknown>) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

async function setTailorStatus(appId: number, status: string, userId: number | null) {
    if (userId) {
        await db.update(applications).set({ tailorStatus: status }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
    } else {
        await db.update(applications).set({ tailorStatus: status }).where(eq(applications.id, appId));
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
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

    let jdClassification: any;
    let jdAnalysis: any;

    const cached = jdCache.get(jobDescription);
    const normalized = normalizeJD(jobDescription);
    const hash = computeJDHash(normalized);

    if (cached) {
        jdClassification = cached.classification;
        jdAnalysis = cached.jdAnalysis;
        if (process.env.NODE_ENV === 'development') {
            console.log(`[jd-cache] HIT — hash: ${hash}`);
        }
    } else {
        jdClassification = classifyJD(jobDescription);
        const keywordHints = extractKeywordHints(jobDescription);
        jdAnalysis = mergeJDAnalysis(keywordHints, {
            targetTitle: keywordHints.targetTitle,
            seniority: jdClassification.seniority,
        });
        jdCache.set(jobDescription, {
            classification: jdClassification,
            jdAnalysis
        });
        if (process.env.NODE_ENV === 'development') {
            console.log(`[jd-cache] MISS — hash: ${hash}`);
            console.log(`[jd-classifier] Classified JD: industry=${jdClassification.industry}, seniority=${jdClassification.seniority}, confidence=${jdClassification.confidence.toFixed(2)}, keywords=[${jdClassification.detectedKeywords.join(', ')}]`);
        }
    }

    const context = {
        classification: jdClassification,
    };
    modelPoolManager.geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
    modelPoolManager.githubApiKey = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_KEY;

    const customUrl = process.env.CUSTOM_LLM_URL;
    const hasGeminiKey = !!apiKey || !!process.env.GEMINI_API_KEY;

    let provider = modelProvider;
    if (!provider) {
        if (hasGeminiKey) provider = 'gemini';
        else if (customUrl) provider = 'custom';
        else provider = 'local';
    }

    console.log(`[tailor] Using guarded tailoring pipeline: provider=${provider}, model=${modelName || 'default'}`);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // ── Step 0: Auto-format plain-text resumes to canonical Markdown ──────
                // This ensures parseResumeSections() always receives well-structured input
                // and that the final tailored output renders consistently across
                // Preview, PDF, and DOCX.
                let formattedInputResume = resume;
                const isPreFiltered = false;

                if (!isPreFiltered && isLikelyPlainText(formattedInputResume)) {
                    console.log('[tailor] Plain-text resume detected — auto-formatting to Markdown...');
                    sendSSE(controller, encoder, { phase: 'formatting' });
                    try {
                        const formatResult = await formatResumeToMarkdown(formattedInputResume, {
                            provider: provider!,
                            apiKey,
                            modelName,
                            customConfig: customConfig as CustomConfig,
                        });
                        formattedInputResume = formatResult.formatted;
                        console.log(`[tailor] Resume formatted. Detected sections: ${formatResult.detectedSections.join(', ')}`);
                    } catch (formatErr) {
                        console.warn('[tailor] Auto-format failed; proceeding with original text.', formatErr);
                    }
                }

                const sections = parseResumeSections(formattedInputResume);

                sendSSE(controller, encoder, { phase: 'extracting' });
                if (appId) await setTailorStatus(appId, 'tailoring', userId);

                sendSSE(controller, encoder, { phase: 'tailoring' });

                // ── Gemini Free-Tier Consolidated Master Call ─────────────────────────
                // Consolidate into 1 Single LLM request to avoid hitting 15 RPM Free Tier limits.

                const masterSystemPrompt = [
                    'You are an expert ATS Resume Writer and Career Optimization Specialist.',
                    'RULE 0 — PRIORITY USER DIRECTIVES (HIGHEST PRIORITY): Obey all custom instructions provided in the job context (e.g. "Quantify metrics", "Emphasize specific frameworks", "Concise 1-page summary").',
                    'RULE 1 — FACTUAL INTEGRITY (ZERO HALLUCINATION): The original resume is the absolute source of truth. Never invent fake employers, degrees, dates, tools, or fabricated metrics. Every metric number, $, or % must be derived from or supported by original candidate history.',
                    'RULE 2 — ATS KEYWORD ALIGNMENT: Align terminology with the target job description keywords where supported by the candidate experience.',
                    'RULE 3 — ACTION VERBS & STAR BULLETS: Every experience bullet must start with a strong past-tense action verb (e.g. Architected, Engineered, Spearheaded, Optimized, Delivered) and follow the STAR method (Action + Result).',
                    'RULE 4 — OUTPUT FORMAT: Return ONLY a valid JSON object matching this structure:',
                    '{',
                    '  "summary": "Rewritten 2-3 sentence professional summary targeting job context",',
                    '  "skills": { "Languages": ["..."], "Frameworks": ["..."], "Cloud & Tools": ["..."] },',
                    '  "experience": "Full Markdown formatted experience section with company, title, dates, and STAR bullet points starting with - "',
                    '}'
                ].join('\n');

                const masterUserPrompt = `
ORIGINAL RESUME SECTIONS:
--- SUMMARY ---
${sections.summary || '(No summary provided)'}

--- SKILLS ---
${sections.skills || '(No skills provided)'}

--- EXPERIENCE ---
${sections.experience || '(No experience provided)'}

--- PROJECTS ---
${sections.projects || ''}

TARGET JOB DESCRIPTION & USER DIRECTIVES:
${jobDescription}

Generate the optimized tailored JSON object containing "summary", "skills", and "experience".
`;

                let masterResponseText = '';
                let attemptCount = 0;
                let success = false;

                // Automatic 429 Rate Limit backoff retry loop for Gemini Free Tier
                while (attemptCount < 3 && !success) {
                    try {
                        if (hasGeminiKey || provider === 'gemini') {
                            masterResponseText = await generateText({
                                prompt: masterUserPrompt,
                                systemInstruction: masterSystemPrompt,
                                provider: 'gemini',
                                apiKey: apiKey || process.env.GEMINI_API_KEY,
                                modelName: modelName || 'gemini-1.5-flash',
                                jsonMode: true,
                            });
                        } else {
                            masterResponseText = await modelPoolManager.call(
                                'summary',
                                masterSystemPrompt,
                                masterUserPrompt
                            );
                        }
                        success = true;
                    } catch (err: any) {
                        attemptCount++;
                        console.warn(`[tailor] Master call attempt ${attemptCount} failed:`, err?.message || err);
                        if (attemptCount < 3) {
                            // Wait 2 seconds before retry for free tier rate limits
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        } else {
                            throw err;
                        }
                    }
                }

                let parsedMaster: { summary?: string; skills?: Record<string, string[]> | string; experience?: string } = {};
                try {
                    parsedMaster = JSON.parse(cleanJson(masterResponseText));
                } catch (e) {
                    console.warn('[tailor] Master response parse warning, using raw output', e);
                }

                const tailoredSummary = parsedMaster.summary || sections.summary;

                // Format skills
                let formattedSkillsString = '';
                if (parsedMaster.skills && typeof parsedMaster.skills === 'object' && !Array.isArray(parsedMaster.skills)) {
                    const formattedSkillsArray: string[] = [];
                    for (const [category, skillsList] of Object.entries(parsedMaster.skills)) {
                        if (Array.isArray(skillsList) && skillsList.length > 0) {
                            formattedSkillsArray.push(`**${category}**: ${skillsList.join(', ')}`);
                        }
                    }
                    formattedSkillsString = formattedSkillsArray.join('\n');
                } else if (typeof parsedMaster.skills === 'string') {
                    formattedSkillsString = parsedMaster.skills;
                } else {
                    formattedSkillsString = sections.skills;
                }

                const tailoredExperience = parsedMaster.experience || sections.experience;

                const tailoredSections = {
                    summary: tailoredSummary,
                    skills: formattedSkillsString,
                    experience: tailoredExperience,
                    education: sections.education,
                    projects: sections.projects,
                    other: sections.other,
                };

                const reconstructedResume = reconstructResume(tailoredSections);
                sendSSE(controller, encoder, { phase: 'tailored', data: { tailoredResume: reconstructedResume } });

                // Phase: Verification
                sendSSE(controller, encoder, { phase: 'verifying' });
                const startVerifyTime = Date.now();
                let verifiedSections = tailoredSections;
                const verificationWarnings: string[] = [];

                try {
                    const report = detectHallucinations(tailoredSections, sections);
                    
                    if (report.clean) {
                        console.log(`[tailor] Verification clean! Bypassed LLM verification in ${Date.now() - startVerifyTime}ms.`);
                    } else {
                        console.log(`[tailor] Hallucinations detected: flagged metrics count=${report.flaggedMetrics.length}, flagged entities count=${report.flaggedEntities.length}. Calling targeted LLM verification...`);
                        
                        const verifyPrompt = buildVerificationPrompt(report.flaggedSentences, sections);
                        let verificationText = '';
                        if (hasGeminiKey || provider === 'gemini') {
                            verificationText = await generateText({
                                prompt: verifyPrompt.userPrompt,
                                systemInstruction: verifyPrompt.systemPrompt,
                                provider: 'gemini',
                                apiKey: apiKey || process.env.GEMINI_API_KEY,
                                modelName: modelName || 'gemini-1.5-flash',
                                jsonMode: true,
                            });
                        } else {
                            verificationText = await modelPoolManager.call(
                                'verification',
                                verifyPrompt.systemPrompt,
                                verifyPrompt.userPrompt
                            );
                        }
                        
                        // Estimate token count for verification prompt
                        const verifyTokens = Math.ceil((verifyPrompt.systemPrompt.length + verifyPrompt.userPrompt.length) / 4);
                        if (process.env.NODE_ENV === 'development') {
                            console.log(`[tailor] Verification prompt token estimate: ${verifyTokens}`);
                        }

                        const patches: Array<{ original: string; corrected: string }> = JSON.parse(cleanJson(verificationText));
                        
                        // Apply the patches idempotently to tailoredSections
                        const correctedSections = { ...tailoredSections };
                        for (const patch of patches) {
                            if (!patch.original || !patch.corrected) continue;
                            const orig = patch.original.trim();
                            const corr = patch.corrected.trim();
                            
                            if (correctedSections.summary.includes(orig)) {
                                correctedSections.summary = correctedSections.summary.replace(orig, corr);
                                verificationWarnings.push(`Summary corrected: "${orig}" -> "${corr}"`);
                            }
                            if (correctedSections.skills.includes(orig)) {
                                correctedSections.skills = correctedSections.skills.replace(orig, corr);
                                verificationWarnings.push(`Skills corrected: "${orig}" -> "${corr}"`);
                            }
                            if (correctedSections.experience.includes(orig)) {
                                correctedSections.experience = correctedSections.experience.replace(orig, corr);
                                verificationWarnings.push(`Experience corrected: "${orig}" -> "${corr}"`);
                            }
                            if (correctedSections.projects.includes(orig)) {
                                correctedSections.projects = correctedSections.projects.replace(orig, corr);
                                verificationWarnings.push(`Projects corrected: "${orig}" -> "${corr}"`);
                            }
                            if (correctedSections.other.includes(orig)) {
                                correctedSections.other = correctedSections.other.replace(orig, corr);
                                verificationWarnings.push(`Certifications corrected: "${orig}" -> "${corr}"`);
                            }
                        }
                        
                        verifiedSections = enforceImmutableSections(sections, correctedSections);
                    }
                } catch (error) {
                    console.warn('[tailor] Verification pass failed; using generated sections with deterministic invariants.', error);
                    verificationWarnings.push('Verification pass failed; deterministic header and education safeguards were applied.');
                }

                // Detect optimal section ordering based on JD analysis
                const sectionOrder = detectOptimalSectionOrder(jdAnalysis);
                if (sectionOrder !== 'default') {
                    console.log(`[tailor] Using ${sectionOrder} section ordering for keyword-dense JD`);
                }

                const preFixResume = reconstructResume(verifiedSections, sectionOrder);
                const preFixCoverage = calculateCoverageSet(
                    preFixResume,
                    jdAnalysis.requiredSkills,
                    jdAnalysis.preferredSkills
                );

                sendSSE(controller, encoder, { phase: 'gap_check', data: { preFixCoverage } });

                const missing = evidencedMissingKeywords(formattedInputResume, preFixCoverage);
                let finalSections = verifiedSections;
                let injectedKeywords: string[] = [];
                const skippedKeywords: string[] = missing.unsupported.map(keyword => `${keyword} - not evidenced in original resume`);

                if (missing.evidenced.length > 0) {
                    try {
                        const gapFixPrompt = buildGapFixPrompt({
                            originalSections: sections,
                            currentSections: verifiedSections,
                            jdAnalysis,
                            evidencedMissingKeywords: missing.evidenced,
                        });
                        let gapFixText = '';
                        if (hasGeminiKey || provider === 'gemini') {
                            gapFixText = await generateText({
                                prompt: gapFixPrompt,
                                systemInstruction: TAILORING_SYSTEM_INSTRUCTION,
                                provider: 'gemini',
                                apiKey: apiKey || process.env.GEMINI_API_KEY,
                                modelName: modelName || 'gemini-1.5-flash',
                                jsonMode: true,
                            });
                        } else {
                            gapFixText = await modelPoolManager.call(
                                'gap_fix',
                                TAILORING_SYSTEM_INSTRUCTION,
                                gapFixPrompt
                            );
                        }
                        const gapFix = parseGapFixResponse(gapFixText, verifiedSections);
                        finalSections = enforceImmutableSections(sections, gapFix.tailoredSections);
                        injectedKeywords = gapFix.injectedKeywords;
                        skippedKeywords.push(...gapFix.skippedKeywords);
                        verificationWarnings.push(...gapFix.warnings);
                    } catch (error) {
                        console.warn('[tailor] Gap fix pass failed; using verified resume.', error);
                        skippedKeywords.push(...missing.evidenced.map(keyword => `${keyword} - gap fix failed`));
                    }
                }

                // ── Post-processing: Bullet deduplication ──
                const allJdKeywords = [...jdAnalysis.requiredSkills, ...jdAnalysis.preferredSkills];
                if (finalSections.experience) {
                    const dedupResult = deduplicateBullets(finalSections.experience, allJdKeywords);
                    if (dedupResult.removedDuplicates.length > 0) {
                        finalSections = { ...finalSections, experience: dedupResult.cleaned };
                        console.log(`[tailor] Removed ${dedupResult.removedDuplicates.length} near-duplicate bullet(s)`);
                        verificationWarnings.push(`Removed ${dedupResult.removedDuplicates.length} near-duplicate bullet(s) from Experience`);
                    }
                }

                // ── Post-processing: Quality audits ──
                if (finalSections.experience) {
                    const verbWarnings = warnRepeatedVerbs(finalSections.experience);
                    const bulletWarnings = auditExperienceBullets(finalSections.experience);
                    verificationWarnings.push(...verbWarnings, ...bulletWarnings);
                }
                const contactWarnings = auditContactLeakage(sections, finalSections);
                verificationWarnings.push(...contactWarnings);

                const tailoredResume = reconstructResume(finalSections, sectionOrder);
                const finalCoverage = calculateCoverageSet(
                    tailoredResume,
                    jdAnalysis.requiredSkills,
                    jdAnalysis.preferredSkills
                );

                sendSSE(controller, encoder, {
                    phase: 'gap_fix_result',
                    data: { injected: injectedKeywords, skipped: skippedKeywords },
                });

                sendSSE(controller, encoder, {
                    phase: 'tailored',
                    data: {
                        tailoredResume,
                        keywordCoverage: finalCoverage,
                    },
                });

                if (appId && userId) {
                    await db.update(applications).set({
                        tailoredResume,
                        tailorStatus: 'analyzing',
                    }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
                }

                sendSSE(controller, encoder, { phase: 'analyzing' });

                const { atsScore } = calculateAtsScore({
                    originalResume: formattedInputResume,
                    tailoredResume,
                    requiredKeywords: jdAnalysis.requiredSkills,
                    preferredKeywords: jdAnalysis.preferredSkills,
                });
                const changes = computeSectionChanges(formattedInputResume, tailoredResume, []);

                if (verificationWarnings.length > 0) {
                    atsScore.analysis += ` Notes: ${verificationWarnings.slice(0, 3).join(' ')}`;
                }

                sendSSE(controller, encoder, {
                    phase: 'complete',
                    data: {
                        atsScore,
                        changes,
                    },
                });

                if (appId && userId) {
                    await db.update(applications).set({
                        analysis: JSON.stringify({
                            changes,
                            atsScore,
                        }),
                        tailorStatus: 'complete',
                    }).where(and(eq(applications.id, appId), eq(applications.userId, userId)));
                }

            } catch (error) {
                console.error('Streaming API Error:', error);
                sendSSE(controller, encoder, {
                    phase: 'error',
                    error: error instanceof Error ? error.message : 'Internal Server Error',
                });
                if (appId) await setTailorStatus(appId, 'error', userId);
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
