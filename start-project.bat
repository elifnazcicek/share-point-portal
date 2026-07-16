@echo off
echo ==================================================
echo SharePoint Portal - Proje Baslatiliyor...
echo ==================================================

:: PATH Ayarlarini Guncelle (Dotnet ve Node24 surumlerini ekle)
set "PATH=C:\Users\stajyer\.gemini\antigravity\scratch\dotnet;C:\Users\stajyer\.gemini\antigravity\scratch\node24;%PATH%"

:: 1. Backend Sunucusunu Baslat (Tüm ağ arayüzlerini dinleyecek şekilde 0.0.0.0'a bağlanır)
echo 1. Backend sunucusu yeni pencerede baslatiliyor (Port: 5100)...
start "SharePoint Backend Server" cmd /k "cd /d C:\Users\stajyer\Desktop\sharepoint-portal\backend && dotnet run --urls http://0.0.0.0:5100"

:: 2. Frontend Sunucusunu Baslat (Tüm ağ arayüzlerini dinleyecek şekilde 0.0.0.0'a bağlanır)
echo 2. Frontend sunucusu yeni pencerede baslatiliyor (Port: 4400)...
start "SharePoint Frontend Server" cmd /k "cd /d C:\Users\stajyer\Desktop\sharepoint-portal\frontend && npm run start -- --port 4400 --host 0.0.0.0"

echo ==================================================
echo Her iki sunucu da ayri pencerelerde baslatildi.
echo Local erisim: http://localhost:4400
echo Ag (LAN) erisimi icin diger arkadaslariniz kendi tarayicilarina 
echo sizin yerel IP adresinizi (orn: http://192.168.1.XX:4400) yazabilir.
echo Yerel IP'nizi ogrenmek icin cmd ekranina 'ipconfig' yazabilirsiniz.
echo ==================================================
pause
