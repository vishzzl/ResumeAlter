import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatProfileToText(profile: any): string {
  if (!profile) return '';

  let text = '';

  // Header — Markdown H1 + pipe-separated contact (matches tailor prompt & resume-parser expectations)
  if (profile.name) text += `# ${profile.name}\n`;
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.linkedin) contactParts.push(`[LinkedIn](${profile.linkedin})`);
  if (profile.website) contactParts.push(`[Website](${profile.website})`);
  if (contactParts.length > 0) text += `${contactParts.join(' | ')}\n`;
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
          // Company | Role | Dates header (matches tailor prompt format)
          text += `**${exp.company || 'Company'}** | **${exp.role || 'Role'}** | **${exp.dates || ''}**\n\n`;

          // General description (not client-specific)
          if (exp.description) {
            exp.description.split('\n').filter((l: string) => l.trim()).forEach((line: string) => {
              const clean = line.replace(/^[\s\-\*•]+/, '').trim();
              if (clean) text += `* ${clean}\n`;
            });
          }
          if (exp.highlights && Array.isArray(exp.highlights)) {
            exp.highlights.forEach((h: string) => {
              if (h && h.trim()) text += `* ${h.trim()}\n`;
            });
          }

          // Client sub-sections
          if (Array.isArray(exp.clients) && exp.clients.length > 0) {
            exp.clients.forEach((client: any) => {
              const label = [client.name, client.domain].filter(Boolean).join(' - ');
              if (label) text += `\n**Client:** ${label}\n\n`;
              if (client.description) {
                client.description.split('\n').filter((l: string) => l.trim()).forEach((line: string) => {
                  const clean = line.replace(/^[\s\-\*•]+/, '').trim();
                  if (clean) text += `* ${clean}\n`;
                });
              }
            });
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
