import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | number | Date) {
    return new Date(dateString).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export function formatProfileToText(profile: any): string {
    if (!profile) return '';

    const parts = [];

    // Basics
    if (profile.name) parts.push(`Name: ${profile.name}`);
    if (profile.email) parts.push(`Email: ${profile.email}`);
    if (profile.phone) parts.push(`Phone: ${profile.phone}`);
    if (profile.linkedin) parts.push(`LinkedIn: ${profile.linkedin}`);
    if (profile.website) parts.push(`Website: ${profile.website}`);
    if (profile.summary) parts.push(`\nSummary:\n${profile.summary}`);

    // Experience
    if (profile.experience) {
        let exp = profile.experience;
        if (typeof exp === 'string') {
            try { exp = JSON.parse(exp); } catch (e) { exp = []; }
        }
        if (Array.isArray(exp) && exp.length > 0) {
            parts.push('\nExperience:');
            exp.forEach((e: any) => {
                parts.push(`- ${e.role} at ${e.company} (${e.dates})`);
                if (e.description) parts.push(`  ${e.description}`);
            });
        }
    }

    // Education
    if (profile.education) {
        let edu = profile.education;
        if (typeof edu === 'string') {
            try { edu = JSON.parse(edu); } catch (e) { edu = []; }
        }
        if (Array.isArray(edu) && edu.length > 0) {
            parts.push('\nEducation:');
            edu.forEach((e: any) => {
                parts.push(`- ${e.degree} from ${e.institution} (${e.dates})`);
            });
        }
    }

    // Skills
    if (profile.skills) {
        let skills = profile.skills;
        if (typeof skills === 'string') {
            try { skills = JSON.parse(skills); } catch (e) { skills = []; }
        }
        if (Array.isArray(skills) && skills.length > 0) {
            parts.push(`\nSkills:\n${skills.join(', ')}`);
        }
    }

    // Projects
    if (profile.projects) {
        let projects = profile.projects;
        if (typeof projects === 'string') {
            try { projects = JSON.parse(projects); } catch (e) { projects = []; }
        }
        if (Array.isArray(projects) && projects.length > 0) {
            parts.push('\nProjects:');
            projects.forEach((p: any) => {
                parts.push(`- ${p.name}: ${p.description}`);
            });
        }
    }

    return parts.join('\n');
}
