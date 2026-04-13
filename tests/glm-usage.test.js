import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectGlmEnv, parseGlmResponse } from '../dist/glm-usage.js';

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

test('detectGlmEnv matches supported GLM hosts only', () => {
  const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const originalAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;

  try {
    process.env.ANTHROPIC_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/';
    process.env.ANTHROPIC_AUTH_TOKEN = 'glm-token';
    assert.deepEqual(detectGlmEnv(), {
      baseUrl: 'https://open.bigmodel.cn',
      authToken: 'glm-token',
    });

    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
    assert.equal(detectGlmEnv(), null);
  } finally {
    restoreEnv('ANTHROPIC_BASE_URL', originalBaseUrl);
    restoreEnv('ANTHROPIC_AUTH_TOKEN', originalAuthToken);
  }
});

test('detectGlmEnv returns null for invalid url or missing token', () => {
  const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const originalAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;

  try {
    process.env.ANTHROPIC_BASE_URL = 'not-a-url';
    process.env.ANTHROPIC_AUTH_TOKEN = 'glm-token';
    assert.equal(detectGlmEnv(), null);

    process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai';
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    assert.equal(detectGlmEnv(), null);
  } finally {
    restoreEnv('ANTHROPIC_BASE_URL', originalBaseUrl);
    restoreEnv('ANTHROPIC_AUTH_TOKEN', originalAuthToken);
  }
});

test('parseGlmResponse prefers 5h token window and parses mixed timestamp formats', () => {
  const futureIso = new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString();
  const futureSeconds = Math.floor((Date.now() + (7 * 24 * 60 * 60 * 1000)) / 1000);

  const parsed = parseGlmResponse({
    data: {
      limits: [
        { type: 'TOKENS_LIMIT', number: 24, percentage: 88, nextResetTime: futureIso },
        { type: 'TOKENS_LIMIT', number: 5, percentage: 19.4, nextResetTime: futureIso },
        { type: 'TIME_LIMIT', percentage: 41.2, currentValue: 12, usage: 30, nextResetTime: String(futureSeconds) },
      ],
    },
  });

  assert.equal(parsed?.tokensPercent, 19);
  assert.equal(parsed?.mcpPercent, 41);
  assert.equal(parsed?.mcpCurrentUsage, 12);
  assert.equal(parsed?.mcpTotal, 30);
  assert.ok(typeof parsed?.tokenResetAt === 'number' && parsed.tokenResetAt > Date.now());
  assert.ok(typeof parsed?.mcpResetAt === 'number' && parsed.mcpResetAt > Date.now());
});

test('parseGlmResponse returns null for invalid payloads', () => {
  assert.equal(parseGlmResponse(null), null);
  assert.equal(parseGlmResponse({}), null);
  assert.equal(parseGlmResponse({ data: { limits: {} } }), null);
});
