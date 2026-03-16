param(
    [string[]]$Names = @(
        'APP_SESSION_SECRET',
        'APP_JWT_SECRET',
        'APP_DATABASE_URL',
        'APP_SUPABASE_SERVICE_ROLE_KEY',
        'APP_NAVER_LOGIN_CLIENT_ID',
        'APP_NAVER_LOGIN_CLIENT_SECRET'
    )
)

Write-Host 'Cloudflare Worker secret 주입 순서' -ForegroundColor Cyan
Write-Host '1. backend/.dev.vars.example 를 backend/.dev.vars 로 복사해 값 입력' -ForegroundColor Yellow
Write-Host '2. 아래 secret 들을 wrangler 로 주입' -ForegroundColor Yellow
Write-Host ''

foreach ($name in $Names) {
    Write-Host "npx wrangler secret put $name" -ForegroundColor Green
}

Write-Host ''
Write-Host 'Variable 값은 wrangler.toml 주석 또는 Cloudflare Dashboard Variables and Secrets > Variables 에 입력' -ForegroundColor Yellow
