#!/bin/sh
# 윈도우 실행 파일 묶기 (Electron): dist/PrisonOfCalligraphy-win64.zip — 압축을 풀고 'Prison of Calligraphy.exe' 실행
# 처음 한 번: npm install (electron·@electron/packager)
set -e
cd "$(dirname "$0")/.."
rm -rf dist/win && mkdir -p dist/win
npx --no-install electron-packager . "Prison of Calligraphy" --platform=win32 --arch=x64 --out=dist/win --overwrite \
  --ignore='^/(dist|docs|tools|node_modules|\.git|CLAUDE\.md)($|/)' --app-version=0.1.0 --win32metadata.ProductName="Prison of Calligraphy"
cd dist/win && zip -qr ../PrisonOfCalligraphy-win64.zip "Prison of Calligraphy-win32-x64"
ls -la ../PrisonOfCalligraphy-win64.zip
