
import { parseResumeSections } from '../lib/resume-parser';

const sampleResume = `
John Doe
123 Main St, Anytown, USA
john.doe@email.com

Summary
Experienced software engineer with 5 years of experience in full-stack development.
Skilled in React, Node.js, and Python.

Experience
Software Engineer | Tech Corp | 2020 - Present
- Developed scalable web applications using Next.js.
- Improved API performance by 30%.

Junior Developer | Startup Inc | 2018 - 2020
- Built frontend components using React.
- Collaborated with UX designers.

Skills
JavaScript, TypeScript, Python, SQL, AWS, Docker

Education
BS Computer Science | University of Technology | 2014 - 2018

Projects
Personal Portfolio
- Built a personal website using Gatsby.

Awards
Best Employee 2021
`;

console.log("Testing Resume Parser...");
const sections = parseResumeSections(sampleResume);

console.log("---------------------------------------------------");
console.log("Header:", sections.header.trim());
console.log("---------------------------------------------------");
console.log("Summary:", sections.summary.trim());
console.log("---------------------------------------------------");
console.log("Experience:", sections.experience.trim());
console.log("---------------------------------------------------");
console.log("Skills:", sections.skills.trim());
console.log("---------------------------------------------------");
console.log("Education:", sections.education.trim());
console.log("---------------------------------------------------");
console.log("Projects:", sections.projects.trim());
console.log("---------------------------------------------------");
console.log("Other:", sections.other.trim());
console.log("---------------------------------------------------");
