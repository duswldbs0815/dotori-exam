#!/usr/bin/env bash
# Vercel 프로덕션 배포. 이 폴더를 git 정보 없이 임시 폴더로 복사해서 올립니다.
# (git 정보가 붙으면 Vercel Hobby 요금제가 배포를 BLOCKED로 막는 경우가 있어서)
# 실행: npm run deploy   (먼저 vercel login, vercel link 필요. .env.local과 data/는 올라가지 않음)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
rsync -a --exclude node_modules --exclude .next --exclude .git --exclude /data \
  --exclude .env.local --exclude .idea --exclude tsconfig.tsbuildinfo "$ROOT"/ "$TMP"/
cd "$TMP" && vercel deploy --prod --yes
