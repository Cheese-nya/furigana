#!/usr/bin/env bash
# Install the current iOS build on the iPad connected to the Hackintosh.
# Run scripts/build-ios-hackintosh.sh first so the Hackintosh has the latest web bundle.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_HOST="${HACKINTOSH_HOST:-hackintosh}"
REMOTE_DIR="${HACKINTOSH_DIR:-~/project/furigana}"

scp -q "$ROOT_DIR/scripts/ipad-install-remote.sh" "$REMOTE_HOST:/tmp/furigana-ipad-install.sh"
# -t gives the remote script a terminal so the keychain password prompt works.
ssh -t "$REMOTE_HOST" "HACKINTOSH_DIR=$REMOTE_DIR "'bash /tmp/furigana-ipad-install.sh; rc=$?; rm -f /tmp/furigana-ipad-install.sh; exit $rc'
