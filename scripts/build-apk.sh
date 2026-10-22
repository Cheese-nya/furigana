#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
BUILD_DIR="$ANDROID_DIR/build"
ASSETS_WWW="$ANDROID_DIR/assets/www"

export JAVA_HOME="/usr/lib/jvm/java-17-openjdk"
export PATH="$JAVA_HOME/bin:$PATH"

SDK_DIR="/home/cheese/Android/Sdk"
BUILD_TOOLS="$SDK_DIR/build-tools/33.0.2"
ANDROID_JAR="$SDK_DIR/platforms/android-33/android.jar"

AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"

echo "==> [1/7] Preparing Android resources and web assets..."
rm -rf "$BUILD_DIR" "$ASSETS_WWW"
mkdir -p "$BUILD_DIR/compiled_res" \
         "$BUILD_DIR/gen" \
         "$BUILD_DIR/classes" \
         "$BUILD_DIR/dex" \
         "$ANDROID_DIR/res/mipmap-xxxhdpi" \
         "$ANDROID_DIR/res/values" \
         "$ANDROID_DIR/keystore" \
         "$ASSETS_WWW"

python3 - "$ROOT_DIR/public/logo.png" "$ANDROID_DIR/res/mipmap-xxxhdpi/ic_launcher.png" "$ROOT_DIR/public/promo-1x1.png" <<'PYEOF'
import sys, shutil
src, dst, fallback = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    from PIL import Image
    im = Image.open(src).convert("RGBA").resize((192, 192))
    im.save(dst, format="PNG")
except Exception:
    shutil.copyfile(fallback, dst)
PYEOF

cat > "$ANDROID_DIR/res/values/strings.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Furigana Studio</string>
</resources>
EOF

echo "==> Building fresh Next.js static export (out/)..."
rm -rf "$ROOT_DIR/out" /tmp/furigana_api_backup
mv "$ROOT_DIR/app/api" /tmp/furigana_api_backup
restore_api() {
  if [ -d /tmp/furigana_api_backup ] && [ ! -d "$ROOT_DIR/app/api" ]; then
    mv /tmp/furigana_api_backup "$ROOT_DIR/app/api"
  fi
}
trap restore_api EXIT
(cd "$ROOT_DIR" && NEXT_EXPORT=true npx next build)
restore_api

cp -r "$ROOT_DIR/out/"* "$ASSETS_WWW/"

# Rename .dat.gz files to .dat.gz.bin so Android AssetManager never auto-decompresses Kuromoji dictionaries
if [ -d "$ASSETS_WWW/dict" ]; then
  for gzfile in "$ASSETS_WWW/dict/"*.dat.gz; do
    if [ -f "$gzfile" ]; then
      mv "$gzfile" "${gzfile}.bin"
    fi
  done
fi

echo "==> [2/7] Compiling Android resources with aapt2..."
"$AAPT2" compile --dir "$ANDROID_DIR/res" -o "$BUILD_DIR/compiled_res/res.zip"

echo "==> [3/7] Linking APK and generating R.java with aapt2..."
"$AAPT2" link \
  -I "$ANDROID_JAR" \
  --manifest "$ANDROID_DIR/AndroidManifest.xml" \
  --java "$BUILD_DIR/gen" \
  -A "$ANDROID_DIR/assets" \
  -0 .bin -0 .gz -0 .dat -0 .wasm -0 .woff2 -0 .mp3 -0 .ogg \
  -o "$BUILD_DIR/unaligned.apk" \
  "$BUILD_DIR/compiled_res/res.zip"

echo "==> [4/7] Compiling Java sources with JDK 17..."
find "$ANDROID_DIR/src" "$BUILD_DIR/gen" -name "*.java" > "$BUILD_DIR/sources.txt"
"$JAVA_HOME/bin/javac" \
  --release 11 \
  -encoding UTF-8 \
  -cp "$ANDROID_JAR" \
  -d "$BUILD_DIR/classes" \
  @"$BUILD_DIR/sources.txt"

echo "==> [5/7] Compiling classes.dex with d8..."
find "$BUILD_DIR/classes" -name "*.class" > "$BUILD_DIR/classes.txt"
"$D8" \
  --lib "$ANDROID_JAR" \
  --min-api 24 \
  --output "$BUILD_DIR/dex" \
  $(cat "$BUILD_DIR/classes.txt")

echo "==> [6/7] Packaging classes.dex and aligning APK..."
(cd "$BUILD_DIR/dex" && zip -q -u "$BUILD_DIR/unaligned.apk" classes.dex)
"$ZIPALIGN" -f -p 4 "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

KEYSTORE="$ANDROID_DIR/keystore/furigana-release.jks"
if [ ! -f "$KEYSTORE" ]; then
  echo "==> Generating signing keystore..."
  "$JAVA_HOME/bin/keytool" -genkeypair \
    -v \
    -keystore "$KEYSTORE" \
    -alias furigana \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass furigana123 \
    -keypass furigana123 \
    -dname "CN=Furigana Studio, OU=Dubbing, O=Cheese, L=Tokyo, S=Tokyo, C=JP"
fi

echo "==> [7/7] Signing and verifying APK..."
FINAL_APK="$ROOT_DIR/FuriganaStudio.apk"
VERSIONED_APK="$BUILD_DIR/FuriganaStudio-v1.2.0.apk"

"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias furigana \
  --ks-pass pass:furigana123 \
  --key-pass pass:furigana123 \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --out "$FINAL_APK" \
  "$BUILD_DIR/aligned.apk"

cp "$FINAL_APK" "$VERSIONED_APK"
"$APKSIGNER" verify --verbose "$FINAL_APK"

# Clean temporary build copies of assets to keep repo light
rm -rf "$ASSETS_WWW" "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

echo "==> APK successfully built:"
ls -lh "$FINAL_APK" "$VERSIONED_APK"
