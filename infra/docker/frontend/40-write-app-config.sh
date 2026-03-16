#!/bin/sh
set -eu

cat > /usr/share/nginx/html/app-config.js <<EOF
window.__JAMISSUE_CONFIG__ = {
  "apiBaseUrl": "${PUBLIC_APP_BASE_URL}",
  "naverMapClientId": "${PUBLIC_NAVER_MAP_CLIENT_ID}"
};
EOF
