#!/usr/bin/env bash
# Builds the two debuggable test APKs for the Android update test, signed with a throwaway key:
#   $WORK/old.apk                       1.2.1 / versionCode 3  -> install this on the emulator
#   $WORK/release/Uku-Furigana-v1.2.2.apk  1.2.2 / versionCode 4  -> served by dev_relay.py as the "new release"
# Both talk to a relay on the emulator host (10.0.2.2:8788) and skip the GitHub direct path.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="${UKU_TEST_DIR:-/tmp/uku-update-test}"
mkdir -p "$WORK/release"
cd "$ROOT"

if [ ! -f "$WORK/test.jks" ]; then
  openssl rand -hex 12 > "$WORK/keystore.pass"
  "${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk}/bin/keytool" -genkeypair -keystore "$WORK/test.jks" -alias uku \
    -keyalg RSA -keysize 2048 -validity 3650 -dname "CN=Uku Test" \
    -storepass "$(cat "$WORK/keystore.pass")" -keypass "$(cat "$WORK/keystore.pass")"
fi
export ANDROID_KEYSTORE="$WORK/test.jks" ANDROID_KEYSTORE_PASSWORD="$(cat "$WORK/keystore.pass")"
export NEXT_PUBLIC_RELAY_BASE=http://10.0.2.2:8788 NEXT_PUBLIC_UPDATE_SOURCE=relay ANDROID_DEBUGGABLE=1

restore() { git checkout -- android/AndroidManifest.xml next-env.d.ts 2>/dev/null || true; }
trap restore EXIT

echo "== old (1.2.1 / 3)"; bash scripts/build-apk.sh; cp UkuFurigana.apk "$WORK/old.apk"
echo "== new (1.2.2 / 4)"
sed -i 's/android:versionCode="3"/android:versionCode="4"/; s/android:versionName="1.2.1"/android:versionName="1.2.2"/' android/AndroidManifest.xml
bash scripts/build-apk.sh; cp UkuFurigana.apk "$WORK/release/Uku-Furigana-v1.2.2.apk"
echo "done: $WORK"
