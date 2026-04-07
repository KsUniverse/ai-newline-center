#!/usr/bin/env bash
set -e
set -a
source ./.env.runtime.production
set +a
export PORT=3000
export HOSTNAME=0.0.0.0
node server.js
