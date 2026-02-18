import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scrapeJobDescription(url: string): Promise<{ content: string | null; error?: string }> {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
            },
            timeout: 10000, // 10s timeout
        });

        const $ = cheerio.load(data);

        // Attempt to find the main job description container
        // These selectors are common but might need to be adjusted for specific sites
        const selectors = [
            '.job-description',
            '#job-description',
            '[class*="description"]',
            'article',
            'main',
            '.content',
            '#job-details',
            '.job-details',
        ];

        let content = '';

        for (const selector of selectors) {
            if ($(selector).length > 0) {
                content = $(selector).text().trim();
                break;
            }
        }

        // Fallback: if no specific container found, get body text but clean it up
        if (!content) {
            $('script, style, nav, footer, header, asides, iframe, noscript').remove();
            content = $('body').text().trim();
        }

        // Clean up excessive whitespace
        const cleaned = content.replace(/\s+/g, ' ').trim();
        return { content: cleaned };

    } catch (error) {
        console.error('Error scraping job description:', error);
        return {
            content: null,
            error: error instanceof Error ? error.message : 'Unknown error during scraping'
        };
    }
}
