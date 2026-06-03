import { describe, it, expect } from 'vitest';
import { classifyJD } from '../lib/jd-classifier';

describe('classifyJD', () => {
    it('should classify ML engineering industry correctly', () => {
        const jd = 'PyTorch, model training, RLHF, inference optimization';
        const result = classifyJD(jd);
        expect(result.industry).toBe('ml_engineering');
        expect(result.confidence).toBeGreaterThanOrEqual(0.4);
        expect(result.detectedKeywords).toContain('pytorch');
        expect(new Set(result.detectedKeywords).size).toBe(result.detectedKeywords.length);
    });

    it('should classify product management industry and executive seniority correctly', () => {
        const jd = 'VP of Product, roadmap, OKRs, stakeholder alignment';
        const result = classifyJD(jd);
        expect(result.industry).toBe('product_management');
        expect(result.seniority).toBe('executive');
        expect(result.confidence).toBeGreaterThanOrEqual(0.4);
        expect(result.detectedKeywords).toContain('roadmap');
    });

    it('should classify fintech industry correctly', () => {
        const jd = 'Need a developer to work on billing, ledger, compliance, payments, transaction, and PCI-DSS compliance';
        const result = classifyJD(jd);
        expect(result.industry).toBe('fintech');
        expect(result.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('should classify senior devops engineer correctly', () => {
        const jd = 'Senior DevOps Engineer\nScale Kubernetes clusters, automate deployment pipeline with terraform, monitor logs in Grafana. Lead complex deployments and optimize infrastructure.';
        const result = classifyJD(jd);
        expect(result.industry).toBe('devops');
        expect(result.seniority).toBe('senior');
        expect(result.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('should classify junior frontend developer correctly', () => {
        const jd = 'Junior Web Developer\nAssist in building responsive layouts with React, HTML, CSS, Tailwind. Learn from senior developers and support the team.';
        const result = classifyJD(jd);
        expect(result.industry).toBe('frontend');
        expect(result.seniority).toBe('junior');
        expect(result.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('should default to general industry and mid seniority when no clear signals exist', () => {
        const jd = 'We are looking for a nice developer who likes coding and having fun with the team.';
        const result = classifyJD(jd);
        expect(result.industry).toBe('general');
        expect(result.seniority).toBe('mid');
        expect(result.confidence).toBeLessThan(0.4);
    });

    it('should classify intern seniority correctly', () => {
        const jd = 'Software Engineer Intern\nCurrently pursuing a university student degree. Learn model training with PyTorch under guidance.';
        const result = classifyJD(jd);
        expect(result.industry).toBe('ml_engineering');
        expect(result.seniority).toBe('intern');
        expect(result.confidence).toBeGreaterThanOrEqual(0.4);
    });

    it('should handle empty or null-like input without throwing', () => {
        const result = classifyJD('');
        expect(result.industry).toBe('general');
        expect(result.seniority).toBe('mid');
        expect(result.confidence).toBe(0);
        expect(result.detectedKeywords).toEqual([]);
    });
});
