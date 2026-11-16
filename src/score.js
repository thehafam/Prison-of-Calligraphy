// 채점: 원본 선을 덮은 정도 + 선 밖으로 벗어나지 않은 정도 + 획 순서·방향 → 0~100
(function () {
  const DEF_TOL = 7; // 허용 거리 (100칸 기준, 작은 글자는 main.js에서 줄여 넘김)
  // 회색 띠 기준 채점 (사용자 확정) — 가이드(화살표·번호)가 없어져도 같은 기준. 띠 폭 8, 그은 선 굵기 3.4 (main.js draw, 글자 크기 g배)
  //   띠 정중앙 100 / 띠 안이지만 삐뚤빼뚤 95 / 띠 가장자리를 건드리거나 조금 빠져나감 90 / 띠 밖으로 나간 게 전체의 10%면 80 / 그 이상 불합격
  const BAND = 4, INK = 1.7;              // 띠 반폭, 그은 선 반폭 (g=1 기준)
  const TOUCH = BAND - INK;                // 선 가운데가 이만큼 떨어지면 선 가장자리가 띠 가장자리에 닿음
  const CENTER = 0.4, WOBBLE = 1.4;        // 평균 거리 ≤ CENTER면 100, WOBBLE 이상이면 95
  const ORDER_W = 0.4;                     // 순서·방향이 틀리면 × (0.6 + 0.4 × 순서)
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
    const g = TOL / DEF_TOL; // 글자 크기 비율 (main.js는 7 × g를 넘김)
    const tPts = template.flatMap(s => resample(s));
    const pPts = strokes.flatMap(s => (s.length > 1 ? resample(s) : s));
    const ds = pPts.map(p => { let m = Infinity; for (const q of tPts) { const d = dist(p, q); if (d < m) m = d; } return m / g; });
    const out = ds.filter(d => d > BAND).length / ds.length;         // 띠 밖으로 나간 비율
    const touched = ds.some(d => d > TOUCH);                          // 띠 가장자리를 건드림
    const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
    let base;
    if (out > 0.1) base = Math.max(0, 79 - (out - 0.1) * 200);       // 10% 넘게 나가면 불합격
    else if (out > 0) base = 90 - out * 100;                          // 조금 나감: 90 → 10%에서 80
    else if (touched) base = 90;                                      // 가장자리를 건드림
    else base = 100 - 5 * Math.min(1, Math.max(0, (mean - CENTER) / (WOBBLE - CENTER))); // 띠 안: 정중앙 100 ~ 삐뚤빼뚤 95
    // 덜 쓴 부분: 원본 선 가운데 아예 쓰지 않은 곳만 깎음. 띠 밖으로 나간 곳은 위 out에서 이미 깎았으니
    // 근처(띠 반폭의 2.5배)에 그은 선이 있으면 쓴 것으로 침 (사용자 확정: 나간 부분은 한 번만 감점)
    const cover = nearRatio(tPts, pPts, BAND * 2.5 * g);
    const coverK = Math.min(1, cover / 0.97);
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
    return Math.round(base * coverK * (1 - ORDER_W + ORDER_W * order));
  }

  window.PC = Object.assign(window.PC || {}, { score, resample, length });
})();
