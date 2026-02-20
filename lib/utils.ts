import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatProfileToText(profile: any): string {
  if (!profile) return '';

  let text = '';

  // Contact Info
  if (profile.name) text += `${profile.name}\n`;
  if (profile.email) text += `Email: ${profile.email}\n`;
  if (profile.phone) text += `Phone: ${profile.phone}\n`;
  if (profile.linkedin) text += `LinkedIn: ${profile.linkedin}\n`;
  if (profile.website) text += `Website: ${profile.website}\n`;
  text += '\n';

  // Summary
  if (profile.summary) {
    text += `SUMMARY\n${profile.summary}\n\n`;
  }

  // Skills
  if (profile.skills) {
    try {
      const skills = typeof profile.skills === 'string' ? JSON.parse(profile.skills) : profile.skills;
      if (Array.isArray(skills) && skills.length > 0) {
        text += `SKILLS\n${skills.join(', ')}\n\n`;
      } else if (typeof skills === 'object') {
        // Handle structured skills (e.g. { languages: [], frameworks: [] })
        text += `SKILLS\n`;
        Object.entries(skills).forEach(([category, items]) => {
          if (Array.isArray(items)) {
            text += `${category}: ${items.join(', ')}\n`;
          }
        });
        text += '\n';
      }
    } catch (e) {
      // If parsing fails, just append raw string if it's not JSON
      text += `SKILLS\n${profile.skills}\n\n`;
    }
  }

  // Experience
  if (profile.experience) {
    text += `EXPERIENCE\n`;
    try {
      const experience = typeof profile.experience === 'string' ? JSON.parse(profile.experience) : profile.experience;
      if (Array.isArray(experience)) {
        experience.forEach((exp: any) => {
          text += `${exp.role} at ${exp.company}\n`;
          text += `${exp.dates || ''}\n`;
          if (exp.description) text += `${exp.description}\n`;
          if (exp.highlights && Array.isArray(exp.highlights)) {
            exp.highlights.forEach((h: string) => text += `- ${h}\n`);
          }
          text += '\n';
        });
      }
    } catch (e) {
      text += `${profile.experience}\n\n`;
    }
  }

  // Education
  if (profile.education) {
    text += `EDUCATION\n`;
    try {
      const education = typeof profile.education === 'string' ? JSON.parse(profile.education) : profile.education;
      if (Array.isArray(education)) {
        education.forEach((edu: any) => {
          text += `${edu.degree} in ${edu.field}\n`;
          text += `${edu.school}, ${edu.dates || ''}\n`;
          if (edu.description) text += `${edu.description}\n`;
          text += '\n';
        });
      }
    } catch (e) {
      text += `${profile.education}\n\n`;
    }
  }

  // Projects
  if (profile.projects) {
    text += `PROJECTS\n`;
    try {
      const projects = typeof profile.projects === 'string' ? JSON.parse(profile.projects) : profile.projects;
      if (Array.isArray(projects)) {
        projects.forEach((proj: any) => {
          text += `${proj.name}\n`;
          if (proj.url) text += `${proj.url}\n`;
          if (proj.description) text += `${proj.description}\n`;
          if (proj.technologies && Array.isArray(proj.technologies)) {
            text += `Technologies: ${proj.technologies.join(', ')}\n`;
          }
          text += '\n';
        });
      }
    } catch (e) {
      text += `${profile.projects}\n\n`;
    }
  }

  // Certifications
  if (profile.certifications) {
    text += `CERTIFICATIONS\n`;
    try {
      const certifications = typeof profile.certifications === 'string' ? JSON.parse(profile.certifications) : profile.certifications;
      if (Array.isArray(certifications)) {
        certifications.forEach((cert: any) => {
          text += `${cert.name} - ${cert.issuer}\n`;
          if (cert.date) text += `${cert.date}\n`;
          if (cert.url) text += `${cert.url}\n`;
          text += '\n';
        });
      }
    } catch (e) {
      text += `${profile.certifications}\n\n`;
    }
  }

  return text;
}
