import { describe, expect, it, vi } from 'vitest';

import {
  buildRequestHeaders,
  parseRuntimeConfig,
  resolveApiBaseUrl,
} from '../../scripts/run-smoke-checks.mjs';
import {
  getProtectedAuthHeaders,
  getProtectedSmokeSkipReason,
  isProtectedSmokeEnabled,
  PROTECTED_SMOKE_ENDPOINTS,
} from '../../scripts/smoke/protected.mjs';
import {
  createProtectedSmokeChecks,
  runProtectedSmokeSuite,
} from '../../scripts/run-protected-smoke-checks.mjs';

describe('run-smoke-checks helpers', () => {
  it('parses runtime app config from the bootstrap script', () => {
    const config = parseRuntimeConfig(`window.__JAMISSUE_CONFIG__ = {
  "apiBaseUrl": "https://api.runtime.example",
  "naverMapClientId": "abc"
};`);

    expect(config).toEqual({
      apiBaseUrl: 'https://api.runtime.example',
      naverMapClientId: 'abc',
    });
  });

  it('prefers runtime apiBaseUrl over the workflow override', () => {
    expect(
      resolveApiBaseUrl({
        runtimeConfig: { apiBaseUrl: 'https://api.runtime.example/' },
        configuredApiBaseUrl: 'https://api.workflow.example/',
      }),
    ).toBe('https://api.runtime.example');
  });

  it('falls back to the configured apiBaseUrl when runtime config is absent', () => {
    expect(
      resolveApiBaseUrl({
        runtimeConfig: null,
        configuredApiBaseUrl: 'https://api.workflow.example/',
      }),
    ).toBe('https://api.workflow.example');
  });

  it('can force the configured apiBaseUrl over runtime config for smoke-only origins', () => {
    process.env.SMOKE_FORCE_API_BASE_URL = '1';

    expect(
      resolveApiBaseUrl({
        runtimeConfig: { apiBaseUrl: 'https://api.runtime.example/' },
        configuredApiBaseUrl: 'https://api.workflow.example/',
      }),
    ).toBe('https://api.workflow.example');

    delete process.env.SMOKE_FORCE_API_BASE_URL;
  });

  it('builds browser-like headers for smoke requests', () => {
    const headers = buildRequestHeaders('application/json,text/plain,*/*');

    expect(headers.accept).toBe('application/json,text/plain,*/*');
    expect(headers['accept-language']).toContain('en-US');
    expect(headers['cache-control']).toBe('no-cache');
    expect(headers['user-agent']).toContain('Mozilla/5.0');
  });

  it('builds protected auth headers from the smoke token', () => {
    process.env.SMOKE_AUTH_BEARER_TOKEN = 'token-123';

    expect(getProtectedAuthHeaders()).toEqual({
      Authorization: 'Bearer token-123',
    });

    delete process.env.SMOKE_AUTH_BEARER_TOKEN;
  });

  it('throws when the protected smoke token is missing', () => {
    delete process.env.SMOKE_AUTH_BEARER_TOKEN;

    expect(() => getProtectedAuthHeaders()).toThrow('SMOKE_AUTH_BEARER_TOKEN is required for protected smoke checks');
  });

  it('defines the protected smoke endpoint contract', () => {
    process.env.SMOKE_AUTH_BEARER_TOKEN = 'token-123';

    expect(createProtectedSmokeChecks({ apiBaseUrl: 'https://api.example.com' }).map((check) => check.name)).toEqual([
      'api-auth-me-authenticated',
      'api-my-summary-authenticated',
      'api-my-notifications-authenticated',
    ]);

    delete process.env.SMOKE_AUTH_BEARER_TOKEN;
  });

  it('keeps protected endpoint definitions in the shared contract module', () => {
    expect(PROTECTED_SMOKE_ENDPOINTS.map((endpoint) => endpoint.path)).toEqual([
      '/api/auth/me',
      '/api/my/summary',
      '/api/my/notifications',
    ]);
  });

  it('reports whether protected smoke is enabled from the token env', () => {
    expect(isProtectedSmokeEnabled({ SMOKE_AUTH_BEARER_TOKEN: 'token-123' })).toBe(true);
    expect(isProtectedSmokeEnabled({ SMOKE_AUTH_BEARER_TOKEN: '' })).toBe(false);
  });

  it('describes why protected smoke is skipped when the token is missing', () => {
    expect(getProtectedSmokeSkipReason({ SMOKE_AUTH_BEARER_TOKEN: '' })).toBe('SMOKE_AUTH_BEARER_TOKEN is not configured');
    expect(getProtectedSmokeSkipReason({ SMOKE_AUTH_BEARER_TOKEN: 'token-123' })).toBeNull();
  });

  it('skips protected smoke without trying to load runtime config when the token is missing', async () => {
    const loadRuntimeConfigImpl = vi.fn();
    const runSmokeSuiteImpl = vi.fn();

    const result = await runProtectedSmokeSuite({
      env: { SMOKE_AUTH_BEARER_TOKEN: '' },
      loadRuntimeConfigImpl,
      runSmokeSuiteImpl,
    });

    expect(result).toMatchObject({
      suite: 'protected',
      skipped: true,
      reason: 'SMOKE_AUTH_BEARER_TOKEN is not configured',
      endpoints: PROTECTED_SMOKE_ENDPOINTS.map((endpoint) => endpoint.name),
    });
    expect(loadRuntimeConfigImpl).not.toHaveBeenCalled();
    expect(runSmokeSuiteImpl).not.toHaveBeenCalled();
  });
});
