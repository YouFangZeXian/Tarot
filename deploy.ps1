$ErrorActionPreference = "Stop"

$projectName = "taluo"
$archiveName = "$projectName-standalone.zip"
$stagingDir = ".deploy\\$projectName-package"
$remoteAlias = "my-trip-web"
$remoteArchive = "/tmp/$archiveName"
$remoteRoot = "/www/wwwroot/$projectName"

Write-Host "Building standalone bundle..."
npm run build

if (Test-Path $stagingDir) {
  Remove-Item $stagingDir -Recurse -Force
}

if (Test-Path $archiveName) {
  Remove-Item $archiveName -Force
}

Write-Host "Preparing staging directory..."
New-Item -ItemType Directory -Path $stagingDir | Out-Null
Copy-Item ".next\\standalone\\*" $stagingDir -Recurse -Force
if (-not (Test-Path "$stagingDir\\.next")) {
  New-Item -ItemType Directory -Path "$stagingDir\\.next" | Out-Null
}
Copy-Item ".next\\static" "$stagingDir\\.next\\static" -Recurse -Force
Copy-Item "public" "$stagingDir\\public" -Recurse -Force
if (Test-Path ".env.local") {
  Copy-Item ".env.local" "$stagingDir\\.env.local" -Force
}

Write-Host "Packaging archive..."
tar.exe -a -cf $archiveName -C $stagingDir .

Write-Host "Uploading archive..."
scp ".\\$archiveName" "${remoteAlias}:${remoteArchive}"

Write-Host "Installing bundle on server..."
ssh $remoteAlias @"
mkdir -p $remoteRoot
find $remoteRoot -mindepth 1 -maxdepth 1 ! -name '.oracle-data' -exec rm -rf -- {} +
unzip -oq $remoteArchive -d $remoteRoot
rm -f $remoteArchive
"@

Write-Host "Cleaning local artifacts..."
Remove-Item $archiveName -Force
Remove-Item $stagingDir -Recurse -Force

Write-Host "Done. Restart the server process after upload if needed."
