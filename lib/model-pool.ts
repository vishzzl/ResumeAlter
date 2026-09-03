/**
 * @file model-pool.ts
 * @description Cyclic model pool manager for routing calls across Gemini and GitHub Models.
 */

import { getGeminiModel } from './gemini';
import { callGitHubModels } from './github_models';

export type TaskType = 'summary' | 'skills' | 'experience' | 'verification' | 'gap_fix';
export type ModelId = 
  | 'gemini-3.8-flash'
  | 'gemini-3.7-flash'
  | 'gemini-3.6-flash'
  | 'gemini-3.5-flash'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-flash-lite'
  | 'gemini-2.5-flash'
  | 'gemini-1.5-flash'
  | 'gemini-2.0-flash-lite'
  | 'gemini-1.5-pro';

export type PoolStatus = Record<ModelId, {
    callsInWindow: number;
    rpmLimit: number;
    available: boolean;
    nextAvailableAt: number; // epoch ms
}>;

export class QuotaExhaustedError extends Error {
    retryAfterMs: number;
    constructor(message: string, retryAfterMs: number) {
        super(message);
        this.name = 'QuotaExhaustedError';
        this.retryAfterMs = retryAfterMs;
    }
}

// Routing Table (Gemini models fallback chain per task type)
const ROUTING_TABLE: Record<TaskType, ModelId[]> = {
    summary: ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-1.5-flash'],
    skills: ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-1.5-flash'],
    experience: ['gemini-2.5-flash', 'gemini-3.7-flash', 'gemini-1.5-flash'],
    verification: ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash'],
    gap_fix: ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-1.5-flash']
};

const RPM_LIMITS: Record<ModelId, number> = {
    'gemini-3.8-flash': 15,
    'gemini-3.7-flash': 15,
    'gemini-3.6-flash': 15,
    'gemini-3.5-flash': 15,
    'gemini-3.5-flash-lite': 30,
    'gemini-3.1-flash-lite': 30,
    'gemini-2.5-flash': 15,
    'gemini-1.5-flash': 15,
    'gemini-2.0-flash-lite': 30,
    'gemini-1.5-pro': 10
};

export class ModelPoolManager {
    private callTimestamps = new Map<ModelId, number[]>();
    private nextAvailableAt = new Map<ModelId, number>();
    private lastUsedIndices: Record<TaskType, number> = {
        summary: -1,
        skills: -1,
        experience: -1,
        verification: -1,
        gap_fix: -1
    };

    public geminiApiKey?: string;
    public githubApiKey?: string;

    // Dependency injection for test execution
    private fetchFn?: (modelId: ModelId, systemPrompt: string, userPrompt: string, jsonMode: boolean, temp: number) => Promise<string>;

    constructor(
        fetchFn?: (modelId: ModelId, systemPrompt: string, userPrompt: string, jsonMode: boolean, temp: number) => Promise<string>
    ) {
        this.fetchFn = fetchFn;
        // Initialize maps
        for (const modelId of Object.keys(RPM_LIMITS) as ModelId[]) {
            this.callTimestamps.set(modelId, []);
            this.nextAvailableAt.set(modelId, 0);
        }
    }

    /**
     * Cleans call timestamps older than 60 seconds.
     */
    private pruneTimestamps(modelId: ModelId, now: number): number[] {
        const list = this.callTimestamps.get(modelId) || [];
        const filtered = list.filter(ts => now - ts < 60000);
        this.callTimestamps.set(modelId, filtered);
        return filtered;
    }

    /**
     * Checks if a model is available to receive calls.
     */
    public isModelAvailable(modelId: ModelId, now: number = Date.now()): boolean {
        const nextAvail = this.nextAvailableAt.get(modelId) || 0;
        if (now < nextAvail) return false;

        const activeCalls = this.pruneTimestamps(modelId, now);
        const limit = RPM_LIMITS[modelId];
        // Must stay below limit minus 1-call safety buffer (i.e. limit - 1)
        return activeCalls.length < limit - 1;
    }

    /**
     * Records a successful or attempted call on a model.
     */
    public recordCall(modelId: ModelId, now: number = Date.now()): void {
        const list = this.callTimestamps.get(modelId) || [];
        list.push(now);
        this.callTimestamps.set(modelId, list);
    }

    /**
     * Temporarily marks a model as exhausted (e.g. after a 429).
     */
    public markAsExhausted(modelId: ModelId, now: number = Date.now()): void {
        this.nextAvailableAt.set(modelId, now + 60000);
        // Fill the window to enforce availability check block
        const list = this.callTimestamps.get(modelId) || [];
        const limit = RPM_LIMITS[modelId];
        while (list.length < limit) {
            list.push(now);
        }
        this.callTimestamps.set(modelId, list);
    }

    /**
     * Resets pool tracking (primarily for unit tests).
     */
    public reset(): void {
        this.callTimestamps.clear();
        this.nextAvailableAt.clear();
        for (const modelId of Object.keys(RPM_LIMITS) as ModelId[]) {
            this.callTimestamps.set(modelId, []);
            this.nextAvailableAt.set(modelId, 0);
        }
        this.lastUsedIndices = {
            summary: -1,
            skills: -1,
            experience: -1,
            verification: -1,
            gap_fix: -1
        };
    }

