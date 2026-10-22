@echo off
echo Building Uku Furigana (Next.js + PyWebView Native Desktop)...
call npm run package:exe
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b %ERRORLEVEL%
)
echo Build complete: UkuFurigana.exe created successfully.
pause
