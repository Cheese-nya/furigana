# Update / feedback end-to-end test setup

Exercises the real update path (check → background download → SHA-256 → system installer) without touching
the production relay or GitHub. Nothing here is used by production builds: the hooks are build-time only.

| Hook | Effect |
| --- | --- |
| `NEXT_PUBLIC_RELAY_BASE` | where the app finds the relay (default `https://uku.saiaino.xyz`) |
| `NEXT_PUBLIC_UPDATE_SOURCE=relay` | skip the GitHub direct path so a fake release can be served |
| `ANDROID_DEBUGGABLE=1` (build-apk.sh) | debuggable APK; only then may `UpdateManager` fetch `http://10.0.2.2:` |
| `UKU_UPDATE_TEST_HOST=<host:port>` | desktop build: also accept `http://<host:port>/` update URLs |

## Android (verified on an API 34 google_apis x86_64 emulator, 2026-10-24)

```bash
tools/update-test/build-test-apks.sh                      # old.apk + release/Uku-Furigana-v<next patch>.apk
python3 tools/update-test/dev_relay.py --dir /tmp/uku-update-test/release \
  --port 8788 --public-base http://10.0.2.2:8788           # fake release + fake /api/feedback
adb install -r /tmp/uku-update-test/old.apk && adb shell am start -n com.cheese.uku/.MainActivity
```

About 5 s after launch the app finds the next version, downloads it and shows the yellow dot. Drive the menu through
DevTools (`adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.cheese.uku)`, then
`node tools/update-test/cdp.mjs '...'`); `adb shell input tap` is unreliable on the glass buttons. The first
install attempt opens the "install unknown apps" page; allow it, go back and tap the row again.
Use an emulator image with a recent WebView (the API 28 image ships Chrome 69 and cannot run the app).
Logs: `adb shell run-as com.cheese.uku cat files/native.log`.

## Windows (verified on the `win10-powerbi` libvirt VM, 2026-10-24)

The whole path ran for real: a frozen `UkuFurigana.exe` found 1.2.2, downloaded and verified it, quit, was swapped
by the helper script, and the new exe started with a clean first page load (no `.old` left behind).

1. Build the web bundle for the VM: `NEXT_PUBLIC_RELAY_BASE=http://192.168.122.1:8788 NEXT_PUBLIC_UPDATE_SOURCE=relay npm run build:web`,
   zip `out/` together with `desktop_runner.py`, `app_icon.ico`, `requirements-desktop.txt` and copy it to `C:\uku-test\winpkg.zip`.
2. `windows/build-win.ps1` unpacks it and builds two exes with PyInstaller (`old\` and `new\`; the second differs by a marker file).
3. Serve the new exe as the release: `dev_relay.py --dir <dir with Uku-Furigana-v1.2.2-windows.exe> --public-base http://192.168.122.1:8788`.
4. `windows/launch-win.ps1` installs the old exe into `C:\uku-test\app` and starts it through Explorer in the interactive session,
   with `UKU_UPDATE_TEST_HOST=192.168.122.1:8788` and `UKU_DEBUG_PORT=9223` set as user variables.
5. Forward the DevTools port (`ssh -L 9223:127.0.0.1:9223 ...`) and drive the page with `CDP_PORT=9223 node cdp.mjs '...'`.
   `windows/swap-state.ps1` shows the installed exe hash and running processes; `windows/cleanup-win.ps1` removes the test setup.

Things that bit us (all fixed in `desktop_runner.py` and the front end, each has a test):
- the apply helper must not use a pipe (`tasklist | find`): detached from a windowed app it aborted before the swap;
- the new exe must be started with `PYINSTALLER_RESET_ENVIRONMENT=1` and without `_MEIPASS2`/`_PYI_*`, or it looks for DLLs in the old extraction dir;
- pywebview exposes an empty `api` first, so wait for the methods (`pywebviewready`), not just the object;
- the desktop build is recognised from `?desktop=1`, because `window.pywebview` can appear after the first render.

Practical notes: the VM's Windows network profile must be *Private* or the SSH firewall rule drops port 22; run PowerShell over ssh with
`$ProgressPreference = 'SilentlyContinue'` and pass scripts with `-File` (a native command such as `schtasks` swallows a script piped on stdin).
