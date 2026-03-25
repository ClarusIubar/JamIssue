param(
    [string]$ProjectName = $(if($env:CLOUDFLARE_PAGES_PROJECT_NAME){$env:CLOUDFLARE_PAGES_PROJECT_NAME}else{'daejeon-jamissue'}),
    [string]$Branch = 'main'
)

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    npm.cmd run build
    npx wrangler pages deploy infra/nginx/site --project-name $ProjectName --branch $Branch --config deploy/wrangler.pages.toml
}
finally {
    Pop-Location
}
