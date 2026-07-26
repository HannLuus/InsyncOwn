#!/usr/bin/env bash
# Copy an existing rclone Google Drive remote into InsyncOwn's config for dogfood.
# Does not print secrets.
set -euo pipefail

SRC="${1:-$HOME/.config/rclone/rclone.conf}"
REMOTE="${2:-gdrive}"
DEST_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/insyncown"
DEST="$DEST_DIR/rclone.conf"

if [[ ! -f "$SRC" ]]; then
  echo "Source rclone config not found: $SRC" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
python3 - "$SRC" "$DEST" "$REMOTE" <<'PY'
import sys
from pathlib import Path

src = Path(sys.argv[1])
dest = Path(sys.argv[2])
remote = sys.argv[3]
text = src.read_text(encoding="utf-8", errors="replace")
lines = text.splitlines()
out: list[str] = []
in_section = False
found = False
for line in lines:
    if line.startswith("[") and line.endswith("]"):
        name = line[1:-1].strip()
        in_section = name == remote
        if in_section:
            found = True
            out.append(f"[{remote}]")
        continue
    if in_section:
        out.append(line)
if not found:
    raise SystemExit(f"Remote [{remote}] not found in {src}")
body = "\n".join(out).strip() + "\n"
if "type = drive" not in body and "type=drive" not in body:
    body = body.replace(f"[{remote}]", f"[{remote}]\ntype = drive", 1)
dest.write_text(body, encoding="utf-8")
print(f"Wrote {dest} from {src} remote [{remote}]")
print("Restart daemon: systemctl --user restart insyncown-daemon || npm run start:daemon")
PY
