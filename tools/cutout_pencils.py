# 상점 연필 사진에서 연필 + 빛(후광·반짝임)만 오려 투명 PNG로: GrabCut(연필 몸통) + 배경을 메운 그림과의 밝기 차(빛)
import sys, json, numpy as np, cv2
I, O = sys.argv[1], sys.argv[2]
# 등급: (파일, 심 끝, 끝(지우개/마개), 몸통 반폭, 빛까지 포함할 여유)
SRC = {0: ('5.jpg', (352, 688), (1600, 505), 48, 30), 1: ('6.jpg', (352, 668), (1600, 500), 48, 30),
       2: ('12.jpg', (262, 778), (1775, 432), 62, 90), 3: ('13.jpg', (258, 780), (1785, 425), 62, 110),
       4: ('14.jpg', (258, 780), (1765, 415), 62, 230), 5: ('15.jpg', (258, 780), (1770, 440), 66, 330)}
meta = {}
for g, (f, tip, end, hw, glow) in SRC.items():
    img = cv2.imread(f'{I}/{f}'); H, W = img.shape[:2]
    if g == 3:  # 'shing!' 글자 지우기 (둘레로 메움)
        m = np.zeros((H, W), np.uint8); m[245:372, 1400:1650] = 255; img = cv2.inpaint(img, m, 15, cv2.INPAINT_TELEA)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ax, ay = end[0] - tip[0], end[1] - tip[1]; L = np.hypot(ax, ay); ux, uy = ax / L, ay / L
    t = (xx - tip[0]) * ux + (yy - tip[1]) * uy; sd = -(xx - tip[0]) * uy + (yy - tip[1]) * ux; d = np.abs(sd)
    inside = (t > -10) & (t < L + 10)
    taper = np.clip(t / 220, 0.15, 1)  # 심 쪽은 가늘게
    mask = np.full((H, W), cv2.GC_BGD, np.uint8)
    mask[inside & (d < hw * taper + glow + 40)] = cv2.GC_PR_BGD
    mask[inside & (d < hw * taper * 1.25)] = cv2.GC_PR_FGD
    mask[(t > 30) & (t < L - 30) & (d < hw * taper * 0.45)] = cv2.GC_FGD
    mask[inside & (sd > hw * taper + 6)] = cv2.GC_BGD  # 연필 아래 그림자
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1.0, 0.0).astype(np.float32)
    fg = cv2.GaussianBlur(fg, (5, 5), 0)
    # 빛: 연필 둘레를 메운 배경보다 밝은 만큼 반투명으로
    region = (inside & (d < hw * taper + glow + 20)).astype(np.uint8) * 255
    small = cv2.resize(img, (W // 2, H // 2)); rsm = cv2.resize(region, (W // 2, H // 2))
    bg = cv2.resize(cv2.inpaint(small, rsm, 9, cv2.INPAINT_TELEA), (W, H)).astype(np.float32)
    im = img.astype(np.float32)
    lum = lambda a: a @ np.array([0.114, 0.587, 0.299], np.float32)
    ga = np.clip((lum(im) - lum(bg) - 28) / 70.0, 0, 1) * (region > 0) * (g >= 2) * (((d < hw * taper + 30) & (sd < hw * taper + 25)) | ((g >= 4) & (t > L - 260)) | ((g == 5) & (np.abs(t - 0.5 * L) < 260)))
    a = np.maximum(fg, ga)
    col = np.where(a[..., None] > 1e-3, (im - bg * (1 - a[..., None])) / np.maximum(a[..., None], 1e-3), im)
    col = np.where(fg[..., None] > 0.5, im, col)
    rgba = np.dstack([np.clip(col, 0, 255), a * 255]).astype(np.uint8)
    ys, xs = np.where(a > 0.04); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = rgba[y0:y1, x0:x1]
    scale = 210.0 / L  # 연필 길이 210px로
    out = cv2.resize(crop, (max(1, int(crop.shape[1] * scale)), max(1, int(crop.shape[0] * scale))), interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{O}/pen_{g}.png', out)
    meta[g] = {'tipX': round((tip[0] - x0) * scale, 1), 'tipY': round((tip[1] - y0) * scale, 1), 'angle': round(float(np.degrees(np.arctan2(ay, ax))), 1), 'w': out.shape[1], 'h': out.shape[0]}
print(json.dumps(meta))
