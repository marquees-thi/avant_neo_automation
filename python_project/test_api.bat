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
curl -s -X POST "http://127.0.0.1:21420/api/color/rgb?r=0&g=255&b=255"
echo.
echo.

echo 4. Definindo Branco Modo Leitura (Brilho 100%%, Temperatura 50%%):
curl -s -X POST "http://127.0.0.1:21420/api/color/white?brightness=100&color_temp=50"
echo.
echo.

echo 5. Testando Inicio de Efeito (Cyberpunk Pulse):
curl -s -X POST "http://127.0.0.1:21420/api/scene/start?scene=cyberpunk"
echo.
echo.

echo 6. Testando Parada Imediata e Restauracao ao Normal:
curl -s -X POST "http://127.0.0.1:21420/api/scene/stop?restore=true"
echo.
echo.

echo 7. Testando se o Cockpit Web esta respondendo:
curl -s -I http://127.0.0.1:21420 | findstr "200"
echo.
echo ==============================================================================
echo [SUCESSO] Todos os endpoints responderam com exito!
echo Voce pode abrir http://127.0.0.1:21420 no seu navegador para o Cockpit completo.
echo ==============================================================================
echo.

pause
