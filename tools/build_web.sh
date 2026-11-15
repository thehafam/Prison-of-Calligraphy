#!/bin/sh
# 웹 플레이 파일 묶기: dist/prison-of-calligraphy-web.zip (압축을 풀고 index.html을 열면 바로 플레이)
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/prison-of-calligraphy
cp -r index.html style.css src assets dist/prison-of-calligraphy/
cd dist && zip -qr prison-of-calligraphy-web.zip prison-of-calligraphy && rm -rf prison-of-calligraphy
ls -la prison-of-calligraphy-web.zip
