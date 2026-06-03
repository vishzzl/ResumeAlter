const fs = require('fs');
const path = require('path');

const logFilePath = 'C:\\Users\\2vish\\.gemini\\antigravity\\brain\\78af904e-d014-4b3b-b2be-cd9e277963de\\.system_generated\\logs\\transcript.jsonl';
const outputMdPath = 'c:\\Users\\2vish\\Repos\\ResumeAlter\\conversation_transcript.md';
const outputJsonPath = 'c:\\Users\\2vish\\Repos\\ResumeAlter\\conversation_transcript.json';

function cleanUserContent(content) {
    if (!content) return '';
    // Extract text between <USER_REQUEST> and </USER_REQUEST> if present
    const match = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
    if (match) {
        return match[1].trim();
    }
    return content.trim();
}

function run() {
    try {
        if (!fs.existsSync(logFilePath)) {
            console.error(`Error: Log file not found at ${logFilePath}`);
            process.exit(1);
        }

        const lines = fs.readFileSync(logFilePath, 'utf8').split('\n');
        const chatTurns = [];
        let currentAssistantContent = '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const step = JSON.parse(line);
                
                if (step.source === 'USER_EXPLICIT' && step.type === 'USER_INPUT') {
                    // Save accumulated assistant response first if it exists
                    if (currentAssistantContent.trim()) {
                        chatTurns.push({
                            role: 'assistant',
                            content: currentAssistantContent.trim()
                        });
                        currentAssistantContent = '';
                    }
                    
                    const cleanText = cleanUserContent(step.content);
                    if (cleanText) {
                        chatTurns.push({
                            role: 'user',
                            content: cleanText
                        });
                    }
                } else if (step.source === 'MODEL' && step.type === 'PLANNER_RESPONSE') {
                    // Accumulate planner response content
                    if (step.content) {
                        currentAssistantContent += step.content + '\n';
                    }
                }
            } catch (err) {
                // Ignore parse errors on individual lines
            }
        }

        // Add any remaining assistant response
        if (currentAssistantContent.trim()) {
            chatTurns.push({
                role: 'assistant',
                content: currentAssistantContent.trim()
            });
        }

        // 1. Generate Markdown Transcript
        let markdownContent = `# Antigravity Conversation Transcript\n\n`;
        markdownContent += `*Conversation ID: 78af904e-d014-4b3b-b2be-cd9e277963de*\n`;
        markdownContent += `*Generated on: ${new Date().toLocaleString()}*\n\n`;
        markdownContent += `This transcript contains the clean dialogue history between the user and Antigravity (the coding assistant), formatted for easy reading or ingestion by other AI models.\n\n`;
        markdownContent += `---\n\n`;

        for (const turn of chatTurns) {
            if (turn.role === 'user') {
                markdownContent += `## 👤 USER\n\n${turn.content}\n\n`;
            } else {
                markdownContent += `## 🤖 ANTIGRAVITY\n\n${turn.content}\n\n`;
            }
            markdownContent += `---\n\n`;
        }

        fs.writeFileSync(outputMdPath, markdownContent, 'utf8');
        console.log(`Successfully wrote Markdown transcript to ${outputMdPath}`);

        // 2. Generate clean JSON Chat History
        fs.writeFileSync(outputJsonPath, JSON.stringify(chatTurns, null, 2), 'utf8');
        console.log(`Successfully wrote JSON chat history to ${outputJsonPath}`);

    } catch (error) {
        console.error('Failed to parse transcript:', error);
    }
}

run();
