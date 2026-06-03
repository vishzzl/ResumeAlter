/**
 * @file hallucination-detector.ts
 * @description Synchronous deterministic check to detect metric and entity hallucinations.
 */

import { ResumeSections } from './resume-parser';
import { extractMetrics } from './experience-helper';

export type HallucinationReport = {
    clean: boolean;
    flaggedMetrics: string[];
    flaggedEntities: string[];
    flaggedSentences: string[]; // the full bullet/sentence containing each flag
    confidence: 'high' | 'medium' | 'low';
};

/**
 * Computes Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
    const tmp = [];
    let i, j;
    for (i = 0; i <= a.length; i++) {
        tmp.push([i]);
    }
    for (j = 1; j <= b.length; j++) {
        tmp[0].push(j);
    }
    for (i = 1; i <= a.length; i++) {
        for (j = 1; j <= b.length; j++) {
            tmp[i][j] = Math.min(
                tmp[i - 1][j] + 1,
                tmp[i][j - 1] + 1,
                tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return tmp[a.length][b.length];
}

// Common words, titles, academic degrees, and action verbs to exclude from hallucination checks.
const ENTITY_EXCLUSIONS = new Set([
    // Senority & Titles
    'senior', 'junior', 'mid', 'lead', 'staff', 'principal', 'executive', 'associate', 'entry',
    'software', 'engineer', 'developer', 'architect', 'manager', 'director', 'vice', 'president', 'vp', 'chief',
    'analyst', 'consultant', 'specialist', 'expert', 'practitioner', 'member', 'leader', 'head',
    // Degrees & Education
    'bachelor', 'bachelors', 'master', 'masters', 'doctor', 'phd', 'bs', 'ms', 'ba', 'ma', 'btech', 'mtech', 'mba',
    'science', 'arts', 'technology', 'engineering', 'business', 'administration', 'degree',
    'university', 'college', 'institute', 'school', 'academy',
    // Certifications & Professional
    'certified', 'certification', 'certificate', 'solutions', 'professional',
    // Tech general terms
    'cloud', 'web', 'data', 'database', 'system', 'systems', 'network', 'networks', 'security',
    'project', 'product', 'program', 'team', 'client', 'clients', 'customer', 'customers',
    'company', 'corporation', 'inc', 'llc', 'ltd', 'group', 'services', 'solutions', 'labs', 'technologies',
    // Months & Time
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
    'present', 'current', 'experience', 'summary', 'skills', 'projects', 'education', 'certifications', 'awards', 'honors',
    'languages', 'frameworks', 'databases', 'tools', 'platforms',
    // Common capitalized action verbs
    'worked', 'led', 'managed', 'developed', 'designed', 'built', 'created', 'implemented', 'optimized', 'scaled',
    'automated', 'engineered', 'architected', 'spearheaded', 'drove', 'mentored', 'established', 'launched',
    'overhauled', 'improved', 'increased', 'reduced', 'saved', 'cut', 'grew', 'accelerated', 'delivered',
    'collaborated', 'contributed', 'assisted', 'participated', 'directed', 'coordinated', 'supervised',
    'analyzed', 'evaluated', 'researched', 'tested', 'debugged', 'resolved', 'supported', 'maintained',
    'deployed', 'configured', 'integrated', 'migrated', 'upgraded', 'streamlined', 'consolidated', 'handled'
]);

/**
 * Extracts potential named entities from text.
 * Capitalized words, phrases, and mixed letter-number codes (like gRPC, React18, IPv6).
 */
function extractEntities(text: string): Set<string> {
    const entities = new Set<string>();
    if (!text) return entities;

    // Match capitalized words/phrases (e.g. "Google Cloud Platform")
    // We allow letters, digits, and special chars like #, +, -
    const capRegex = /\b[A-Z][a-zA-Z0-9+#.-]*/g;
    const matches = text.match(capRegex) || [];
    for (const m of matches) {
        const clean = m.trim().replace(/[.,;:!?)]$/, '');
        if (clean && clean.length > 1 && !ENTITY_EXCLUSIONS.has(clean.toLowerCase())) {
            entities.add(clean);
        }
    }

    // Match mixed letter/number tokens like gRPC, React18, IPv6, Web3
    const mixedRegex = /\b[a-zA-Z0-9+#.-]*\d+[a-zA-Z0-9+#.-]*\b/g;
    const mixedMatches = text.match(mixedRegex) || [];
    for (const m of mixedMatches) {
        const clean = m.trim().replace(/[.,;:!?)]$/, '');
        if (clean && !/^\d+$/.test(clean) && clean.length > 1 && !ENTITY_EXCLUSIONS.has(clean.toLowerCase())) {
            entities.add(clean);
        }
    }

    return entities;
}

