// ---------------------------------------------------------------------------
// Skill Matching Engine
// ---------------------------------------------------------------------------
// Matches JD-extracted skills against the user's master skill mappings,
// and filters experience entries to only include JD-relevant bullets.
// ---------------------------------------------------------------------------

import {
    SkillMapping,
    SkillMatchResult,
    FilteredExperience,
    AutoTagSuggestion,
} from '../types/skill-mapping';
import { containsKeyword } from './ats-scoring';

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function normalize(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9+#.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function compact(value: string): string {
    return normalize(value).replace(/[^a-z0-9+#]+/g, '');
}

// ---------------------------------------------------------------------------
// Core matching: does a JD skill match a profile SkillMapping?
// ---------------------------------------------------------------------------

/**
 * Returns true if `jdSkill` matches the given `mapping` by name or any alias.
 * Uses both loose normalised comparison and the ATS alias engine from ats-scoring.
 */
function skillMatches(jdSkill: string, mapping: SkillMapping): boolean {
    const jdNorm = normalize(jdSkill);
    const jdCompact = compact(jdSkill);

    // Check the canonical skill name
    const candidates = [mapping.skillName, ...mapping.aliases];

    for (const candidate of candidates) {
        if (!candidate) continue;

        // 1. Direct normalised match
        if (normalize(candidate) === jdNorm) return true;

        // 2. Compact match (ignore all separators: "Node.js" == "nodejs")
        if (compact(candidate) === jdCompact && jdCompact.length >= 2) return true;

        // 3. Use the ATS alias engine for broader matching (handles TECH_ALIAS_PAIRS)
        if (containsKeyword(candidate, jdSkill)) return true;
        if (containsKeyword(jdSkill, candidate)) return true;
    }

    return false;
}

// ---------------------------------------------------------------------------
// Compatibility helper: match JD skills against legacy structured profile data.
// ---------------------------------------------------------------------------

/**
 * Matches required and preferred JD skills against the user's SkillMappings.
 * Returns which profile skills matched, which JD skills had no match,
 * and which profile skills were unused.
 */
export function matchSkillsToProfile(
    jdSkills: { required: string[]; preferred: string[] },
    skillMappings: SkillMapping[]
): SkillMatchResult {
    const allJDSkills = [...jdSkills.required, ...jdSkills.preferred];
    const matchedSet = new Set<number>(); // indices into skillMappings
    const unmatchedJDSkills: string[] = [];

    for (const jdSkill of allJDSkills) {
        let found = false;
        for (let i = 0; i < skillMappings.length; i++) {
            if (skillMatches(jdSkill, skillMappings[i])) {
                matchedSet.add(i);
                found = true;
                // Don't break — a JD skill could match multiple profile skills
                // (e.g. "React" matches both "React" and "React Native")
                // but typically it's 1:1
                break;
            }
        }
        if (!found) {
            unmatchedJDSkills.push(jdSkill);
        }
    }

    const matchedSkills = Array.from(matchedSet).map(i => skillMappings[i]);
    const unusedProfileSkills = skillMappings.filter((_, i) => !matchedSet.has(i));

    return { matchedSkills, unmatchedJDSkills, unusedProfileSkills };
}

// ---------------------------------------------------------------------------
// Filter experience by matched skills
// ---------------------------------------------------------------------------

/**
 * Extracts all bullet strings from an experience entry in a stable order:
 *   1. Description lines (split by newline, cleaned)
 *   2. Highlights array entries
 * This matches how the profile UI presents bullets.
 */
export function extractBullets(exp: {
    description?: string;
    highlights?: string[];
}): string[] {
    const bullets: string[] = [];

    if (exp.description) {
        const lines = exp.description
            .split('\n')
            .map(l => l.replace(/^[\s\-*•]+/, '').trim())
            .filter(Boolean);
        bullets.push(...lines);
    }

    if (Array.isArray(exp.highlights)) {
        for (const h of exp.highlights) {
            if (h && h.trim()) bullets.push(h.trim());
        }
    }

    return bullets;
}

/**
 * Filters experience entries to only include bullets tagged with JD-relevant skills.
 *
 * Strategy:
 * - If an experience entry has ANY bullet matching a JD skill, include the entry
 * - Include only the matched bullets + description (always kept for context)
 * - If an experience entry has NO matched bullets, still include it with
 *   just the general description (for career continuity)
 * - All experience contexts are included (user's decision: don't drop roles)
 */
export function filterExperienceBySkills(
    experience: any[],
    matchedSkills: SkillMapping[]
): FilteredExperience[] {
    if (!Array.isArray(experience) || experience.length === 0) return [];
    if (matchedSkills.length === 0) {
        // No skill mappings matched — return all experience unfiltered
        return experience.map((exp, i) => ({
            company: exp.company || '',
            role: exp.role || '',
            dates: exp.dates || '',
            description: exp.description || '',
            highlights: Array.isArray(exp.highlights) ? exp.highlights : [],
            clients: Array.isArray(exp.clients) ? exp.clients : [],
            includedBecause: [],
            originalIndex: i,
        }));
    }

    // Build a map: experienceIndex → Set<bulletIndex> that are relevant
    const relevantBullets = new Map<number, Set<number>>();
    const relevantSkillNames = new Map<number, Set<string>>();

    for (const skill of matchedSkills) {
        for (const link of skill.experienceLinks) {
            if (!relevantBullets.has(link.experienceIndex)) {
                relevantBullets.set(link.experienceIndex, new Set());
                relevantSkillNames.set(link.experienceIndex, new Set());
            }
            for (const bi of link.bulletIndices) {
                relevantBullets.get(link.experienceIndex)!.add(bi);
            }
            relevantSkillNames.get(link.experienceIndex)!.add(skill.skillName);
        }
    }

    return experience.map((exp, expIndex) => {
        const allBullets = extractBullets(exp);
        const matchedBulletIndices = relevantBullets.get(expIndex);
        const skillNames = relevantSkillNames.get(expIndex);

        if (matchedBulletIndices && matchedBulletIndices.size > 0) {
            // This experience has tagged bullets that match the JD
            const matchedHighlights = allBullets.filter((_, i) =>
                matchedBulletIndices.has(i)
            );
            const unmatchedHighlights = allBullets.filter((_, i) =>
                !matchedBulletIndices.has(i)
            );
            // Prioritize matched highlights first, fill up to 5 bullets total for a robust career history
            const filteredHighlights = [...matchedHighlights, ...unmatchedHighlights].slice(0, 5);

            return {
                company: exp.company || '',
                role: exp.role || '',
                dates: exp.dates || '',
                description: '', // Bullets are in filteredHighlights
                highlights: filteredHighlights,
                clients: Array.isArray(exp.clients) ? exp.clients : [],
                includedBecause: Array.from(skillNames || []),
                originalIndex: expIndex,
            };
        }

        // No matched bullets for this role — include with just general context
        // Keep 1-2 general bullets to show career continuity
        const generalBullets = allBullets.slice(0, 2);
        return {
            company: exp.company || '',
            role: exp.role || '',
            dates: exp.dates || '',
            description: '',
            highlights: generalBullets,
            clients: Array.isArray(exp.clients) ? exp.clients : [],
            includedBecause: [],
            originalIndex: expIndex,
        };
    });
}

// ---------------------------------------------------------------------------
// Auto-tag suggestions
// ---------------------------------------------------------------------------

/**
 * Scans all experience bullets and suggests which skills they might demonstrate.
 * Uses keyword matching to find skill names (and aliases) in bullet text.
 *
 * Returns suggestions sorted by confidence (highest first).
 */
export function suggestSkillTags(
    experience: any[],
    skillMappings: SkillMapping[]
): AutoTagSuggestion[] {
    const suggestions: AutoTagSuggestion[] = [];

    // Build a set of already-linked (expIndex, bulletIndex, skillName) to avoid dupes
    const alreadyLinked = new Set<string>();
    for (const skill of skillMappings) {
        for (const link of skill.experienceLinks) {
            for (const bi of link.bulletIndices) {
                alreadyLinked.add(`${link.experienceIndex}:${bi}:${skill.skillName}`);
            }
        }
    }

    for (let expIndex = 0; expIndex < experience.length; expIndex++) {
        const bullets = extractBullets(experience[expIndex]);

        for (let bulletIndex = 0; bulletIndex < bullets.length; bulletIndex++) {
            const bulletText = bullets[bulletIndex];

            for (const skill of skillMappings) {
                const key = `${expIndex}:${bulletIndex}:${skill.skillName}`;
                if (alreadyLinked.has(key)) continue;

                // Check skill name and all aliases against the bullet text
                const candidates = [skill.skillName, ...skill.aliases];
                for (const candidate of candidates) {
                    if (containsKeyword(bulletText, candidate)) {
                        // Determine confidence based on match quality
                        const bulletLower = bulletText.toLowerCase();
                        const candidateLower = candidate.toLowerCase();

                        // Exact word match = high confidence
                        const exactMatch = new RegExp(`\\b${escapeRegex(candidateLower)}\\b`, 'i').test(bulletText);
                        const confidence = exactMatch ? 0.9 : 0.6;

                        suggestions.push({
                            skillName: skill.skillName,
                            experienceIndex: expIndex,
                            bulletIndex,
                            matchedTerm: candidate,
                            confidence,
                        });

                        // Mark as found to avoid duplicate suggestions for aliases
                        alreadyLinked.add(key);
                        break;
                    }
                }
            }
        }
    }

    // Sort by confidence descending, then by experience index, then bullet index
    suggestions.sort((a, b) =>
        b.confidence - a.confidence
        || a.experienceIndex - b.experienceIndex
        || a.bulletIndex - b.bulletIndex
    );

    return suggestions;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Utility: parse skill mappings from profile JSON
// ---------------------------------------------------------------------------

/**
 * Safely parses the `skillMappings` JSON field from a profile record.
 * Returns an empty array if missing, null, or invalid.
 */
export function parseSkillMappings(raw: string | null | undefined): SkillMapping[] {
    if (!raw) return [];
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(parsed)) return [];
        // Basic validation: each item must have a skillName
        return parsed.filter(
            (item: any) => item && typeof item.skillName === 'string' && item.skillName.trim()
        ) as SkillMapping[];
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Utility: group matched skills by category for resume output
// ---------------------------------------------------------------------------

/**
 * Groups matched skills by their category for the Skills section.
 * Returns a map: category → skill names (sorted by yearsOfExperience desc).
 */
export function groupSkillsByCategory(
    skills: SkillMapping[]
): Map<string, string[]> {
    const groups = new Map<string, SkillMapping[]>();

    for (const skill of skills) {
        const category = skill.category || 'Other';
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category)!.push(skill);
    }

    // Sort within each category by years of experience (descending)
    const result = new Map<string, string[]>();
    for (const [category, categorySkills] of groups) {
        categorySkills.sort((a, b) => (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0));
        result.set(category, categorySkills.map(s => s.skillName));
    }

    return result;
}
