@echo off
echo Building Furigana Dubbing Studio (Python Native)...
python -m PyInstaller --noconfirm --onefile --windowed --name "FuriganaDubbingStudio_Native" app.py
echo Copying to root directory...
copy "dist\FuriganaDubbingStudio_Native.exe" ".\FuriganaDubbingStudio_Native.exe"
echo Build complete!
pause
