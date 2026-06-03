/**
 * @file bullet-scorer.ts
 * @description Scores resume experience bullets based on STAR dimensions and builds rewrite prompts.
 */

import { extractMetrics } from './experience-helper';

export type BulletScore = {
    bullet: string;
    actionVerb: boolean;
    hasMetric: boolean;
    hasImpact: boolean;
    hasScope: boolean;
    starScore: 0 | 1 | 2 | 3 | 4;
    issues: Array<'weak_verb' | 'no_metric' | 'no_impact' | 'no_scope'>;
};

const APPROVED_VERBS = new Set([
    'architected', 'designed', 'developed', 'implemented', 'led', 'managed', 'directed', 'created',
    'built', 'engineered', 'optimized', 'scaled', 'automated', 'delivered', 'launched', 'migrated',
    'streamlined', 'formulated', 'expanded', 'cultivated', 'spearheaded', 'secured', 'drove',
    'orchestrated', 'integrated', 'overhauled', 'maximized', 'minimized', 'refactored',
    'established', 'executed', 'maintained', 'authored', 'pioneered', 'rescued', 'negotiated',
    'mentored', 'standardized', 'consolidated', 'analyzed', 'facilitated', 'coordinated',
    'reduced', 'accelerated', 'improved', 'configured', 'deployed', 'resolved', 'monitored'
]);

const IMPACT_KEYWORDS = [
    'resulting in', 'achieving', 'driving', 'enabling', 'reducing', 'increasing', 'improving',
    'accelerating', 'leading to', 'saving', 'generating', 'maximizing', 'minimizing', 'optimizing',
    'delivering', 'spurring', 'boosting', 'facilitating', 'slashing', 'expanding',
    'to improve', 'to optimize', 'to reduce', 'to increase', 'to scale', 'to boost', 'to deliver',
    'improve', 'optimize', 'reduce', 'increase', 'scale', 'boost', 'deliver'
];

const SCOPE_KEYWORDS = [
    'team of', 'users', 'clients', 'stakeholders', 'scale', 'enterprise', 'database of',
    'system of', 'infrastructure of', 'budget of', 'across', 'global', 'department',
    'business unit', 'engineers', 'developers', 'customers', 'platform', 'workload', 'pipeline'
];

/**
 * Scores a single bullet point on 4 STAR dimensions:
 * - Action Verb
 * - Metric
 * - Impact Clause
 * - Scope/Context
 */
export function scoreBullet(bullet: string | null | undefined): BulletScore {
    if (!bullet || !bullet.trim()) {
        return {
            bullet: bullet || '',
            actionVerb: false,
            hasMetric: false,
            hasImpact: false,
            hasScope: false,
            starScore: 0,
            issues: ['weak_verb', 'no_metric', 'no_impact', 'no_scope']
        };
    }

    const clean = bullet.replace(/^[-*•\s]+/, '').trim();
    if (!clean) {
        return {
            bullet,
            actionVerb: false,
            hasMetric: false,
            hasImpact: false,
            hasScope: false,
            starScore: 0,
            issues: ['weak_verb', 'no_metric', 'no_impact', 'no_scope']
        };
    }

    // 1. Action Verb check
    const firstWordMatch = clean.match(/^[a-zA-Z]+/);
    const firstWord = firstWordMatch ? firstWordMatch[0].toLowerCase() : '';
    const actionVerb = APPROVED_VERBS.has(firstWord);

    // 2. Metric check
    const metrics = extractMetrics(clean);
    const timeframeRegex = /\b(within|in|over|for|during)\s+\d+\s+(day|week|month|year)s?\b/i;
    const hasMetric = metrics.length > 0 || timeframeRegex.test(clean);

    // 3. Impact check
    const impactRegex = new RegExp(`\\b(${IMPACT_KEYWORDS.join('|')})\\b`, 'i');
    const hasImpact = impactRegex.test(clean);

    // 4. Scope check
    const scopeRegex = new RegExp(`\\b(${SCOPE_KEYWORDS.join('|')})\\b`, 'i');
    const hasScope = scopeRegex.test(clean);

    // Calculate score & issues
    const issues: Array<'weak_verb' | 'no_metric' | 'no_impact' | 'no_scope'> = [];
    if (!actionVerb) issues.push('weak_verb');
    if (!hasMetric) issues.push('no_metric');
    if (!hasImpact) issues.push('no_impact');
    if (!hasScope) issues.push('no_scope');

    const starScore = (
        (actionVerb ? 1 : 0) +
        (hasMetric ? 1 : 0) +
        (hasImpact ? 1 : 0) +
        (hasScope ? 1 : 0)
    ) as 0 | 1 | 2 | 3 | 4;

    return {
        bullet,
        actionVerb,
        hasMetric,
        hasImpact,
        hasScope,
        starScore,
        issues
    };
}

/**
 * Builds a prompt under 400 tokens to rewrite a single bullet point.
 */
export function buildSingleBulletRewritePrompt(
    bullet: string,
    issues: Array<'weak_verb' | 'no_metric' | 'no_impact' | 'no_scope'>,
    roleContext: { company: string; title: string },
    jdContext: { industry: string; seniority: string; text?: string }
): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = [
        'You are an expert resume editor specializing in the STAR method.',
        'Your goal is to rewrite a single bullet point to fix specific issues:',
        issues.join(', ') + '.',
        'Keep the bullet under 180 characters.',
        'Maintain absolute metric integrity: do not introduce any new numbers, percentages, or dollar amounts.',
        'Begin with a strong past-tense action verb.',
        'Output ONLY the rewritten bullet string without markdown formatting, quotes, or bullet characters.'
    ].join(' ');

    const userPrompt = [
        `Role: ${roleContext.title} at ${roleContext.company}`,
        `Industry: ${jdContext.industry}, Seniority: ${jdContext.seniority}`,
        `Original Bullet: ${bullet}`,
        'Rewritten Bullet:'
    ].join('\n');

    return { systemPrompt, userPrompt };
}
