#!/bin/bash
# Web-only: load the author's shared Claude config into this web session by
# downloading the public claude-resources mirror (HTTPS tarball) and running its
# web loader. Tarball, not `git clone`: web routes git through a scoped proxy
# that can reject out-of-scope clones (403), while plain HTTPS egress always
# works. Runs only in single-repo sessions (multi-repo sessions never register
# repo-level hooks — the env setup script covers those). No-ops on the local
# terminal; degrades gracefully if github.com is unreachable.
set -euo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
[ -n "${HOME:-}" ] || { echo "web-bootstrap: \$HOME unset — skipping" >&2; exit 0; }
# Pre-launch install wins: the env Setup script (primary loader) writes this
# sentinel after a successful install — skip so a tier-1 private-clone profile
# is not clobbered by this hook's public-mirror tarball. (if-form, not
# `[ -f ] && exit 0`: under set -e a missing sentinel would abort the script.)
if [ -f "$HOME/.claude/.web-profile-source" ]; then exit 0; fi
# --self-only gate: limit loading to web sessions that opt in, WITHOUT committing
# any personal identifier. Opt in by setting CLAUDE_WEB_PROFILE_OPT_IN=1 in your
# per-user web env (Claude Code on the web → Environment variables — per-account,
# not tracked in git). Other accounts that never set it no-op; it supports
# multiple accounts (each opts in), survives account switches (set the var in the
# new account's env — no source change), and fails loudly, not silently.
[ "${CLAUDE_WEB_PROFILE_OPT_IN:-}" = "1" ] || {
  echo "web-bootstrap: CLAUDE_WEB_PROFILE_OPT_IN not set — skipping" >&2
  exit 0
}

SRC="$HOME/.claude-src"
TARBALL="$(mktemp)"

# Fetch over plain HTTPS (curl -f fails on 404). Try main, then master.
# Loop, not a fetch() helper taking a positional param — this template gets
# copied around docs/skills where $-positionals can be mangled by skill
# argument substitution.
fetched=""
for ref in main master; do
  if curl -fsSL --max-time 120 \
      "https://github.com/Takazudo/claude-resources/archive/refs/heads/$ref.tar.gz" \
      -o "$TARBALL"; then
    fetched=1
    break
  fi
done

if [ -n "$fetched" ]; then
  rm -rf "$SRC"; mkdir -p "$SRC"
  # tar can fail on a 200-but-not-a-tarball response (proxy block page).
  if ! tar -xzf "$TARBALL" -C "$SRC" --strip-components=1; then
    rm -f "$TARBALL"; rm -rf "$SRC"
    echo "web-bootstrap: tarball extract failed — skipping web profile"
    exit 0
  fi
  rm -f "$TARBALL"
  bash "$SRC/scripts/setup-web.sh"
else
  rm -f "$TARBALL"
  echo "claude-resources unreachable (network policy?) — skipping web profile"
  exit 0
fi
