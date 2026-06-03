// ---------------------------------------------------------------------------
// Skill-to-Experience Mapping Types
// ---------------------------------------------------------------------------

/**
 * Links a skill to specific bullets within an experience entry.
 * `experienceIndex` references the position in the profile's experience[] array.
 * `bulletIndices` references specific bullets (from the combined description
 * lines + highlights array for that experience entry).
 */
export interface ExperienceLink {
    experienceIndex: number;
    bulletIndices: number[];
}

/**
 * A single skill in the master profile with its metadata and
 * links to the experience bullets where it was used.
 */
export interface SkillMapping {
    skillName: string;
    category: string;
    yearsOfExperience: number;
    aliases: string[];
    experienceLinks: ExperienceLink[];
}

// ---------------------------------------------------------------------------
// Matching Results
// ---------------------------------------------------------------------------

/**
 * Result of matching JD-extracted skills against the user's master skill mappings.
 */
export interface SkillMatchResult {
    /** Skills from the master profile that matched the JD */
    matchedSkills: SkillMapping[];
    /** JD skills that have no match in the master profile */
    unmatchedJDSkills: string[];
    /** Profile skills that were not needed for this JD */
    unusedProfileSkills: SkillMapping[];
}

// ---------------------------------------------------------------------------
// Filtered Experience
// ---------------------------------------------------------------------------

/**
 * An experience entry with bullets filtered to only those tagged with
 * JD-relevant skills.
 */
export interface FilteredExperience {
    company: string;
    role: string;
    dates: string;
    description: string;
    highlights: string[];
    clients: Array<{
        name: string;
        domain: string;
        description: string;
    }>;
    /** Which JD skills caused this experience entry to be included */
    includedBecause: string[];
    /** Original index in the profile's experience array */
    originalIndex: number;
}

// ---------------------------------------------------------------------------
// Auto-Tag Suggestion
// ---------------------------------------------------------------------------

/**
 * Suggestion for auto-tagging a skill to an experience bullet.
 */
export interface AutoTagSuggestion {
    skillName: string;
    experienceIndex: number;
    bulletIndex: number;
    /** The matched keyword/phrase that triggered the suggestion */
    matchedTerm: string;
    /** Confidence score 0-1 */
    confidence: number;
}
