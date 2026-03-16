param(
    [string]$ProjectName = 'jamissue-web',
    [string]$ProductionBranch = 'codex/deploy-stack',
    [string]$AccountId = $env:CLOUDFLARE_ACCOUNT_ID,
    [string]$ApiToken = $env:CLOUDFLARE_API_TOKEN
)

if (-not $AccountId) {
    throw 'CLOUDFLARE_ACCOUNT_ID 가 비어 있습니다. 환경변수로 넣거나 -AccountId 로 넘겨주세요.'
}

if (-not $ApiToken) {
    throw 'CLOUDFLARE_API_TOKEN 이 비어 있습니다. 환경변수로 넣거나 -ApiToken 으로 넘겨주세요.'
}

$headers = @{
    Authorization = "Bearer $ApiToken"
    'Content-Type' = 'application/json'
}

$projectUri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects"
$body = @{
    name = $ProjectName
    production_branch = $ProductionBranch
} | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Method Post -Uri $projectUri -Headers $headers -Body $body
    $result = $response.result
    $subdomain = if ($result.subdomain) { $result.subdomain } else { "$ProjectName.pages.dev" }
    Write-Host "CREATED_PROJECT_NAME=$($result.name)"
    Write-Host "CREATED_PROJECT_URL=https://$subdomain"
    exit 0
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if ($statusCode -eq 409) {
        $existing = Invoke-RestMethod -Method Get -Uri "$projectUri/$ProjectName" -Headers $headers
        $result = $existing.result
        $subdomain = if ($result.subdomain) { $result.subdomain } else { "$ProjectName.pages.dev" }
        Write-Host "EXISTING_PROJECT_NAME=$($result.name)"
        Write-Host "EXISTING_PROJECT_URL=https://$subdomain"
        exit 0
    }
    throw
}
