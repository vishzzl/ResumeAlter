import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
    content: string | null;
    error?: string;
    scrapeBlocked?: boolean; // true when auth-wall / bot-detection is suspected
}

// Phrases that indicate a login/bot-detection wall
const AUTH_WALL_SIGNALS = [
    'sign in', 'log in', 'login', 'create account', 'register to view',
    'please log in', 'access denied', 'captcha', 'verify you are human',
    'enable javascript', 'javascript is required',
];

function detectAuthWall(content: string): boolean {
    const lower = content.toLowerCase();
    // If content is very short OR contains multiple auth-wall signals, flag it
    const signalMatches = AUTH_WALL_SIGNALS.filter(s => lower.includes(s)).length;
    return content.length < 300 || signalMatches >= 2;
}

function isDisallowedHost(hostname: string): boolean {
    const lowered = hostname.toLowerCase();

    // Explicit localhost and IPv6 localhost
    if (lowered === 'localhost' || lowered === '::1') return true;

    // Reject direct IPv4 matches for private/local/link-local scopes
    // Cloud metadata: 169.254.169.254
    // Loopback: 127.x.x.x
    // Class A private: 10.x.x.x
    // Class B private: 172.16-31.x.x
    // Class C private: 192.168.x.x
    if (
        lowered.startsWith('127.') ||
        lowered.startsWith('10.') ||
        lowered.startsWith('192.168.') ||
        lowered === '169.254.169.254'
    ) {
        return true;
    }

    // Class B (172.16.0.0 - 172.31.255.255) needs more precise check
    const parts = lowered.split('.');
    if (parts.length === 4 && parts[0] === '172') {
        const secondOctet = parseInt(parts[1], 10);
        if (secondOctet >= 16 && secondOctet <= 31) return true;
    }

    return false;
}

export async function scrapeJobDescription(url: string): Promise<ScrapeResult> {
    try {
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            throw new Error('Invalid URL format');
        }

        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            throw new Error('Only HTTP and HTTPS protocols are permitted');
        }

        if (isDisallowedHost(parsedUrl.hostname)) {
            throw new Error('Scraping internal network resources is prohibited');
        }

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
            maxRedirects: 3, // Prevent infinite redirect loops or redirect SSRF bypasses
        });

        const $ = cheerio.load(data);

        // Attempt to find the main job description container
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

        // Fallback: get body text
        if (!content) {
            $('script, style, nav, footer, header, asides, iframe, noscript').remove();
            content = $('body').text().trim();
        }

        // Clean up excessive whitespace
        const cleaned = content.replace(/\s+/g, ' ').trim();

        // Quality check — detect auth-wall / bot-detection pages
        if (detectAuthWall(cleaned)) {
            console.warn(`Scrape quality check failed for ${url}: likely auth-wall or bot-detection (${cleaned.length} chars)`);
            return {
                content: null,
                scrapeBlocked: true,
                error: 'The job page appears to require a login or is blocking automated access. Please paste the job description manually.',
            };
        }

        return { content: cleaned };

    } catch (error) {
        console.error('Error scraping job description:', error);
        return {
            content: null,
            error: error instanceof Error ? error.message : 'Unknown error during scraping'
        };
    }
}
