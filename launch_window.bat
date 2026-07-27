@echo off
cd /d "%~dp0"

start /b npm run dev > nul 2>&1

ping 127.0.0.1 -n 3 > nul

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000 --window-size=1280,830 --title="Furigana Dubbing Studio"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --window-size=1280,830 --title="Furigana Dubbing Studio"
) else (
    start http://localhost:3000
)
