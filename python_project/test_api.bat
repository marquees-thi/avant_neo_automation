@echo off
title Teste Rapido da API REST Local - Avant Neo 50W (Porta 21420)
echo ==============================================================================
echo Testando Endpoints da API Local (http://127.0.0.1:21420)
echo ==============================================================================
echo.

echo 1. Consultando Status Geral:
curl -s http://127.0.0.1:21420/api/status
echo.
echo.

echo 2. Alternando Alimentacao (Toggle Power):
curl -s -X POST http://127.0.0.1:21420/api/power/toggle
echo.
echo.

echo 3. Definindo Cor Cyberpunk Neon (Ciano 0, 255, 255):
curl -s -X POST http://127.0.0.1:21420/api/color/rgb -H "Content-Type: application/json" -d "{\"r\":0,\"g\":255,\"b\":255}"
echo.
echo.

echo 4. Definindo Branco Modo Leitura (Brilho 100%%, Temperatura 50%%):
curl -s -X POST http://127.0.0.1:21420/api/color/white -H "Content-Type: application/json" -d "{\"brightness\":100,\"color_temp\":50}"
echo.
echo.

echo 5. Iniciando Modo Ambilight:
curl -s -X POST http://127.0.0.1:21420/api/scene/start -H "Content-Type: application/json" -d "{\"scene\":\"ambilight\"}"
echo.
echo.

pause
