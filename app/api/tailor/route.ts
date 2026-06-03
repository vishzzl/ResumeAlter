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
    modelPoolManager.githubApiKey = apiKey || process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_KEY;

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
                let normalizedResume = resume;
                const isPreFiltered = false;

                if (!isPreFiltered && isLikelyPlainText(normalizedResume)) {
                    console.log('[tailor] Plain-text resume detected — auto-formatting to Markdown...');
                    sendSSE(controller, encoder, { phase: 'formatting' });
                    try {
                        const formatResult = await formatResumeToMarkdown(normalizedResume, {
                            provider: provider!,
                            apiKey,
                            modelName,
                            customConfig: customConfig as CustomConfig,
                        });
                        normalizedResume = formatResult.formatted;
                        console.log(`[tailor] Resume formatted. Detected sections: ${formatResult.detectedSections.join(', ')}`);
                    } catch (formatErr) {
                        console.warn('[tailor] Auto-format failed; proceeding with original text.', formatErr);
                    }
                }

                const sections = parseResumeSections(normalizedResume);

                sendSSE(controller, encoder, { phase: 'extracting' });
                if (appId) await setTailorStatus(appId, 'tailoring', userId);

                sendSSE(controller, encoder, { phase: 'tailoring' });

                // ── Task 2: Decomposed Sub-Prompts ─────────────────────────

                // Summary stage
                const summaryPrompt = buildSummaryPrompt(sections.summary, jobDescription, jdClassification, jdAnalysis.requiredSkills);
                const summaryResponse = await modelPoolManager.call(
                    'summary',
                    summaryPrompt.systemPrompt,
                    summaryPrompt.userPrompt
                );
                const tailoredSummary = summaryResponse.trim();
                const summarySentences = tailoredSummary.split(/(?<=[.!?])\s+/).filter(Boolean);
                const prunedSummary = summarySentences.slice(0, 3).join(' ');

                // Skills stage
                const skillsPrompt = buildSkillsPrompt(sections.skills, jobDescription, jdClassification);
                const skillsResponse = await modelPoolManager.call(
                    'skills',
                    skillsPrompt.systemPrompt,
                    skillsPrompt.userPrompt
                );
                
                let skillsJson: Record<string, string[]> = {};
                try {
                    skillsJson = JSON.parse(cleanJson(skillsResponse));
                } catch (err) {
                    console.warn('[tailor] Failed to parse skills JSON response, using raw response', err);
                }

                // Verify that all returned skills are in the original skills list
                for (const [category, skillsList] of Object.entries(skillsJson)) {
                    if (!Array.isArray(skillsList)) continue;
                    for (const skill of skillsList) {
                        if (typeof skill !== 'string') continue;
                        if (!containsKeyword(sections.skills, skill)) {
                            throw new Error(`Skills post-call validation failed: Skill "${skill}" was not present in original skills.`);
                        }
                    }
                }

                let formattedSkillsString = '';
                if (skillsJson && typeof skillsJson === 'object' && !Array.isArray(skillsJson)) {
                    const formattedSkillsArray: string[] = [];
                    for (const [category, skillsList] of Object.entries(skillsJson)) {
                        if (Array.isArray(skillsList) && skillsList.length > 0) {
                            formattedSkillsArray.push(`**${category}**: ${skillsList.join(', ')}`);
                        }
                    }
                    formattedSkillsString = formattedSkillsArray.join('\n');
                } else {
                    formattedSkillsString = skillsResponse.trim();
                }

                // Experience stage
                const originalRoles = parseExperienceMarkdown(sections.experience);
                let tailoredExperience = '';
                const tailoredRoles = [];
                
                for (const role of originalRoles) {
                    let attempt = 0;
                    let bullets: string[] = [];
                    let lastError: any = null;
                    
                    while (attempt < 3) {
                        try {
                            const experiencePrompt = buildExperiencePrompt(role, jobDescription, jdClassification);
                            const experienceResponse = await modelPoolManager.call(
                                'experience',
                                experiencePrompt.systemPrompt,
                                experiencePrompt.userPrompt
                            );
                            
                            bullets = JSON.parse(cleanJson(experienceResponse));
                            if (!Array.isArray(bullets)) {
                                throw new Error('Experience response must be a JSON array of strings');
                            }
                            
                            // Verify metric integrity
                            const originalText = role.bullets.join(' ');
                            const originalMetrics = extractMetrics(originalText).map(m => m.toLowerCase());
                            
                            for (const bullet of bullets) {
                                const tailoredMetrics = extractMetrics(bullet);
                                for (const metric of tailoredMetrics) {
                                    if (!originalMetrics.includes(metric.toLowerCase())) {
                                        throw new MetricIntegrityError(`Metric "${metric}" in tailored bullet is not present in original bullets of role "${role.title}".`);
                                    }
                                }
                            }
                            
                            // If passed, break out of attempt loop
                            break;
                        } catch (err) {
                            lastError = err;
                            attempt++;
                            console.warn(`[tailor] Experience tailoring attempt ${attempt} for role "${role.title}" failed/flagged:`, err instanceof Error ? err.message : err);
                        }
                    }
                    
                    if (bullets.length === 0) {
                        console.error(`[tailor] All experience tailoring attempts failed for role "${role.title}". Falling back to original bullets.`);
                        bullets = role.bullets;
                    }
                    
                    // Task 5: STAR Scorer and targeted rewriter
                    let rewritesCount = 0;
                    const finalBullets: string[] = [];
                    
                    for (const bullet of bullets) {
                        const score = scoreBullet(bullet);
                        if (score.starScore <= 1 && rewritesCount < 3) {
                            let rewriteAttempt = 0;
                            let bestBullet = bullet;
                            let bestScore = score.starScore;
                            
                            while (rewriteAttempt < 2) {
                                try {
                                    const rewritePrompt = buildSingleBulletRewritePrompt(
                                        bullet,
                                        score.issues,
                                        { company: role.company, title: role.title },
                                        { industry: jdClassification.industry, seniority: jdClassification.seniority }
                                    );
                                    const rewriteResponse = await modelPoolManager.call(
                                        'experience',
                                        rewritePrompt.systemPrompt,
                                        rewritePrompt.userPrompt
                                    );
                                    const rewritten = rewriteResponse.trim().replace(/^[-*•\s]+/, '').trim();
                                    
                                    // Verify metric integrity on the rewritten bullet
                                    const originalText = role.bullets.join(' ');
                                    const originalMetrics = extractMetrics(originalText).map(m => m.toLowerCase());
                                    const tailoredMetrics = extractMetrics(rewritten);
                                    for (const metric of tailoredMetrics) {
                                        if (!originalMetrics.includes(metric.toLowerCase())) {
                                            throw new Error(`Metric "${metric}" in rewritten bullet was not in original.`);
                                        }
                                    }
                                    
                                    const rewrittenScore = scoreBullet(rewritten);
                                    if (rewrittenScore.starScore > bestScore) {
                                        bestScore = rewrittenScore.starScore;
                                        bestBullet = rewritten;
                                    }
                                    
                                    if (rewrittenScore.starScore >= 2) {
                                        break;
                                    }
                                } catch (e) {
                                    console.warn(`[tailor] Bullet rewrite attempt ${rewriteAttempt + 1} failed:`, e);
                                }
                                rewriteAttempt++;
                            }
                            
                            finalBullets.push(bestBullet);
                            rewritesCount++;
                        } else {
                            finalBullets.push(bullet);
                        }
                    }
                    
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`[bullet-scorer] role: ${role.title} — rewrote ${rewritesCount}/${bullets.length} bullets`);
                    }
                    
                    tailoredRoles.push({
                        ...role,
                        bullets: finalBullets
                    });
                }
                
                // Reconstruct experience markdown
                const expLines: string[] = [];
                for (const role of tailoredRoles) {
                    const periodStr = role.period ? ` | **${role.period}**` : '';
                    expLines.push(`**${role.company}** | **${role.title}**${periodStr}`);
                    expLines.push('');
                    for (const b of role.bullets) {
                        expLines.push(`- ${b}`);
                    }
                    expLines.push('');
                }
                tailoredExperience = expLines.join('\n').trim();

                // Log token usage in development
                if (process.env.NODE_ENV === 'development') {
                    const tokensSummary = Math.ceil((summaryPrompt.systemPrompt.length + summaryPrompt.userPrompt.length) / 4);
                    const tokensSkills = Math.ceil((skillsPrompt.systemPrompt.length + skillsPrompt.userPrompt.length) / 4);
                    let tokensExperience = 0;
                    for (const role of originalRoles) {
                        const p = buildExperiencePrompt(role, jobDescription, jdClassification);
                        tokensExperience += Math.ceil((p.systemPrompt.length + p.userPrompt.length) / 4);
                    }
                    console.log(`[tailor] Decomposed sub-prompt tokens estimate: total=${tokensSummary + tokensSkills + tokensExperience} (summary=${tokensSummary}, skills=${tokensSkills}, experience=${tokensExperience})`);
                }

                const tailoredSections = {
                    header: sections.header,
                    summary: prunedSummary,
                    skills: formattedSkillsString,
                    experience: tailoredExperience,
                    education: sections.education,
                    projects: sections.projects,
                    other: sections.other
                };

                const generatedSections = enforceImmutableSections(sections, tailoredSections);
                const tailoringResult = {
                    jdAnalysis,
                    tailoredSections: generatedSections,
                    skippedRequirements: [] as string[],
                    warnings: [] as string[],
                    changeLog: [
                        { section: 'summary', reason: 'Rewritten for professional impact and JD alignment.' },
                        { section: 'skills', reason: 'Re-grouped and filtered to match candidate verified skills.' },
                        { section: 'experience', reason: 'Rewritten experience bullets using STAR format and active verbs.' }
                    ]
                };

                sendSSE(controller, encoder, { phase: 'verifying' });

                let verifiedSections = generatedSections;
                let verificationWarnings = [...tailoringResult.warnings];
                try {
                    const startVerifyTime = Date.now();
                    const report = detectHallucinations(sections, generatedSections);
                    
                    if (report.clean) {
                        console.log(`[tailor] Verification clean! Bypassed LLM verification in ${Date.now() - startVerifyTime}ms.`);
                    } else {
                        console.log(`[tailor] Hallucinations detected: flagged metrics count=${report.flaggedMetrics.length}, flagged entities count=${report.flaggedEntities.length}. Calling targeted LLM verification...`);
                        
                        const verifyPrompt = buildVerificationPrompt(report.flaggedSentences, sections);
                        const verificationText = await modelPoolManager.call(
                            'verification',
                            verifyPrompt.systemPrompt,
                            verifyPrompt.userPrompt
                        );
                        
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

                const missing = evidencedMissingKeywords(normalizedResume, preFixCoverage);
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
                        const gapFixText = await modelPoolManager.call(
                            'gap_fix',
                            TAILORING_SYSTEM_INSTRUCTION,
                            gapFixPrompt
                        );
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
                    originalResume: normalizedResume,
                    tailoredResume,
                    requiredKeywords: jdAnalysis.requiredSkills,
                    preferredKeywords: jdAnalysis.preferredSkills,
                });
                const changes = computeSectionChanges(normalizedResume, tailoredResume, tailoringResult.changeLog);

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
