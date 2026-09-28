' ==============================================================================
' Inicializador Silencioso em Background para Windows 11
' Executa main.py via pythonw.exe sem abrir nenhuma janela de prompt/console
' ==============================================================================
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strScriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strScriptDir

' Executa usando pythonw (Python Windowless) sem foco e sem janela (0)
WshShell.Run "pythonw main.py", 0, False
