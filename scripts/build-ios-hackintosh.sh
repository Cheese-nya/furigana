#!/usr/bin/env bash
# ==============================================================================
# Furigana Dubbing Studio — Hackintosh Remote iOS Production Build Script
# ==============================================================================
# Builds the static Next.js export (`out/`), syncs the workspace to the remote
# Hackintosh (`hackintosh` / cheese@192.168.18.188), runs `npx cap sync ios`,
# and compiles the iOS App via `xcodebuild` (Simulator + Generic iOS Device).
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REMOTE_HOST="${HACKINTOSH_HOST:-hackintosh}"
REMOTE_DIR="${HACKINTOSH_DIR:-~/project/furigana}"

echo "=================================================================="
echo "1. Building Next.js Static Export (out/) on Local Machine..."
echo "=================================================================="

API_BACKUP_DIR=""
restore_api_routes() {
  if [[ -n "$API_BACKUP_DIR" && -d "$API_BACKUP_DIR/api" ]]; then
    mv "$API_BACKUP_DIR/api" "$ROOT_DIR/app/api"
    rmdir "$API_BACKUP_DIR" 2>/dev/null || true
  fi
}
trap restore_api_routes EXIT

if [[ -d "$ROOT_DIR/app/api" ]]; then
  API_BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/furigana-ios-api-backup.XXXXXX")"
  mv "$ROOT_DIR/app/api" "$API_BACKUP_DIR/api"
fi

NEXT_EXPORT=true npx next build
restore_api_routes

if [[ ! -f "$ROOT_DIR/out/index.html" ]]; then
  echo "ERROR: Static export out/index.html was not generated." >&2
  exit 1
fi

echo "=================================================================="
echo "2. Syncing Static Export & Project Files to Hackintosh ($REMOTE_HOST)..."
echo "=================================================================="

ssh -o ConnectTimeout=10 "$REMOTE_HOST" "mkdir -p $REMOTE_DIR"

rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'android/app/build' \
  --exclude 'android/.gradle' \
  --exclude 'ios/build' \
  --exclude 'ios/App/Pods' \
  "$ROOT_DIR/out" \
  "$ROOT_DIR/app" \
  "$ROOT_DIR/public" \
  "$ROOT_DIR/package.json" \
  "$ROOT_DIR/package-lock.json" \
  "$ROOT_DIR/capacitor.config.ts" \
  "$ROOT_DIR/tsconfig.json" \
  "$ROOT_DIR/next.config.ts" \
  "$REMOTE_HOST:$REMOTE_DIR/"

if [[ -d "$ROOT_DIR/ios/App/App" ]]; then
  ssh "$REMOTE_HOST" "mkdir -p $REMOTE_DIR/ios/App/App"
  rsync -az --exclude 'public' "$ROOT_DIR/ios/App/App/" "$REMOTE_HOST:$REMOTE_DIR/ios/App/App/"
  # Version and build settings live in the project file, not under ios/App/App.
  rsync -az "$ROOT_DIR/ios/App/App.xcodeproj/project.pbxproj" "$REMOTE_HOST:$REMOTE_DIR/ios/App/App.xcodeproj/"
fi

echo "=================================================================="
echo "3. Running Capacitor iOS Sync & Xcode Production Build on Hackintosh..."
echo "=================================================================="

ssh "$REMOTE_HOST" 'bash -se' <<'EOF'
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

cd ~/project/furigana

echo "--> Node: $(node -v), NPM: $(npm -v)"
echo "--> Xcode: $(xcodebuild -version | tr '\n' ' ')"

if [[ ! -d ios/App ]]; then
  npx cap add ios
fi

echo "--> Syncing Capacitor iOS project..."
npx cap sync ios

echo "--> Building iOS Release for iOS Simulator (iphonesimulator)..."
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -sdk iphonesimulator \
  -derivedDataPath ios/build-sim \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build | tail -n 25

echo "--> Building iOS Release for Generic iOS Device (iphoneos, unsigned bundle)..."
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath ios/build-device \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build | tail -n 25

SIM_APP="ios/build-sim/Build/Products/Release-iphonesimulator/App.app"
DEV_APP="ios/build-device/Build/Products/Release-iphoneos/App.app"

echo "=================================================================="
echo "iOS Production Build Artifacts Verified on Hackintosh:"
ls -ld "$SIM_APP" "$DEV_APP"
du -sh "$SIM_APP" "$DEV_APP"
echo "=================================================================="
EOF

SYNC_BACK="${SYNC_BACK:-0}"

# The local working copy is the source of truth for `ios/App/` (local edits are
# newer than the remote one). Copying the Hackintosh tree back would silently
# overwrite those local changes, so the rsync back is opt-in: run with
# `SYNC_BACK=1` only when you deliberately want the remote configuration to win.
if [[ "$SYNC_BACK" == "1" ]]; then
  echo "--> Syncing updated ios/App configuration back from Hackintosh..."
  rsync -az \
    --exclude 'Pods' \
    --exclude 'build*' \
    --exclude 'DerivedData' \
    --exclude 'public' \
    "$REMOTE_HOST:$REMOTE_DIR/ios/App/" "$ROOT_DIR/ios/App/"
else
  echo "--> Skipping ios/App sync-back: local tree is authoritative (set SYNC_BACK=1 to override)."
fi

echo "Hackintosh iOS Production Build Completed Successfully!"
