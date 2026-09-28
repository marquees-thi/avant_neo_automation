# ==============================================================================
# Teste de API REST Local - Avant Neo 50W IoT (PowerShell)
# Executa chamadas nativas sem dependencia de curl ou problemas de aspas
# ==============================================================================

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Testando API REST Local (http://127.0.0.1:21420)..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Status
Write-Host "`n1. Status Geral:" -ForegroundColor Yellow
$status = Invoke-RestMethod -Uri "http://127.0.0.1:21420/api/status" -Method Get
$status | Format-List

# 2. Toggle Power
Write-Host "2. Alternando Alimentação (Toggle):" -ForegroundColor Yellow
$toggle = Invoke-RestMethod -Uri "http://127.0.0.1:21420/api/power/toggle" -Method Post
$toggle | Format-List

# 3. Cor RGB
Write-Host "3. Definindo Cor Cyberpunk Neon (Ciano):" -ForegroundColor Yellow
$rgbBody = @{ r = 0; g = 255; b = 255 } | ConvertTo-Json
$rgb = Invoke-RestMethod -Uri "http://127.0.0.1:21420/api/color/rgb" -Method Post -ContentType "application/json" -Body $rgbBody
$rgb | Format-List

# 4. Branco Leitura
Write-Host "4. Definindo Branco Modo Leitura:" -ForegroundColor Yellow
$whiteBody = @{ brightness = 100; color_temp = 50 } | ConvertTo-Json
$white = Invoke-RestMethod -Uri "http://127.0.0.1:21420/api/color/white" -Method Post -ContentType "application/json" -Body $whiteBody
$white | Format-List

# 5. Iniciar Ambilight
Write-Host "5. Iniciando Modo Ambilight:" -ForegroundColor Yellow
$sceneBody = @{ scene = "ambilight" } | ConvertTo-Json
$scene = Invoke-RestMethod -Uri "http://127.0.0.1:21420/api/scene/start" -Method Post -ContentType "application/json" -Body $sceneBody
$scene | Format-List

Write-Host "`n[SUCESSO] Todos os testes foram executados com sucesso!" -ForegroundColor Green
Write-Host "Abrindo Painel Web no navegador: http://127.0.0.1:21420 ..." -ForegroundColor Cyan
Start-Process "http://127.0.0.1:21420"
