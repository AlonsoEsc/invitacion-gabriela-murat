$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseDirectory = Join-Path $projectRoot "release"
$stagingRoot = Join-Path $releaseDirectory "staging"
$applicationRoot = Join-Path $stagingRoot "invitacion"
$archivePath = Join-Path $releaseDirectory "invitacion-ifastnet.zip"

npm run build:pages
if ($LASTEXITCODE -ne 0) { throw "La compilacion del frontend fallo." }

if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }

New-Item -ItemType Directory -Path (Join-Path $applicationRoot "server") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $applicationRoot "dist") -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $projectRoot "server/src") -Destination (Join-Path $applicationRoot "server/src") -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot "server/package.json") -Destination (Join-Path $applicationRoot "server/package.json")
Copy-Item -LiteralPath (Join-Path $projectRoot "server/package-lock.json") -Destination (Join-Path $applicationRoot "server/package-lock.json")
Copy-Item -LiteralPath (Join-Path $projectRoot "server/.env.example") -Destination (Join-Path $applicationRoot "server/.env.example")
Copy-Item -LiteralPath (Join-Path $projectRoot "dist/client") -Destination (Join-Path $applicationRoot "dist/client") -Recurse

Compress-Archive -LiteralPath $applicationRoot -DestinationPath $archivePath -CompressionLevel Optimal
Remove-Item -LiteralPath $stagingRoot -Recurse -Force

Write-Host "Paquete listo: $archivePath"
