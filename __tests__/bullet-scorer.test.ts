import { describe, it, expect } from 'vitest';
import { scoreBullet, buildSingleBulletRewritePrompt } from '../lib/bullet-scorer';

describe('Bullet Scorer', () => {
    it('should score 4/4 for a perfect STAR bullet', () => {
        const bullet = 'Architected a new microservices platform for a team of 10 developers, resulting in a 40% reduction in deployment latency.';
        const score = scoreBullet(bullet);
        
        expect(score.actionVerb).toBe(true);
        expect(score.hasMetric).toBe(true);
        expect(score.hasImpact).toBe(true);
        expect(score.hasScope).toBe(true);
        expect(score.starScore).toBe(4);
        expect(score.issues).toEqual([]);
    });

    it('should score 0/4 and return all issues for empty, null, or undefined inputs', () => {
        const scoreNull = scoreBullet(null);
        expect(scoreNull.starScore).toBe(0);
        expect(scoreNull.issues).toEqual(['weak_verb', 'no_metric', 'no_impact', 'no_scope']);

        const scoreUndefined = scoreBullet(undefined);
        expect(scoreUndefined.starScore).toBe(0);
        expect(scoreUndefined.issues).toEqual(['weak_verb', 'no_metric', 'no_impact', 'no_scope']);

        const scoreEmpty = scoreBullet('');
        expect(scoreEmpty.starScore).toBe(0);
        expect(scoreEmpty.issues).toEqual(['weak_verb', 'no_metric', 'no_impact', 'no_scope']);
        
        const scoreWhitespace = scoreBullet('   -  ');
        expect(scoreWhitespace.starScore).toBe(0);
        expect(scoreWhitespace.issues).toEqual(['weak_verb', 'no_metric', 'no_impact', 'no_scope']);
    });

    it('should penalize weak verbs and identify missing dimensions', () => {
        // "Helped" is a weak verb. No metric, no scope, but has impact.
        const bullet = 'Helped on the front-end to improve user engagement.';
        const score = scoreBullet(bullet);

        expect(score.actionVerb).toBe(false); // weak verb
        expect(score.hasMetric).toBe(false);
        expect(score.hasImpact).toBe(true); // "improve user engagement"
        expect(score.hasScope).toBe(false);
        expect(score.starScore).toBe(1);
        expect(score.issues).toContain('weak_verb');
        expect(score.issues).toContain('no_metric');
        expect(score.issues).toContain('no_scope');
    });

    it('should detect timeframe metrics as valid metrics', () => {
        const bullet = 'Spearheaded team migration to AWS platform within 6 weeks, driving scalability.';
        const score = scoreBullet(bullet);

        expect(score.actionVerb).toBe(true); // Spearheaded
        expect(score.hasMetric).toBe(true);  // "within 6 weeks"
        expect(score.hasImpact).toBe(true);  // "driving scalability"
        expect(score.hasScope).toBe(true);   // "team"
        expect(score.starScore).toBe(4);
    });

    it('should generate a rewrite prompt under 400 tokens with correct context', () => {
        const bullet = 'Helped design the database.';
        const score = scoreBullet(bullet);
        const role = { company: 'Acme Corp', title: 'Developer' };
        const jd = { industry: 'fintech', seniority: 'senior' };

        const prompts = buildSingleBulletRewritePrompt(bullet, score.issues, role, jd);
        
        expect(prompts.systemPrompt).toContain('STAR method');
        expect(prompts.systemPrompt).toContain('metric integrity');
        expect(prompts.userPrompt).toContain('Acme Corp');
        expect(prompts.userPrompt).toContain('Developer');
        expect(prompts.userPrompt).toContain('Helped design the database.');
        
        // Approximate token check (characters / 4)
        const totalChars = prompts.systemPrompt.length + prompts.userPrompt.length;
        const approxTokens = Math.ceil(totalChars / 4);
        expect(approxTokens).toBeLessThan(400);
    });
});
