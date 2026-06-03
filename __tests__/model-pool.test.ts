import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelPoolManager, QuotaExhaustedError, ModelId } from '../lib/model-pool';

describe('ModelPoolManager', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    // Test 1 — Routing table correctness
    it('should route summary to gemini-2.0-flash-lite and experience to cohere-command-r-plus as first models', async () => {
        const fetchHistory: ModelId[] = [];
        const mockFetch = async (modelId: ModelId) => {
            fetchHistory.push(modelId);
            return 'success';
        };
        const pool = new ModelPoolManager(mockFetch);
        
        await pool.call('summary', 'sys', 'user');
        expect(fetchHistory[0]).toBe('gemini-2.0-flash-lite');

        fetchHistory.length = 0;
        await pool.call('experience', 'sys', 'user');
        expect(fetchHistory[0]).toBe('cohere-command-r-plus');
    });

    // Test 2 — Round-robin cyclic routing
    it('should distribute summary calls across fallback chain when preferred model approaches RPM limit', async () => {
        const fetchHistory: ModelId[] = [];
        const mockFetch = async (modelId: ModelId) => {
            fetchHistory.push(modelId);
            return 'success';
        };
        const pool = new ModelPoolManager(mockFetch);

        for (let i = 0; i < 30; i++) {
            await pool.call('summary', 'sys', 'user');
        }

        const liteCalls = fetchHistory.filter(m => m === 'gemini-2.0-flash-lite').length;
        const flashCalls = fetchHistory.filter(m => m === 'gemini-1.5-flash').length;

        expect(liteCalls).toBeLessThan(30);
        expect(flashCalls).toBeGreaterThan(0);
        expect(fetchHistory.length).toBe(30);
    });

    // Test 3 — Transparent 429 retry
    it('should handle 429 responses transparently and mark models as exhausted', async () => {
        const fetchHistory: ModelId[] = [];
        const mockFetch = async (modelId: ModelId) => {
            fetchHistory.push(modelId);
            if (modelId === 'gemini-2.0-flash-lite') {
                const err = new Error('429 Rate Limit Exceeded');
                (err as any).status = 429;
                throw err;
            }
            return 'fallback success';
        };

        const pool = new ModelPoolManager(mockFetch);
        const result = await pool.call('summary', 'sys', 'user');

        expect(result).toBe('fallback success');
        expect(fetchHistory).toEqual(['gemini-2.0-flash-lite', 'gemini-1.5-flash']);
        
        const status = pool.getPoolStatus();
        expect(status['gemini-2.0-flash-lite'].available).toBe(false);
    });

    // Test 4 — Sliding window accuracy (61-second rolloff)
    it('should respect the 60-second sliding window accuracy and roll off old calls', () => {
        vi.useFakeTimers();
        const pool = new ModelPoolManager();
        const now = Date.now();

        // Simulate 14 calls at time T (RPM limit = 15, safety buffer limit - 1 = 14)
        for (let i = 0; i < 14; i++) {
            pool.recordCall('gemini-1.5-flash', now);
        }

        // Verify status at current time T
        let status = pool.getPoolStatus(now);
        expect(status['gemini-1.5-flash'].callsInWindow).toBe(14);
        expect(status['gemini-1.5-flash'].available).toBe(false);

        // Forward mock time by 61 seconds
        const nextTime = now + 61000;
        vi.setSystemTime(nextTime);

        // Verify callsInWindow rolled off to 0
        status = pool.getPoolStatus(nextTime);
        expect(status['gemini-1.5-flash'].callsInWindow).toBe(0);
        expect(status['gemini-1.5-flash'].available).toBe(true);
    });

    // Test 5 — QuotaExhaustedError when all models exhausted
    it('should throw QuotaExhaustedError with retryAfterMs when all chain models are busy', async () => {
        const mockFetch = async () => 'success';
        const pool = new ModelPoolManager(mockFetch);

        // Exhaust gemini-2.0-flash-lite (RPM=30 -> 29 available), gemini-1.5-flash (RPM=15 -> 14 available), cohere-command-r-plus (RPM=10 -> 9 available)
        // Total calls = 29 + 14 + 9 = 52 calls.
        for (let i = 0; i < 52; i++) {
            await pool.call('summary', 'sys', 'user');
        }

        // The 53rd call should throw QuotaExhaustedError
        await expect(pool.call('summary', 'sys', 'user')).rejects.toThrow(QuotaExhaustedError);
        
        try {
            await pool.call('summary', 'sys', 'user');
        } catch (err: any) {
            expect(err).toBeInstanceOf(QuotaExhaustedError);
            expect(err.retryAfterMs).toBeGreaterThan(0);
        }
    });
});
