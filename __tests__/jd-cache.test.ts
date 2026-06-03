import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JDCache, normalizeJD, computeJDHash } from '../lib/jd-cache';

describe('JDCache', () => {
    let cache: JDCache;

    beforeEach(() => {
        cache = new JDCache();
        vi.useRealTimers();
    });

    it('should correctly normalize JD text (lowercase, collapse whitespace, strip URLs/emails)', () => {
        const jd = '  Need a Senior Developer. Contact hr@acme.com or visit http://acme.com/jobs.   Lots   of whitespace! ';
        const normalized = normalizeJD(jd);
        
        expect(normalized).toBe('need a senior developer. contact or visit lots of whitespace!');
    });

    it('should compute a 16-character SHA-256 hex hash', () => {
        const hash1 = computeJDHash('test content');
        const hash2 = computeJDHash('test content');
        const hash3 = computeJDHash('other content');

        expect(hash1.length).toBe(16);
        expect(hash1).toBe(hash2);
        expect(hash1).not.toBe(hash3);
    });

    it('should cache and retrieve results, and log hit/miss stats', () => {
        const jd = 'React Developer';
        const result = { classification: { industry: 'frontend' }, jdAnalysis: { requiredSkills: ['React'] } } as any;

        // Cache miss
        expect(cache.get(jd)).toBeNull();
        expect(cache.getStats()).toEqual({ hits: 0, misses: 1, size: 0 });

        // Cache set and hit
        cache.set(jd, result);
        const retrieved = cache.get(jd);
        expect(retrieved).toEqual(result);
        expect(cache.getStats()).toEqual({ hits: 1, misses: 1, size: 1 });
    });

    it('should invalidate specific cached entries', () => {
        const jd = 'Python Backend Engineer';
        const result = { classification: { industry: 'backend' }, jdAnalysis: { requiredSkills: ['Python'] } } as any;

        cache.set(jd, result);
        expect(cache.get(jd)).toEqual(result);

        cache.invalidate(jd);
        expect(cache.get(jd)).toBeNull();
    });

    it('should expire entries after 24 hours (TTL check)', () => {
        vi.useFakeTimers();
        const now = Date.now();
        const jd = 'Data Engineer';
        const result = { classification: { industry: 'data_engineering' }, jdAnalysis: { requiredSkills: ['SQL'] } } as any;

        cache.set(jd, result);
        expect(cache.get(jd)).toEqual(result);

        // Advance time by 23 hours and 59 minutes (should still be valid)
        vi.setSystemTime(now + (23 * 60 * 60 * 1000 + 59 * 60 * 1000));
        expect(cache.get(jd)).toEqual(result);

        // Advance time by 24 hours and 1 minute (should be expired)
        vi.setSystemTime(now + (24 * 60 * 60 * 1000 + 60 * 1000));
        expect(cache.get(jd)).toBeNull();
    });

    it('should evict least-recently-used (LRU) entry when exceeding 100 entries', () => {
        // We will insert 101 entries and ensure the first one is evicted
        const result = { classification: {}, jdAnalysis: {} } as any;

        // Insert 100 entries
        for (let i = 1; i <= 100; i++) {
            cache.set(`Job description number ${i}`, { ...result, id: i });
        }

        // Stats should show size 100
        expect(cache.getStats().size).toBe(100);
        
        // Touch entry 1 so it becomes most recently used
        cache.get('Job description number 1');

        // Insert the 101st entry (which should evict "Job description number 2" since 1 was touched and 2 is now the oldest)
        cache.set('Job description number 101', { ...result, id: 101 });

        // Size should stay at 100
        expect(cache.getStats().size).toBe(100);

        // Entry 1 should still exist (since it was touched)
        expect(cache.get('Job description number 1')).not.toBeNull();
        
        // Entry 2 should be evicted
        expect(cache.get('Job description number 2')).toBeNull();
        
        // Entry 101 should exist
        expect(cache.get('Job description number 101')).not.toBeNull();
    });
});
