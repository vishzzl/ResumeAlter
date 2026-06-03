import { describe, it, expect } from 'vitest';
import { detectHallucinations } from '../lib/hallucination-detector';
import { ResumeSections } from '../lib/resume-parser';

describe('detectHallucinations', () => {
    const mockOriginal: ResumeSections = {
        header: 'John Doe | john@doe.com | 123-456-7890 | Seattle, WA',
        summary: 'Experienced software engineer at Google.',
        skills: 'Languages: Python, Go, C++',
        experience: '**Google** | **Software Engineer** | **2020 - Present**\n- Worked on search backend improving latency by 100ms.\n- Handled team of 5 engineers.',
        education: 'BS in CS, UW, 2020',
        projects: 'Personal Website: Built with UW server.',
        other: 'AWS Certified Solutions Architect'
    };

    it('should pass and be clean when tailored resume is strictly grounded in original', () => {
        const tailored: ResumeSections = {
            ...mockOriginal,
            summary: 'Senior Software Engineer at Google with UW degree.',
            experience: '**Google** | **Software Engineer** | **2020 - Present**\n- Optimized search engine latency by 100ms.\n- Mentored UW grads in a team of 5.'
        };

        const result = detectHallucinations(mockOriginal, tailored);
        expect(result.clean).toBe(true);
        expect(result.flaggedMetrics).toEqual([]);
        expect(result.flaggedEntities).toEqual([]);
    });

    it('should flag invented metrics', () => {
        const tailored: ResumeSections = {
            ...mockOriginal,
            experience: '**Google** | **Software Engineer** | **2020 - Present**\n- Improved performance by 40%.' // 40% is not in original!
        };

        const result = detectHallucinations(mockOriginal, tailored);
        expect(result.clean).toBe(false);
        expect(result.flaggedMetrics).toContain('40%');
        expect(result.flaggedSentences[0]).toContain('40%');
    });

    it('should not flag metrics that are present verbatim in original (zero false positive check)', () => {
        const tailored: ResumeSections = {
            ...mockOriginal,
            summary: 'Engineered backend systems reducing search latency by 100ms.' // 100ms is in original!
        };

        const result = detectHallucinations(mockOriginal, tailored);
        expect(result.clean).toBe(true);
        expect(result.flaggedMetrics).not.toContain('100ms');
    });

    it('should allow named entities with Levenshtein distance <= 2', () => {
        const tailored: ResumeSections = {
            ...mockOriginal,
            // "Go" (original) vs "Golang" (Levenshtein distance to UW or AWS is large, but check if we allow slightly different spelling e.g. UW vs UWashington?)
            // Let's test a simple spelling change within Levenshtein <= 2:
            // "Go" to "Goo" (Lev1), or "Python" to "Pythons" (Lev1)
            skills: 'Languages: Pythons, Go, C++' // Pythons vs Python is Lev 1
        };

        const result = detectHallucinations(mockOriginal, tailored);
        expect(result.clean).toBe(true);
        expect(result.flaggedEntities).toEqual([]);
    });

    it('should flag named entities with Levenshtein distance > 2', () => {
        const tailored: ResumeSections = {
            ...mockOriginal,
            summary: 'Worked at Amazon.' // Amazon is not in original
        };

        const result = detectHallucinations(mockOriginal, tailored);
        expect(result.clean).toBe(false);
        expect(result.flaggedEntities).toContain('Amazon');
    });

    it('should run in under 50ms (performance check)', () => {
        const tailored: ResumeSections = {
            ...mockOriginal,
            summary: 'Senior Software Engineer at Google with UW degree.',
            experience: '**Google** | **Software Engineer** | **2020 - Present**\n- Optimized search engine latency by 100ms.\n- Mentored UW grads in a team of 5.'
        };

        const start = performance.now();
        detectHallucinations(mockOriginal, tailored);
        const duration = performance.now() - start;

        expect(duration).toBeLessThan(50);
    });
});
