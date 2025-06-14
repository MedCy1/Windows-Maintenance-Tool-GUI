@echo off
title Windows Maintenance Tool - Admin Launcher
echo.
echo ==========================================
echo  Windows Maintenance Tool V2.9.8
echo  Lancement avec privileges administrateur
echo ==========================================
echo.

REM Verifier si on est deja administrateur
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Privileges administrateur detectes
    echo [INFO] Lancement en mode developpement...
    echo.
    npm run dev
    echo.
    echo [INFO] Application fermee
    pause
) else (
    echo [INFO] Demande d'elevation des privileges...
    echo [ACTION] Une fenetre UAC va s'ouvrir
    echo [TIP] Appuyez F12 dans l'app pour ouvrir DevTools si besoin
    echo.
    powershell -Command "Start-Process cmd -ArgumentList '/k cd /d \"%~dp0\" && echo [ADMIN] Lancement Windows Maintenance Tool... && npm run dev' -Verb RunAs"
    echo.
    echo [SUCCESS] Commande d'elevation envoyee
)

pause