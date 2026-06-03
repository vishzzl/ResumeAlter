/**
 * @file jd-classifier.ts
 * @description Deterministic keyword-frequency classifier for JD industry domain and seniority level.
 */

export type IndustryDomain =
    | 'fintech'
    | 'ml_engineering'
    | 'devops'
    | 'product_management'
    | 'data_engineering'
    | 'frontend'
    | 'backend'
    | 'fullstack'
    | 'design'
    | 'marketing'
    | 'sales'
    | 'general';

export type SeniorityLevel =
    | 'intern'
    | 'junior'
    | 'mid'
    | 'senior'
    | 'staff' | 'principal' | 'executive';

export type JDClassification = {
    industry: IndustryDomain;
    seniority: SeniorityLevel;
    confidence: number;
    detectedKeywords: string[]; // top 10 matched keywords for debugging (no duplicates)
};

// Curated keyword lists for each industry. Lowercase for case-insensitive matching.
const INDUSTRY_KEYWORDS: Record<Exclude<IndustryDomain, 'general'>, string[]> = {
    fintech: [
        'payment', 'payments', 'transaction', 'transactions', 'billing', 'accounting',
        'ledger', 'compliance', 'regulation', 'regulations', 'pci-dss', 'banking', 'bank',
        'wealth', 'capital', 'portfolio', 'credit', 'fraud', 'clearing', 'settlements',
        'fintech', 'gateway', 'gateways', 'stripe', 'transferwise', 'checkout'
    ],
    ml_engineering: [
        'pytorch', 'tensorflow', 'jax', 'neural network', 'neural networks', 'nlp', 'cv',
        'computer vision', 'natural language processing', 'deep learning', 'machine learning',
        'ml', 'rlhf', 'inference optimization', 'inference', 'model training', 'models', 'model',
        'fine-tuning', 'transformers', 'transformer', 'cuda', 'huggingface', 'scikit-learn',
        'mlops', 'tensorrt', 'langchain', 'vector database', 'embeddings', 'llm', 'llms', 'openai'
    ],
    devops: [
        'kubernetes', 'docker', 'terraform', 'ci/cd', 'jenkins', 'gitlab', 'github actions',
        'ansible', 'chef', 'puppet', 'helm', 'cloudformation', 'monitoring', 'prometheus',
        'grafana', 'logging', 'elasticsearch', 'kibana', 'cloud', 'aws', 'gcp', 'azure',
        'sre', 'reliability', 'deployment', 'infrastructure', 'scaling', 'provisioning'
    ],
    product_management: [
        'roadmap', 'roadmaps', 'product manager', 'product owner', 'pm', 'prd', 'backlog',
        'user stories', 'user story', 'stakeholder alignment', 'stakeholder', 'stakeholders',
        'alignment', 'customer feedback', 'kpi', 'kpis', 'okr', 'okrs', 'launch', 'strategy',
        'product lifecycle', 'market research', 'competitor analysis', 'agile', 'scrum'
    ],
    data_engineering: [
        'spark', 'hadoop', 'kafka', 'snowflake', 'redshift', 'dbt', 'bigquery', 'databricks',
        'airflow', 'data pipeline', 'data pipelines', 'etl', 'elt', 'data warehouse',
        'data warehousing', 'mapreduce', 'hive', 'parquet', 'schema', 'schemas', 'data lake',
        'data lakes', 'presto', 'trino'
    ],
    frontend: [
        'css', 'html', 'react', 'vue', 'angular', 'next.js', 'nextjs', 'svelte', 'tailwind',
        'bootstrap', 'sass', 'webpack', 'vite', 'typescript', 'javascript', 'dom', 'ui/ux',
        'browser', 'browsers', 'frontend', 'front-end', 'responsive', 'flexbox', 'grid',
        'single page application', 'spa', 'redux', 'graphql client'
    ],
    backend: [
        'rest api', 'rest apis', 'restful', 'graphql', 'node.js', 'nodejs', 'express',
        'spring boot', 'django', 'flask', 'fastapi', 'postgresql', 'mysql', 'redis',
        'microservices', 'rabbitmq', 'backend', 'back-end', 'grpc', 'sql', 'nosql',
        'server-side', 'oop', 'api design', 'database schema', 'databases', 'routing',
        'authentication', 'authorization', 'orm'
    ],
    fullstack: [
        'fullstack', 'full-stack', 'mern', 'mean', 'frontend and backend',
        'web application', 'web applications', 'sveltekit'
    ],
    design: [
        'figma', 'sketch', 'design system', 'typography', 'wireframe', 'wireframes',
        'mockup', 'mockups', 'prototyping', 'prototype', 'layout', 'visual design',
        'user interface', 'user experience', 'ui/ux', 'illustrator', 'photoshop',
        'portfolio', 'interaction design'
    ],
    marketing: [
        'seo', 'sem', 'google analytics', 'content strategy', 'campaign', 'social media',
        'branding', 'marketing copy', 'copywriting', 'lead generation', 'cpc', 'ctr',
        'conversion rate', 'email marketing', 'marketing campaign'
    ],
    sales: [
        'crm', 'salesforce', 'hubspot', 'account executive', 'pipeline', 'lead qualification',
        'negotiation', 'revenue', 'quota', 'sales representative', 'enterprise sales',
        'business development', 'b2b sales', 'cold calling', 'sales pitch'
    ]
};

