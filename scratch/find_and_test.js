const axios = require('axios');
const cheerio = require('cheerio');

async function run() {
    try {
        console.log("Fetching Figma Greenhouse job board...");
        const res = await axios.get("https://boards.greenhouse.io/figma");
        const $ = cheerio.load(res.data);
        const links = [];
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href && href.includes('/figma/jobs/')) {
                if (href.startsWith('http')) {
                    links.push(href);
                } else {
                    links.push("https://boards.greenhouse.io" + href);
                }
            }
        });

        console.log("Found job links:", links.slice(0, 3));
        if (links.length > 0) {
            const targetJob = links[0];
            console.log("\nTesting scrape on real job URL:", targetJob);
            
            // Test with Jina Reader
            const jinaUrl = `https://r.jina.ai/${targetJob}`;
            console.log(`Sending request to: ${jinaUrl}`);
            const jinaRes = await axios.get(jinaUrl, {
                headers: { 'Accept': 'application/json' },
                timeout: 25000 // Give it enough time
            });
            
            console.log("Jina Scrape Status:", jinaRes.status);
            if (jinaRes.data && jinaRes.data.data && jinaRes.data.data.content) {
                console.log("Jina Scraped Content Length:", jinaRes.data.data.content.length);
                console.log("Snippet:\n", jinaRes.data.data.content.substring(0, 500));
            } else {
                console.log("Jina Response did not have data.content:", JSON.stringify(jinaRes.data).substring(0, 300));
            }
        } else {
            console.log("No job links found on the page.");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

run();
