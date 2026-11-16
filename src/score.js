// 채점: 원본 선을 덮은 정도 + 선 밖으로 벗어나지 않은 정도 + 획 순서·방향 → 0~100
(function () {
  const DEF_TOL = 7; // 허용 거리 (100칸 기준, 작은 글자는 main.js에서 줄여 넘김)
  const W = { cover: 0.6, precise: 0.4, order: 0.4 }; // 모양 점수 × (0.6 + 0.4 × 순서·방향)
  // 붉은 가이드 선에서 얼마나 떨어져 그었나 (사용자 요청: 회색 띠 안이라도 선에서 벗어나면 100점이 아님)
  // 평균 거리가 허용 거리의 DEAD 이하면 감점 없음, 그 위로는 비율만큼 깎음 (띠 가장자리를 따라 그으면 약 90점)
  const DEAD = 0.1, DEV = 0.28;

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

  function nearRatio(from, to, TOL) {
    if (!from.length) return 0;
    let ok = 0;
    for (const p of from) {
      for (const q of to) if (dist(p, q) <= TOL) { ok++; break; }
    }
    return ok / from.length;
  }

  function meanDist(from, to, cap) {
    let sum = 0;
    for (const p of from) { let m = cap; for (const q of to) { const d = dist(p, q); if (d < m) m = d; } sum += m; }
    return from.length ? sum / from.length : cap;
  }
  function score(template, strokes, TOL = DEF_TOL) {
    strokes = strokes.filter(s => s.length > 0);
    if (!strokes.length) return 0;
    const tPts = template.flatMap(s => resample(s));
    const pPts = strokes.flatMap(s => (s.length > 1 ? resample(s) : s));
    const cover = nearRatio(tPts, pPts, TOL);
    const precise = nearRatio(pPts, tPts, TOL);
    // 획 순서·방향: i번째 획을 원본 i번째 획과 같은 비율 지점(0·⅓·⅔·끝)에서 비교 → 거꾸로 쓰면 크게 깎임
    const n = Math.min(template.length, strokes.length);
    let ord = 0;
    for (let i = 0; i < n; i++) {
      const t = resample(template[i]), p = strokes[i].length > 1 ? resample(strokes[i]) : strokes[i];
      for (const f of [0, 1 / 3, 2 / 3, 1]) {
        const a = t[Math.round(f * (t.length - 1))], b = p[Math.round(f * (p.length - 1))];
        if (dist(a, b) <= TOL * 1.2) ord += 0.25;
      }
    }
    const order = (ord / template.length) * (n / Math.max(template.length, strokes.length));
    const shape = W.cover * cover + W.precise * precise;
    const dev = Math.max(0, meanDist(pPts, tPts, TOL * 1.5) / TOL - DEAD);
    return Math.round(100 * shape * (1 - DEV * dev) * (1 - W.order + W.order * order));
  }

  window.PC = Object.assign(window.PC || {}, { score, resample, length });
})();
