/**
 * Embedding utilities — DEPRECATED
 *
 * The @xenova/transformers local approach has been replaced with
 * Gemini (primary generation) + OpenRouter free models (alternatives + fact-checking).
 *
 * This file is kept as a stub to avoid import errors in case any other file references it.
 * The actual ensemble logic now lives in lib/optimization-agent.ts and lib/openrouter.ts.
 */

// No-op exports for backward compatibility
export const MODEL_WEIGHTS = {};
export function cosineSimilarity(_a: number[], _b: number[]): number { return 0; }
export async function getEmbedding(_text: string, _model: string): Promise<number[]> { return []; }
