#!/usr/bin/env bash
set -euo pipefail

APP_NAME="ai-newline-center"
RELEASE_DIR="release/${APP_NAME}"

rm -rf .next release
mkdir -p "${RELEASE_DIR}"

set -a
source ./.env.build.production
set +a

pnpm install --frozen-lockfile
pnpm prisma generate
pnpm build:next

cp -R .next/standalone/* "${RELEASE_DIR}/"
mkdir -p "${RELEASE_DIR}/.next"
cp -R .next/static "${RELEASE_DIR}/.next/"
cp -R public "${RELEASE_DIR}/"
cp -R prisma "${RELEASE_DIR}/"

cat > "${RELEASE_DIR}/start.sh" <<'EOF'
#!/usr/bin/env bash
set -e
set -a
source ./.env.runtime.production
set +a
export PORT=3000
export HOSTNAME=0.0.0.0
node server.js
EOF

chmod +x "${RELEASE_DIR}/start.sh"

cd release
zip -rq "${APP_NAME}.zip" "${APP_NAME}"
