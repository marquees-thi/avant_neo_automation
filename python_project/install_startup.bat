@echo off
title Configurar Inicializacao Automatica no Windows 11 - Avant Neo 50W IoT
echo ==============================================================================
echo Adicionando Avant Neo 50W IoT Engine a pasta Inicializar (Startup) do Windows
echo ==============================================================================
echo.

set SCRIPT_DIR=%~dp0
set TARGET_VBS=%SCRIPT_DIR%start_background.vbs
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_FOLDER%\AvantNeoBulb.lnk

powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT_PATH%');$s.TargetPath='wscript.exe';$s.Arguments='\"%TARGET_VBS%\"';$s.WorkingDirectory='%SCRIPT_DIR%';$s.Description='Avant Neo 50W IoT Background Controller';$s.Save()"

if %ERRORLEVEL% EQU 0 (
    echo [SUCESSO] Atalho criado em:
    echo %SHORTCUT_PATH%
    echo.
    echo O aplicativo agora iniciara automaticamente de forma silenciosa sempre
    echo que voce fizer login no Windows 11!
) else (
    echo [ERRO] Falha ao criar o atalho de inicializacao.
)

echo.
pause
