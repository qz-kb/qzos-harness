#!/bin/bash
# Local QZOS preview; delegate builds and watchers to the upstream DSH launcher.
set -euo pipefail
qzos_repo="$(cd "$(dirname "$0")/../../../.." && pwd)"
qzos_root="$(cd "$qzos_repo/../.." && pwd)"
qzos_node_version="$(tr -d '[:space:]' < "$qzos_repo/.node-version")"
qzos_node_dir="$qzos_root/.local/toolchains/node-v$qzos_node_version/bin"
if [[ ! -x "$qzos_node_dir/node" ]]; then
  echo "缺少项目要求的 Node $qzos_node_version：$qzos_node_dir/node" >&2
  exit 1
fi
export PATH="$qzos_node_dir:$PATH"
if [[ "$(node --version)" != "v$qzos_node_version" ]]; then
  echo 'Node 版本不匹配，启动已停止。' >&2
  exit 1
fi
if lsof -nP -iTCP:3081 -sTCP:LISTEN >/dev/null 2>&1; then
  echo '3081 已被占用。请在原启动终端按 Ctrl+C，再运行本命令。' >&2
  exit 1
fi
cd "$qzos_repo"
echo "Node $(node --version)：构建最新代码后启动，后续修改自动重新构建。"
exec pnpm run dev:web --patch apps/web/tests/pin-browse-picker.overlay.yml --port 3081 --no-open
