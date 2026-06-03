import { scrapeJobDescription } from '../lib/scraper';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
    console.log("==========================================");
    console.log("Verifying Job Scraper with Jina integration");
    console.log("==========================================\n");

    const testUrls = [
        // LinkedIn job URL (typically fails with standard axios, should succeed with Jina)
        "https://www.linkedin.com/jobs/view/4096053706/",
        // Lever or Greenhouse URL (usually easy to scrape, but let's see how Jina handles it)
        "https://jobs.lever.co/lever/11111111-2222-3333-4444-555555555555" // Mock Lever URL
    ];

    for (const url of testUrls) {
        console.log(`Scraping URL: ${url}`);
        const startTime = Date.now();
        const result = await scrapeJobDescription(url);
        const duration = Date.now() - startTime;
        
        console.log(`Completed in ${duration}ms`);
        if (result.content) {
            console.log(`[SUCCESS] Scraped ${result.content.length} characters.`);
            console.log(`Snippet:\n${result.content.substring(0, 300)}...\n`);
        } else {
            console.log(`[FAILED] Error: ${result.error}`);
            console.log(`Blocked: ${result.scrapeBlocked}\n`);
        }
        console.log("------------------------------------------");
    }
}

run();
