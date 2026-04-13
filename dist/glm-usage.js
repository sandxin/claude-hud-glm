import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as https from 'node:https';
import * as http from 'node:http';
import { getHudPluginDir } from './claude-config-dir.js';
import { createDebug } from './debug.js';
const GLM_HOSTS = ['open.bigmodel.cn', 'dev.bigmodel.cn', 'api.z.ai'];
const CACHE_FILENAME = 'glm-cache.json';
const DEFAULT_CACHE_TTL_MS = 60_000;
const API_TIMEOUT_MS = 5_000;
const FIVE_HOUR_WINDOW_MS = 5 * 60 * 60 * 1000;
const debug = createDebug('glm');
export function detectGlmEnv() {
    const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim() ?? '';
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim() ?? '';
    if (!baseUrl || !authToken) {
        return null;
    }
    try {
        const url = new URL(baseUrl);
        const isGlm = GLM_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
        if (!isGlm) {
            return null;
        }
        return { baseUrl: url.origin, authToken };
    }
    catch {
        return null;
    }
}
function getCachePath() {
    return path.join(getHudPluginDir(os.homedir()), CACHE_FILENAME);
}
function readCache(ttlMs) {
    try {
        const raw = fs.readFileSync(getCachePath(), 'utf-8');
        const cache = JSON.parse(raw);
        if (typeof cache.fetchedAt !== 'number') {
            return null;
        }
        if (cache.tokensPercent !== null && typeof cache.tokensPercent !== 'number') {
            return null;
        }
        if (cache.mcpPercent !== null && typeof cache.mcpPercent !== 'number') {
            return null;
        }
        if (cache.tokenResetAt !== null && typeof cache.tokenResetAt !== 'number') {
            return null;
        }
        if (cache.mcpResetAt !== null && typeof cache.mcpResetAt !== 'number') {
            return null;
        }
        if (cache.mcpCurrentUsage !== null && typeof cache.mcpCurrentUsage !== 'number') {
            return null;
        }
        if (cache.mcpTotal !== null && typeof cache.mcpTotal !== 'number') {
            return null;
        }
        if (Date.now() - cache.fetchedAt > ttlMs) {
            return null;
        }
        return {
            tokensPercent: cache.tokensPercent ?? null,
            mcpPercent: cache.mcpPercent ?? null,
            mcpCurrentUsage: cache.mcpCurrentUsage ?? null,
            mcpTotal: cache.mcpTotal ?? null,
            tokenResetAt: cache.tokenResetAt ?? null,
            mcpResetAt: cache.mcpResetAt ?? null,
            fetchedAt: cache.fetchedAt,
        };
    }
    catch {
        return null;
    }
}
function writeCache(data) {
    try {
        const cachePath = getCachePath();
        const dirPath = path.dirname(cachePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(cachePath, JSON.stringify(data), 'utf-8');
    }
    catch {
        // Cache failures should never break HUD rendering.
    }
}
function fetchGlmUsage(baseUrl, authToken) {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/monitor/usage/quota/limit', baseUrl);
        const transport = url.protocol === 'http:' ? http : https;
        const req = transport.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === 'http:' ? 80 : 443),
            path: url.pathname,
            method: 'GET',
            headers: {
                Authorization: authToken,
                Accept: 'application/json',
            },
            timeout: API_TIMEOUT_MS,
        }, res => {
            let body = '';
            res.setEncoding('utf-8');
            res.on('data', chunk => {
                body += chunk;
            });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`GLM API HTTP ${res.statusCode}`));
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                }
                catch {
                    reject(new Error('Invalid JSON response from GLM API'));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('GLM API request timed out'));
        });
        req.end();
    });
}
function parseTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (value > 1e12) {
            return Math.trunc(value);
        }
        if (value > 1e9) {
            return Math.trunc(value * 1000);
        }
        return null;
    }
    if (typeof value === 'string') {
        const trimmedValue = value.trim();
        if (!trimmedValue) {
            return null;
        }
        if (/^\d+(\.\d+)?$/.test(trimmedValue)) {
            return parseTimestamp(Number(trimmedValue));
        }
        const parsedMs = Date.parse(trimmedValue);
        return Number.isNaN(parsedMs) ? null : parsedMs;
    }
    return null;
}
function extractResetAt(limit) {
    const timestamp = parseTimestamp(limit.nextResetTime);
    if (timestamp !== null && timestamp > Date.now()) {
        return timestamp;
    }
    return null;
}
function toGlmUsageData(cache) {
    const tokenResetAtMs = cache.tokenResetAt ?? (cache.fetchedAt + FIVE_HOUR_WINDOW_MS);
    return {
        provider: 'glm',
        tokensPercent: cache.tokensPercent,
        mcpPercent: cache.mcpPercent,
        mcpCurrentUsage: cache.mcpCurrentUsage,
        mcpTotal: cache.mcpTotal,
        tokenResetAt: new Date(tokenResetAtMs),
        mcpResetAt: cache.mcpResetAt === null ? null : new Date(cache.mcpResetAt),
        fetchedAt: cache.fetchedAt,
    };
}
export function parseGlmResponse(response) {
    const limits = response?.data?.limits;
    if (!Array.isArray(limits)) {
        return null;
    }
    const tokenLimit = limits.find(limit => limit.type === 'TOKENS_LIMIT' && limit.number === 5)
        ?? limits.find(limit => limit.type === 'TOKENS_LIMIT')
        ?? null;
    const mcpLimit = limits.find(limit => limit.type === 'TIME_LIMIT') ?? null;
    let tokensPercent = null;
    let mcpPercent = null;
    let mcpCurrentUsage = null;
    let mcpTotal = null;
    let tokenResetAt = null;
    let mcpResetAt = null;
    if (tokenLimit && typeof tokenLimit.percentage === 'number') {
        tokensPercent = Math.round(Math.min(100, Math.max(0, tokenLimit.percentage)));
        tokenResetAt = extractResetAt(tokenLimit);
    }
    if (mcpLimit && typeof mcpLimit.percentage === 'number') {
        mcpPercent = Math.round(Math.min(100, Math.max(0, mcpLimit.percentage)));
        if (typeof mcpLimit.currentValue === 'number') {
            mcpCurrentUsage = mcpLimit.currentValue;
        }
        if (typeof mcpLimit.usage === 'number') {
            mcpTotal = mcpLimit.usage;
        }
        mcpResetAt = extractResetAt(mcpLimit);
    }
    return { tokensPercent, mcpPercent, mcpCurrentUsage, mcpTotal, tokenResetAt, mcpResetAt };
}
export async function getGlmUsage() {
    const env = detectGlmEnv();
    if (!env) {
        return null;
    }
    const cached = readCache(DEFAULT_CACHE_TTL_MS);
    if (cached) {
        debug('cache hit (age: %dms)', Date.now() - cached.fetchedAt);
        return toGlmUsageData(cached);
    }
    debug('cache miss, fetching from %s', env.baseUrl);
    try {
        const response = await fetchGlmUsage(env.baseUrl, env.authToken);
        const parsed = parseGlmResponse(response);
        if (!parsed) {
            debug('failed to parse GLM response');
            return null;
        }
        const fetchedAt = Date.now();
        const cacheData = {
            ...parsed,
            tokenResetAt: parsed.tokenResetAt ?? (fetchedAt + FIVE_HOUR_WINDOW_MS),
            fetchedAt,
        };
        writeCache(cacheData);
        return toGlmUsageData(cacheData);
    }
    catch (error) {
        debug('API error: %s', error instanceof Error ? error.message : 'unknown');
        const stale = readCache(Infinity);
        if (stale) {
            debug('returning stale cache as fallback');
            return toGlmUsageData(stale);
        }
        return null;
    }
}
//# sourceMappingURL=glm-usage.js.map