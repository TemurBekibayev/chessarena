# Automated VPS Backup Script for Grand Arena
$ErrorActionPreference = "Stop"

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = "backups\backup_$Timestamp"
$ArchiveName = "backups\chess_backup_vps_$Timestamp.tar.gz"

Write-Host "📦 1. VPS serverda to'liq arxiv yaratilmoqda..." -ForegroundColor Cyan
ssh -o StrictHostKeyChecking=no root@13.140.171.252 "cd /var/www/chess.amuhr.uz; tar -czf /tmp/chess_backup_latest.tar.gz --exclude=node_modules . ; ls -lh /tmp/chess_backup_latest.tar.gz"

Write-Host "⬇️ 2. Arxiv local kompyuterga yuklab olinmoqda..." -ForegroundColor Cyan
if (-not (Test-Path "backups")) { New-Item -ItemType Directory -Path "backups" | Out-Null }
scp -o StrictHostKeyChecking=no root@13.140.171.252:/tmp/chess_backup_latest.tar.gz $ArchiveName

Write-Host "📂 3. Arxiv ochilmoqda ($BackupDir)..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
tar -xzf $ArchiveName -C $BackupDir

Write-Host "🔄 4. data/database.json va .env local ishchi papkaga yangilanmoqda..." -ForegroundColor Cyan
Copy-Item "$BackupDir\data\database.json" "data\database.json" -Force
if (Test-Path "$BackupDir\.env") {
    Copy-Item "$BackupDir\.env" ".env" -Force
}

Write-Host "✅ Backup muvaffaqiyatli yakunlandi!" -ForegroundColor Green
Write-Host "Arxiv: $ArchiveName" -ForegroundColor Yellow
Write-Host "Ochilgan fayllar: $BackupDir" -ForegroundColor Yellow
Write-Host "Local baza: data\database.json yangilandi." -ForegroundColor Yellow
