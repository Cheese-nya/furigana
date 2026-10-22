#!/usr/bin/env bash
# Runs on the Hackintosh (copied there by scripts/install-ipad.sh): signs, installs and
# launches the app on the connected iPad. Codesign over SSH needs the login keychain
# unlocked, so this prompts for the Mac login password interactively.
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "${HACKINTOSH_DIR:-$HOME/project/furigana}"

echo "==> 解锁登录钥匙串（请输入黑苹果的登录密码，输入时不显示）"
security unlock-keychain ~/Library/Keychains/login.keychain-db

DEVICE_ID="$(xcrun devicectl list devices 2>/dev/null | awk '/iPad/ && /available/ {print $3; exit}')"
if [[ -z "$DEVICE_ID" ]]; then
  echo "未找到已连接且可用的 iPad（请确认已解锁并信任此电脑）" >&2
  exit 1
fi
echo "==> 目标设备：$DEVICE_ID"

echo "==> 签名构建 Release（首次可能需要一两分钟）"
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination "platform=iOS,id=$DEVICE_ID" \
  -derivedDataPath ios/build-ipad \
  -allowProvisioningUpdates \
  build | grep -E "error:|BUILD (SUCCEEDED|FAILED)" || true

APP="ios/build-ipad/Build/Products/Release-iphoneos/App.app"
codesign --verify --deep --strict "$APP"

echo "==> 安装到 iPad"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP"

echo "==> 启动应用"
if ! xcrun devicectl device process launch --device "$DEVICE_ID" com.cheese.uku; then
  echo "已安装但未能自动启动：首次安装请在 iPad「设置 > 通用 > VPN 与设备管理」中信任开发者证书，然后点开「浮く」。"
fi
