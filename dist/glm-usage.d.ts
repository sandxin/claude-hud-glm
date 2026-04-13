import type { GlmUsageData } from './types.js';
type GlmEnv = {
    baseUrl: string;
    authToken: string;
};
type GlmCacheData = {
    tokensPercent: number | null;
    mcpPercent: number | null;
    mcpCurrentUsage: number | null;
    mcpTotal: number | null;
    tokenResetAt: number | null;
    mcpResetAt: number | null;
    fetchedAt: number;
};
export declare function detectGlmEnv(): GlmEnv | null;
export declare function parseGlmResponse(response: unknown): Omit<GlmCacheData, 'fetchedAt'> | null;
export declare function getGlmUsage(): Promise<GlmUsageData | null>;
export {};
//# sourceMappingURL=glm-usage.d.ts.map