    /**
     * Returns the current pool usage status.
     */
    public getPoolStatus(now: number = Date.now()): PoolStatus {
        const status = {} as PoolStatus;
        for (const modelId of Object.keys(RPM_LIMITS) as ModelId[]) {
            const activeCalls = this.pruneTimestamps(modelId, now);
            const limit = RPM_LIMITS[modelId];
            const nextAvail = this.nextAvailableAt.get(modelId) || 0;
            const available = now >= nextAvail && activeCalls.length < limit - 1;

            status[modelId] = {
                callsInWindow: activeCalls.length,
                rpmLimit: limit,
                available,
                nextAvailableAt: nextAvail
            };
        }
        return status;
    }

    /**
     * Selects the next available model in the task's routing chain (round-robin).
     */
    private selectModel(taskType: TaskType, now: number = Date.now()): ModelId | null {
        const chain = ROUTING_TABLE[taskType];
        const chainLength = chain.length;
        const startIndex = (this.lastUsedIndices[taskType] + 1) % chainLength;

        for (let i = 0; i < chainLength; i++) {
            const idx = (startIndex + i) % chainLength;
            const modelId = chain[idx];
            if (this.isModelAvailable(modelId, now)) {
                this.lastUsedIndices[taskType] = idx;
                return modelId;
            }
        }
        return null;
    }

    /**
     * Resolves the QuotaExhaustedError parameters when all chain models are busy.
     */
    private getQuotaExhaustedError(taskType: TaskType, now: number = Date.now()): QuotaExhaustedError {
        const chain = ROUTING_TABLE[taskType];
        let minAvailableTime = Infinity;

        for (const modelId of chain) {
            const nextAvail = this.nextAvailableAt.get(modelId) || 0;
            const activeCalls = this.pruneTimestamps(modelId, now);
            const oldestCall = activeCalls.length > 0 ? activeCalls[0] + 60000 : now + 60000;

            const time = Math.max(nextAvail, oldestCall);
            if (time < minAvailableTime) {
                minAvailableTime = time;
            }
        }

        const retryAfterMs = Math.max(1000, minAvailableTime - now);
        return new QuotaExhaustedError(
            `All models in the routing chain for task "${taskType}" are currently exhausted. Please retry later.`,
            retryAfterMs
        );
    }

    /**
     * Executes the actual HTTP fetch or SDK invocation for a model.
     */
    private async executeFetch(
        modelId: ModelId,
        systemPrompt: string,
        userPrompt: string,
        jsonMode: boolean,
        temp: number
    ): Promise<string> {
        if (this.fetchFn) {
            return await this.fetchFn(modelId, systemPrompt, userPrompt, jsonMode, temp);
        }

        // Direct integration with Gemini SDK or GitHub models Azure endpoint
        const isGemini = modelId.startsWith('gemini');
        if (isGemini) {
            const model = getGeminiModel(
                this.geminiApiKey,
                modelId,
                {
                    temperature: temp,
                    ...(jsonMode ? { responseMimeType: 'application/json' } : {})
                },
                systemPrompt
            );
            if (!model) throw new Error(`Failed to initialize Gemini model "${modelId}"`);
            const result = await model.generateContent(userPrompt);
            return result.response.text();
        } else {
            // GitHub Azure Models
            return await callGitHubModels({
                model: modelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: temp,
                apiKey: this.githubApiKey,
                caller: 'model-pool',
                ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
            });
        }
    }

    /**
     * Calls the model pool to execute an LLM task.
     * Handles 429 transparent retries and fallback chains.
     */
    public async call(
        taskType: TaskType,
        systemPrompt: string,
        userPrompt: string
    ): Promise<string> {
        const chain = ROUTING_TABLE[taskType];
        const jsonMode = taskType !== 'summary';
        const temp = taskType === 'summary' ? 0.3 : 0.2;

        let attempt = 0;
        const triedModels = new Set<ModelId>();

        while (attempt < chain.length) {
            const now = Date.now();
            const modelId = this.selectModel(taskType, now);
            
            if (!modelId || triedModels.has(modelId)) {
                throw this.getQuotaExhaustedError(taskType, now);
            }

            triedModels.add(modelId);
            this.recordCall(modelId, now);

            try {
                return await this.executeFetch(modelId, systemPrompt, userPrompt, jsonMode, temp);
            } catch (err: any) {
                const is429 =
                    err?.status === 429 ||
                    err?.message?.includes('429') ||
                    err?.message?.includes('rate limit') ||
                    err?.message?.includes('RateLimit');

                if (is429) {
                    console.warn(`[model-pool] Model "${modelId}" returned a 429 rate limit error. Marking as exhausted and retrying on fallback...`);
                    this.markAsExhausted(modelId, Date.now());
                    attempt++;
                } else {
                    // Propagate other non-429 errors (e.g. invalid auth or formatting)
                    throw err;
                }
            }
        }

        throw this.getQuotaExhaustedError(taskType, Date.now());
    }
}

// Module-level Singleton
export const modelPoolManager = new ModelPoolManager();
