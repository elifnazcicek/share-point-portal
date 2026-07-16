@echo off
echo ==================================================
echo SharePoint Portal - Proje Baslatiliyor...
echo ==================================================

:: PATH Ayarlarini Guncelle (Dotnet ve Node24 surumlerini ekle)
set "PATH=C:\Users\stajyer\.gemini\antigravity\scratch\dotnet;C:\Users\stajyer\.gemini\antigravity\scratch\node24;%PATH%"

:: 1. Backend Sunucusunu Baslat
echo 1. Backend sunucusu yeni pencerede baslatiliyor (Port: 5100)...
start "SharePoint Backend Server" cmd /k "cd /d C:\Users\stajyer\Desktop\sharepoint-portal\backend && dotnet run --urls http://localhost:5100"

:: 2. Frontend Sunucusunu Baslat
echo 2. Frontend sunucusu yeni pencerede baslatiliyor (Port: 4400)...
start "SharePoint Frontend Server" cmd /k "cd /d C:\Users\stajyer\Desktop\sharepoint-portal\frontend && npm run start -- --port 4400"

echo ==================================================
echo Her iki sunucu da ayri pencerelerde baslatildi.
echo Frontend: http://localhost:4400
echo Backend:  http://localhost:5100
echo ==================================================
pause
