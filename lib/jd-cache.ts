/**
 * @file jd-cache.ts
 * @description In-memory LRU cache with TTL for job description classification and analysis results.
 */

import * as crypto from 'crypto';

export type CachedJDResult = {
    classification: any;
    jdAnalysis: any;
};

interface CacheEntry {
    result: CachedJDResult;
    timestamp: number;
    normalizedJd: string;
}

/**
 * Normalizes JD text by:
 * - Converting to lowercase
 * - Stripping URLs
 * - Stripping email addresses
 * - Collapsing multiple whitespaces/newlines to a single space
 */
export function normalizeJD(text: string): string {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Computes SHA-256 hash (truncated to 16 characters) of the normalized text.
 */
export function computeJDHash(normalizedText: string): string {
    return crypto
        .createHash('sha256')
        .update(normalizedText)
        .digest('hex')
        .slice(0, 16);
}

export class JDCache {
    private cache = new Map<string, CacheEntry>();
    private hits = 0;
    private misses = 0;
    private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours
    private readonly maxEntries = 100;

    public get(jdText: string): CachedJDResult | null {
        if (!jdText) return null;
        const normalized = normalizeJD(jdText);
        const hash = computeJDHash(normalized);
        const entry = this.cache.get(hash);

        if (!entry) {
            this.misses++;
            return null;
        }

        const now = Date.now();
        if (now - entry.timestamp > this.ttlMs) {
            // Expired
            this.cache.delete(hash);
            this.misses++;
            return null;
        }

        // LRU update: move to end
        this.cache.delete(hash);
        this.cache.set(hash, entry);
        
        this.hits++;
        return entry.result;
    }

    public set(jdText: string, result: CachedJDResult): void {
        if (!jdText) return;
        const normalized = normalizeJD(jdText);
        const hash = computeJDHash(normalized);

        if (this.cache.has(hash)) {
            this.cache.delete(hash);
        } else if (this.cache.size >= this.maxEntries) {
            // Evict the oldest (first entry in Map insertion order)
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(hash, {
            result,
            timestamp: Date.now(),
            normalizedJd: normalized
        });
    }

    public invalidate(jdText: string): void {
        if (!jdText) return;
        const normalized = normalizeJD(jdText);
        const hash = computeJDHash(normalized);
        this.cache.delete(hash);
    }

    public getStats() {
        return {
            hits: this.hits,
            misses: this.misses,
            size: this.cache.size
        };
    }

    public clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
}

// Module-level Singleton
export const jdCache = new JDCache();
