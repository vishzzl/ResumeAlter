import { ResumeSections, parseResumeSections } from './resume-parser';

export interface KeywordCoverage {
    score: number;
    matched: string[];
    missing: string[];
    total: number;
}

export interface KeywordCoverageSet {
    required: KeywordCoverage;
    preferred: KeywordCoverage;
}

export interface KeywordHints {
    targetTitle: string;
    requiredSkills: string[];
    preferredSkills: string[];
    requirements: string[];
    keyVerbs: string[];
    keyPhrases: string[];
}

export interface AtsScore {
    before: number;
    after: number;
    breakdown: {
        keywordMatch: { before: number; after: number };
        experienceRelevance: { before: number; after: number };
        skillsAlignment: { before: number; after: number };
        formatting: { before: number; after: number };
        groundedness: { before: number; after: number };
    };
    analysis: string;
}

export interface SectionChange {
    section: string;
    original: string;
    new: string;
    reason: string;
}

export interface GroundednessResult {
    score: number;
    unsupportedNumbers: string[];
    unsupportedKeywords: string[];
}

const TECH_ALIAS_PAIRS: Array<[string, string[]]> = [
    ['javascript', ['js', 'ecmascript']],
    ['typescript', ['ts']],
    ['node.js', ['nodejs', 'node js']],
    ['react.js', ['reactjs', 'react']],
    ['vue.js', ['vuejs', 'vue']],
    ['next.js', ['nextjs', 'next js']],
    ['express.js', ['expressjs', 'express']],
    ['amazon web services', ['aws']],
    ['aws', ['amazon web services']],
    ['google cloud platform', ['gcp']],
    ['gcp', ['google cloud platform']],
    ['microsoft azure', ['azure']],
    ['ci/cd', ['ci cd', 'continuous integration', 'continuous delivery', 'continuous integration and delivery']],
    ['postgresql', ['postgres', 'postgres sql']],
    ['mongodb', ['mongo db']],
    ['kubernetes', ['k8s']],
    ['terraform', ['iac', 'infrastructure as code']],
    ['machine learning', ['ml']],
    ['artificial intelligence', ['ai']],
    ['large language models', ['llm', 'llms']],
    ['rest api', ['restful api', 'rest apis', 'restful apis']],
    ['apis', ['api']],
];

function uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const cleaned = value.replace(/\s+/g, ' ').trim();
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(cleaned);
    }
    return result;
}

