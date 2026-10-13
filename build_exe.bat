@echo off
echo Building Furigana Dubbing Studio (Next.js + PyWebView Native Desktop)...
call npm run package:exe
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b %ERRORLEVEL%
)
echo Build complete: FuriganaDubbingStudio.exe created successfully.
pause
