#!/usr/bin/env bash
# Fix permissions on the mounted volumes on first use.
#
# Runs as the non-root user. The base image grants that user passwordless sudo,
# so ownership changes go through sudo. Docker creates named volumes root-owned;
# without this step the editor server cannot write its IPC socket under /tmp and
# the container exits at startup.
#
# Idempotent and non-fatal: every step tolerates an already-correct volume and a
# failure is logged rather than propagated, so a rebuild never breaks create.

# Resolve the user and its home once so no path is hardcoded twice.
username="$(id -un)"
home_dir="${HOME:-/home/${username}}"

uid="$(id -u)"
gid="$(id -g)"

log() {
  printf 'post-create: %s\n' "$*"
}

# Run a command, log it, and never propagate failure.
run() {
  "$@" || log "WARN: '$*' failed (continuing)"
}

# The opencode data and state volumes are mounted under ~/.local and start
# root-owned. Chowning ~/.local recursively in one step takes both volumes (and
# the parent directory) to the running user's numeric UID:GID. mkdir -p is a
# no-op when a feature already created the directory.
run sudo mkdir -p "$home_dir/.local/"
run sudo chown -R "$uid:$gid" "$home_dir/.local/"

# /tmp is a named volume Docker creates root-owned with mode 0755. Give it to the
# running user and make it the world-writable sticky directory a tmpfs would have
# provided, so every process (and the editor server) can write.
run sudo chown "$uid:$gid" /tmp
run sudo chmod 1777 /tmp

# The workspace bind mount is owned by the host user, which the in-container git
# sees as a different owner. Mark it safe so git does not refuse with "dubious
# ownership". Add only when absent so repeated rebuilds stay idempotent.
workspace="$(pwd)"
if ! git config --global --get-all safe.directory 2>/dev/null | grep -qxF "$workspace"; then
  run git config --global --add safe.directory "$workspace"
fi

log "done"
