import { generateText, cleanJson, CustomConfig } from './generate';
import { 
    KeywordCoverageSet, 
    AtsScore, 
    FormattingResult, 
    GroundednessResult, 
    analyzeFormatting, 
    calculateGroundedness 
} from './ats-scoring';

export async function evaluateAtsLLM(params: {
    originalResume: string;
    tailoredResume: string;
    jobDescription: string;
    apiKey?: string;
    modelName?: string;
    provider?: string;
    customConfig?: CustomConfig;
}): Promise<{
    atsScore: AtsScore;
    beforeCoverage: KeywordCoverageSet;
    afterCoverage: KeywordCoverageSet;
    groundedness: GroundednessResult;
    formatting: FormattingResult;
}> {
    const { originalResume, tailoredResume, jobDescription, apiKey, modelName, provider, customConfig } = params;

    const prompt = `
You are an expert ATS (Applicant Tracking System) parser and evaluator. Your job is to analyze a Job Description and compare two resumes (Original and Tailored) against it using precise keyword matching.

JOB DESCRIPTION:
${jobDescription}

${originalResume ? `ORIGINAL RESUME:\n${originalResume}` : 'ORIGINAL RESUME: [Not provided — set all "before" scores to 0]'}

TAILORED RESUME:
${tailoredResume}

INSTRUCTIONS:
1. Extract ALL "must-have" (required) technical skills, tools, and platforms from the JD.
2. Extract ALL "nice-to-have" (preferred) technical skills from the JD.
3. For both resumes, determine if each required/preferred skill is demonstrated using these match tiers:
   - EXACT MATCH: The keyword appears verbatim (case-insensitive). Count as MATCH.
   - VARIANT MATCH: A known spelling variant appears (e.g., "Node.js" ↔ "NodeJS", "PostgreSQL" ↔ "Postgres"). Count as MATCH.
   - NO MATCH: The skill is absent. Count as MISSING.
   Do NOT count semantic/conceptual matches (e.g., "React" does NOT match "Frontend Framework").
4. Calculate scores using these rubrics:
   - keywordScore = (exactMatches + variantMatches) / totalExtractedSkills × 100
   - skillsScore = (matchedRequired / totalRequired) × 70 + (matchedPreferred / totalPreferred) × 30
   - experienceScore: 0–20 if no relevant role, 20–50 if related but different domain, 50–80 if same domain with partial overlap, 80–100 if directly aligned role with matching responsibilities

OUTPUT STRICTLY VALID JSON IN THIS EXACT FORMAT:
{
  "extractedRequirements": {
    "requiredSkills": ["skill1", "skill2"],
    "preferredSkills": ["skill3"]
  },
  "originalMatch": {
    "requiredMatched": ["skill1"],
    "requiredMissing": ["skill2"],
    "preferredMatched": [],
    "preferredMissing": ["skill3"],
    "experienceScore": 60,
    "skillsScore": 50,
    "keywordScore": 50
  },
  "tailoredMatch": {
    "requiredMatched": ["skill1", "skill2"],
    "requiredMissing": [],
    "preferredMatched": ["skill3"],
    "preferredMissing": [],
    "experienceScore": 85,
    "skillsScore": 95,
    "keywordScore": 100
  },
  "analysis": "Brief 1-sentence analysis of the tailored resume's ATS performance."
}
`;

    const systemInstruction = 'You are a professional ATS Parser. Extract strictly accurate JSON.';

    try {
        const rawResponse = await generateText({
            prompt,
            systemInstruction,
            provider: provider || 'gemini',
            apiKey,
            modelName: modelName || 'gemini-flash-latest',
            customConfig,
            temperature: 0.15, // Low temperature for deterministic scoring
            jsonMode: true,
        });

        const data = JSON.parse(cleanJson(rawResponse));

        // Safely extract requirements
        const reqSkills = data.extractedRequirements?.requiredSkills || [];
        const prefSkills = data.extractedRequirements?.preferredSkills || [];

        // Build KeywordCoverageSets
        const beforeCoverage: KeywordCoverageSet = {
            required: {
                score: data.originalMatch?.keywordScore || 0,
                matched: data.originalMatch?.requiredMatched || [],
                missing: data.originalMatch?.requiredMissing || [],
                total: (data.originalMatch?.requiredMatched?.length || 0) + (data.originalMatch?.requiredMissing?.length || 0)
            },
            preferred: {
                score: data.originalMatch?.keywordScore || 0,
                matched: data.originalMatch?.preferredMatched || [],
                missing: data.originalMatch?.preferredMissing || [],
                total: (data.originalMatch?.preferredMatched?.length || 0) + (data.originalMatch?.preferredMissing?.length || 0)
            }
        };

        const afterCoverage: KeywordCoverageSet = {
            required: {
                score: data.tailoredMatch?.keywordScore || 0,
                matched: data.tailoredMatch?.requiredMatched || [],
                missing: data.tailoredMatch?.requiredMissing || [],
                total: (data.tailoredMatch?.requiredMatched?.length || 0) + (data.tailoredMatch?.requiredMissing?.length || 0)
            },
            preferred: {
                score: data.tailoredMatch?.keywordScore || 0,
                matched: data.tailoredMatch?.preferredMatched || [],
                missing: data.tailoredMatch?.preferredMissing || [],
                total: (data.tailoredMatch?.preferredMatched?.length || 0) + (data.tailoredMatch?.preferredMissing?.length || 0)
            }
        };

        // Fallback total calculation if LLM omitted missing arrays
        if (beforeCoverage.required.total === 0) beforeCoverage.required.total = reqSkills.length;
        if (beforeCoverage.preferred.total === 0) beforeCoverage.preferred.total = prefSkills.length;
        if (afterCoverage.required.total === 0) afterCoverage.required.total = reqSkills.length;
        if (afterCoverage.preferred.total === 0) afterCoverage.preferred.total = prefSkills.length;

        // Run deterministic formatting & groundedness checks
        const beforeFormatting = analyzeFormatting(originalResume || tailoredResume).score;
        const afterFormattingResult = analyzeFormatting(tailoredResume);
        const groundednessResult = calculateGroundedness(originalResume || tailoredResume, tailoredResume, reqSkills, prefSkills);

        // Blend the LLM scores with deterministic formatting and groundedness
        const beforeExperience = data.originalMatch?.experienceScore || 0;
        const afterExperience = data.tailoredMatch?.experienceScore || 0;
        const beforeSkills = data.originalMatch?.skillsScore || 0;
        const afterSkills = data.tailoredMatch?.skillsScore || 0;
        const beforeKeyword = data.originalMatch?.keywordScore || 0;
        const afterKeyword = data.tailoredMatch?.keywordScore || 0;
        
        const beforeGroundedness = 100; // Original is always 100% grounded against itself

        // Calculate final scores using the same 40/25/20/10/5 weighting as before
        const beforeOverall = Math.round(
            (beforeKeyword * 0.40) +
            (beforeExperience * 0.25) +
            (beforeSkills * 0.20) +
            (beforeFormatting * 0.10) +
            (beforeGroundedness * 0.05)
        );

        const afterOverall = Math.round(
            (afterKeyword * 0.40) +
            (afterExperience * 0.25) +
            (afterSkills * 0.20) +
            (afterFormattingResult.score * 0.10) +
            (groundednessResult.score * 0.05)
        );

        const missingRequired = afterCoverage.required.missing.length;
        const groundedNote = groundednessResult.score < 100
            ? ` Groundedness warnings: ${[
                ...groundednessResult.unsupportedNumbers.map(item => `unsupported number "${item}"`),
                ...groundednessResult.unsupportedKeywords.map(item => `unsupported keyword "${item}"`),
            ].slice(0, 4).join('; ')}.`
            : '';

        const fallbackAnalysis = `ATS score is based on semantic keyword coverage, experience relevance, skills alignment, ATS-safe formatting, and factual groundedness. ${afterCoverage.required.matched.length}/${reqSkills.length} required keywords matched${missingRequired ? `; ${missingRequired} required keywords remain missing` : ''}.${groundedNote}`;

        return {
            beforeCoverage,
            afterCoverage,
            groundedness: groundednessResult,
            formatting: afterFormattingResult,
            atsScore: {
                before: Math.max(0, Math.min(100, beforeOverall)),
                after: Math.max(0, Math.min(100, afterOverall)),
                breakdown: {
                    keywordMatch: { before: beforeKeyword, after: afterKeyword },
                    experienceRelevance: { before: beforeExperience, after: afterExperience },
                    skillsAlignment: { before: beforeSkills, after: afterSkills },
                    formatting: { before: beforeFormatting, after: afterFormattingResult.score },
                    groundedness: { before: beforeGroundedness, after: groundednessResult.score },
                },
                analysis: (data.analysis ? data.analysis + ' ' : '') + fallbackAnalysis,
            }
        };
    } catch (error) {
        console.error("LLM ATS Scoring failed, falling back to legacy scoring if possible", error);
        throw error;
    }
}
