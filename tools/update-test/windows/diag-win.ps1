$ProgressPreference = 'SilentlyContinue'
"== processes"
Get-CimInstance Win32_Process -Filter "Name='UkuFurigana.exe' or Name='msedgewebview2.exe'" | ForEach-Object { $_.Name + " pid " + $_.ProcessId + " parent " + $_.ParentProcessId + " start " + $_.CreationDate.ToString('HH:mm:ss') }
"== uku.log (last 24 lines, trimmed)"
Get-Content C:\Users\pbi\AppData\Local\UkuFurigana\logs\uku.log -Tail 60 | Where-Object { $_ -match '^\d{4}-|Exception|WebView2' } | Select-Object -Last 14 | ForEach-Object { if ($_.Length -gt 190) { $_.Substring(0,190) } else { $_ } }
