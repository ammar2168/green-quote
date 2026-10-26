#!/bin/sh
#
# Creates .env from .env.example and fills in a random SESSION_SECRET:
#
#   sh scripts/init-env.sh
#
# Plain POSIX sh rather than a tsx script, so it works before `pnpm install`
# and for the Docker-only setup, which needs no Node at all. Safe to re-run: an
# existing SESSION_SECRET is never replaced, because changing it signs everyone
# out.

set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

if grep -q '^SESSION_SECRET=.' .env; then
  echo "SESSION_SECRET is already set; leaving it unchanged."
  exit 0
fi

# 32 random bytes, base64-encoded. Falls back to /dev/urandom where openssl is
# missing. Base64 never contains "|", so it is a safe sed delimiter below.
secret=$(openssl rand -base64 32 2>/dev/null ||
  head -c 32 /dev/urandom | base64 | tr -d '\n')

if grep -q '^SESSION_SECRET=' .env; then
  # Written via a temp file because `sed -i` takes different flags on macOS
  # and Linux.
  sed "s|^SESSION_SECRET=.*|SESSION_SECRET=$secret|" .env >.env.tmp
  mv .env.tmp .env
else
  printf '\nSESSION_SECRET=%s\n' "$secret" >>.env
fi

echo "Generated SESSION_SECRET in .env."
