import { optimizeResume } from '../lib/optimization-agent';
import { AgentInput } from '../types/optimization';

async function main() {
    const input: AgentInput = {
        originalResume: `
John Doe
Software Engineer
Experience: 3 years building web apps using React and Node.js.
Skills: JavaScript, HTML, CSS.
        `.trim(),
        jobDescription: `
Frontend Developer
We are looking for a skilled Frontend Developer proficient in React, Next.js, and modern CSS (Tailwind).
You should have a strong understanding of web performance and accessibility.
        `.trim()
    };

    console.log("Starting Resume Optimization...");
    try {
        const result = await optimizeResume(input);
        console.log("\n=========================");
        console.log("OPTIMIZATION COMPLETE!");
        console.log("=========================\n");
        console.log(`Winning Model: ${result.winningModel}`);
        console.log(`Final Score: ${result.finalScore.toFixed(4)}\n`);
        console.log("Candidate Scores:");
        console.table(result.candidateResumes);
        console.log("\nBest Resume Output:\n");
        console.log(result.bestResume);
    } catch (error) {
        console.error("Pipeline Error:", error);
    }
}

main();
