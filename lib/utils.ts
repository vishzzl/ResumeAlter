import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { SkillMatchResult, FilteredExperience } from "../types/skill-mapping"
import { groupSkillsByCategory } from "./skill-matcher"


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function normalizeResumeText(text: string): string {
  const lines = text.split(/\r?\n/);
  const normalized: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') {
      normalized.push('');
      continue;
    }

    const prev = normalized[normalized.length - 1];
    if (!prev || prev === '') {
      normalized.push(line);
      continue;
    }

    if (/^(\*|[-•])\s|^#{1,6}\s|^\*\*Client:/i.test(line)) {
      normalized.push(line);
      continue;
    }

    if (/-$/.test(prev)) {
      normalized[normalized.length - 1] = prev.slice(0, -1) + line;
      continue;
    }

    if (/^(\*|[-•])\s/.test(prev)) {
      normalized[normalized.length - 1] = prev + ' ' + line;
      continue;
    }

    if (!/[\.\!\?]$/.test(prev)) {
      normalized[normalized.length - 1] = prev + ' ' + line;
      continue;
    }

    normalized.push(line);
  }

  return normalized.join('\n');
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      text += `${profile.certifications}\n\n`;
    }
  }

  return text;
}

export function formatFilteredProfileToText(
  profile: any,
  matchResult: SkillMatchResult,
  filteredExperience: FilteredExperience[]
): string {
  if (!profile) return '';

  let text = '';

  // Header — H1 + pipe-separated contact
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

  // Skills: grouped by category for matchedSkills
  if (matchResult.matchedSkills && matchResult.matchedSkills.length > 0) {
    text += `SKILLS\n`;
    const groups = groupSkillsByCategory(matchResult.matchedSkills);
    for (const [category, skillNames] of groups.entries()) {
      text += `${category}: ${skillNames.join(', ')}\n`;
    }
    text += '\n';
  } else {
    // Fallback if no matched skills (e.g. backward compatibility / empty list)
    if (profile.skills) {
      try {
        const skills = typeof profile.skills === 'string' ? JSON.parse(profile.skills) : profile.skills;
        if (Array.isArray(skills) && skills.length > 0) {
          text += `SKILLS\n${skills.join(', ')}\n\n`;
        } else if (typeof skills === 'object') {
          text += `SKILLS\n`;
          Object.entries(skills).forEach(([category, items]) => {
            if (Array.isArray(items)) {
              text += `${category}: ${items.join(', ')}\n`;
            }
          });
          text += '\n';
        }
      } catch {
        text += `SKILLS\n${profile.skills}\n\n`;
      }
    }
  }

  // Experience: use filteredExperience entries
  if (filteredExperience && filteredExperience.length > 0) {
    text += `EXPERIENCE\n`;
    filteredExperience.forEach((exp: FilteredExperience) => {
      text += `**${exp.company || 'Company'}** | **${exp.role || 'Role'}** | **${exp.dates || ''}**\n\n`;

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
  } else if (profile.experience) {
    // Fallback: raw experience
    text += `EXPERIENCE\n`;
    try {
      const experience = typeof profile.experience === 'string' ? JSON.parse(profile.experience) : profile.experience;
      if (Array.isArray(experience)) {
        experience.forEach((exp: any) => {
          text += `**${exp.company || 'Company'}** | **${exp.role || 'Role'}** | **${exp.dates || ''}**\n\n`;
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      text += `${profile.certifications}\n\n`;
    }
  }

  return text;
}

export function formatProfileToMarkdownForPDF(profile: any): string {
  if (!profile) return '';

  let markdown = '';

  // 1. Header (Markdown H1 + contact rows)
  if (profile.name) markdown += `# ${profile.name}\n`;
  const contactParts: string[] = [];
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.linkedin) contactParts.push(`[LinkedIn](${profile.linkedin})`);
  if (profile.website) contactParts.push(`[Website](${profile.website})`);
  if (contactParts.length > 0) {
    markdown += `${contactParts.join(' | ')}\n`;
  }
  markdown += '\n';

  // 2. Summary
  if (profile.summary && profile.summary.trim()) {
    markdown += `## Summary\n${normalizeResumeText(profile.summary.trim())}\n\n`;
  }

  // 3. Skills
  if (profile.skills) {
    let skillsMarkdown = '';
    try {
      const skills = typeof profile.skills === 'string' ? JSON.parse(profile.skills) : profile.skills;
      if (Array.isArray(skills) && skills.length > 0) {
        skillsMarkdown += `**Skills**: ${skills.join(', ')}\n`;
      } else if (typeof skills === 'object' && skills !== null) {
        Object.entries(skills).forEach(([category, items]) => {
          if (Array.isArray(items) && items.length > 0) {
            skillsMarkdown += `**${category}**: ${items.join(', ')}\n`;
          } else if (typeof items === 'string' && items.trim()) {
            skillsMarkdown += `**${category}**: ${items.trim()}\n`;
          }
        });
      } else if (typeof skills === 'string' && skills.trim()) {
        skillsMarkdown += `**Skills**: ${skills.trim()}\n`;
      }
    } catch {
      if (typeof profile.skills === 'string' && profile.skills.trim()) {
        skillsMarkdown += `**Skills**: ${profile.skills.trim()}\n`;
      }
    }
    if (skillsMarkdown) {
      markdown += `## Skills\n${skillsMarkdown}\n`;
    }
  }

  // 4. Experience
  if (profile.experience) {
    try {
      const experience = typeof profile.experience === 'string' ? JSON.parse(profile.experience) : profile.experience;
      if (Array.isArray(experience) && experience.length > 0) {
        markdown += `## Experience\n`;
        experience.forEach((exp: any) => {
          // Company | Role | Dates header
          const company = normalizeResumeText(String(exp.company || 'Company'));
          const role = normalizeResumeText(String(exp.role || 'Role'));
          const dates = normalizeResumeText(String(exp.dates || ''));
          markdown += `**${company}** | **${role}** | **${dates}**\n\n`;

          // General description bullets
          if (exp.description) {
            normalizeResumeText(exp.description).split('\n').filter((l: string) => l.trim()).forEach((line: string) => {
              const clean = line.replace(/^[\s\-\*•]+/, '').trim();
              if (clean) markdown += `* ${clean}\n`;
            });
          }
          if (exp.highlights && Array.isArray(exp.highlights)) {
            exp.highlights.forEach((h: string) => {
              if (h && h.trim()) markdown += `* ${h.trim()}\n`;
            });
          }

          // Client sub-sections
          if (Array.isArray(exp.clients) && exp.clients.length > 0) {
            exp.clients.forEach((client: any) => {
              const label = [client.name, client.domain].filter(Boolean).join(' - ');
              if (label) markdown += `\n**Client:** ${label}\n\n`;
              if (client.description) {
                normalizeResumeText(client.description).split('\n').filter((l: string) => l.trim()).forEach((line: string) => {
                  const clean = line.replace(/^[\s\-\*•]+/, '').trim();
                  if (clean) markdown += `* ${clean}\n`;
                });
              }
            });
          }
          markdown += '\n';
        });
      }
    } catch {}
  }

  // 5. Education
  if (profile.education) {
    try {
      const education = typeof profile.education === 'string' ? JSON.parse(profile.education) : profile.education;
      if (Array.isArray(education) && education.length > 0) {
        markdown += `## Education\n`;
        education.forEach((edu: any) => {
          const degreeAndField = [edu.degree, edu.field].filter(Boolean).join(' in ');
          markdown += `**${edu.institution || edu.school || 'University'}** | **${degreeAndField || 'Degree'}** | **${edu.dates || ''}**\n\n`;
          if (edu.description) {
            normalizeResumeText(edu.description).split('\n').filter((l: string) => l.trim()).forEach((line: string) => {
              markdown += `* ${line.trim()}\n`;
            });
          }
          markdown += '\n';
        });
      }
    } catch {}
  }

  // 6. Projects
  if (profile.projects) {
    try {
      const projects = typeof profile.projects === 'string' ? JSON.parse(profile.projects) : profile.projects;
      if (Array.isArray(projects) && projects.length > 0) {
        markdown += `## Projects\n`;
        projects.forEach((proj: any) => {
          const projectName = normalizeResumeText(String(proj.name || 'Project'));
          const techStr = Array.isArray(proj.technologies) ? proj.technologies.join(', ') : normalizeResumeText(String(proj.technologies || ''));
          const urlStr = proj.url ? normalizeResumeText(String(proj.url)) : '';
          markdown += `**${projectName}** | **${techStr}** | **${urlStr}**\n\n`;
          if (proj.description) {
            normalizeResumeText(proj.description).split('\n').filter((l: string) => l.trim()).forEach((line: string) => {
              const clean = line.replace(/^[\s\-\*•]+/, '').trim();
              if (clean) markdown += `* ${clean}\n`;
            });
          }
          markdown += '\n';
        });
      }
    } catch {}
  }

  // 7. Certifications
  if (profile.certifications) {
    try {
      const certifications = typeof profile.certifications === 'string' ? JSON.parse(profile.certifications) : profile.certifications;
      if (Array.isArray(certifications) && certifications.length > 0) {
        markdown += `## Certifications\n`;
        certifications.forEach((cert: any) => {
          markdown += `**${cert.name}** | **${cert.issuer || ''}** | **${cert.date || ''}**\n\n`;
          if (cert.url) {
            markdown += `* [Credential Link](${cert.url})\n`;
          }
          markdown += '\n';
        });
      }
    } catch {}
  }

  return markdown.trim() + '\n';
}