/**
 * Deterministically checks for invented metrics or named entities in the tailored resume.
 * 
 * @param original The original resume sections structure.
 * @param tailored The tailored resume sections structure.
 * @returns The hallucination report.
 */
export function detectHallucinations(
    original: ResumeSections,
    tailored: ResumeSections
): HallucinationReport {
    const startTime = Date.now();

    // 1. Gather all original texts
    const originalText = [
        original.header,
        original.summary,
        original.skills,
        original.experience,
        original.education,
        original.projects,
        original.other
    ].join('\n');

    const originalLower = originalText.toLowerCase();

    // 2. Extract original metrics and entities
    const originalMetrics = new Set(
        extractMetrics(originalText).map(m => m.toLowerCase())
    );
    const originalEntities = extractEntities(originalText);

    // 3. Collect tailored sentences and bullets
    const sectionsToCheck = [
        tailored.summary,
        tailored.skills,
        tailored.experience,
        tailored.projects,
        tailored.other
    ];

    const sentences: string[] = [];
    for (const text of sectionsToCheck) {
        if (!text) continue;
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            // Experience bullets are evaluated as single sentences
            if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•')) {
                sentences.push(trimmed);
            } else {
                const splitSentences = trimmed.split(/(?<=[.!?])\s+/);
                sentences.push(...splitSentences.filter(Boolean));
            }
        }
    }

    const flaggedMetrics = new Set<string>();
    const flaggedEntities = new Set<string>();
    const flaggedSentences = new Set<string>();

    // 4. Validate each sentence
    for (const sentence of sentences) {
        let sentenceFlagged = false;

        // Check metrics
        const metrics = extractMetrics(sentence);
        for (const metric of metrics) {
            const metricLower = metric.toLowerCase();
            // A metric present in the original resume must never be flagged (exact check)
            if (!originalMetrics.has(metricLower)) {
                flaggedMetrics.add(metric);
                sentenceFlagged = true;
            }
        }

        // Check entities
        const entities = extractEntities(sentence);
        for (const entity of entities) {
            const entityLower = entity.toLowerCase();

            // Guard 1: Exact case-insensitive substring match in the original text
            if (originalLower.includes(entityLower)) {
                continue;
            }

            // Guard 2: Exact or fuzzy match (Levenshtein <= 2) with any extracted original entity
            let foundMatch = false;
            for (const origEntity of originalEntities) {
                const origLower = origEntity.toLowerCase();
                if (origLower === entityLower || levenshtein(origLower, entityLower) <= 2) {
                    foundMatch = true;
                    break;
                }
            }

            if (!foundMatch) {
                flaggedEntities.add(entity);
                sentenceFlagged = true;
            }
        }

        if (sentenceFlagged) {
            flaggedSentences.add(sentence);
        }
    }

    const fm = Array.from(flaggedMetrics);
    const fe = Array.from(flaggedEntities);
    const fs = Array.from(flaggedSentences);

    const clean = fm.length === 0 && fe.length === 0;

    // Set confidence: if clean, high confidence. If minor flags, medium. If major, low.
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (!clean) {
        confidence = (fm.length + fe.length > 3) ? 'low' : 'medium';
    }

    const endTime = Date.now();
    if (process.env.NODE_ENV === 'development') {
        console.log(`[hallucination-detector] Completed check in ${endTime - startTime}ms. clean=${clean}, flaggedMetrics=${fm.length}, flaggedEntities=${fe.length}`);
    }

    return {
        clean,
        flaggedMetrics: fm,
        flaggedEntities: fe,
        flaggedSentences: fs,
        confidence
    };
}
