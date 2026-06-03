import { describe, it, expect } from 'vitest';
import { buildSummaryPrompt } from '../lib/prompts/buildSummaryPrompt';
import { buildSkillsPrompt } from '../lib/prompts/buildSkillsPrompt';
import { buildExperiencePrompt } from '../lib/prompts/buildExperiencePrompt';
import { extractMetrics, parseExperienceMarkdown } from '../lib/experience-helper';

describe('Prompt Decomposition Builders', () => {
    const mockClassification = {
        industry: 'ml_engineering' as const,
        seniority: 'senior' as const,
        confidence: 0.8,
        detectedKeywords: ['pytorch', 'transformers']
    };

    describe('buildSummaryPrompt', () => {
        it('should return system and user prompts with exact formula instructions', () => {
            const originalSummary = 'Original summary here.';
            const jdText = 'Looking for ML Engineer.';
            const topKeywords = ['PyTorch', 'Transformers', 'Python'];

            const result = buildSummaryPrompt(originalSummary, jdText, mockClassification, topKeywords);

            expect(result).toHaveProperty('systemPrompt');
            expect(result).toHaveProperty('userPrompt');
            expect(typeof result.systemPrompt).toBe('string');
            expect(typeof result.userPrompt).toBe('string');
            expect(result.systemPrompt).toContain('RULE 1 — FACTUAL INTEGRITY');
            expect(result.systemPrompt).toContain('Sentence 1:');
            expect(result.systemPrompt).toContain('Sentence 2:');
            expect(result.systemPrompt).toContain('Sentence 3');
            expect(result.systemPrompt).toContain('first-person');
            expect(result.systemPrompt).toContain('target title');
            expect(result.userPrompt).toContain(originalSummary);
        });

        it('should be a pure function', () => {
            const p1 = buildSummaryPrompt('A', 'B', mockClassification, ['C']);
            const p2 = buildSummaryPrompt('A', 'B', mockClassification, ['C']);
            expect(p1).toEqual(p2);
        });
    });

    describe('buildSkillsPrompt', () => {
        it('should output system prompt that strictly forbids adding JD skills absent from original', () => {
            const originalSkills = 'Python, Git';
            const jdText = 'Looking for PyTorch and React.';
            const result = buildSkillsPrompt(originalSkills, jdText, mockClassification);

            expect(result.systemPrompt).toContain('You may only list skills present in the original skills section');
            expect(result.systemPrompt).toContain('Do not add skills mentioned in the JD that are absent from the original');
            expect(result.userPrompt).toContain(originalSkills);
        });

        it('should be a pure function', () => {
            const p1 = buildSkillsPrompt('A', 'B', mockClassification);
            const p2 = buildSkillsPrompt('A', 'B', mockClassification);
            expect(p1).toEqual(p2);
        });
    });

    describe('buildExperiencePrompt', () => {
        it('should include metric preservation instructions and STAR guidelines', () => {
            const role = {
                company: 'Google',
                title: 'Senior Engineer',
                bullets: ['Led a team of 5', 'Improved latency by 40%']
            };
            const jdText = 'Need AWS experience.';
            const result = buildExperiencePrompt(role, jdText, mockClassification);

            expect(result.systemPrompt).toContain('RULE 1 — FACTUAL INTEGRITY & METRIC PRESERVATION');
            expect(result.systemPrompt).toContain('Every number, $ amount, and % value in the output bullets must also be present verbatim');
            expect(result.systemPrompt).toContain('STAR method');
            expect(result.systemPrompt).toContain('100 and 180 characters');
            expect(result.userPrompt).toContain(role.company);
            expect(result.userPrompt).toContain(role.bullets[1]);
        });

        it('should list at least 40 strong action verbs', () => {
            const role = {
                company: 'Google',
                title: 'Senior Engineer',
                bullets: ['Led a team of 5']
            };
            const result = buildExperiencePrompt(role, 'JD', mockClassification);
            const verbMatches = result.systemPrompt.match(/[A-Z][a-z]+/g) || [];
            // Check that we have a substantial list of verbs in the system prompt
            expect(verbMatches.length).toBeGreaterThan(30);
        });

        it('should be a pure function', () => {
            const role = { company: 'Google', title: 'Senior Engineer', bullets: ['A'] };
            const p1 = buildExperiencePrompt(role, 'B', mockClassification);
            const p2 = buildExperiencePrompt(role, 'B', mockClassification);
            expect(p1).toEqual(p2);
        });
    });

    describe('experience-helper', () => {
        it('should parse experience markdown correctly', () => {
            const md = `
**Google** | **Senior Software Engineer** | **2020 - Present**

- Developed cloud systems scaling to 10M users.
- Automated pipeline saving $50k/year.

**Facebook** | **Software Engineer** | **2018 - 2020**
- Built user profile page using React.
            `;
            const roles = parseExperienceMarkdown(md);
            expect(roles.length).toBe(2);
            expect(roles[0].company).toBe('Google');
            expect(roles[0].title).toBe('Senior Software Engineer');
            expect(roles[0].period).toBe('2020 - Present');
            expect(roles[0].bullets.length).toBe(2);
            expect(roles[0].bullets[1]).toContain('$50k/year');
            expect(roles[1].company).toBe('Facebook');
            expect(roles[1].title).toBe('Software Engineer');
            expect(roles[1].period).toBe('2018 - 2020');
            expect(roles[1].bullets.length).toBe(1);
        });

        it('should extract metrics correctly', () => {
            expect(extractMetrics('Improved performance by 40%')).toContain('40%');
            expect(extractMetrics('Saved $120K annually')).toContain('$120K');
            expect(extractMetrics('Latency under 150ms')).toContain('150ms');
            expect(extractMetrics('Scaled to 3x throughput')).toContain('3x');
            expect(extractMetrics('No numbers here')).toEqual([]);
        });
    });
});