function normalizeForLooseMatch(value: string): string {
    return value
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9+#.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function compactForMatch(value: string): string {
    return normalizeForLooseMatch(value).replace(/[^a-z0-9+#]+/g, '');
}

function keywordAliases(keyword: string): string[] {
    const normalized = normalizeForLooseMatch(keyword);
    const compact = compactForMatch(keyword);
    const aliases = new Set<string>([keyword, normalized, compact]);

    for (const [canonical, variants] of TECH_ALIAS_PAIRS) {
        const all = [canonical, ...variants];
        const normalizedAll = all.map(normalizeForLooseMatch);
        const compactAll = all.map(compactForMatch);
        if (normalizedAll.includes(normalized) || compactAll.includes(compact)) {
            for (const item of all) aliases.add(item);
        }
    }

    return Array.from(aliases).filter(Boolean);
}

export function containsKeyword(text: string, keyword: string): boolean {
    if (!text || !keyword?.trim()) return false;

    const lowerText = text.toLowerCase();
    const looseText = ` ${normalizeForLooseMatch(text)} `;
    const compactText = compactForMatch(text);

    return keywordAliases(keyword).some(alias => {
        const raw = alias.toLowerCase().trim();
        const loose = normalizeForLooseMatch(alias);
        const compact = compactForMatch(alias);
        if (!raw && !loose && !compact) return false;

        return lowerText.includes(raw)
            || (loose ? looseText.includes(` ${loose} `) : false)
            || (compact.length >= 2 ? compactText.includes(compact) : false);
    });
}

export function isKeywordEvidenced(sourceText: string, keyword: string): boolean {
    return containsKeyword(sourceText, keyword);
}

export function calculateKeywordCoverage(text: string, keywords: string[]): KeywordCoverage {
    const matched: string[] = [];
    const missing: string[] = [];
    const unique = uniqueStrings(keywords);

    for (const keyword of unique) {
        if (containsKeyword(text, keyword)) matched.push(keyword);
        else missing.push(keyword);
    }

    return {
        score: unique.length > 0 ? Math.round((matched.length / unique.length) * 100) : 100,
        matched,
        missing,
        total: unique.length,
    };
}

export function calculateCoverageSet(
    text: string,
    requiredKeywords: string[],
    preferredKeywords: string[]
): KeywordCoverageSet {
    return {
        required: calculateKeywordCoverage(text, requiredKeywords),
        preferred: calculateKeywordCoverage(text, preferredKeywords),
    };
}

function extractListAfterHeading(text: string, headingMatchers: RegExp[]): string[] {
    const lines = text.split(/\r?\n/);
    const items: string[] = [];
    let collecting = false;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            if (collecting) break;
            continue;
        }

        const isHeading = headingMatchers.some(pattern => pattern.test(line));
        if (isHeading) {
            collecting = true;
            const inline = line.split(':').slice(1).join(':').trim();
            if (inline) {
                items.push(...inline.split(/[,;|]/).map(item => item.trim()));
            }
            continue;
        }

        if (collecting) {
            const looksLikeNextHeading = /^[A-Z][A-Za-z0-9 /&()+-]+:\s*$/.test(line)
                || /^(Company|Job Title|Description|Additional Context|Selected Experience|Selected Requirements):/i.test(line);
            if (looksLikeNextHeading) break;

            const cleaned = line.replace(/^[-*\u2022]\s*/, '').trim();
            if (cleaned) items.push(cleaned);
        }
    }

    return uniqueStrings(items);
}

export function extractKeywordHints(jobDescription: string): KeywordHints {
    const requiredSkills = extractListAfterHeading(jobDescription, [
        /^required skills\b/i,
        /^must[- ]?have skills\b/i,
        /^skills required\b/i,
    ]);
    const preferredSkills = extractListAfterHeading(jobDescription, [
        /^preferred skills\b/i,
        /^nice[- ]?to[- ]?have\b/i,
        /^bonus skills\b/i,
    ]);
    const requirements = extractListAfterHeading(jobDescription, [
        /^selected requirements\b/i,
        /^requirements\b/i,
        /^minimum qualifications\b/i,
    ]);
    const keyVerbs = extractListAfterHeading(jobDescription, [
        /^responsibilities\b/i,
        /^selected experience\b/i,
    ])
        .flatMap(item => item.match(/\b(build|design|develop|lead|manage|architect|deploy|scale|optimize|automate|implement|integrate|analyze|collaborate|own|deliver)\w*/gi) || [])
        .slice(0, 12);

    const titleMatch = jobDescription.match(/^Job Title:\s*(.+)$/im)
        || jobDescription.match(/\b(?:hiring|role|position)\s+(?:for|as)?\s*:?\s*([A-Z][A-Za-z0-9 /,&+-]{3,80})/i);

    return {
        targetTitle: titleMatch?.[1]?.trim() || '',
        requiredSkills,
        preferredSkills,
        requirements,
        keyVerbs: uniqueStrings(keyVerbs),
        keyPhrases: [],
    };
}

function weightedKeywordScore(coverage: KeywordCoverageSet): number {
    if (coverage.required.total === 0 && coverage.preferred.total === 0) return 100;
    if (coverage.required.total === 0) return coverage.preferred.score;
    if (coverage.preferred.total === 0) return coverage.required.score;
    return Math.round((coverage.required.score * 0.75) + (coverage.preferred.score * 0.25));
}

