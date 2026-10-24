$ProgressPreference = 'SilentlyContinue'
Get-Process UkuFurigana -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 2
Remove-Item -Recurse -Force C:\uku-test\app, C:\Users\pbi\AppData\Local\UkuFurigana\updates -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force C:\uku-test\app | Out-Null
Copy-Item C:\uku-test\old\UkuFurigana.exe C:\uku-test\app\UkuFurigana.exe
"installed old exe: " + (Get-FileHash C:\uku-test\app\UkuFurigana.exe).Hash.Substring(0,16)
[Environment]::SetEnvironmentVariable('UKU_UPDATE_TEST_HOST', '192.168.122.1:8788', 'User')
[Environment]::SetEnvironmentVariable('UKU_DEBUG_PORT', '9223', 'User')
cmd /c "schtasks /delete /tn ukutest2 /f >nul 2>&1 <nul"
cmd /c "schtasks /create /tn ukutest2 /tr ""explorer.exe C:\uku-test\app\UkuFurigana.exe"" /sc once /st 23:59 /f /it >nul <nul"
cmd /c "schtasks /run /tn ukutest2 >nul <nul"
Start-Sleep 25
$p = Get-Process UkuFurigana -ErrorAction SilentlyContinue
if ($p) { foreach ($x in $p) { $c = Get-CimInstance Win32_Process -Filter "ProcessId=$($x.Id)"; $par = Get-Process -Id $c.ParentProcessId -ErrorAction SilentlyContinue; "pid " + $x.Id + " session " + $x.SessionId + " parent " + $c.ParentProcessId + " (" + $par.ProcessName + ")" } } else { "NOT RUNNING" }
