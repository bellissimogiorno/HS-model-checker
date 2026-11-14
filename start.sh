#!/bin/sh
# Works from any current directory; starts a localhost-only server.
set -eu
cd -- "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec python3 serve.py --open "$@"
