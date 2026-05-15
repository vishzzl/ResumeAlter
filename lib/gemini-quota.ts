export type GeminiHealthState = 'idle' | 'checking' | 'ok' | 'quota' | 'auth' | 'model' | 'timeout' | 'network' | 'error';

export interface GeminiHealthStatus {
    state: GeminiHealthState;
    model: string;
    message: string;
    detail: string;
    checkedAt: number;
    source: 'live_check' | 'runtime_error' | 'manual';
    retryAfterSeconds: number | null;
    exhaustedMetrics: string[];
    exhaustedLabels: string[];
    isDailyExhausted: boolean;
    isMinuteExhausted: boolean;
    rawError?: string;
    knownRemaining: {
        requestsToday: number | null;
        requestsThisMinute: number | null;
        inputTokensToday: number | null;
        inputTokensThisMinute: number | null;
    };
    disclosure: string;
}

const QUOTA_LABELS: Record<string, string> = {
    GenerateRequestsPerDayPerProjectPerModel: 'Daily requests',
    GenerateRequestsPerMinutePerProjectPerModel: 'Requests per minute',
    GenerateContentInputTokensPerModelPerDay: 'Input tokens per day',
    GenerateContentInputTokensPerModelPerMinute: 'Input tokens per minute',
};

function makeBase(model: string, source: GeminiHealthStatus['source']): GeminiHealthStatus {
    return {
        state: 'idle',
        model,
        message: 'No recent health data.',
        detail: 'Run a check or wait for a real request result to populate Gemini model health.',
        checkedAt: Date.now(),
        source,
        retryAfterSeconds: null,
        exhaustedMetrics: [],
        exhaustedLabels: [],
        isDailyExhausted: false,
        isMinuteExhausted: false,
        knownRemaining: {
            requestsToday: null,
            requestsThisMinute: null,
            inputTokensToday: null,
            inputTokensThisMinute: null,
        },
        disclosure: 'Gemini does not expose exact remaining quota counts through this app. Status is based on last-known runtime or health-check results.',
    };
}

function extractRetryAfterSeconds(rawError: string): number | null {
    const retryInfoMatch = rawError.match(/retryDelay":"(\d+)s"/i);
    if (retryInfoMatch) return Number(retryInfoMatch[1]);

    const retryTextMatch = rawError.match(/Please retry in ([\d.]+)s/i);
    if (retryTextMatch) return Math.max(1, Math.ceil(Number(retryTextMatch[1])));

    return null;
}

function extractQuotaIds(rawError: string): string[] {
    const ids = [...rawError.matchAll(/quotaId":"([^"]+)"/g)].map(match => match[1]);
    return Array.from(new Set(ids));
}

function toQuotaLabels(quotaIds: string[]): string[] {
    return quotaIds.map(id => {
        const normalized = id.replace(/-FreeTier$/i, '');
        for (const [key, label] of Object.entries(QUOTA_LABELS)) {
            if (normalized.includes(key)) return label;
        }
        return normalized;
    });
}

export function parseGeminiHealthError(rawError: string, model: string, source: GeminiHealthStatus['source']): GeminiHealthStatus {
    const status = makeBase(model, source);
    status.rawError = rawError;
    status.checkedAt = Date.now();
    status.retryAfterSeconds = extractRetryAfterSeconds(rawError);

    const lower = rawError.toLowerCase();
    const quotaIds = extractQuotaIds(rawError);
    status.exhaustedMetrics = quotaIds;
    status.exhaustedLabels = toQuotaLabels(quotaIds);
    status.isDailyExhausted = quotaIds.some(id => /PerDay/i.test(id));
    status.isMinuteExhausted = quotaIds.some(id => /PerMinute/i.test(id));

    if (lower.includes('429') || lower.includes('quota exceeded')) {
        status.state = 'quota';
        status.message = status.isDailyExhausted
            ? 'Free-tier quota exhausted for this model.'
            : 'Rate limit hit for this model.';
        const parts: string[] = [];
        if (status.exhaustedLabels.length > 0) parts.push(status.exhaustedLabels.join(', '));
        if (status.retryAfterSeconds) parts.push(`retry in about ${status.retryAfterSeconds}s`);
        status.detail = parts.length > 0
            ? parts.join(' | ')
            : 'Gemini reported quota exhaustion but did not provide exact remaining counts.';

        if (quotaIds.some(id => /GenerateRequestsPerDay/i.test(id))) status.knownRemaining.requestsToday = 0;
        if (quotaIds.some(id => /GenerateRequestsPerMinute/i.test(id))) status.knownRemaining.requestsThisMinute = 0;
        if (quotaIds.some(id => /InputTokensPerModelPerDay/i.test(id))) status.knownRemaining.inputTokensToday = 0;
        if (quotaIds.some(id => /InputTokensPerModelPerMinute/i.test(id))) status.knownRemaining.inputTokensThisMinute = 0;
        return status;
    }

    if (lower.includes('api key not valid') || lower.includes('403')) {
        status.state = 'auth';
        status.message = 'API key or permissions issue.';
        status.detail = 'Gemini rejected the key or the key does not have access to this model.';
        return status;
    }

    if (lower.includes('404') || lower.includes('not found')) {
        status.state = 'model';
        status.message = 'Model unavailable.';
        status.detail = 'This Gemini model is not available for the current API key or region.';
        return status;
    }

    if (lower.includes('timed out') || lower.includes('timeouterror')) {
        status.state = 'timeout';
        status.message = 'Request timed out.';
        status.detail = 'The model did not respond before the app timeout. Try a lighter model or smaller prompt.';
        return status;
    }

    if (lower.includes('econn') || lower.includes('network') || lower.includes('fetch')) {
        status.state = 'network';
        status.message = 'Network issue while contacting Gemini.';
        status.detail = 'The request did not complete cleanly. This is usually temporary.';
        return status;
    }

    status.state = 'error';
    status.message = 'Unexpected Gemini error.';
    status.detail = rawError.slice(0, 240);
    return status;
}

export function createGeminiHealthyStatus(model: string, source: GeminiHealthStatus['source']): GeminiHealthStatus {
    const status = makeBase(model, source);
    status.state = 'ok';
    status.message = 'Ready';
    status.detail = 'Last check completed successfully. Exact remaining quota counts are not exposed by Gemini here.';
    return status;
}

export function formatRelativeCooldown(status: GeminiHealthStatus | null): number | null {
    if (!status?.retryAfterSeconds) return null;
    const elapsedSeconds = Math.floor((Date.now() - status.checkedAt) / 1000);
    return Math.max(0, status.retryAfterSeconds - elapsedSeconds);
}

export function formatTokenCount(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return 'Unknown';
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
    return `${value}`;
}

export function estimateTokenCount(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}
