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
tools/update-test/build-test-apks.sh                      # old.apk + release/Uku-Furigana-v1.2.2.apk
python3 tools/update-test/dev_relay.py --dir /tmp/uku-update-test/release \
  --port 8788 --public-base http://10.0.2.2:8788           # fake release + fake /api/feedback
adb install -r /tmp/uku-update-test/old.apk && adb shell am start -n com.cheese.uku/.MainActivity
```

About 5 s after launch the app finds 1.2.2, downloads it and shows the yellow dot. Drive the menu through
DevTools (`adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.cheese.uku)`, then
`node tools/update-test/cdp.mjs '...'`); `adb shell input tap` is unreliable on the glass buttons. The first
install attempt opens the "install unknown apps" page; allow it, go back and tap the row again.
Use an emulator image with a recent WebView (the API 28 image ships Chrome 69 and cannot run the app).
Logs: `adb shell run-as com.cheese.uku cat files/native.log`.

## Windows (NOT verified)

The desktop download/apply code is covered by `tests/test_desktop_update.py`, but the real swap
(`build_apply_script` under cmd.exe, a frozen exe, relaunch) has not been run on Windows. To try it, build the exe
with `NEXT_PUBLIC_RELAY_BASE=http://192.168.122.1:8788 NEXT_PUBLIC_UPDATE_SOURCE=relay`, run it with
`UKU_UPDATE_TEST_HOST=192.168.122.1:8788`, and serve `Uku-Furigana-v1.2.2-windows.exe` from `dev_relay.py`.
