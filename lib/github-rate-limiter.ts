import * as fs from 'fs';
import * as path from 'path';

interface TierState {
    date: string;
    dailyCount: number;
    timestamps: number[]; // Timestamps of requests in the last 60 seconds
}

interface RateLimitState {
    high: TierState;
    low: TierState;
}

const LIMITS = {
    high: {
        rpm: 10,
        rpd: 50,
        concurrency: 1, // Absolute safe margin (GitHub limit is 5)
    },
    low: {
        rpm: 15,
        rpd: 150,
        concurrency: 2, // Absolute safe margin (GitHub limit is 5)
    }
};

const STATE_FILE_PATH = path.join(process.cwd(), 'scratch', 'github-rate-limits.json');

// Memory queues for concurrency lock
const activeRequests = { high: 0, low: 0 };
const pendingQueues: { high: (() => void)[]; low: (() => void)[] } = { high: [], low: [] };

/**
 * Initialize or load rate limit state from persistent local storage
 */
function loadState(): RateLimitState {
    const today = new Date().toISOString().split('T')[0];
    const defaultState: RateLimitState = {
        high: { date: today, dailyCount: 0, timestamps: [] },
        low: { date: today, dailyCount: 0, timestamps: [] }
    };

    try {
        const dir = path.dirname(STATE_FILE_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(STATE_FILE_PATH)) {
            const data = JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf-8')) as RateLimitState;
            
            // Validate structure & handle new day reset
            const state = { ...defaultState };
            
            if (data.high && data.high.date === today) {
                state.high = {
                    date: today,
                    dailyCount: data.high.dailyCount || 0,
                    timestamps: Array.isArray(data.high.timestamps) ? data.high.timestamps : []
                };
            }
            if (data.low && data.low.date === today) {
                state.low = {
                    date: today,
                    dailyCount: data.low.dailyCount || 0,
                    timestamps: Array.isArray(data.low.timestamps) ? data.low.timestamps : []
                };
            }
            
            return state;
        }
    } catch (err) {
        console.error('[GitHub Models Rate Limiter] Failed to load rate limit state:', err);
    }

    return defaultState;
}

/**
 * Save rate limit state to local file
 */
function saveState(state: RateLimitState) {
    try {
        fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
        console.error('[GitHub Models Rate Limiter] Failed to save rate limit state:', err);
    }
}

/**
 * Prune timestamps older than 60 seconds
 */
function pruneTimestamps(timestamps: number[]): number[] {
    const oneMinuteAgo = Date.now() - 60000;
    return timestamps.filter(t => t > oneMinuteAgo);
}

/**
 * Check if the model is high or low tier based on naming heuristics
 */
export function getModelTier(modelName: string): 'high' | 'low' {
    const name = modelName.toLowerCase();
    
    // Low tier checks (e.g. mini, 8b, phi, mistral, cohere-command-r)
    if (
        name.includes('mini') ||
        name.includes('8b') ||
        name.includes('phi') ||
        (name.includes('command-r') && !name.includes('plus')) ||
        name.includes('gemma-2-9b') ||
        name.includes('mistral-7b')
    ) {
        return 'low';
    }
    
    // Default to high tier for safety if we are unsure (stricter limits)
    return 'high';
}

/**
 * Executes a GitHub Model API call, strictly honoring daily, minute, and concurrency limits.
 */
export async function executeWithRateLimits<T>(
    modelName: string,
    executeFn: () => Promise<T>
): Promise<T> {
    const tier = getModelTier(modelName);
    const limits = LIMITS[tier];

    // 1. Check daily limit immediately before queueing
    let state = loadState();
    let tierState = state[tier];
    
    if (tierState.dailyCount >= limits.rpd) {
        throw new Error(
            `[GitHub Models Rate Limiter] Daily request limit exceeded for ${tier}-tier models. ` +
            `Used: ${tierState.dailyCount}/${limits.rpd}. Please try again tomorrow or switch providers.`
        );
    }

    // 2. Concurrency Control lock
    if (activeRequests[tier] >= limits.concurrency) {
        console.log(`[GitHub Models Rate Limiter] Concurrency limit reached for ${tier}-tier. Queueing request...`);
        await new Promise<void>((resolve) => {
            pendingQueues[tier].push(resolve);
        });
    }

    activeRequests[tier]++;

    try {
        // 3. RPM (Requests Per Minute) sliding window check & throttling loop
        while (true) {
            state = loadState();
            tierState = state[tier];
            
            // Clean up old requests
            tierState.timestamps = pruneTimestamps(tierState.timestamps);
            
            if (tierState.timestamps.length < limits.rpm) {
                // We are under the RPM limit! Break the loop and proceed.
                break;
            }

            // We are at the RPM limit. Calculate wait time until the oldest request falls off the 60s window.
            const oldestTimestamp = tierState.timestamps[0];
            const timeElapsedSinceOldest = Date.now() - oldestTimestamp;
            const waitTimeMs = Math.max(100, 60000 - timeElapsedSinceOldest + 100); // 100ms safety buffer

            console.warn(
                `[GitHub Models Rate Limiter] RPM limit near! ${tierState.timestamps.length}/${limits.rpm} requests active. ` +
                `Sleeping for ${(waitTimeMs / 1000).toFixed(1)}s to protect GitHub API from rate-limiting...`
            );
            
            await new Promise(res => setTimeout(res, waitTimeMs));
        }

        // 4. Register the request in persistent state
        state = loadState();
        tierState = state[tier];
        tierState.timestamps = pruneTimestamps(tierState.timestamps);
        
        // Double check daily limit one last time
        if (tierState.dailyCount >= limits.rpd) {
            throw new Error(
                `[GitHub Models Rate Limiter] Daily request limit reached during throttling. ` +
                `Used: ${tierState.dailyCount}/${limits.rpd}.`
            );
        }

        const now = Date.now();
        tierState.timestamps.push(now);
        tierState.dailyCount++;
        saveState(state);

        console.log(
            `[GitHub Models Rate Limiter] Dispatching ${tier}-tier request. ` +
            `Daily count: ${tierState.dailyCount}/${limits.rpd}. ` +
            `Requests in last 60s: ${tierState.timestamps.length}/${limits.rpm}.`
        );

        // 5. Execute the actual call
        return await executeFn();

    } finally {
        // Release concurrency lock
        activeRequests[tier]--;
        
        // Process next in queue
        if (pendingQueues[tier].length > 0) {
            const nextResolve = pendingQueues[tier].shift();
            if (nextResolve) nextResolve();
        }
    }
}
