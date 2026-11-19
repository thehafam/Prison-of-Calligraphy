#!/bin/sh
# itch.io용 HTML5 묶음: dist/prison-of-calligraphy-itch.zip — zip 최상위에 index.html (itch.io 'HTML' 프로젝트 규칙)
set -e
cd "$(dirname "$0")/.."
rm -rf dist/itch && mkdir -p dist/itch
cp -r index.html style.css src assets dist/itch/
rm -f dist/prison-of-calligraphy-itch.zip
cd dist/itch && zip -qr ../prison-of-calligraphy-itch.zip . && cd .. && rm -rf itch
ls -la prison-of-calligraphy-itch.zip && unzip -l prison-of-calligraphy-itch.zip | tail -1
