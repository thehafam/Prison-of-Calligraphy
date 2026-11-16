// 게임 흐름: 타이틀 → 튜토리얼(src/tutorial.js) → 단계(제한시간 안에 90점 이상 종이를 할당량만큼) → 결과
(function () {
  const { t } = PC;
  const $ = id => document.getElementById(id);

  // 필기구: 파손 확률 10%p씩 감소(사용자 확정, 고급연필 5%는 [임시], 깨지지 않은 연필 0%)
  const PRICES = [15, 25, 35, 70, 120, 300]; // 사용자 확정: 단단한 심 업그레이드로 해금하므로 조금 낮춤 [임시]
  const PENCILS = [0.40, 0.30, 0.20, 0.10, 0.05, 0].map((p, i) => ({ p, price: PRICES[i] }));
  // 하루 일감 (사용자 확정): 몸값 2000냥을 모으면 풀려남. 하루 = 5분, 아침마다 일감을 하나 골라 할당량을 채움
  // 일감은 차례로 해금: 바로 아래 일감을 이틀 성공하면 다음 일감이 열림. 어려운 일감일수록 장당 값이 높음
  const JOBS = [
    { tier: 'letter', quota: 50, pay: 1 },   // 1 한글 자음·모음 / 알파벳 하나
    { tier: 'word1', quota: 40, pay: 2 },    // 2 받침 없는 한 글자 / 영어 3자
    { tier: 'syl3', quota: 30, pay: 4 },     // 3 받침 있는 한 글자 / 영어 4~5자
    { tier: 'word3', quota: 20, pay: 8 },    // 4 받침 있는 두 음절 / 영어 6자
    { tier: 'word5', quota: 15, pay: 15, guide: false }, // 5 세 음절 이상 / 영어 7자 이상 (여기부터 화살표·번호 없음)
    { tier: 'sent1', quota: 10, pay: 25, guide: false }, // 6 짧은 문장 (사용자 확정: 20 → 25냥)
    { tier: 'sent23', quota: 5, pay: 60, guide: false }, // 7 제법 긴 문장 (사용자 확정: 25 → 60냥)
  ];
  const DAY_SEC = 300, RANSOM = 2000, WINS_TO_UNLOCK = 2;
  const jobOpen = i => i === 0 || ((S.wins || [])[i - 1] || 0) >= WINS_TO_UNLOCK;
  const PASS = 80;
  const fmtMoney = n => String(Math.round(n * 100) / 100); // 보너스로 반 냥이 생길 수 있음 // 합격선 (사용자 확정)
  // 보상: 기본금(글이 길수록 많음: 획 수 ÷ 3, 최소 1냥) + 완성도 (80~89점 기본금 / 90~99점 +1 / 100점 +2)
  const rewardOf = (score, base) => (score < PASS ? 0 : Math.round((base * (score >= 100 ? 1.2 : score >= 90 ? 1.15 : 1) + lv('word') * WORD_NYANG) * 100) / 100); // 장당 값 + 완성도(90점 +15%, 100점 +20%, 사용자 확정) + 좋은 말 // 장당 값 = 일감 값 + 완성도 + 좋은 말
  const CREDIT_BASE = 18;
  // 파손: 글자 수에 비례 — 글자 하나마다 등급 확률 × 1/4 (표의 확률 ≈ 4글자 한 장 기준). 한 장에 여러 번 부러질 수 있음 (최대 횟수 없음)
  const BREAK_PER_CHAR = 0.25 * 2 / 3; // 사용자 확정: 예전(1/4)의 2/3
  const ICONS = [0, 1, 2, 3, 4, 5].map(g => `assets/pencil_${g}.jpg`); // 연필 아이콘 (나머지 4종은 이미지 오면 추가)
  // 스킬 (상점 스킬 탭, 모두 최대 15레벨 — 사용자 확정, 레벨마다 가격이 오름) [임시: 효과·가격]
  const SKILLS = {
    clock: { price: [5, 8, 11, 14, 17, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65] },  // 느린 시계: 단계 시간 +2초/레벨 (최대 +30초, 합 480)
    hand:  { price: [3, 5, 7, 9, 11, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40] },     // 빠른 손: 바꿔 쥐는 시간 1.5 → 0.1초 (−0.1초/레벨, 합 300)
    word:  { price: [8, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75] },  // 좋은 말 한마디: 합격한 종이마다 +0.5냥/레벨 (최대 +7.5, 합 606)
    tough: { price: [5, 8, 11, 14, 17, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65] }, // 단단한 심 15레벨: 연필 업그레이드 (아래 TOUGH_R) [임시: 가격]
  };
  // 단단한 심 = 연필 업그레이드 (사용자 확정): 레벨마다 '지금 가장 좋은 연필'의 파손율이 내려감. 다음 연필의 파손율에 닿으면 그 연필 해금,
  // 새 연필은 그 값에서 시작해 다시 내려감. 지난 연필은 다음 연필의 원래 파손율에서 멈춤. 최종 목표 = 고급연필 2%
  //   레벨 0: 40% · 4: 30%(연필) · 8: 20%(괜찮은) · 12: 10%(제법 좋은) · 14: 5%(고급) · 15: 2%
  const TOUGH_R = [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 38]; // 볼품없는 연필 40%에서 줄어든 %p
  const FLOOR = [0.30, 0.20, 0.10, 0.05, 0.02, 0];  // 연필마다 내려갈 수 있는 바닥 (= 다음 연필의 원래 파손율, 고급연필은 2%)
  const topRate = () => 0.40 - TOUGH_R[lv('tough')] / 100;
  const UNBREAK_JOB = 5; // 깨지지 않은 연필 (사용자 확정): 고급연필이 해금된 채 6번째 일감이 열리면, 또는 단단한 심 15레벨, 또는 무한 모드에 들어서면
  const unlocked = g => g === 0 || (g === 5 ? !!S.endless || lv('tough') >= skillMax('tough') || (jobOpen(UNBREAK_JOB) && topRate() <= PENCILS[4].p + 1e-9) : topRate() <= PENCILS[g].p + 1e-9);
  const unlockLevel = g => TOUGH_R.findIndex(r => 0.40 - r / 100 <= PENCILS[g].p + 1e-9);
  const breakRate = g => (g === 5 ? 0 : Math.max(FLOOR[g], Math.min(PENCILS[g].p, topRate())));
  const skillMax = k => SKILLS[k].price.length;
  const CLOCK_SEC = 2, WORD_NYANG = 0.5, SWAP_BY_LV = Array.from({ length: 16 }, (_, i) => +(1.5 - i * 0.1).toFixed(1));
  const lv = k => (S.skills && S.skills[k]) || 0;
  const swapMs = () => SWAP_BY_LV[lv('hand')] * 1000; // 연필을 바꿔 쥐는 데 드는 시간 (시간은 계속 흐름)

  const S = { mode: 'title', stage: 0, lives: 3, money: 0, hand: 0, spares: [0, 0, 0, 0, 0, 0],
    timeLeft: 0, stack: [], passed: 0, earned: 0, running: false, busy: false };
  // 튜토리얼이 조종하는 고리: 쓰기 허용·상납·연필 파손·상점 닫힘
  const T = { allowDraw: false, allowShop: true, onShopOpen: null, onSubmit: null, onBreak: null, onShopClose: null };
  let sheet = null, cur = null, timerId = null;

  // ---------- 종이 그리기 ----------
  const cv = $('paper'), ctx = cv.getContext('2d');
  function fit() {
    const d = window.devicePixelRatio || 1; // 날아오는 중의 변형과 상관없이 실제 크기로
    cv.width = Math.round(cv.offsetWidth * d); cv.height = Math.round(cv.offsetHeight * d);
    draw();
  }
  window.addEventListener('resize', fit);

  function draw() {
    const u = cv.height / 100, W = sheet ? sheet.w : 100; // 높이 100 기준, 폭 W (긴 단어는 가로로 긴 종이)
    ctx.setTransform(u, 0, 0, u, 0, 0);
    ctx.fillStyle = '#f1e7cf'; ctx.fillRect(0, 0, W, 100);
    ctx.strokeStyle = '#8b7a5a'; ctx.lineWidth = 0.6; ctx.strokeRect(4, 4, W - 8, 92);
    ctx.setLineDash([1.5, 1.5]); ctx.strokeStyle = '#c9b996'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(W / 2, 4); ctx.lineTo(W / 2, 96); ctx.moveTo(4, 50); ctx.lineTo(W - 4, 50); ctx.stroke();
    ctx.setLineDash([]);
    if (!sheet) return;
    ctx.lineCap = ctx.lineJoin = 'round';
    // 따라 쓸 글씨 (회색)
    const g = sheet.g;
    ctx.strokeStyle = '#c4bcae'; ctx.lineWidth = 8 * g;
    for (const s of sheet.tpl) poly(s);
    // 획 순서 화살표·번호
    if (sheet.guide) {
      sheet.labels = sheet.labels || placeLabels(sheet.tpl, g, sheet.w);
      const next = Math.min(sheet.tpl.length - 1, cur ? sheet.strokes.length - 1 : sheet.strokes.length); // 지금 쓸 획
      sheet.tpl.forEach((s, i) => { if (i !== next) arrow(s, i + 1, g, false); });
      arrow(sheet.tpl[next], next + 1, g, true);
    }
    // 플레이어 글씨
    ctx.strokeStyle = '#26221d'; ctx.lineWidth = 3.4 * g;
    for (const s of sheet.strokes) {
      if (s.length === 1) { ctx.fillStyle = '#26221d'; ctx.beginPath(); ctx.arc(s[0][0], s[0][1], 1.7 * g, 0, 7); ctx.fill(); }
      else poly(s);
    }
  }
  function poly(s) { ctx.beginPath(); s.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.stroke(); }
  // 획 순서 표시: 획마다 색을 달리하고(화살표·시작점·번호가 같은 색), 시작점에 점 + 번호까지 짧은 선.
  // 번호는 다른 획 선·번호에서 가장 먼 자리에 둠. 지금 쓸 획은 진하고 크게, 나머지는 흐리게
  const STROKE_COLORS = ['#c0392b', '#1f6fb2', '#2e8b57', '#c77d0a', '#8e44ad', '#16a2a2', '#b03a74', '#556b2f'];
  function placeLabels(tpl, g, w) {
    const pts = tpl.flatMap(s => PC.resample(s, 2)), placed = [], R = 8 * g;
    return tpl.map(s => {
      const [x, y] = s[0];
      let best = null, bestScore = -1;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, c = [x + Math.cos(a) * R, y + Math.sin(a) * R];
        if (c[0] < 4 * g + 2 || c[0] > w - 4 * g - 2 || c[1] < 4 * g + 2 || c[1] > 98 - 4 * g) continue;
        let d = Infinity;
        for (const p of pts) d = Math.min(d, Math.hypot(p[0] - c[0], p[1] - c[1]));
        for (const l of placed) d = Math.min(d, Math.hypot(l[0] - c[0], l[1] - c[1]) * 0.6);
        if (d > bestScore) { bestScore = d; best = c; }
      }
      best = best || [x, y - R]; placed.push(best); return best;
    });
  }
  function arrow(s, n, g, active) {
    const col = STROKE_COLORS[(n - 1) % STROKE_COLORS.length], [x, y] = s[0], [lx, ly] = sheet.labels[n - 1];
    ctx.globalAlpha = active ? 1 : 0.6;
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = (active ? 0.9 : 0.6) * g; poly(s);
    const a = s[s.length - 2], b = s[s.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h = active ? 1.25 : 1;
    ctx.beginPath();
    ctx.moveTo(b[0] + Math.cos(ang) * 2.5 * g * h, b[1] + Math.sin(ang) * 2.5 * g * h);
    ctx.lineTo(b[0] + Math.cos(ang + 2.5) * 3 * g * h, b[1] + Math.sin(ang + 2.5) * 3 * g * h);
    ctx.lineTo(b[0] + Math.cos(ang - 2.5) * 3 * g * h, b[1] + Math.sin(ang - 2.5) * 3 * g * h);
    ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 1.3 * g, 0, 7); ctx.fill();                                   // 시작점
    ctx.lineWidth = 0.4 * g; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.stroke(); // 번호까지 선
    const r = (active ? 4.2 : 3.3) * g;
    ctx.beginPath(); ctx.arc(lx, ly, r, 0, 7); ctx.fill();
    if (active) { ctx.lineWidth = 0.5 * g; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.font = `bold ${r * 1.35}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n, lx, ly + 0.2 * g);
    ctx.globalAlpha = 1;
  }

  // ---------- 종이 한 장: 글자는 게임 언어와 상관없이 한글·영어가 섞여 나옴 ----------
  function newSheet(opt = {}) {
    let { lang, key } = opt;
    if (!key) [lang, key] = opt.pool ? opt.pool[Math.floor(Math.random() * opt.pool.length)] : PC.pick(opt.tier || stageDef().tier);
    const { tpl, k, w = 100 } = PC.build(lang, key), g = Math.min(1, Math.max(0.5, k * 1.15)); // g: 작은 글자일수록 선·번호·허용 거리를 줄임
    setPaper(w);
    const guide = S.mode !== 'stage' || stageDef().guide !== false;
    const chars = [...key].filter(ch => ch !== ' ' && ch !== '.' && ch !== '\n').length;
    sheet = { lang, key, tpl, g, w, guide, chars, base: S.mode === 'stage' ? stageDef().pay : 1, strokes: [], ink: 0, breakAt: Infinity };
    // 파손: 글자 수에 비례해 쓰는 도중 아무 순간에 (planBreaks, 튜토리얼은 정해 둔 장에서만)
    const len = tpl.reduce((a, s) => a + PC.length(s), 0);
    sheet.len = len;
    if (opt.breakAt) sheet.breakAt = len * opt.breakAt;
    else planBreaks();
    draw(); fly('arrive');
    return sheet;
  }

  // 지금 쥔 연필로 남은 글자에 파손 시점을 정함 (새 종이, 새 연필을 쥘 때)
  function planBreaks() {
    if (!sheet || S.mode !== 'stage' || S.hand === null) return;
    const done = sheet.ink / sheet.len, left = Math.max(0, Math.round(sheet.chars * (1 - done)));
    const p = breakRate(S.hand) * BREAK_PER_CHAR, at = [];
    for (let i = 0; i < left; i++) if (Math.random() < p) at.push(sheet.ink + (sheet.len - sheet.ink) * (0.05 + Math.random() * 0.9));
    sheet.breaks = at.sort((a, b) => a - b); sheet.breakAt = sheet.breaks.shift() ?? Infinity;
  }
  function takePencil(g) { S.hand = g; planBreaks(); hud(); penShown = -1; }

  // 창구에서 날아오는 종이: 배경 이미지(cover) 안 창구 위치를 화면 좌표로 바꿔 출발점으로
  const BG = { w: 2000, h: 1091 }, HATCH = { x: 1005, y: 330 };
  let flying = false;
  function hatchPoint() {
    const vw = innerWidth, vh = innerHeight, k = Math.max(vw / BG.w, vh / BG.h);
    return [(vw - BG.w * k) / 2 + HATCH.x * k, (vh - BG.h * k) / 2 + HATCH.y * k];
  }
  // 종이 폭: 높이는 늘 같고 폭만 w/100배 (화면보다 넓으면 화면에 맞춰 통째로 줄어듦)
  function setPaper(w) {
    const wrap = $('paperWrap');
    wrap.style.width = `min(${(60 * w) / 100}vh, 94vw)`; wrap.style.aspectRatio = `${w} / 100`;
    fit();
  }
  function fly(kind, then) {
    const w = $('paperWrap'), [hx, hy] = hatchPoint();
    w.style.visibility = ''; w.classList.remove('arrive', 'leave'); w.style.transform = '';
    const r = w.getBoundingClientRect();
    w.style.setProperty('--fx', `${hx - (r.left + r.width / 2)}px`);
    w.style.setProperty('--fy', `${hy - (r.top + r.height / 2)}px`);
    void w.offsetWidth; flying = true; cur = null; w.classList.add(kind);
    w.onanimationend = () => { flying = false; if (then) then(); };
  }

  const canDraw = () => (S.mode === 'stage' ? S.running : S.mode === 'tutorial' && T.allowDraw) && S.hand !== null && !S.busy && !flying;
  function pt(e) { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.height) * 100, ((e.clientY - r.top) / r.height) * 100]; }
  cv.addEventListener('pointerdown', e => {
    if (!sheet || !canDraw()) return;
    cv.setPointerCapture(e.pointerId);
    cur = [pt(e)]; sheet.strokes.push(cur); draw();
  });
  cv.addEventListener('pointermove', e => {
    if (!cur) return;
    const p = pt(e), q = cur[cur.length - 1], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < 0.4) return;
    cur.push(p); sheet.ink += d; draw();
    if (sheet.ink >= sheet.breakAt) breakPencil();
  });
  // 마지막 획을 쓰고 떼면 자동 상납 (사용자 확정). 연필이 획 도중 부러져 이어 쓴 획은 세지 않음
  const end = () => {
    if (cur && sheet && sheet.strokes.length >= sheet.tpl.length + (sheet.breakCount || 0)) setTimeout(submit, 250);
    cur = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

  // ---------- 연필 커서: 종이 위에서는 마우스 대신 지금 쥔 연필이 따라다니며 심 끝으로 씀 (사용자 요청) ----------
  // 코드로 그린 SVG(가로, 심 끝이 왼쪽 가운데) → 비스듬히 기울여 심 끝을 마우스 위치에 맞춤. 등급마다 상점 사진과 같은 생김새
  const PEN_LOOK = [
    { L: 46, body: '#d6a42a', eraser: '#3a3530', chips: true },               // 볼품없는 연필: 짧고 칠이 벗겨짐
    { L: 54, body: '#dfae2c', eraser: '#e89aa0' },                            // 연필: 깨끗한 몽당연필
    { L: 84, body: '#f4c531', eraser: '#f0a3ab', gloss: true },               // 괜찮은 연필
    { L: 84, body: '#1d6a46', eraser: '#7c7c80', gloss: true, band: true },   // 제법 좋은 연필
    { L: 88, body: '#121212', cap: 'gold', gloss: true, filigree: true },     // 고급연필
    { L: 88, body: 'url(#wg)', cap: 'diamond', gloss: true },                 // 깨지지 않은 연필
  ];
  function pencilSVG(g) {
    const P = PEN_LOOK[g], L = P.L, x1 = 26 + L, W = x1 + 22;
    let body = `<rect x="26" y="3" width="${L}" height="18" fill="${P.body}"/>`
      + `<rect x="26" y="15" width="${L}" height="6" fill="rgba(0,0,0,.22)"/><line x1="26" y1="9" x2="${x1}" y2="9" stroke="rgba(0,0,0,.18)"/>`;
    if (P.gloss) body += `<rect x="28" y="5" width="${L - 4}" height="2.4" rx="1.2" fill="rgba(255,255,255,.55)"/>`;
    if (P.chips) body += [0.15, 0.4, 0.62, 0.85].map((f, i) => `<path d="M${26 + L * f} ${4 + (i % 2) * 7} l6 1 l-2 5 l-6 -1z" fill="#8a6a3a"/>`).join('');
    if (P.band) body += `<rect x="${x1 - 9}" y="3" width="3" height="18" fill="#d9b24a"/>`;
    if (P.filigree) body += `<path d="M30 12 q6 -6 12 0 t12 0 t12 0 t12 0 t12 0" fill="none" stroke="#d9b24a" stroke-width="1.3"/>`;
    let end;
    if (P.cap === 'gold') end = `<rect x="${x1}" y="2.5" width="18" height="19" rx="3" fill="url(#gold)"/><circle cx="${x1 + 9}" cy="12" r="3" fill="#c0122c"/>`;
    else if (P.cap === 'diamond') end = `<rect x="${x1}" y="4" width="6" height="16" fill="url(#gold)"/><path d="M${x1 + 6} 12 l6 -9 h6 l4 9 l-4 9 h-6z" fill="#eaf6ff" stroke="#9fd0ff" stroke-width=".8"/>`;
    else end = `<rect x="${x1}" y="2.5" width="11" height="19" fill="url(#gold)"/>`
      + [3, 6, 9].map(d => `<line x1="${x1 + d}" y1="2.5" x2="${x1 + d}" y2="21.5" stroke="rgba(90,60,10,.5)"/>`).join('')
      + `<rect x="${x1 + 11}" y="3.5" width="10" height="17" rx="3" fill="${P.eraser}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 24" width="${W * 1.15}" height="${24 * 1.15}">
      <defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc86"/><stop offset=".5" stop-color="#b8892c"/><stop offset="1" stop-color="#7a5714"/></linearGradient>
      <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#efe3c4"/><stop offset="1" stop-color="#bfa978"/></linearGradient></defs>
      <polygon points="0,12 8,9 8,15" fill="#2e2b28"/><polygon points="8,9 26,3 26,21 8,15" fill="#e3bb8a"/>${body}${end}</svg>`;
  }
  // Gemini가 검정 배경에 그린 커서 그림을 투명 PNG로 뺀 것 (assets/cursor_{등급}.png, tools/cutout_cursor.py). 그림이 없으면 위 코드 그림(예비)
  // tipX·tipY = 그림 속 심 끝, angle = 그림 속 연필 기울기 → -38°가 되게 돌림
  const CURSOR_IMG = {"0": {"tipX": 0.3, "tipY": 39.8, "angle": -9.6, "w": 198, "h": 42}, "1": {"tipX": 0.1, "tipY": 39.4, "angle": -10.6, "w": 197, "h": 40}, "2": {"tipX": 0.3, "tipY": 51.5, "angle": -12.3, "w": 196, "h": 52}, "3": {"tipX": 2.5, "tipY": 68.1, "angle": -12.6, "w": 206, "h": 75}, "4": {"tipX": 2.3, "tipY": 68.7, "angle": -12.1, "w": 203, "h": 84}, "5": {"tipX": 0.1, "tipY": 75.9, "angle": -13.0, "w": 195, "h": 81}};
  const PEN_TILT = -38, PEN_SCALE = 0.8;
  let penShown = -1;
  function movePen(e) {
    const pen = $('penCursor'), r = cv.getBoundingClientRect();
    const over = e && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    const ok = over && (S.mode === 'stage' || S.mode === 'tutorial') && S.hand !== null && $('paperWrap').style.visibility !== 'hidden'
      && ['shop', 'result', 'death'].every(id => $(id).classList.contains('hidden'));
    pen.classList.toggle('hidden', !ok); cv.style.cursor = ok ? 'none' : '';
    if (!ok) return;
    const m = CURSOR_IMG[S.hand];
    if (penShown !== S.hand) {
      pen.className = 'g' + S.hand; penShown = S.hand;
      if (m) { pen.innerHTML = `<img src="assets/cursor_${S.hand}.png" alt="" width="${m.w * PEN_SCALE}" height="${m.h * PEN_SCALE}">`; pen.style.transformOrigin = `${m.tipX * PEN_SCALE}px ${m.tipY * PEN_SCALE}px`; }
      else { pen.innerHTML = pencilSVG(S.hand); pen.style.transformOrigin = '0 50%'; }
    }
    const press = cur ? ' scale(.96)' : '';
    pen.style.transform = m
      ? `translate(${e.clientX - m.tipX * PEN_SCALE}px, ${e.clientY - m.tipY * PEN_SCALE}px) rotate(${PEN_TILT - m.angle}deg)${press}`
      : `translate(${e.clientX}px, ${e.clientY - 13.8}px) rotate(${PEN_TILT}deg)${press}`;
  }
  addEventListener('pointermove', movePen); addEventListener('pointerdown', movePen); addEventListener('pointerup', movePen);

  // ---------- 연필 ----------
  // 부러지는 순간: 쥐고 있던 연필 등급의 부러짐 그림을 잠깐 띄움 (assets/pencil_snap_{등급}.jpg, 깨지지 않은 연필은 없음)
  function showSnap(g) {
    if (g === null || g > 4) return;
    const e = $('snap'); e.style.backgroundImage = `url(assets/pencil_snap_${g}.jpg)`;
    e.classList.remove('hidden', 'show'); void e.offsetWidth; e.classList.add('show');
    $('game').classList.add('shake'); setTimeout(() => $('game').classList.remove('shake'), 500);
  }
  function breakPencil() {
    showSnap(S.hand);
    $('penCursor').classList.add('hidden'); cv.style.cursor = '';
    if (cur) sheet.breakCount = (sheet.breakCount || 0) + 1; // 쓰던 획이 끊김 → 이어 쓰는 획 하나 더 허용
    cur = null; sheet.breakAt = Infinity; sheet.breaks = []; S.hand = null; // 새 연필을 쥐면 남은 글자로 다시 정함
    sfxSnap();
    if (S.mode === 'tutorial') { hud(); return T.onBreak && T.onBreak(); }
    toast(t('pencilBroke'));
    const best = bestSpare();
    if (best >= 0) {
      S.busy = true;
      setTimeout(() => { S.spares[best]--; S.busy = false; takePencil(best); toast(t('swapped')); }, swapMs());
    } else if (S.money >= PENCILS[0].price) {
      setTimeout(() => { toast(t('buyPencil')); openShop(); }, 700);
    } else {
      S.busy = true;
      setTimeout(() => {
        // 외상 (사용자 확정): 돈이 없으면 교도관이 볼품없는 연필을 외상으로 줌. 외상값 18냥, 외상을 질 때마다 1냥씩 오름(19·20…)
        S.credits = (S.credits || 0) + 1; const cost = CREDIT_BASE + S.credits - 1; S.debt = (S.debt || 0) + cost;
        toast(t('credit', { c: cost, d: fmtMoney(S.debt) })); S.busy = false; takePencil(0); saveGame();
      }, swapMs());
    }
    hud();
  }
  function bestSpare() { for (let g = PENCILS.length - 1; g >= 0; g--) if (S.spares[g] > 0) return g; return -1; }

  // 연필 아이콘 + 반짝임 애니메이션 (등급이 높을수록 별이 많고 빛이 강함, 볼품없는 연필·연필은 효과 없음)
  const TWINKLES = [0, 0, 3, 4, 6, 9];
  function pencilPic(g) {
    let stars = '';
    for (let i = 0; i < TWINKLES[g]; i++) {
      const x = 12 + ((i * 37 + g * 11) % 78), y = 10 + ((i * 53 + g * 7) % 70), d = ((i * 0.37) % 1.6).toFixed(2);
      stars += `<i style="left:${x}%;top:${y}%;animation-delay:${d}s"></i>`;
    }
    return `<span class="pic g${g}"><img class="pencil-icon" src="${ICONS[g]}" alt="">${stars}</span>`;
  }
  function openShop() { $('shop').classList.remove('hidden'); renderShop(); }
  function renderShop() {
    $('shopMoney').innerHTML = `<img class="coin" src="assets/coin.png" alt=""> ${fmtMoney(S.money)} ${t('money')}`;
    document.querySelectorAll('#shopTabs button').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === (S.shopTab || 'items'));
      b.classList.toggle('new', b.dataset.tab === 'items' && !!(S.fresh && S.fresh.length));
    });
    if (S.shopTab === 'skills') return renderSkills();
    const names = t('pencils');
    let h = `<tr><th></th><th>${t('breakRate')}</th><th>${t('price')}</th><th>${t('owned')}</th><th></th></tr>`;
    PENCILS.forEach((pc, g) => {
      const own = S.spares[g] + (S.hand === g ? ` · ${t('inHand')}` : '');
      const icon = ICONS[g] ? pencilPic(g) : '';
      const open = unlocked(g), pct = v => `${+(v * 100).toFixed(1)}%`;
      const rate = open ? `${pct(breakRate(g))}${breakRate(g) < pc.p ? ` <small class="was">${pct(pc.p)}</small>` : ''}` : pct(pc.p);
      const act = open
        ? `<button data-buy="${g}" ${S.money < pc.price ? 'disabled' : ''}>${t('buy')}</button>
           <button data-use="${g}" ${S.spares[g] && S.hand !== g ? '' : 'disabled'}>${t('use')}</button>`
        : `<span class="lockwhy">${g === 5 ? t('unlockStage', { n: UNBREAK_JOB + 1 }) : t('unlockTough', { n: unlockLevel(g) })}</span>`;
      const fresh = open && S.fresh && S.fresh.includes(g);
      h += `<tr class="${open ? (fresh ? 'fresh' : '') : 'locked'}"><td>${icon}${names[g]}${fresh ? ` <span class="newtag">${t('newTag')}</span>` : ''}</td><td>${rate}</td><td>${pc.price}</td><td>${open ? own : '—'}</td><td>${act}</td></tr>`;
    });
    $('shopTable').innerHTML = h;
    if (!$('shop').classList.contains('hidden')) { S.fresh = []; $('btnShop').classList.remove('new'); } // 아이템 탭을 봤으면 '새로' 표시를 지움
  }
  // 새로 해금된 연필 알림 (사용자 요청): 자막 + 상점 버튼·아이템 탭·연필 줄에 '새로' 표시
  function noteUnlocks(before) {
    PENCILS.forEach((_, g) => {
      if (before[g] || !unlocked(g)) return;
      (S.fresh = S.fresh || []).push(g);
      notice(t('pencilUnlocked', { name: t('pencils')[g] }));
    });
    if (S.fresh && S.fresh.length) { $('btnShop').classList.add('new'); if (!$('shop').classList.contains('hidden')) renderShop(); }
  }
  // 확인 버튼을 눌러야 닫히는 알림 (사용자 요청: 해금 알림). 여러 개면 차례로
  const noticeQ = [];
  function notice(m) { noticeQ.push(m); if (noticeQ.length === 1) showNotice(); }
  function showNotice() { $('noticeText').textContent = noticeQ[0]; $('notice').classList.remove('hidden'); }
  $('btnNotice').onclick = () => { noticeQ.shift(); if (noticeQ.length) showNotice(); else $('notice').classList.add('hidden'); };
  // 스킬 탭: 이름·설명(지금 → 다음 효과)·레벨 점·가격·업그레이드
  function renderSkills() {
    let h = `<tr><th></th><th>${t('skillEffect')}</th><th>${t('skillLevel')}</th><th>${t('price')}</th><th></th></tr>`;
    for (const k of Object.keys(SKILLS)) {
      const l = lv(k), M = skillMax(k), max = l >= M, price = SKILLS[k].price[l];
      const eff = v => (k === 'clock' ? `+${v * CLOCK_SEC}${t('sec')}` : k === 'hand' ? `${SWAP_BY_LV[v]}${t('sec')}` : k === 'tough' ? `${+(40 - TOUGH_R[v]).toFixed(1)}%` : `+${fmtMoney(v * WORD_NYANG)}`);
      const desc = `${t('sk_' + k + '_d')}<br><small>${eff(l)}${max ? '' : ' → ' + eff(l + 1)}</small>`;
      const dots = M > 5 ? `${l} / ${M}` : '●'.repeat(l) + '○'.repeat(M - l);
      h += `<tr><td class="skname">${t('sk_' + k)}</td><td class="skdesc">${desc}</td><td class="dots">${dots}</td><td>${max ? '—' : price}</td>
        <td><button data-skill="${k}" ${max || S.money < price ? 'disabled' : ''}>${max ? t('maxed') : l ? t('upgrade') : t('buy')}</button></td></tr>`;
    }
    $('shopTable').innerHTML = h;
  }
  document.querySelectorAll('#shopTabs button').forEach(b => { b.onclick = () => { S.shopTab = b.dataset.tab; renderShop(); }; });
  $('shopTable').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.skill) {
      const k = b.dataset.skill, l = lv(k); if (l >= skillMax(k) || S.money < SKILLS[k].price[l]) return;
      const before = PENCILS.map((_, g) => unlocked(g));
      S.money -= SKILLS[k].price[l]; S.skills = S.skills || {}; S.skills[k] = l + 1;
      if (k === 'tough') { planBreaks(); noteUnlocks(before); }
      if (k === 'clock' && S.running) S.bonusTime = (S.bonusTime || 0) + CLOCK_SEC; // 단계 도중에 사면 지금 단계에도 바로 +2초
    } else if (b.dataset.buy) {
      const g = +b.dataset.buy; if (S.money < PENCILS[g].price) return;
      S.money -= PENCILS[g].price;
      if (S.hand === null && !S.busy) takePencil(g); else S.spares[g]++;
    } else if (b.dataset.use) {
      const g = +b.dataset.use; if (!S.spares[g] || S.busy) return;
      S.spares[g]--; if (S.hand !== null) S.spares[S.hand]++; takePencil(g);
    }
    renderShop(); hud();
  });

  // ---------- 상납: 다 쓴 종이는 책상 옆에 쌓였다가, 시간이 끝나면 한 장씩 창구로 빨려 들어가 판정 ----------
  function submit() {
    if (!sheet || !sheet.strokes.length || S.busy || flying) return;
    if (S.mode === 'tutorial') return T.onSubmit && T.onSubmit();
    if (!S.running) return;
    toStack(); hud(); newSheet();
  }
  function toStack() {
    const r = $('paperWrap').getBoundingClientRect(), i = S.stack.length;
    S.stack.push({ tpl: sheet.tpl, strokes: sheet.strokes, g: sheet.g, base: sheet.base });
    const img = new Image(); img.src = cv.toDataURL('image/jpeg', 0.7); img.className = 'sheet-mini';
    img.style.width = r.width + 'px'; img.style.height = r.height + 'px';
    img.style.transform = `translate(${r.left}px,${r.top}px)`;
    $('stack').appendChild(img);
    // 더미 자리: 화면 오른쪽 아래, 상점 버튼 위의 고정 칸(폭 160·높이 110px 안에 줄여 넣음). 현재 종이와 겹치면 종이 뒤로 감
    const COL = 160, MAXH = 110, k = Math.min(COL / r.width, MAXH / r.height), w = r.width * k, h = r.height * k;
    const x = innerWidth - 20 - COL + (COL - w) / 2 + Math.random() * 8 - 4, y = innerHeight - 80 - h - Math.min(i, 20) * 4;
    const rot = Math.random() * 10 - 5;
    requestAnimationFrame(() => requestAnimationFrame(() => { img.style.transform = `translate(${x}px,${y}px) scale(${k}) rotate(${rot}deg)`; }));
    sheet = null; $('paperWrap').style.visibility = 'hidden';
  }
  function vacuum(done) {
    const imgs = [...$('stack').children].reverse(), [hx, hy] = hatchPoint(), GAP = 220;
    imgs.forEach((img, i) => setTimeout(() => {
      img.classList.add('suck'); sfxNoise(0.35, 500, 2600, 0.5);
      img.style.transform = `translate(${hx}px,${hy}px) scale(0.03) rotate(${Math.random() * 720 - 360}deg)`;
      img.style.opacity = '0';
    }, 400 + i * GAP));
    setTimeout(done, 400 + imgs.length * GAP + 700);
  }
  // 정산: 더미의 종이를 채점해 80점 이상이면 기본금 + 완성도 보너스
  function settle() {
    const scores = S.stack.map(x => PC.score(x.tpl, x.strokes, 7 * x.g));
    const pay = scores.map((v, i) => rewardOf(v, S.stack[i].base));
    S.passed = scores.filter(v => v >= PASS).length; S.earned = pay.reduce((a, b) => a + b, 0); S.money += S.earned;
    S.bonus = 0; // 할당을 넘긴 장도 같은 값으로 받음
    $('resultScores').innerHTML = scores.map((v, i) => `<span class="chip ${v >= PASS ? 'ok' : ''}">${v}${pay[i] ? ` · +${pay[i]} <img class="coin" src="assets/coin.png" alt="">` : ''}</span>`).join('');
    S.stack = []; $('stack').innerHTML = '';
    return scores;
  }
  function pop(s, ok) {
    const p = $('scorePop'); p.textContent = s; p.style.color = ok ? 'var(--ok)' : 'var(--accent)';
    p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
  }

  // ---------- 단계 ----------
  const stageDef = () => JOBS[S.job || 0];
  function startGame() {
    Object.assign(S, { stage: 0, job: 0, wins: JOBS.map(() => 0), endless: false, lives: 3, money: 0, hand: 0, spares: [0, 0, 0, 0, 0, 0], announced: null, skills: { clock: 0, hand: 0, word: 0 }, shopTab: 'items', debt: 0, credits: 0, fresh: [], unbreakNoted: false });
    PC.tutorial.run(); // 새 게임은 반드시 튜토리얼부터
  }
  // 아침: 오늘의 일감 고르기 (무한 모드는 무작위)
  function pickJob() {
    Object.assign(S, { mode: 'stage', running: false, stack: [], timeLeft: DAY_SEC + lv('clock') * CLOCK_SEC });
    $('stack').innerHTML = ''; show('game'); $('controls').style.visibility = 'hidden';
    sheet = null; $('paperWrap').style.visibility = 'hidden'; hud();
    $('jobsSub').innerHTML = t('jobsSub', { d: S.stage + 1, m: fmtMoney(S.money), r: RANSOM });
    const names = t('jobNames');
    let h = `<tr><th></th><th>${t('jobQuota')}</th><th>${t('jobPay')}</th><th>${t('jobDaily')}</th><th></th></tr>`;
    JOBS.forEach((jb, i) => {
      const open = jobOpen(i);
      const act = open ? `<button data-job="${i}">${t('take')}</button>`
        : `<span class="lockwhy">${t('jobLock', { n: (S.wins[i - 1] || 0) })}</span>`;
      h += `<tr class="${open ? '' : 'locked-job'}"><td class="jobname">${i + 1}. ${names[i]}</td><td>${jb.quota}</td><td>${jb.pay}</td><td>${jb.quota * jb.pay}</td><td>${act}</td></tr>`;
    });
    $('jobTable').innerHTML = h;
    $('jobs').classList.remove('hidden');
  }
  $('jobTable').addEventListener('click', e => {
    const b = e.target.closest('button[data-job]'); if (!b) return;
    $('jobs').classList.add('hidden'); startStage(+b.dataset.job);
  });
  function startStage(jobIdx) {
    if (jobIdx === undefined) {
      if (!S.endless) return pickJob();
      jobIdx = Math.floor(Math.random() * JOBS.length); // 무한 모드: 낱자부터 문장까지 무작위
    }
    S.job = jobIdx;
    // 화살표·번호가 없는 일감을 처음 받으면 교도관이 알려 줌 (종이 없이)
    if (stageDef().guide === false && S.announced !== 'noguide') {
      S.announced = 'noguide';
      Object.assign(S, { mode: 'stage', running: false, stack: [], timeLeft: DAY_SEC });
      $('stack').innerHTML = ''; show('game'); $('controls').style.visibility = 'hidden';
      sheet = null; $('paperWrap').style.visibility = 'hidden'; hud();
      return PC.tutorial.talk(['up_noguide1', 'up_noguide2'], () => startStage(jobIdx));
    }
    Object.assign(S, { mode: 'stage', passed: 0, earned: 0, stack: [], timeLeft: DAY_SEC + lv('clock') * CLOCK_SEC, running: true, busy: false, bonusTime: 0 });
    $('stack').innerHTML = ''; $('controls').style.visibility = '';
    show('game'); newSheet(); hud();
    const t0 = performance.now(), total = S.timeLeft;
    clearInterval(timerId);
    timerId = setInterval(() => {
      S.timeLeft = Math.max(0, total + (S.bonusTime || 0) - (performance.now() - t0) / 1000);
      hud();
      if (S.timeLeft <= 0) endStage();
    }, 100);
  }
  function endStage() {
    clearInterval(timerId); S.running = false; cur = null;
    $('shop').classList.add('hidden');
    // 시간이 끝났을 때 쓰던 종이도 글씨가 있으면 함께 냄
    if (sheet && sheet.strokes.length && !flying) toStack();
    sheet = null; $('paperWrap').style.visibility = 'hidden'; $('controls').style.visibility = 'hidden';
    vacuum(judge);
  }
  function judge() {
    settle();
    const q = stageDef().quota, clear = S.passed >= q;
    // 외상 갚기: 정산한 돈에서 빼 감. 다 못 갚으면 목숨 하나로 대신 치르고 외상은 없어짐
    let debtLine = '', jobLine = '';
    if (S.debt > 0) {
      if (S.money >= S.debt) { S.money -= S.debt; debtLine = t('debtPaid', { d: fmtMoney(S.debt) }); }
      else { S.lives--; debtLine = t('debtLife', { d: fmtMoney(S.debt) }); }
      S.debt = 0;
    }
    if (!clear) S.lives--;
    else if (!S.endless) {
      // 이틀 성공하면 다음 일감이 열림 (6번째 일감이 열리면 깨지지 않은 연필도)
      const before = PENCILS.map((_, g) => unlocked(g));
      S.wins[S.job]++;
      if (S.wins[S.job] === WINS_TO_UNLOCK && S.job + 1 < JOBS.length) jobLine = t('jobUnlocked', { name: t('jobNames')[S.job + 1] });
      noteUnlocks(before);
    }
    hud();
    const txt = t('stageResult', { n: S.passed, q, m: fmtMoney(S.earned) }) + (jobLine ? '\n' + jobLine : '') + (debtLine ? '\n' + debtLine : '');
    if (S.lives <= 0) return gameOver();
    S.stage++; saveGame(); // 하루가 끝나는 순간 저장 (실패해 잃은 목숨도 저장)
    const free = !S.endless && S.money >= RANSOM; // 몸값을 다 모음 → 교도관이 풀어 주겠다고 함
    result(clear ? t('stageClear') : t('stageFail'), txt, free ? t('next') : t('nextStage'), () => (free ? release() : startStage()));
  }
  // 몸값을 모음: 남아서 더 쓸지(무한 모드) / 나갈지(엔딩)
  function release() {
    show('game'); $('controls').style.visibility = 'hidden'; sheet = null; $('paperWrap').style.visibility = 'hidden';
    PC.tutorial.talk(['rel_1', 'rel_2'], () => {
      result(t('relTitle'), t('relAsk'), t('choiceLeave'), () => {
        saveGame('ended'); // 엔딩 → 이어하기는 보이되 못 누름
        result(t('endTitle'), t('endText', { d: S.stage, m: fmtMoney(S.money) }), t('restart'), toTitle);
      }, t('choiceStay'), () => {
        const before = PENCILS.map((_, g) => unlocked(g));
        S.endless = true; saveGame(); noteUnlocks(before);
        PC.tutorial.talk(['rel_stay'], () => startStage());
      });
    });
  }
  // 죽음: 교도관의 마지막 말 → 복면이 씌워지듯 암전 → 쿵(발판이 꺼짐) → 떨어지는 소리 → "당신은 죽었습니다."
  function gameOver() {
    saveGame('ended'); // 죽음도 엔딩 → 이어하기는 보이되 못 누름
    clearInterval(timerId); S.running = false; S.busy = true; cur = null;
    ['shop', 'result', 'jobs'].forEach(id => $(id).classList.add('hidden'));
    $('controls').style.visibility = 'hidden'; $('toast').classList.remove('show'); $('btnShop').classList.add('hidden');
    const wait = ms => new Promise(r => setTimeout(r, ms));
    PC.tutorial.talk(['d_1', 'd_2', 'd_3'], async () => {
      $('hood').classList.remove('hidden'); void $('hood').offsetWidth; $('hood').classList.add('drop');
      sfxNoise(1.2, 900, 300, 0.25); // 천이 스치는 소리
      await wait(1900);
      sfxThud(); $('game').classList.add('shake');
      await wait(450); sfxFall();
      await wait(1300); sfxThud(0.5); $('game').classList.remove('shake');
      await wait(1200);
      $('deathSub').textContent = t('deathSub', { n: S.stage + 1, m: fmtMoney(S.money) });
      $('death').classList.remove('hidden');
    });
  }
  function result(title, text, btn, fn, btn2, fn2) {
    $('resultTitle').textContent = title; $('resultText').textContent = text;
    const b = $('btnResult'); b.textContent = btn;
    b.onclick = () => { $('result').classList.add('hidden'); fn(); };
    const b2 = $('btnResult2'); b2.classList.toggle('hidden', !btn2); b2.textContent = btn2 || '';
    b2.onclick = () => { $('result').classList.add('hidden'); fn2(); };
    $('result').classList.remove('hidden');
  }

  // ---------- 자동 저장 (사용자 확정): 튜토리얼을 마치고 1단계에 들어설 때 + 매 단계 결과 ----------
  // status: progress = 이어하기 가능 / ended = 엔딩을 봄(죽음 포함) → 이어하기 보이되 비활성 / 기록 없음 → 이어하기 숨김
  const SAVE_KEY = 'prison_of_calligraphy_save_v1';
  function saveGame(status = 'progress') {
    const d = { status, stage: S.stage, job: S.job || 0, wins: S.wins, endless: !!S.endless, unbreakNoted: !!S.unbreakNoted, lives: S.lives, money: S.money, hand: S.hand, spares: S.spares, announced: S.announced || null, skills: S.skills, debt: S.debt || 0, credits: S.credits || 0 };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) {}
    updateContinue();
  }
  function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  function updateContinue() {
    const sv = loadSave(), b = $('btnContinue');
    b.classList.toggle('hidden', !sv); b.disabled = !sv || sv.status !== 'progress';
  }
  function continueGame() {
    const sv = loadSave(); if (!sv || sv.status !== 'progress') return;
    Object.assign(S, { stage: sv.stage, job: sv.job || 0, wins: sv.wins || JOBS.map(() => 0), endless: !!sv.endless, unbreakNoted: !!sv.unbreakNoted, lives: sv.lives, money: sv.money, hand: sv.hand ?? 0, spares: sv.spares, announced: sv.announced, skills: sv.skills || { clock: 0, hand: 0, word: 0 }, debt: sv.debt || 0, credits: sv.credits || 0, mode: 'stage' });
    if (S.hand === null && !S.spares.some(n => n)) S.hand = 0; // 저장 때 손이 비어 있었으면 볼품없는 연필 하나
    startStage();
  }

  // ---------- 화면 ----------
  // ---------- 타이틀: 보이지 않는 손이 제목을 획 순서대로 씀 (사용자 확정: 한 줄 제목, 한자는 글자로만) ----------
  const tcv = $('titlePaper'), tctx = tcv.getContext('2d');
  let titleAnim = 0, titleSkip = false;
  function playTitle() {
    cancelAnimationFrame(titleAnim); titleSkip = false;
    const lang = PC.getLang(), key = t('title');
    const { tpl, k, w } = PC.build(lang, key), g = Math.min(1, Math.max(0.5, k * 1.15));
    const lens = tpl.map(s => PC.length(s)), total = lens.reduce((a, b) => a + b, 0);
    const d = devicePixelRatio || 1, cw = Math.min(innerWidth * 0.86, (innerHeight * 0.34 * w) / 100), ch = (cw * 100) / w;
    tcv.style.width = cw + 'px'; tcv.style.height = ch + 'px'; tcv.width = Math.round(cw * d); tcv.height = Math.round(ch * d);
    tcv.setAttribute('aria-label', key);
    ['titleSub', 'titleBtns'].forEach(id => $(id).classList.remove('show'));
    const wrap = $('titleWrap'); wrap.classList.remove('arrive'); void wrap.offsetWidth; wrap.classList.add('arrive');
    const DUR = 3800, t0 = performance.now() + 900; let lastTick = 0;
    const frame = now => {
      const prog = titleSkip ? 1 : Math.max(0, Math.min(1, (now - t0) / DUR));
      const u = tcv.height / 100; tctx.setTransform(u, 0, 0, u, 0, 0);
      tctx.fillStyle = '#f1e7cf'; tctx.fillRect(0, 0, w, 100);
      tctx.strokeStyle = '#8b7a5a'; tctx.lineWidth = 0.6; tctx.strokeRect(4, 4, w - 8, 92);
      tctx.strokeStyle = '#26221d'; tctx.lineWidth = 4 * g; tctx.lineCap = tctx.lineJoin = 'round';
      let left = total * prog;
      tpl.forEach((s, i) => {
        if (left <= 0) return;
        tctx.beginPath(); tctx.moveTo(...s[0]);
        for (let j = 1; j < s.length && left > 0; j++) {
          const [ax, ay] = s[j - 1], [bx, by] = s[j], seg = Math.hypot(bx - ax, by - ay);
          if (seg <= left) { tctx.lineTo(bx, by); left -= seg; }
          else { const f = left / seg; tctx.lineTo(ax + (bx - ax) * f, ay + (by - ay) * f); left = 0; }
        }
        tctx.stroke();
      });
      if (prog > 0 && prog < 1 && now - lastTick > 70) { lastTick = now; sfxNoise(0.05, 3200, 2600, 0.05, 'highpass'); } // 사각사각
      if (prog < 1) titleAnim = requestAnimationFrame(frame);
      else { $('titleSub').classList.add('show'); setTimeout(() => $('titleBtns').classList.add('show'), titleSkip ? 0 : 600); }
    };
    titleAnim = requestAnimationFrame(frame);
  }
  // 쓰는 도중 아무 곳이나 누르면 다 쓴 상태로
  $('title').addEventListener('pointerdown', e => { if (!e.target.closest('button')) titleSkip = true; });

  function show(which) {
    const g = which === 'game';
    $('bg').classList.toggle('dim', !g);
    $('title').classList.toggle('hidden', g);
    $('deskArea').classList.toggle('hidden', !g); $('btnShop').classList.toggle('hidden', !g || !T.allowShop); // 튜토리얼에선 교도관이 상점을 알려 줄 때까지 숨김
    $('hud').classList.toggle('hidden', !g || S.mode !== 'stage');
    if (g) fit();
  }
  function toTitle() {
    clearInterval(timerId); S.mode = 'title'; S.running = false; sheet = null;
    $('stack').innerHTML = ''; PC.tutorial.stop(); show('title'); playTitle(); updateContinue();
    ['hood', 'death', 'shop', 'jobs', 'result'].forEach(id => $(id).classList.add('hidden')); $('hood').classList.remove('drop'); S.busy = false;
  }
  function hud() {
    if (S.mode !== 'stage') return;
    $('hudStage').textContent = S.stage + 1;
    $('hudTime').textContent = S.timeLeft.toFixed(1);
    $('hudQuota').textContent = `${S.stack.length} / ${stageDef().quota}`;
    $('hudLives').textContent = '♥'.repeat(Math.max(0, S.lives)) + '♡'.repeat(Math.max(0, 3 - S.lives));
    $('hudMoney').textContent = fmtMoney(S.money) + (S.endless ? '' : ` / ${RANSOM}`) + (S.debt ? ` (${t('debtShort')} ${fmtMoney(S.debt)})` : '');
    const spare = S.spares.reduce((a, b) => a + b, 0);
    $('hudPencil').textContent = (S.hand === null ? t('noPencil') : t('pencils')[S.hand]) + (spare ? ` (+${spare} ${t('spares')})` : '');
  }
  let toastId;
  function toast(m) { const e = $('toast'); e.textContent = m; e.classList.add('show'); clearTimeout(toastId); toastId = setTimeout(() => e.classList.remove('show'), 2600); }

  // 소리 (Web Audio 합성): 잡음을 거른 짧은 소리. 부러짐 = 높은 딱 / 빨려 듦 = 올라가는 휙
  let ac;
  function sfxNoise(dur, f0, f1, gain, type = 'bandpass') {
    try {
      ac = ac || new AudioContext();
      const n = Math.round(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, i / n * (type === 'highpass' ? 8 : 1)));
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = type; f.frequency.setValueAtTime(f0, ac.currentTime); f.frequency.exponentialRampToValueAtTime(f1, ac.currentTime + dur);
      g.gain.setValueAtTime(gain, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      src.buffer = buf; src.connect(f).connect(g).connect(ac.destination); src.start();
    } catch (e) {}
  }
  const sfxSnap = () => sfxNoise(0.12, 1800, 2200, 1, 'highpass');
  // 쿵: 낮게 떨어지는 사인파 + 짧은 저음 잡음 / 떨어짐: 아래로 내려가는 바람 소리
  function sfxThud(gain = 1) {
    try {
      ac = ac || new AudioContext();
      const o = ac.createOscillator(), g = ac.createGain(), now = ac.currentTime;
      o.type = 'sine'; o.frequency.setValueAtTime(90, now); o.frequency.exponentialRampToValueAtTime(32, now + 0.6);
      g.gain.setValueAtTime(gain, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      o.connect(g).connect(ac.destination); o.start(now); o.stop(now + 0.85);
    } catch (e) {}
    sfxNoise(0.25, 400, 120, gain * 0.8, 'lowpass');
  }
  const sfxFall = () => sfxNoise(1.1, 1600, 180, 0.6);

  // ---------- 버튼 ----------
  $('btnSubmit').onclick = submit;
  $('btnNew').onclick = () => {
    if (flying || S.busy || !sheet) return;
    if (S.mode === 'stage' && S.running) newSheet();
    else if (S.mode === 'tutorial' && T.allowDraw) { sheet.strokes = []; sheet.ink = 0; draw(); } // 튜토리얼: 같은 글자를 지우고 다시
  };
  // 상점은 연필이 부러지지 않았어도 게임 화면(튜토리얼·단계·대사·정산 중)이면 언제든 열림 (사용자 확정)
  $('btnShop').onclick = () => { if (T.allowShop && S.mode !== 'title' && $('death').classList.contains('hidden')) { openShop(); if (T.onShopOpen) T.onShopOpen(); } };
  $('btnShopClose').onclick = () => { $('shop').classList.add('hidden'); if (T.onShopClose) T.onShopClose(); };
  // 시작: 눈이 감기듯 검게 닫힌 뒤 튜토리얼(눈을 뜨는 장면)로
  const fadeTo = fn => { $('fadeBlack').classList.add('on'); setTimeout(() => { fn(); setTimeout(() => $('fadeBlack').classList.remove('on'), 300); }, 900); };
  $('btnStart').onclick = () => fadeTo(startGame);
  $('btnContinue').onclick = () => { if (!$('btnContinue').disabled) fadeTo(continueGame); };
  $('btnDeath').onclick = toTitle;
  $('btnSettings').onclick = () => { $('selLang').value = PC.getLang(); $('settings').classList.remove('hidden'); };
  $('btnSettingsClose').onclick = () => $('settings').classList.add('hidden');
  $('selLang').onchange = e => { PC.setLang(e.target.value); hud(); if (S.mode === 'title') playTitle(); };

  PC.setLang(PC.getLang());
  show('title'); playTitle(); updateContinue();
  PC.game = { S, T, endStage, release, JOBS, PENCILS, PASS, get sheet() { return sheet; }, get flying() { return flying; },
    saveGame, newSheet, toStack, vacuum, settle, pop, toast, result, openShop, show, startGame, startStage, endStage, draw, hud };
})();
