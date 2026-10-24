$ProgressPreference = 'SilentlyContinue'
Get-Process UkuFurigana, msedgewebview2, probe, probe2, find -ErrorAction SilentlyContinue | Stop-Process -Force
foreach ($t in 'ukutest','ukutest2','ukuprobe','ukuprobe2') { cmd /c "schtasks /delete /tn $t /f >nul 2>&1 <nul" }
foreach ($v in 'UKU_UPDATE_TEST_HOST','UKU_DEBUG_PORT','P2_VARIANT','P2_CWD') { [Environment]::SetEnvironmentVariable($v, $null, 'User') }
Remove-Item -Recurse -Force C:\uku-test\app, C:\uku-test\probe-app, C:\uku-test\probe-pkg, C:\uku-test\probe-dist, C:\uku-test\probe-work, C:\Users\pbi\AppData\Local\UkuFurigana\updates -ErrorAction SilentlyContinue
Remove-Item C:\uku-test\probe*.py, C:\uku-test\probe*.txt, C:\uku-test\probe*.bat, C:\uku-test\probe*.log, C:\uku-test\variant.txt, C:\uku-test\launch.bat -ErrorAction SilentlyContinue
"tasks left: " + ((cmd /c "schtasks /query /fo csv /nh 2>nul <nul" | Select-String -Pattern 'uku' | Measure-Object).Count)
"uku env vars left: " + (([Environment]::GetEnvironmentVariables('User').Keys | Where-Object { $_ -match '^(UKU_|P2_)' } | Measure-Object).Count)
"uku-test dir:"; Get-ChildItem C:\uku-test -Force | ForEach-Object { "  " + $_.Name }
