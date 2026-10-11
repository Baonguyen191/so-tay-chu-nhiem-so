# Cài Sổ tay Chủ nhiệm số (bản nhà trường) lên một máy tính Windows 10/11 của trường,
# mở ra Internet qua Cloudflare Tunnel (không cần mở cổng modem, không cần IP tĩnh).
#
# Cách dùng: mở PowerShell bằng quyền quản trị (chuột phải > Run as administrator), dán:
#   $env:CF_HOSTNAME = "sotay.tentruong.xyz"
#   irm https://raw.githubusercontent.com/Baonguyen191/so-tay-chu-nhiem-so/main/deploy/windows/cai-dat-windows.ps1 | iex
# Tên miền phải đã ở trạng thái Active trong Cloudflare (gói Free, không cần thẻ). Bộ cài mở trình duyệt
# để đăng nhập Cloudflare một lần, tự tạo tunnel và bản ghi DNS.
# Đã có mã tunnel tạo trong Zero Trust thì đặt $env:CF_TOKEN thay cho CF_HOSTNAME.
# Không đặt biến nào thì chỉ cài ứng dụng (dùng trên máy này tại http://localhost:3000).
#
# Chạy lại nhiều lần không sao: lần sau sao lưu dữ liệu, cập nhật mã mới nhất, dữ liệu giữ nguyên.
& {
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo = "Baonguyen191/so-tay-chu-nhiem-so"
$Branch = if ($env:SOTAY_BRANCH) { $env:SOTAY_BRANCH } else { "main" }
$Port = if ($env:SOTAY_PORT) { [int]$env:SOTAY_PORT } else { 3000 }
$Root = "C:\SoTay"
$AppDir = "$Root\app"
$DataDir = "$Root\du-lieu"
$CfDir = "$Root\cloudflared"
$TaskName = "SoTayChuNhiem"
$TunnelTask = "SoTayTunnel"
$TunnelName = "so-tay"
$Token = $env:CF_TOKEN
$Hostname = if ($env:CF_HOSTNAME) { $env:CF_HOSTNAME.Trim().ToLower() -replace '^https?://', '' -replace '/.*$', '' } else { "" }

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
# Chương trình ngoài (cloudflared) ghi nhật ký ra stderr; PowerShell 5.1 coi đó là lỗi khi ErrorActionPreference = Stop.
function Invoke-Native([scriptblock]$Block) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { & $Block } finally { $ErrorActionPreference = $old }
}
function Protect-Folder($path) {
  icacls $path /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
}
function Find-Cloudflared {
  @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Hãy mở PowerShell bằng quyền quản trị (chuột phải > Run as administrator) rồi chạy lại." }

$tmp = Join-Path $env:TEMP "so-tay-cai-dat"
New-Item -ItemType Directory -Force $tmp | Out-Null

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node -and (Test-Path "$env:ProgramFiles\nodejs\node.exe")) { $node = "$env:ProgramFiles\nodejs\node.exe" }
$major = if ($node) { [int](& $node -p "process.versions.node.split('.')[0]") } else { 0 }
if ($major -lt 22) {
  Step "Cài Node.js (bản LTS mới nhất)"
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
  $v = (Invoke-RestMethod "https://nodejs.org/dist/index.json" | Where-Object { $_.lts } | Select-Object -First 1).version
  $msi = Join-Path $tmp "node-$v-$arch.msi"
  Invoke-WebRequest "https://nodejs.org/dist/$v/node-$v-$arch.msi" -OutFile $msi -UseBasicParsing
  Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait
  $node = "$env:ProgramFiles\nodejs\node.exe"
  if (-not (Test-Path $node)) { throw "Cài Node.js không thành công. Hãy cài thủ công từ https://nodejs.org rồi chạy lại." }
}
$npm = Join-Path (Split-Path $node) "npm.cmd"
Write-Host "    Node.js $(& $node -v)"

Step "Thư mục dữ liệu (chỉ quản trị viên máy và hệ thống được đọc)"
New-Item -ItemType Directory -Force $AppDir, "$DataDir\sao-luu" | Out-Null
Protect-Folder $DataDir