// Seniority patterns to scan in title or description
const SENIORITY_PATTERNS = {
    executive: {
        title: [/\b(vp|vice president|director|chief|cto|cio|ceo|head of)\b/i],
        body: [/\b(define strategy|stakeholder alignment|own the roadmap|organizational design|strategic vision|executive leadership|board of directors)\b/i]
    },
    principal: {
        title: [/\b(principal|distinguished|fellow)\b/i],
        body: [/\b(technical direction|technical strategy|company-wide|enterprise-wide)\b/i]
    },
    staff: {
        title: [/\b(staff)\b/i],
        body: [/\b(technical leadership|mentor|mentoring|cross-team|cross-functional|architecture|design systems|drive technical decisions|mentor junior|mentor developers)\b/i]
    },
    senior: {
        title: [/\b(senior|sr|lead)\b/i],
        body: [/\b(lead developers|complex|optimize|optimization|mentorship|mentor|independently|architecture|design|years of experience|expert|professional)\b/i]
    },
    mid: {
        title: [],
        body: [/\b(contribute|contribution|collaborate|build|maintain|develop|development|implementation|implement|experience)\b/i]
    },
    junior: {
        title: [/\b(junior|jr|associate|entry)\b/i],
        body: [/\b(learn|learning|assist|assistance|under guidance|collaborate with|support|0-2 years|recent graduate|entry-level|junior developer|junior engineer)\b/i]
    },
    intern: {
        title: [/\b(intern|internship)\b/i],
        body: [/\b(intern|internship|co-op|student|pursuing|university student|summer intern|graduate intern)\b/i]
    }
};

/**
 * Normalizes text for clean keyword checking.
 */
