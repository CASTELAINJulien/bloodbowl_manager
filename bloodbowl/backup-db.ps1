# =====================================================
#  Sauvegarde de la base Blood Bowl (volume Docker bb_data)
#  Usage : clic droit > "Exécuter avec PowerShell", ou
#          PowerShell> .\backup-db.ps1
#  Crée un instantané daté dans le dossier ./backups
# =====================================================
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Le backend doit tourner (la base est dans son volume)
$running = docker ps --filter "name=bb_backend" --filter "status=running" --quiet
if (-not $running) {
    Write-Host "Le conteneur bb_backend ne tourne pas. Lancez d'abord : docker compose up -d" -ForegroundColor Red
    exit 1
}

$dir = Join-Path $PSScriptRoot 'backups'
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$out = Join-Path $dir "bloodbowl-$stamp.db"

# Instantané cohérent via l'API backup de SQLite (gère le mode WAL)
docker exec bb_backend node -e "import('better-sqlite3').then(async ({default:D})=>{const db=new D('/app/data/bloodbowl.db');await db.backup('/tmp/bb_backup.db');db.close();})"
docker cp bb_backend:/tmp/bb_backup.db "$out"
docker exec bb_backend rm -f /tmp/bb_backup.db

$size = [Math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host "Sauvegarde creee : $out ($size Ko)" -ForegroundColor Green

# On ne conserve que les 20 sauvegardes les plus recentes
Get-ChildItem $dir -Filter 'bloodbowl-*.db' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 20 |
    Remove-Item -Force -ErrorAction SilentlyContinue
