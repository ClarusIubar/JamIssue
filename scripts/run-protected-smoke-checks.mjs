import {
  assert,
  fetchJson,
  loadRuntimeConfig,
  runCheck,
  runSmokeSuite,
  scriptEntryMatches,
} from "./smoke/shared.mjs";
import {
  getProtectedAuthHeaders,
  getProtectedSmokeSkipReason,
  PROTECTED_SMOKE_ENDPOINTS,
} from "./smoke/protected.mjs";

export function createProtectedSmokeChecks({ apiBaseUrl }) {
  const authHeaders = getProtectedAuthHeaders();

  return PROTECTED_SMOKE_ENDPOINTS.map((endpoint) => ({
    name: endpoint.name,
    run: () => runCheck(endpoint.name, async () => {
      const { response, json } = await fetchJson(`${apiBaseUrl}${endpoint.path}`, {
        headers: authHeaders,
      });
      endpoint.assertJson(response, json, assert);
    }),
  }));
}

export async function runProtectedSmokeSuite({
  env = process.env,
  loadRuntimeConfigImpl = loadRuntimeConfig,
  runSmokeSuiteImpl = runSmokeSuite,
} = {}) {
  const skipReason = getProtectedSmokeSkipReason(env);
  if (skipReason) {
    const payload = {
      suite: "protected",
      skipped: true,
      reason: skipReason,
      checkedAt: new Date().toISOString(),
      endpoints: PROTECTED_SMOKE_ENDPOINTS.map((endpoint) => endpoint.name),
    };
    console.log(JSON.stringify(payload, null, 2));
    return payload;
  }

  const { appConfigResult, runtimeConfig, apiBaseUrl } = await loadRuntimeConfigImpl();
  return runSmokeSuiteImpl({
    suiteName: "protected",
    checks: createProtectedSmokeChecks({ apiBaseUrl, appConfigResult }),
    runtimeConfig,
    appConfigResult,
    apiBaseUrl,
  });
}

export async function main() {
  return runProtectedSmokeSuite();
}

if (scriptEntryMatches(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    console.error("[smoke] fatal error", error);
    process.exitCode = 1;
  });
}