export interface FormattingResult {
    score: number;
    hasHeader: boolean;
    hasSummary: boolean;
    hasExperience: boolean;
    hasSkills: boolean;
    hasMinBullets: boolean;
    hasTables: boolean;
    hasDividers: boolean;
    longLinesCount: number;
}

export function analyzeFormatting(text: string): FormattingResult {
    const sections = parseResumeSections(text);
    let score = 55;

    const hasHeader = !!sections.header.trim();
    const hasSummary = !!sections.summary.trim();
    const hasExperience = !!sections.experience.trim();
    const hasSkills = !!sections.skills.trim();
    const hasMinBullets = countBullets(sections.experience) >= 3;
    const hasDividers = /[|\u2500-\u257f]/.test(text);
    const hasTables = /<table|<\/table>/i.test(text);
    const longLinesCount = text.split(/\r?\n/).filter(line => line.length > 180).length;

    if (hasHeader) score += 8;
    if (hasSummary) score += 8;
    if (hasExperience) score += 10;
    if (hasSkills) score += 8;
    if (hasMinBullets) score += 6;
    if (!hasDividers) score += 3;
    if (!hasTables) score += 2;
    score -= Math.min(10, longLinesCount * 2);

    return {
        score: Math.max(0, Math.min(100, score)),
        hasHeader,
        hasSummary,
        hasExperience,
        hasSkills,
        hasMinBullets,
        hasTables,
        hasDividers,
        longLinesCount,
    };
}

function formattingScore(text: string): number {
    return analyzeFormatting(text).score;
}

function countBullets(text: string): number {
    return text.split(/\r?\n/).filter(line => /^\s*[-*]\s+/.test(line)).length;
}

function extractNumbers(text: string): string[] {
    const matches = text.match(/(?:[$\u20ac\u00a3]\s*)?\b\d+(?:[.,]\d+)?\s*(?:%|k|m|b|x|years?|yrs?|months?)?\b/gi) || [];
    return uniqueStrings(matches.map(item => item.replace(/\s+/g, ' ').trim()));
}

export function calculateGroundedness(
    originalResume: string,
    tailoredResume: string,
    requiredKeywords: string[],
    preferredKeywords: string[]
): GroundednessResult {
    const originalNumbers = extractNumbers(originalResume).map(item => item.toLowerCase());
    const unsupportedNumbers = extractNumbers(tailoredResume)
        .filter(item => !originalNumbers.includes(item.toLowerCase()));

    const allKeywords = uniqueStrings([...requiredKeywords, ...preferredKeywords]);
    const unsupportedKeywords = allKeywords.filter(keyword =>
        containsKeyword(tailoredResume, keyword) && !isKeywordEvidenced(originalResume, keyword)
    );

    const penalty = (unsupportedNumbers.length * 10) + (unsupportedKeywords.length * 8);
    return {
        score: Math.max(0, Math.min(100, 100 - penalty)),
        unsupportedNumbers,
        unsupportedKeywords,
    };
}

function experienceRelevanceScore(text: string, coverage: KeywordCoverageSet): number {
    const sections = parseResumeSections(text);
    const keywordScore = weightedKeywordScore(coverage);
    const bulletBonus = Math.min(12, countBullets(sections.experience) * 2);
    const experiencePresence = sections.experience.trim() ? 8 : 0;
    return Math.max(0, Math.min(100, Math.round(keywordScore * 0.8 + bulletBonus + experiencePresence)));
}

function skillsAlignmentScore(text: string, requiredKeywords: string[], preferredKeywords: string[]): number {
    const sections = parseResumeSections(text);
    const skillsText = sections.skills || text;
    return weightedKeywordScore(calculateCoverageSet(skillsText, requiredKeywords, preferredKeywords));
}

