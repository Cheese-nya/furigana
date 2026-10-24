$ProgressPreference = 'SilentlyContinue'
Set-Location C:\uku-test
Remove-Item -Recurse -Force src, old, new -ErrorAction SilentlyContinue
Expand-Archive -Force winpkg.zip src
Set-Location src
"files in out: " + (Get-ChildItem out -Recurse -File | Measure-Object).Count
New-Item -ItemType Directory -Force ..\old, ..\new | Out-Null
"== build OLD"
cmd /c "python -m PyInstaller --noconfirm --onefile --windowed --icon=app_icon.ico --name UkuFurigana --add-data out;out desktop_runner.py > ..\build-old.log 2>&1"
Get-Content ..\build-old.log -Tail 4
Copy-Item dist\UkuFurigana.exe ..\old\UkuFurigana.exe
"1.2.2 marker" | Set-Content out\VERSION.txt
"== build NEW"
cmd /c "python -m PyInstaller --noconfirm --onefile --windowed --icon=app_icon.ico --name UkuFurigana --add-data out;out desktop_runner.py > ..\build-new.log 2>&1"
Get-Content ..\build-new.log -Tail 4
Copy-Item dist\UkuFurigana.exe ..\new\UkuFurigana.exe
Get-FileHash ..\old\UkuFurigana.exe, ..\new\UkuFurigana.exe | ForEach-Object { $_.Hash.Substring(0,16) + "  " + $_.Path + "  " + (Get-Item $_.Path).Length }
"BUILD-DONE"