$dbFile = "$DataDir\sotay.sqlite"
if ((Test-Path $dbFile) -and (Test-Path "$AppDir\node_modules\better-sqlite3")) {
  Step "Sao lưu trước khi cập nhật"
  $dest = "$DataDir\sao-luu\truoc-cap-nhat-$(Get-Date -Format yyyyMMdd-HHmmss).sqlite"
  & $node -e "const D=require(process.argv[3]+'/node_modules/better-sqlite3');new D(process.argv[1],{readonly:true}).backup(process.argv[2]).then(()=>process.exit(0))" $dbFile $dest $AppDir
  if ($LASTEXITCODE -ne 0) { throw "Sao lưu không thành công, dừng cập nhật để giữ an toàn dữ liệu." }
  Write-Host "    $dest"
}

Step "Dừng ứng dụng đang chạy (nếu có)"
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) { Stop-ScheduledTask -TaskName $TaskName }
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like "*$AppDir\server\index.js*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Step "Tải mã nguồn mới nhất"
$zip = Join-Path $tmp "app.zip"
$src = Join-Path $tmp "src"
Invoke-WebRequest "https://github.com/$Repo/archive/refs/heads/$Branch.zip" -OutFile $zip -UseBasicParsing
if (Test-Path $src) { Remove-Item -Recurse -Force $src }
Expand-Archive $zip -DestinationPath $src
$inner = (Get-ChildItem $src -Directory | Select-Object -First 1).FullName
robocopy $inner $AppDir /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Chép mã nguồn không thành công (robocopy $LASTEXITCODE)." }

Step "Cài thư viện"
Push-Location $AppDir
& $npm ci --omit=dev --no-audit --no-fund
$npmExit = $LASTEXITCODE
Pop-Location
if ($npmExit -ne 0) { throw "npm ci không thành công." }

Step "Chạy ứng dụng nền, tự khởi động cùng Windows"
@"
@echo off
rem Tao boi cai-dat-windows.ps1. Chay lai bo cai de cap nhat, khong sua tay.
set PORT=$Port
set HOST=127.0.0.1
set DATA_DIR=$DataDir
set TRUST_PROXY=1
set BACKUP_KEEP=14
set NODE_ENV=production
cd /d "$AppDir"
for %%F in ("$Root\nhat-ky.txt") do if %%~zF GTR 5000000 move /y "$Root\nhat-ky.txt" "$Root\nhat-ky.cu.txt" >nul
"$node" "$AppDir\server\index.js" >> "$Root\nhat-ky.txt" 2>&1
"@ | Set-Content -Encoding ascii "$Root\chay.cmd"

# Tác vụ chạy nền bằng tài khoản hệ thống, tự chạy khi bật máy (chưa cần ai đăng nhập), tự chạy lại khi bị tắt.
function Register-StartupTask($name, $exe, $arguments) {
  $action = New-ScheduledTaskAction -Execute $exe -Argument $arguments
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "S-1-5-18" -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
  if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) { Stop-ScheduledTask -TaskName $name }
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Start-ScheduledTask -TaskName $name
}
Register-StartupTask $TaskName "cmd.exe" "/c `"$Root\chay.cmd`""

$local = "http://localhost:$Port"
$state = $null
for ($i = 0; $i -lt 30 -and -not $state; $i++) {
  Start-Sleep -Seconds 1
  try { $state = Invoke-RestMethod "$local/api/state" } catch { }
}
if (-not $state) { throw "Ứng dụng chưa chạy. Xem lỗi trong $Root\nhat-ky.txt" }

Step "Không cho máy ngủ khi cắm điện (để giáo viên luôn vào được)"
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

if ($state.needsSetup) {
  Write-Host ""
  Write-Host "Mở $local trên máy này để tạo tài khoản quản trị (Ban giám hiệu) đầu tiên." -ForegroundColor Yellow
  Start-Process $local
  if ($Token -or $Hostname) {
    Write-Host "Bộ cài chờ tạo xong tài khoản rồi mới mở ra Internet, để người lạ không tạo trước được..." -ForegroundColor Yellow
    while ((Invoke-RestMethod "$local/api/state").needsSetup) { Start-Sleep -Seconds 3 }
    Write-Host "    Đã có tài khoản quản trị."
  }
}

if ($Token -or $Hostname) {
  Step "Cài Cloudflare Tunnel (mở ra Internet qua HTTPS)"
  $cf = Find-Cloudflared
  if (-not $cf) {
    $cfMsi = Join-Path $tmp "cloudflared.msi"
    Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi" -OutFile $cfMsi -UseBasicParsing
    Start-Process msiexec.exe -ArgumentList "/i `"$cfMsi`" /qn /norestart" -Wait
    $cf = Find-Cloudflared
    if (-not $cf) { throw "Cài cloudflared không thành công." }
  }
}