export function calculateAtsScore(params: {
    originalResume: string;
    tailoredResume: string;
    requiredKeywords: string[];
    preferredKeywords: string[];
}): {
    atsScore: AtsScore;
    beforeCoverage: KeywordCoverageSet;
    afterCoverage: KeywordCoverageSet;
    groundedness: GroundednessResult;
    formatting: FormattingResult;
} {
    const { originalResume, tailoredResume, requiredKeywords, preferredKeywords } = params;
    const beforeCoverage = calculateCoverageSet(originalResume, requiredKeywords, preferredKeywords);
    const afterCoverage = calculateCoverageSet(tailoredResume, requiredKeywords, preferredKeywords);
    const beforeKeyword = weightedKeywordScore(beforeCoverage);
    const afterKeyword = weightedKeywordScore(afterCoverage);
    const beforeFormatting = formattingScore(originalResume);
    const afterFormatting = analyzeFormatting(tailoredResume);
    const groundedness = calculateGroundedness(originalResume, tailoredResume, requiredKeywords, preferredKeywords);

    const beforeExperience = experienceRelevanceScore(originalResume, beforeCoverage);
    const afterExperience = experienceRelevanceScore(tailoredResume, afterCoverage);
    const beforeSkills = skillsAlignmentScore(originalResume, requiredKeywords, preferredKeywords);
    const afterSkills = skillsAlignmentScore(tailoredResume, requiredKeywords, preferredKeywords);

    const beforeGroundedness = 100;
    const before = Math.round(
        beforeKeyword * 0.40
        + beforeExperience * 0.25
        + beforeSkills * 0.20
        + beforeFormatting * 0.10
        + beforeGroundedness * 0.05
    );
    const after = Math.round(
        afterKeyword * 0.40
        + afterExperience * 0.25
        + afterSkills * 0.20
        + afterFormatting.score * 0.10
        + groundedness.score * 0.05
    );

    const missingRequired = afterCoverage.required.missing.length;
    const groundedNote = groundedness.score < 100
        ? ` Groundedness warnings: ${[
            ...groundedness.unsupportedNumbers.map(item => `unsupported number "${item}"`),
            ...groundedness.unsupportedKeywords.map(item => `unsupported keyword "${item}"`),
        ].slice(0, 4).join('; ')}.`
        : '';

    return {
        beforeCoverage,
        afterCoverage,
        groundedness,
        formatting: afterFormatting,
        atsScore: {
            before: Math.max(0, Math.min(100, before)),
            after: Math.max(0, Math.min(100, after)),
            breakdown: {
                keywordMatch: { before: beforeKeyword, after: afterKeyword },
                experienceRelevance: { before: beforeExperience, after: afterExperience },
                skillsAlignment: { before: beforeSkills, after: afterSkills },
                formatting: { before: beforeFormatting, after: afterFormatting.score },
                groundedness: { before: beforeGroundedness, after: groundedness.score },
            },
            analysis: `ATS score is based on real keyword coverage, experience relevance, skills alignment, ATS-safe formatting, and factual groundedness. ${afterCoverage.required.matched.length}/${afterCoverage.required.total} required keywords matched${missingRequired ? `; ${missingRequired} required keywords remain missing` : ''}.${groundedNote}`,
        },
    };
}

export function computeSectionChanges(
    originalResume: string,
    tailoredResume: string,
    changeReasons: Array<{ section?: string; reason?: string }> = []
): SectionChange[] {
    const originalSections = parseResumeSections(originalResume);
    const tailoredSections = parseResumeSections(tailoredResume);
    const names: Array<keyof ResumeSections> = ['summary', 'experience', 'skills', 'education', 'projects', 'other'];
    const changes: SectionChange[] = [];

    for (const name of names) {
        const original = (originalSections[name] || '').trim();
        const current = (tailoredSections[name] || '').trim();
        if (!original && !current) continue;
        if (original === current) continue;

        const explicitReason = changeReasons.find(item => item.section?.toLowerCase() === name)?.reason;
        changes.push({
            section: sectionLabel(name),
            original: original.substring(0, 240),
            new: current.substring(0, 240),
            reason: explicitReason || defaultChangeReason(name, original, current),
        });
    }

    return changes;
}

