# 검정 배경 연필 이미지 → 투명 PNG: 연필 몸통(축 따라 가장자리를 찾아 채움)은 불투명, 나머지 빛은 밝기 = 투명도(검정 위 가산광으로 보고 되돌림)
import sys, json, numpy as np, cv2
I, O = sys.argv[1], sys.argv[2]
SRC = {5: ('26.jpg', (262, 795), (1905, 415), 58), 4: ('27.jpg', (258, 782), (1858, 440), 58),
       3: ('28.jpg', (265, 795), (1832, 445), 62), 2: ('29.jpg', (265, 785), (1822, 445), 72),
       0: ('30.jpg', (362, 688), (1645, 472), 58)}
meta = {}
for g, (f, tip, end, hw) in SRC.items():
    img = cv2.imread(f'{I}/{f}').astype(np.float32); H, W = img.shape[:2]
    lum = cv2.GaussianBlur(img.max(2), (5, 5), 0)
    ax, ay = end[0] - tip[0], end[1] - tip[1]; L = float(np.hypot(ax, ay)); ux, uy = ax / L, ay / L; nx, ny = -uy, ux
    body = np.zeros((H, W), np.uint8); prev = None
    offs = np.arange(-1.4 * hw, 1.4 * hw + 1)
    for t in np.arange(0, L + 1, 2.0):
        cx, cy = tip[0] + ux * t, tip[1] + uy * t
        xs = np.clip((cx + nx * offs).astype(int), 0, W - 1); ys = np.clip((cy + ny * offs).astype(int), 0, H - 1)
        on = np.where(lum[ys, xs] > (14 if g == 0 else 34))[0]
        lim = hw * min(1.0, 0.12 + t / 230)            # 심 쪽은 가늘게
        if len(on): lo, hi = max(offs[on[0]], -lim * 1.15), min(offs[on[-1]], lim * 1.15)
        else: lo, hi = -lim * 0.5, lim * 0.5
        mf = 0.75 if g == 0 else 0.35
        lo, hi = min(lo, -lim * mf), max(hi, lim * mf)  # 어두운 심·검은 몸통도 채움
        cur = [(cx + nx * lo, cy + ny * lo), (cx + nx * hi, cy + ny * hi)]
        if prev: cv2.fillPoly(body, [np.array([prev[0], prev[1], cur[1], cur[0]], np.int32)], 255)
        prev = cur
    body = cv2.GaussianBlur(cv2.erode(body, np.ones((3, 3), np.uint8)), (3, 3), 0).astype(np.float32) / 255
    glow = np.clip((img.max(2) - 10) / 235.0, 0, 1)
    a = np.maximum(body, glow)
    col = np.where(body[..., None] > 0.5, img, np.clip(img / np.maximum(glow[..., None], 1e-3), 0, 255))
    rgba = np.dstack([col, a * 255]).clip(0, 255).astype(np.uint8)
    ys, xs = np.where(a > 0.03); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = rgba[y0:y1, x0:x1]; s = 200.0 / L
    out = cv2.resize(crop, (int(crop.shape[1] * s), int(crop.shape[0] * s)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{O}/cursor_{g}.png', out)
    meta[g] = {'tipX': round((tip[0] - x0) * s, 1), 'tipY': round((tip[1] - y0) * s, 1), 'angle': round(float(np.degrees(np.arctan2(ay, ax))), 1), 'w': out.shape[1], 'h': out.shape[0]}
print(json.dumps(meta))