if ($Hostname) {
  # Tunnel tạo bằng đăng nhập Cloudflare (không qua Zero Trust nên không cần thẻ thanh toán).
  New-Item -ItemType Directory -Force $CfDir | Out-Null
  Protect-Folder $CfDir
  $cert = "$env:USERPROFILE\.cloudflared\cert.pem"
  $cred = "$CfDir\tunnel.json"
  if (-not (Test-Path $cert)) {
    Write-Host ""
    Write-Host "Trình duyệt sẽ mở trang Cloudflare: đăng nhập, bấm vào tên miền $($Hostname -replace '^[^.]+\.', ''), rồi bấm Authorize." -ForegroundColor Yellow
    Invoke-Native { & $cf tunnel login }
    if (-not (Test-Path $cert)) { throw "Chưa đăng nhập được Cloudflare. Chạy lại bộ cài và bấm Authorize trên trình duyệt." }
  }
  $env:TUNNEL_ORIGIN_CERT = $cert
  $list = (Invoke-Native { & $cf tunnel list --name $TunnelName --output json 2>$null }) -join ""
  if ($list -notmatch "`"name`":\s*`"$TunnelName`"") {
    Invoke-Native { & $cf tunnel create --cred-file $cred $TunnelName }
    if ($LASTEXITCODE -ne 0) { throw "Tạo tunnel không thành công." }
  } elseif (-not (Test-Path $cred)) {
    Invoke-Native { & $cf tunnel token --cred-file $cred $TunnelName }
    if ($LASTEXITCODE -ne 0) { throw "Lấy khóa tunnel không thành công." }
  }
  Invoke-Native { & $cf tunnel route dns --overwrite-dns $TunnelName $Hostname }
  if ($LASTEXITCODE -ne 0) { throw "Tạo bản ghi DNS cho $Hostname không thành công. Kiểm tra tên miền đã Active trong Cloudflare chưa." }
  # Chạy theo ID (đọc từ file khóa) để tác vụ nền không cần chứng chỉ đăng nhập cert.pem.
  $tunnelId = (Get-Content $cred -Raw | ConvertFrom-Json).TunnelID
  if (-not $tunnelId) { throw "File khóa tunnel $cred không hợp lệ." }
  Register-StartupTask $TunnelTask $cf "tunnel --no-autoupdate --loglevel warn --logfile `"$Root\tunnel-nhat-ky.txt`" run --cred-file `"$cred`" --url http://localhost:$Port $tunnelId"
  Write-Host "    Đã kết nối. Địa chỉ cho giáo viên: https://$Hostname (có thể chờ 1-2 phút)."
} elseif ($Token) {
  if (Get-Service cloudflared -ErrorAction SilentlyContinue) {
    Invoke-Native { & $cf service uninstall 2>$null | Out-Null }
    Start-Sleep -Seconds 2
  }
  Invoke-Native { & $cf service install $Token }
  if ($LASTEXITCODE -ne 0) { throw "Cài dịch vụ Cloudflare Tunnel không thành công. Kiểm tra lại mã tunnel." }
  Write-Host "    Đã kết nối. Mở bằng tên miền đã khai báo ở Cloudflare (mục Public Hostname)."
}

Write-Host ""
Write-Host "Xong." -ForegroundColor Green
Write-Host "  Trên máy này:  $local"
Write-Host "  Dữ liệu:       $dbFile"
Write-Host "  Sao lưu tự động mỗi ngày: $DataDir\sao-luu (nên chép ra USB hoặc Google Drive mỗi tuần)"
Write-Host "  Nhật ký:       $Root\nhat-ky.txt"
Write-Host "  Cập nhật bản mới: chạy lại đúng lệnh cài đặt (dữ liệu giữ nguyên)."
}
