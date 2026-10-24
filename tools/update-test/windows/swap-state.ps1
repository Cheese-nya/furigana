$ProgressPreference = 'SilentlyContinue'
"installed exe: " + (Get-FileHash C:\uku-test\app\UkuFurigana.exe).Hash.Substring(0,16) + "  " + (Get-Item C:\uku-test\app\UkuFurigana.exe).Length
Get-ChildItem C:\uku-test\app | ForEach-Object { "  app\" + $_.Name + "  " + $_.Length }
$p = Get-Process UkuFurigana -ErrorAction SilentlyContinue
if ($p) { "running pids: " + (($p | ForEach-Object { $_.Id }) -join ",") + "  start: " + (($p | ForEach-Object { $_.StartTime.ToString('HH:mm:ss') }) -join ",") } else { "not running" }
Get-ChildItem C:\Users\pbi\AppData\Local\UkuFurigana\updates -ErrorAction SilentlyContinue | ForEach-Object { "  updates\" + $_.Name + "  " + $_.Length }
"--- uku.log tail"; Get-Content C:\Users\pbi\AppData\Local\UkuFurigana\logs\uku.log -Tail 8
