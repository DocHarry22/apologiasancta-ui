param(
  [string]$EngineUrl = "https://apologiasancta-engine.onrender.com",
  [string]$UiUrl = "https://sandybrown-bear-488955.hostingersite.com",
  [string]$ApkPath = ".\android\app\build\outputs\apk\debug\apologia-sancta-debug.apk"
)

$ErrorActionPreference = "Continue"

function Test-HttpRoute {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
    [PSCustomObject]@{
      Url = $Url
      Status = [int]$response.StatusCode
      Bytes = $response.RawContentLength
      Result = "PASS"
    }
  } catch {
    [PSCustomObject]@{
      Url = $Url
      Status = "ERR"
      Bytes = 0
      Result = $_.Exception.Message
    }
  }
}

$engine = $EngineUrl.TrimEnd("/")
$ui = $UiUrl.TrimEnd("/")

$routes = @(
  "$engine/health",
  "$engine/rooms",
  "$engine/topics",
  "$engine/leaderboard",
  "$engine/rooms/global",
  "$engine/rooms/global/stages",
  "$engine/rooms/global/leaderboard?period=all-time",
  "$engine/rooms/global/state",
  "$ui/",
  "$ui/mobile/",
  "$ui/author/login",
  "$ui/library"
)

"== HTTP smoke =="
$results = foreach ($route in $routes) {
  Test-HttpRoute -Url $route
}
$results | Format-Table -AutoSize

""
"== APK =="
if (Test-Path -LiteralPath $ApkPath) {
  Get-Item -LiteralPath $ApkPath | Select-Object FullName,Length,LastWriteTime | Format-List
  Get-FileHash -Algorithm SHA256 -LiteralPath $ApkPath | Select-Object Path,Hash | Format-List
} else {
  "Missing APK: $ApkPath"
}

""
"== SSE smoke =="
"Run this manually when needed: curl.exe --max-time 8 -N $engine/rooms/global/events"
