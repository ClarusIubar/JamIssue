param(
    [string]$ProjectName = $(if($env:CLOUDFLARE_PAGES_PROJECT_NAME){$env:CLOUDFLARE_PAGES_PROJECT_NAME}else{'jamissue-web'}),
    [string]$Branch = 'codex/deploy-stack'
)

Push-Location (Resolve-Path "$PSScriptRoot\..")
try {
    npm.cmd run build
    npx wrangler pages deploy infra/nginx/site --project-name $ProjectName --branch $Branch --config deploy/wrangler.pages.toml
}
finally {
    Pop-Location
}
