#!/usr/bin/env bash
# build.sh — build InkLab CN Windows release packages.
#
# Output naming (per g2):
#   InkLab-Windows-cn-v0.7.43.zip
#
# CN builds ship Windows only (Linux/macOS cross-builds are not maintained).
#
# Domestic mirrors first; anything without a CN mirror uses the machine proxy
# (HTTP_PROXY / HTTPS_PROXY / ALL_PROXY) if set.
#
# Usage:
#   ./build.sh                  # windows/amd64 (default)
#   ./build.sh -v 0.7.43        # set version
#   ./build.sh -p windows       # explicit windows/amd64
#   ./build.sh --skip-deps      # skip node/go/wails install steps
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

VERSION="0.7.43"
PLATFORMS="windows"
SKIP_DEPS=0
OUT_DIR="${ROOT}/dist"

# --- mirrors (CN) -----------------------------------------------------------
# npm / node
export NPM_CONFIG_REGISTRY="${NPM_CONFIG_REGISTRY:-https://registry.npmmirror.com}"
# Go modules
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
export GOSUMDB="${GOSUMDB:-sum.golang.google.cn}"
# Pin the toolchain from go.mod. Host Go 1.27+ breaks Wails v2.11 type analysis
# ("package fmt without types was imported from .../cmd/genspellenums").
export GOTOOLCHAIN="${GOTOOLCHAIN:-go1.24.3}"
# Electron / node binary mirrors (harmless if unused)
export ELECTRON_MIRROR="${ELECTRON_MIRROR:-https://npmmirror.com/mirrors/electron/}"
export NODEJS_ORG_MIRROR="${NODEJS_ORG_MIRROR:-https://npmmirror.com/mirrors/node/}"
export NVM_NODEJS_ORG_MIRROR="${NVM_NODEJS_ORG_MIRROR:-https://npmmirror.com/mirrors/node/}"

# If no CN mirror applies, fall through to the local proxy when present.
if [[ -z "${HTTP_PROXY:-}${HTTPS_PROXY:-}${ALL_PROXY:-}${http_proxy:-}${https_proxy:-}${all_proxy:-}" ]]; then
  : # no proxy configured — direct / mirror only
else
  echo "Using local proxy for non-mirrored downloads"
fi

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \?//'
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--version) VERSION="${2#v}"; shift 2 ;;
    -p|--platforms) PLATFORMS="$2"; shift 2 ;;
    --skip-deps) SKIP_DEPS=1; shift ;;
    -o|--out) OUT_DIR="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "unknown arg: $1"; usage ;;
  esac
done

TAG="v${VERSION}"
CN_TAG="cn-v${VERSION}"

log() { printf '\n==> %s\n' "$*"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

# Prefer a real Linux node/npm. On WSL, Windows npm often appears first in PATH
# and breaks builds (EPERM / EISDIR under \\wsl.localhost\...).
prefer_linux_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$NVM_DIR/nvm.sh"
    nvm use 20 >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
  fi
  # Drop Windows npm/node from PATH if present.
  local cleaned=()
  local p
  IFS=':' read -ra _parts <<< "$PATH"
  for p in "${_parts[@]}"; do
    case "$p" in
      /mnt/c/*|*/AppData/*|*/WINDOWS*|*/Windows*) continue ;;
    esac
    # Windows "Program Files" paths (space) — skip without breaking `case`.
    if [[ "$p" == *'/Program Files'* ]] || [[ "$p" == *'/ProgramFiles'* ]]; then
      continue
    fi
    cleaned+=("$p")
  done
  PATH="$(IFS=:; echo "${cleaned[*]}")"
  export PATH
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    if file "$(command -v node)" 2>/dev/null | grep -qi 'ELF.*Linux'; then
      echo "node $(node -v) / npm $(npm -v) ($(command -v node))"
      return 0
    fi
  fi
  return 1
}

install_node_if_needed() {
  if prefer_linux_node; then
    return
  fi
  log "Installing Node.js 20 via nvm (npmmirror)..."
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    # nvm install script — prefer gitee mirror when curl github is slow
    curl -fsSL https://gitee.com/mirrors/nvm/raw/master/install.sh -o /tmp/nvm-install.sh \
      || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh -o /tmp/nvm-install.sh
    bash /tmp/nvm-install.sh
  fi
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm install 20
  nvm use 20
  prefer_linux_node || {
    echo "ERROR: need a Linux node binary; Windows npm under WSL will fail" >&2
    exit 1
  }
}

install_go_tools() {
  need_cmd go
  # Force the pinned toolchain (downloads once via GOPROXY / proxy).
  echo "host $(command go version 2>/dev/null || true)"
  echo "build toolchain: $(GOTOOLCHAIN="$GOTOOLCHAIN" go version)"
  local gbin
  gbin="$(GOTOOLCHAIN="$GOTOOLCHAIN" go env GOPATH)/bin"
  case ":$PATH:" in
    *":$gbin:"*) ;;
    *) export PATH="$gbin:$PATH" ;;
  esac
  if ! command -v wails >/dev/null 2>&1; then
    log "Installing wails v2.11.0 (with ${GOTOOLCHAIN})..."
    GOTOOLCHAIN="$GOTOOLCHAIN" go install github.com/wailsapp/wails/v2/cmd/wails@v2.11.0
  fi
  need_cmd wails
  echo "wails $(wails version 2>/dev/null | head -1 || true)"
}

