
export interface ResumeSections {
    header: string;
    summary: string;
    experience: string;
    skills: string;
    education: string;
    projects: string;
    other: string;
}

export function parseResumeSections(text: string): ResumeSections {
    const sections: ResumeSections = {
        header: '',
        summary: '',
        experience: '',
        skills: '',
        education: '',
        projects: '',
        other: ''
    };

    if (!text) return sections;

    // Define common section headers (case-insensitive)
    const sectionHeaders = {
        summary: /^(summary|professional summary|executive summary|profile|about me|objective)/i,
        experience: /^(experience|work experience|professional experience|employment history|work history)/i,
        skills: /^(skills|core competencies|technical skills|technologies|expertise)/i,
        education: /^(education|academic background|qualifications)/i,
        projects: /^(projects|personal projects|key projects)/i,
        other: /^(awards|certifications|publications|languages|interests|references|volunteering)/i
    };

    const lines = text.split('\n');
    let currentSection: keyof ResumeSections = 'header';
    let buffer: string[] = [];

    // Simple heuristic: Header is usually at the top before any named section

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            buffer.push(lines[i]); // Preserve empty lines for formatting
            continue;
        }

        // Check if line is a section header
        // Heuristic: Short line, often uppercase or title case, matches keywords
        let isHeader = false;
        let matchedSection: keyof ResumeSections | null = null;

        if (line.length < 50) { // Headers are usually short
            // Strip markdown, colons, pipes, and whitespace
            const cleanLine = line.replace(/^[\s#*>\-]+|[:|]/g, '').trim();

            for (const [key, regex] of Object.entries(sectionHeaders)) {
                if (regex.test(cleanLine)) {
                    isHeader = true;
                    matchedSection = key as keyof ResumeSections;
                    break;
                }
            }
        }

        if (isHeader && matchedSection) {
            // Save buffer to current section
            sections[currentSection] += buffer.join('\n') + '\n';
            buffer = [];
            currentSection = matchedSection;

            // For "Other" section, we might want to keep the sub-header (e.g. "Awards") because we group them.
            // For strictly defined sections like "Summary", "Experience", "Skills", we can drop the header
            // efficiently because we will re-add standard headers in the reconstruction.
            if (matchedSection === 'other') {
                buffer.push(lines[i]);
            }
        } else {
            buffer.push(lines[i]);
        }
    }

    // Flush remaining buffer
    sections[currentSection] += buffer.join('\n');

    // Cleanup: trim sections
    for (const key of Object.keys(sections)) {
        sections[key as keyof ResumeSections] = sections[key as keyof ResumeSections].trim();
    }

    return sections;
}