function normalizeText(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Classifies a job description text to extract industry domain and seniority level.
 * 
 * @param jdText The job description raw text.
 * @returns The classification details containing industry, seniority, confidence, and detected keywords.
 */
export function classifyJD(jdText: string): JDClassification {
    if (!jdText || !jdText.trim()) {
        return {
            industry: 'general',
            seniority: 'mid',
            confidence: 0,
            detectedKeywords: []
        };
    }

    const normalized = normalizeText(jdText);
    const matchesMap = new Map<string, number>();
    const keywordMatches: Array<{ keyword: string; count: number }> = [];

    // 1. Industry Domain Classification
    for (const [domain, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
        let domainHits = 0;
        for (const kw of keywords) {
            // Count occurrence frequency
            // Escape special chars like . and / for regex safety
            const escapedKw = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            // Allow word boundaries where appropriate, but if it starts/ends with special characters (like ci/cd), do not enforce word boundary at those edges
            const startsWithWordChar = /^\w/.test(kw);
            const endsWithWordChar = /\w$/.test(kw);
            const pattern = new RegExp(
                (startsWithWordChar ? '\\b' : '') + escapedKw + (endsWithWordChar ? '\\b' : ''),
                'g'
            );
            const matches = normalized.match(pattern);
            if (matches && matches.length > 0) {
                domainHits += matches.length;
                const existing = matchesMap.get(kw) || 0;
                matchesMap.set(kw, existing + matches.length);
            }
        }
        if (domainHits > 0) {
            matchesMap.set(`__domain__:${domain}`, domainHits);
        }
    }

    // Identify top scoring industry
    let bestIndustry: IndustryDomain = 'general';
    let maxIndustryHits = 0;

    for (const domain of Object.keys(INDUSTRY_KEYWORDS) as Array<Exclude<IndustryDomain, 'general'>>) {
        const hits = matchesMap.get(`__domain__:${domain}`) || 0;
        if (hits > maxIndustryHits) {
            maxIndustryHits = hits;
            bestIndustry = domain;
        }
    }

    // Collect top 10 detected keywords (deduplicated)
    const allMatchingKeywords = Array.from(matchesMap.entries())
        .filter(([key]) => !key.startsWith('__domain__:'))
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => key);

    const topKeywords = allMatchingKeywords.slice(0, 10);

    // Calculate confidence based on hits count (0 to 1 scale)
    let confidence = 0;
    if (maxIndustryHits > 0) {
        // Confidence is a function of matched keywords
        confidence = Math.min(1.0, maxIndustryHits / 5);
    }

    // If confidence is below 0.4, default industry to general
    if (confidence < 0.4) {
        bestIndustry = 'general';
    }

    // 2. Seniority Classification
    // Extract the title line (first non-empty line or matching "Job Title:")
    const lines = jdText.split('\n').map(l => l.trim()).filter(Boolean);
    const titleLine = lines.find(line => line.toLowerCase().includes('job title:')) || lines[0] || '';
    const normalizedTitle = normalizeText(titleLine);

    const seniorityScores: Record<SeniorityLevel, number> = {
        intern: 0,
        junior: 0,
        mid: 0,
        senior: 0,
        staff: 0,
        principal: 0,
        executive: 0
    };

    // Score based on patterns
    for (const [level, patterns] of Object.entries(SENIORITY_PATTERNS) as Array<[SeniorityLevel, typeof SENIORITY_PATTERNS[keyof typeof SENIORITY_PATTERNS]]>) {
        // Check title signals (heavy weight)
        for (const regex of patterns.title) {
            if (regex.test(normalizedTitle)) {
                seniorityScores[level] += 10;
            }
        }
        // Check body signals
        for (const regex of patterns.body) {
            const matches = normalized.match(regex);
            if (matches) {
                seniorityScores[level] += matches.length;
            }
        }
    }

    // Pick highest seniority level
    let bestSeniority: SeniorityLevel = 'mid';
    let maxSeniorityScore = 0;

    // Ordered check to prioritize higher seniority in case of ties, or let's use exact maximum
    for (const level of ['intern', 'junior', 'mid', 'senior', 'staff', 'principal', 'executive'] as SeniorityLevel[]) {
        const score = seniorityScores[level];
        if (score > maxSeniorityScore) {
            maxSeniorityScore = score;
            bestSeniority = level;
        } else if (score === maxSeniorityScore && score > 0) {
            // Tie breaker logic: favor higher level if it's senior+ or just mid
            bestSeniority = level;
        }
    }

    // If confidence is below 0.4, default seniority level to mid
    if (confidence < 0.4 && maxSeniorityScore === 0) {
        bestSeniority = 'mid';
    }

    return {
        industry: bestIndustry,
        seniority: bestSeniority,
        confidence,
        detectedKeywords: topKeywords
    };
}
