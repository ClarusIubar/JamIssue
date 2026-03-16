import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const siteDir = path.join(rootDir, "infra", "nginx", "site");
const assetsDir = path.join(siteDir, "assets");
const iconsDir = path.join(siteDir, "icons");

const APP_NAME = "대전잼있슈";
const APP_SHORT_NAME = "잼있슈";
const APP_DESCRIPTION = "대전을 한 입에 고르는 모바일 여행 앱";
const MAP_KEY_WARNING = "PUBLIC_NAVER_MAP_CLIENT_ID 값이 비어 있어 지도 영역은 안내 상태로 표시됩니다.";

async function readPublicEnv() {
  const envFiles = [path.join(rootDir, ".env.example"), path.join(rootDir, ".env")];
  const values = {
    ...process.env,
  };

  for (const envFile of envFiles) {
    try {
      const content = await readFile(envFile, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
          continue;
        }

        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) {
          continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();
        values[key] = value;
      }
    } catch {
    }
  }

  Object.assign(values, process.env);

  const mapKey =
    (values.PUBLIC_NAVER_MAP_CLIENT_ID &&
    values.PUBLIC_NAVER_MAP_CLIENT_ID !== "YOUR_NAVER_MAP_CLIENT_ID"
      ? values.PUBLIC_NAVER_MAP_CLIENT_ID
      : "") ||
    values.NAVER_MAP_CLIENT_ID ||
    "";

  return {
    apiBaseUrl: values.PUBLIC_APP_BASE_URL || values.APP_BASE_URL || "http://localhost:8000",
    naverMapClientId: mapKey,
  };
}

function createManifest() {
  return JSON.stringify(
    {
      name: APP_NAME,
      short_name: APP_SHORT_NAME,
      description: APP_DESCRIPTION,
      start_url: "/",
      display: "standalone",
      background_color: "#fff8fb",
      theme_color: "#ff7fa8",
      lang: "ko",
      icons: [
        {
          src: "/icons/jamissue-icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    },
    null,
    2,
  );
}

function createIconSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${APP_NAME}">
  <defs>
    <linearGradient id="jam-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffe3ef" />
      <stop offset="100%" stop-color="#d9f3ff" />
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="64" fill="url(#jam-bg)" />
  <path d="M68 98c0-19.882 16.118-36 36-36h48c19.882 0 36 16.118 36 36v60c0 19.882-16.118 36-36 36h-48c-19.882 0-36-16.118-36-36V98Z" fill="#fff7ef" />
  <path d="M86 104h84c9.941 0 18 8.059 18 18v24H68v-24c0-9.941 8.059-18 18-18Z" fill="#ff8fb7" />
  <circle cx="128" cy="152" r="30" fill="#ff5d92" />
  <circle cx="128" cy="152" r="14" fill="#fff4fb" />
</svg>`.trim();
}

function createIndexHtml() {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${APP_NAME}</title>
    <meta name="description" content="${APP_DESCRIPTION}" />
    <meta name="theme-color" content="#ff7fa8" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icons/jamissue-icon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/assets/main.css" />
    <script defer src="/app-config.js"></script>
    <script type="module" defer src="/assets/main.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

async function writeStaticFiles(publicConfig) {
  await mkdir(siteDir, { recursive: true });
  await mkdir(iconsDir, { recursive: true });
  await writeFile(path.join(siteDir, "index.html"), createIndexHtml(), "utf8");
  await writeFile(path.join(siteDir, "manifest.webmanifest"), createManifest(), "utf8");
  await writeFile(path.join(iconsDir, "jamissue-icon.svg"), createIconSvg(), "utf8");
  await writeFile(
    path.join(siteDir, "app-config.js"),
    `window.__JAMISSUE_CONFIG__ = ${JSON.stringify(publicConfig, null, 2)};\n`,
    "utf8",
  );
}

async function main() {
  const publicConfig = await readPublicEnv();

  if (!publicConfig.naverMapClientId) {
    console.warn(MAP_KEY_WARNING);
  }

  await rm(siteDir, { recursive: true, force: true });
  await mkdir(assetsDir, { recursive: true });

  await build({
    entryPoints: [path.join(rootDir, "src", "main.tsx")],
    bundle: true,
    outdir: assetsDir,
    entryNames: "main",
    format: "esm",
    target: ["es2020", "chrome110", "safari16"],
    jsx: "automatic",
    loader: {
      ".css": "css",
    },
    minify: true,
    sourcemap: false,
    logLevel: "info",
  });

  await writeStaticFiles(publicConfig);
  console.log(`Built mobile web bundle to ${siteDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