setup_frontend() {
  log "Frontend deps (npm registry=${NPM_CONFIG_REGISTRY})"
  need_cmd npm
  npm config set registry "$NPM_CONFIG_REGISTRY"
  (
    cd frontend
    if [[ -f package-lock.json ]]; then
      npm ci --prefer-offline || npm install
    else
      npm install
    fi
  )
}

set_product_version() {
  log "Set productVersion=${VERSION} (CN)"
  node -e "
const fs=require('fs');
const j=JSON.parse(fs.readFileSync('wails.json','utf8'));
j.info = j.info || {};
j.info.productVersion = '${VERSION}';
j.info.productName = j.info.productName || 'InkLab';
if (!String(j.info.productName).includes('中文')) {
  j.info.productName = 'InkLab - 魔兽世界工具箱（中文）';
}
j.info.comments = 'InkLab 中文版 — 1.18.1 数据本地化';
fs.writeFileSync('wails.json', JSON.stringify(j, null, 4) + '\n');
"
}

# Zip helpers: prefer `zip`, else Python (WSL often has no zip binary).
package_zip() {
  local dest="$1" src="$2" arcname="$3"
  rm -f "$dest"
  if command -v zip >/dev/null 2>&1; then
    (cd "$(dirname "$src")" && zip -9 "$dest" "$(basename "$src")")
    # rename entry if needed
    return 0
  fi
  python3 - "$dest" "$src" "$arcname" <<'PY'
import sys, zipfile
dest, src, arc = sys.argv[1], sys.argv[2], sys.argv[3]
with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.write(src, arc)
PY
}

package_zip_dir() {
  local dest="$1" srcdir="$2" arcroot="$3"
  rm -f "$dest"
  if command -v zip >/dev/null 2>&1; then
    (cd "$(dirname "$srcdir")" && zip -9r "$dest" "$(basename "$srcdir")")
    return 0
  fi
  python3 - "$dest" "$srcdir" "$arcroot" <<'PY'
import os, sys, zipfile
dest, srcdir, arcroot = sys.argv[1], sys.argv[2], sys.argv[3]
with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, _, files in os.walk(srcdir):
        for f in files:
            path = os.path.join(root, f)
            rel = os.path.join(arcroot, os.path.relpath(path, srcdir))
            z.write(path, rel)
PY
}

build_one() {
  local platform="$1" artifact_base="$2" artifact_ext="$3" build_tags="${4:-}"
  local name="InkLab-${artifact_base}-${CN_TAG}.${artifact_ext}"

  log "Building ${platform} -> ${name} (GOTOOLCHAIN=${GOTOOLCHAIN})"
  # shellcheck disable=SC2086
  GOTOOLCHAIN="$GOTOOLCHAIN" wails build -platform "${platform}" -skipbindings ${build_tags} \
    -ldflags "-X main.Version=${TAG}-cn -X main.Repo=inklab-cn"

  mkdir -p "$OUT_DIR"
  case "$artifact_base" in
    Windows)
      # Guard against accidentally shipping a Linux ELF renamed to .exe
      # (e.g. plain `go build -o InkLab.exe` without GOOS=windows).
      if ! file build/bin/InkLab.exe | grep -q 'PE32+.*x86-64'; then
        echo "ERROR: build/bin/InkLab.exe is not a Windows x64 PE:" >&2
        file build/bin/InkLab.exe >&2
        exit 1
      fi
      package_zip "${OUT_DIR}/${name}" build/bin/InkLab.exe InkLab.exe
      ;;
    Linux)
      tar -czvf "${OUT_DIR}/${name}" -C build/bin InkLab
      ;;
    macOS)
      if [[ -d build/bin/InkLab.app ]]; then
        package_zip_dir "${OUT_DIR}/${name}" build/bin/InkLab.app InkLab.app
      else
        # cross-compile may emit a bare binary
        package_zip "${OUT_DIR}/${name}" build/bin/InkLab InkLab
      fi
      ;;
  esac
  echo "✓ ${OUT_DIR}/${name}"
}

# --- main -------------------------------------------------------------------
log "InkLab CN build ${CN_TAG}"
mkdir -p "$OUT_DIR"

if [[ "$SKIP_DEPS" -eq 0 ]]; then
  install_node_if_needed
  install_go_tools
  setup_frontend
else
  prefer_linux_node || true
  need_cmd node
  need_cmd npm
  need_cmd go
  need_cmd wails
fi

set_product_version

IFS=',' read -ra PLAT_ARR <<< "$PLATFORMS"
for p in "${PLAT_ARR[@]}"; do
  p="$(echo "$p" | tr '[:upper:]' '[:lower:]' | xargs)"
  case "$p" in
    windows|win)
      build_one "windows/amd64" "Windows" "zip" ""
      ;;
    linux|macos|darwin|mac)
      echo "CN builds are Windows-only; refusing platform: $p" >&2
      exit 1
      ;;
    *)
      echo "unknown platform: $p (use windows)" >&2
      exit 1
      ;;
  esac
done

log "Done. Artifacts in ${OUT_DIR}:"
ls -lh "$OUT_DIR"/InkLab-*-"${CN_TAG}".* 2>/dev/null || ls -lh "$OUT_DIR"