function sectionLabel(name: keyof ResumeSections): string {
    switch (name) {
        case 'summary': return 'Summary';
        case 'experience': return 'Experience';
        case 'skills': return 'Skills';
        case 'education': return 'Education';
        case 'projects': return 'Projects';
        case 'other': return 'Certifications';
        case 'header': return 'Header';
    }
}

function defaultChangeReason(name: keyof ResumeSections, original: string, current: string): string {
    if (!current) return `Removed ${sectionLabel(name)} content that was not relevant to the target role.`;
    if (!original) return `Added ${sectionLabel(name)} content from resume evidence relevant to the target role.`;
    return `Reworked ${sectionLabel(name)} for stronger JD alignment while preserving source facts.`;
}

export function scoreSectionCandidate(params: {
    sectionName: keyof ResumeSections;
    candidateText: string;
    originalResume: string;
    requiredKeywords: string[];
    preferredKeywords: string[];
}): { score: number; scoreBreakdown: { keyword: number; format: number; groundedness: number } } {
    const { sectionName, candidateText, originalResume, requiredKeywords, preferredKeywords } = params;
    const coverage = calculateCoverageSet(candidateText, requiredKeywords, preferredKeywords);
    const keyword = ['summary', 'skills', 'experience', 'projects'].includes(sectionName)
        ? weightedKeywordScore(coverage)
        : 100;
    const format = scoreSectionFormat(sectionName, candidateText);
    const groundedness = calculateGroundedness(originalResume, candidateText, requiredKeywords, preferredKeywords).score;
    const score = Math.round(keyword * 0.45 + format * 0.20 + groundedness * 0.35);

    return {
        score: Math.max(0, Math.min(100, score)),
        scoreBreakdown: { keyword, format, groundedness },
    };
}

function scoreSectionFormat(sectionName: keyof ResumeSections, text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    let score = 80;
    if (/^##\s+/m.test(trimmed)) score -= 15;
    if (/```/.test(trimmed)) score -= 20;

    if (sectionName === 'summary') {
        const sentences = trimmed.split(/[.!?]+/).filter(Boolean).length;
        if (sentences >= 2 && sentences <= 3) score += 15;
        if (trimmed.length > 650) score -= 15;
    }

    if (sectionName === 'experience' || sectionName === 'projects') {
        const bullets = countBullets(trimmed);
        if (bullets >= 2) score += 12;
        if (bullets === 0) score -= 20;
    }

    if (sectionName === 'skills') {
        if (/\*\*[^*]+\*\*:/.test(trimmed)) score += 15;
        if (trimmed.length > 1200) score -= 10;
    }

    return Math.max(0, Math.min(100, score));
}

export function evidencedMissingKeywords(originalResume: string, coverage: KeywordCoverageSet): {
    evidenced: string[];
    unsupported: string[];
} {
    const allMissing = uniqueStrings([...coverage.required.missing, ...coverage.preferred.missing]);
    const evidenced = allMissing.filter(keyword => isKeywordEvidenced(originalResume, keyword));
    const unsupported = allMissing.filter(keyword => !isKeywordEvidenced(originalResume, keyword));
    return { evidenced, unsupported };
}

export function mergeKeywordHints(primary: KeywordHints, fallback: Partial<KeywordHints>): KeywordHints {
    return {
        targetTitle: primary.targetTitle || fallback.targetTitle || '',
        requiredSkills: uniqueStrings([...primary.requiredSkills, ...(fallback.requiredSkills || [])]),
        preferredSkills: uniqueStrings([...primary.preferredSkills, ...(fallback.preferredSkills || [])]),
        requirements: uniqueStrings([...primary.requirements, ...(fallback.requirements || [])]),
        keyVerbs: uniqueStrings([...primary.keyVerbs, ...(fallback.keyVerbs || [])]).slice(0, 12),
        keyPhrases: uniqueStrings([...primary.keyPhrases, ...(fallback.keyPhrases || [])]).slice(0, 10),
    };
}
