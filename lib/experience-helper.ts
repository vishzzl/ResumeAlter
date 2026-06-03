/**
 * @file experience-helper.ts
 * @description Helper functions to parse experience markdown and extract metrics.
 */

export class MetricIntegrityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MetricIntegrityError';
    }
}

export interface ResumeRole {
    company: string;
    title: string;
    location?: string;
    period?: string;
    bullets: string[];
}

/**
 * Parses markdown Experience section string into a structured array of ResumeRoles.
 */
export function parseExperienceMarkdown(text: string): ResumeRole[] {
    if (!text || !text.trim()) return [];

    const lines = text.split('\n').map(l => l.trim());
    const roles: ResumeRole[] = [];
    let currentRole: ResumeRole | null = null;

    for (const line of lines) {
        if (!line) continue;

        // Check if it is a bullet point (bullet marker followed by whitespace)
        const isBullet = /^[-*•]\s+/.test(line);
        if (isBullet) {
            const bulletContent = line.replace(/^[-*•]\s*/, '').trim();
            if (bulletContent) {
                if (!currentRole) {
                    currentRole = {
                        company: 'Company',
                        title: 'Software Engineer',
                        bullets: []
                    };
                    roles.push(currentRole);
                }
                currentRole.bullets.push(bulletContent);
            }
        } else {
            // It is a role header line
            // Clean markdown bolding/header prefix
            const cleanLine = line
                .replace(/^#+\s+/, '')
                .replace(/\*\*/g, '')
                .replace(/^[-*•]\s*/, '')
                .trim();

            if (!cleanLine) continue;

            // Split by typical separators
            let parts = cleanLine.split('|').map(p => p.trim());
            if (parts.length < 2) {
                parts = cleanLine.split(' - ').map(p => p.trim());
            }
            if (parts.length < 2) {
                parts = cleanLine.split(' – ').map(p => p.trim());
            }

            let company = '';
            let title = '';
            let period = '';

            if (parts.length >= 3) {
                company = parts[0];
                title = parts[1];
                period = parts[2];
            } else if (parts.length === 2) {
                company = parts[0];
                title = parts[1];
            } else {
                title = cleanLine;
                company = 'Company';
            }

            currentRole = {
                company: company || 'Company',
                title: title || 'Software Engineer',
                period: period || undefined,
                bullets: []
            };
            roles.push(currentRole);
        }
    }

    return roles;
}

/**
 * Extracts metrics from a text string.
 * A metric is defined as:
 * - preceded by $ (e.g. $2M, $120k)
 * - followed by % (e.g. 40%)
 * - matching \d+(\.\d+)?[%$kKmMbB]? or common units like ms, x
 */
export function extractMetrics(text: string): string[] {
    if (!text) return [];
    
    // We match:
    // 1. Preceded by $: \$[\d.,]+[kKmMbB]?
    // 2. Numbers ending in %: [\d.,]+%
    // 3. Numbers ending in common metric units: \b\d+(?:\.\d+)?[xXkKmMbB]?\b
    // 4. Numbers with units: \b\d+(?:ms|months?|years?|yrs?)\b
    const regex = /(?:\$[\d.,]+[kKmMbBxX]?|[\d.,]+%|\b\d+(?:\.\d+)?[xXkKmMbB]?\b|\b\d+(?:ms|months?|years?|yrs?)\b)/g;
    const matches = text.match(regex) || [];
    
    // Clean matches: remove trailing punctuation
    return Array.from(new Set(
        matches
            .map(m => m.trim().replace(/[.,;:!?)]$/, ''))
            .filter(Boolean)
    ));
}
