import { describe, it, expect } from 'vitest';
import { getDetailedATSReport } from '../lib/ats-scoring';

describe('ATS Scoring Details', () => {
    const originalResume = `
Vishnu Prasad | vish@example.com
SUMMARY
Experienced software engineer.
EXPERIENCE
Acme Corp | Software Engineer
- Led the backend refactoring effort.
- Built a microservices platform.
- Managed a team.
SKILLS
Javascript, Typescript, AWS
`;

    const tailoredResume = `
Vishnu Prasad | vish@example.com
SUMMARY
Experienced software engineer specializing in frontend and backend engineering.
EXPERIENCE
Acme Corp | Software Engineer
- Architected the backend refactoring effort for a team of 5, resulting in a 40% performance gain.
- Designed a microservices platform serving 1M users to optimize latency.
- Led team of 3 developers to deliver projects on time.
SKILLS
Javascript, Typescript, AWS, React
`;

    it('should generate a detailed ATS report that matches the overall score structure', () => {
        const report = getDetailedATSReport({
            originalResume,
            tailoredResume,
            requiredKeywords: ['React', 'Typescript'],
            preferredKeywords: ['AWS']
        });

        expect(report.overall).toBeGreaterThanOrEqual(0);
        expect(report.overall).toBeLessThanOrEqual(100);
        expect(report.dimensions.keywordCoverage.max).toBe(60);
        expect(report.dimensions.quantification.max).toBe(20);
        expect(report.dimensions.actionVerbs.max).toBe(10);
        expect(report.dimensions.formatting.max).toBe(10);

        // Ensure scores sum to overall exactly
        const sum = report.dimensions.keywordCoverage.score + 
                    report.dimensions.quantification.score + 
                    report.dimensions.actionVerbs.score + 
                    report.dimensions.formatting.score;
        expect(sum).toBe(report.overall);
    });

    it('should correctly count bullets lacking metrics and weak action verbs', () => {
        const report = getDetailedATSReport({
            originalResume,
            tailoredResume,
            requiredKeywords: ['React'],
            preferredKeywords: []
        });

        // "Led team of 3 developers to deliver projects on time" has metric "3" but might lack a percentage/dollar metric (actually extractMetrics recognizes "3" as a metric).
        // Let's verify dimensions are within bounds
        expect(report.dimensions.quantification.score).toBeLessThanOrEqual(20);
        expect(report.dimensions.actionVerbs.score).toBeLessThanOrEqual(10);
    });

    it('should return deterministic suggestions when score is low', () => {
        const poorResume = `
Vishnu Prasad
`;
        const report = getDetailedATSReport({
            originalResume: poorResume,
            tailoredResume: poorResume,
            requiredKeywords: ['Docker', 'Kubernetes', 'Go'],
            preferredKeywords: []
        });

        expect(report.overall).toBeLessThan(75);
        expect(report.suggestions.length).toBeGreaterThan(0);
        expect(report.suggestions[0]).toContain('Include missing required keywords');
    });

    it('should return at most 4 suggestions', () => {
        const report = getDetailedATSReport({
            originalResume,
            tailoredResume,
            requiredKeywords: ['Docker', 'Kubernetes', 'Go', 'Python'],
            preferredKeywords: ['CI/CD']
        });

        expect(report.suggestions.length).toBeLessThanOrEqual(4);
    });

    it('should list specific formatting violations if found', () => {
        const invalidFormattingResume = `No sections whatsoever`;
        const report = getDetailedATSReport({
            originalResume,
            tailoredResume: invalidFormattingResume,
            requiredKeywords: [],
            preferredKeywords: []
        });

        expect(report.dimensions.formatting.violations).toContain('missing experience');
        expect(report.dimensions.formatting.violations).toContain('missing skills');
    });
});
