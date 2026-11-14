// 채점: 원본 선을 덮은 정도 + 선 밖으로 벗어나지 않은 정도 + 획 순서·방향 → 0~100
(function () {
  const TOL = 7; // 허용 거리 (100칸 기준)
  const W = { cover: 0.6, precise: 0.4, order: 0.4 }; // 모양 점수 × (0.6 + 0.4 × 순서·방향)

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function resample(poly, step = 1) {
    if (poly.length < 2) return poly.slice();
    const out = [poly[0]];
    let carry = 0;
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1], b = poly[i], d = dist(a, b);
      let s = step - carry;
      while (s <= d) {
        const k = s / d;
        out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
        s += step;
      }
      carry = d - (s - step);
    }
    out.push(poly[poly.length - 1]);
    return out;
  }

  const length = poly => poly.reduce((s, p, i) => (i ? s + dist(poly[i - 1], p) : 0), 0);

  function nearRatio(from, to) {
    if (!from.length) return 0;
    let ok = 0;
    for (const p of from) {
      for (const q of to) if (dist(p, q) <= TOL) { ok++; break; }
    }
    return ok / from.length;
  }

  function score(template, strokes) {
    strokes = strokes.filter(s => s.length > 0);
    if (!strokes.length) return 0;
    const tPts = template.flatMap(s => resample(s));
    const pPts = strokes.flatMap(s => (s.length > 1 ? resample(s) : s));
    const cover = nearRatio(tPts, pPts);
    const precise = nearRatio(pPts, tPts);
    // 획 순서·방향: i번째 획을 원본 i번째 획과 같은 비율 지점(0·⅓·⅔·끝)에서 비교 → 거꾸로 쓰면 크게 깎임
    const n = Math.min(template.length, strokes.length);
    let ord = 0;
    for (let i = 0; i < n; i++) {
      const t = resample(template[i]), p = strokes[i].length > 1 ? resample(strokes[i]) : strokes[i];
      for (const f of [0, 1 / 3, 2 / 3, 1]) {
        const a = t[Math.round(f * (t.length - 1))], b = p[Math.round(f * (p.length - 1))];
        if (dist(a, b) <= TOL * 1.5) ord += 0.25;
      }
    }
    const order = (ord / template.length) * (n / Math.max(template.length, strokes.length));
    const shape = W.cover * cover + W.precise * precise;
    return Math.round(100 * shape * (1 - W.order + W.order * order));
  }

  window.PC = Object.assign(window.PC || {}, { score, resample, length });
})();
