// 게임 흐름: 타이틀 → 튜토리얼(src/tutorial.js) → 단계(제한시간 안에 90점 이상 종이를 할당량만큼) → 결과
(function () {
  const { t } = PC;
  const $ = id => document.getElementById(id);

  // 필기구: 파손 확률 7%p씩 감소(마지막은 0%), 가격 3배씩
  const PENCILS = [0.40, 0.33, 0.26, 0.19, 0.12, 0].map((p, i) => ({ p, price: 10 * 3 ** i }));
  // 단계: 첫 단계 30초 4장 (이후 수치는 시험하며 조정)
  // tier: letter 낱자 / word1 쉬운 단어 1(영어 3자·한글 한 글자) / word2 단어 2(영어 4~5자·한글 두 글자) / word3 단어 3(영어 6자·한글 받침) / word4 단어 4(영어 7자 이상·한글 겹받침·이중모음) / sent1 짧은 문장(두세 단어). 단어 단계 시간·장수는 [임시]
  // 1~4단계는 두 단계씩 같은 묶음, 5단계부터는 한 단계마다 오름 (사용자 확정)
  const STAGES = [{ time: 30, quota: 4, tier: 'letter' }, { time: 30, quota: 5, tier: 'letter' },
    { time: 50, quota: 4, tier: 'word1' }, { time: 55, quota: 5, tier: 'word1' },
    { time: 75, quota: 4, tier: 'word2' }, { time: 90, quota: 4, tier: 'word3' },
    { time: 115, quota: 4, tier: 'word4', guide: false },
    { time: 135, quota: 3, tier: 'sent1', guide: false }];
  // 난이도가 오를 때 교도관의 설명 (guide: false = 7단계부터 획 순서 화살표·번호를 지움)
  const TIER_TALK = {
    word1: ['up_intro1', 'up_word1'],
    word2: ['up_intro2', 'up_word2'],
    word3: ['up_intro3', 'up_word3'],
    word4: ['up_intro4', 'up_word4', 'up_noguide1', 'up_noguide2'],
    sent1: ['up_intro5', 'up_sent1'],
  };
  const PASS = 80; // 합격선 (사용자 확정)
  // 보상: 기본금(글이 길수록 많음: 획 수 ÷ 3, 최소 1냥) + 완성도 (80~89점 기본금 / 90~99점 +1 / 100점 +2)
  const baseOf = tpl => Math.max(1, Math.round(tpl.length / 3));
  const rewardOf = (score, base) => (score >= 100 ? base + 2 : score >= 90 ? base + 1 : score >= PASS ? base : 0);
  // 파손: 글자 수에 비례 — 글자 하나마다 등급 확률 × 1/4 (표의 확률 ≈ 4글자 한 장 기준). 한 장에 여러 번 부러질 수 있음 (최대 횟수 없음)
  const BREAK_PER_CHAR = 0.25;
  const ICONS = [0, 1, 2, 3, 4, 5].map(g => `assets/pencil_${g}.jpg`); // 연필 아이콘 (나머지 4종은 이미지 오면 추가)
  const SWAP_MS = 1500; // 연필을 바꿔 쥐는 데 드는 시간 (시간은 계속 흐름)

  const S = { mode: 'title', stage: 0, lives: 3, money: 0, hand: 0, spares: [0, 0, 0, 0, 0, 0],
    timeLeft: 0, stack: [], passed: 0, earned: 0, running: false, busy: false };
  // 튜토리얼이 조종하는 고리: 쓰기 허용·상납·연필 파손·상점 닫힘
  const T = { allowDraw: false, allowShop: false, onSubmit: null, onBreak: null, onShopClose: null };
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
    const chars = [...key].filter(ch => ch !== ' ' && ch !== '.').length;
    sheet = { lang, key, tpl, g, w, guide, chars, base: baseOf(tpl), strokes: [], ink: 0, breakAt: Infinity };
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
    const p = PENCILS[S.hand].p * BREAK_PER_CHAR, at = [];
    for (let i = 0; i < left; i++) if (Math.random() < p) at.push(sheet.ink + (sheet.len - sheet.ink) * (0.05 + Math.random() * 0.9));
    sheet.breaks = at.sort((a, b) => a - b); sheet.breakAt = sheet.breaks.shift() ?? Infinity;
  }
  function takePencil(g) { S.hand = g; planBreaks(); hud(); }

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
    if (cur) sheet.breakCount = (sheet.breakCount || 0) + 1; // 쓰던 획이 끊김 → 이어 쓰는 획 하나 더 허용
    cur = null; sheet.breakAt = Infinity; sheet.breaks = []; S.hand = null; // 새 연필을 쥐면 남은 글자로 다시 정함
    sfxSnap();
    if (S.mode === 'tutorial') { hud(); return T.onBreak && T.onBreak(); }
    toast(t('pencilBroke'));
    const best = bestSpare();
    if (best >= 0) {
      S.busy = true;
      setTimeout(() => { S.spares[best]--; S.busy = false; takePencil(best); toast(t('swapped')); }, SWAP_MS);
    } else if (S.money >= PENCILS[0].price) {
      setTimeout(() => { toast(t('buyPencil')); openShop(); }, 700);
    } else {
      S.busy = true;
      setTimeout(() => {
        toast(t('freePencil')); S.lives--; S.busy = false; takePencil(0);
        if (S.lives > 0) saveGame(); // 단계 도중 연필값으로 잃은 목숨도 바로 저장 (껐다 켜도 되살아나지 않게)
        if (S.lives <= 0) gameOver();
      }, SWAP_MS);
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
  function openShop() { renderShop(); $('shop').classList.remove('hidden'); }
  function renderShop() {
    $('shopMoney').innerHTML = `<img class="coin" src="assets/coin.png" alt=""> ${S.money} ${t('money')}`;
    const names = t('pencils');
    let h = `<tr><th></th><th>${t('breakRate')}</th><th>${t('price')}</th><th>${t('owned')}</th><th></th></tr>`;
    PENCILS.forEach((pc, g) => {
      const own = S.spares[g] + (S.hand === g ? ` · ${t('inHand')}` : '');
      const icon = ICONS[g] ? pencilPic(g) : '';
      h += `<tr><td>${icon}${names[g]}</td><td>${Math.round(pc.p * 100)}%</td><td>${pc.price}</td><td>${own}</td><td>
        <button data-buy="${g}" ${S.money < pc.price ? 'disabled' : ''}>${t('buy')}</button>
        <button data-use="${g}" ${S.spares[g] && S.hand !== g ? '' : 'disabled'}>${t('use')}</button></td></tr>`;
    });
    $('shopTable').innerHTML = h;
  }
  $('shopTable').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.buy) {
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
    const k = 0.3, w = r.width * k;
    const x = Math.min(r.right + 24, innerWidth - w - 12) + Math.random() * 8 - 4, y = r.bottom - w - i * 4;
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
    $('resultScores').innerHTML = scores.map((v, i) => `<span class="chip ${v >= PASS ? 'ok' : ''}">${v}${pay[i] ? ` · +${pay[i]} <img class="coin" src="assets/coin.png" alt="">` : ''}</span>`).join('');
    S.stack = []; $('stack').innerHTML = '';
    return scores;
  }
  function pop(s, ok) {
    const p = $('scorePop'); p.textContent = s; p.style.color = ok ? 'var(--ok)' : 'var(--accent)';
    p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
  }

  // ---------- 단계 ----------
  const stageDef = () => STAGES[Math.min(S.stage, STAGES.length - 1)];
  function startGame() {
    Object.assign(S, { stage: 0, lives: 3, money: 0, hand: 0, spares: [0, 0, 0, 0, 0, 0], announced: null });
    PC.tutorial.run(); // 새 게임은 반드시 튜토리얼부터
  }
  function startStage() {
    // 묶음(tier)이 바뀌는 단계에 처음 들어서면: 교도관이 새 난이도를 설명한 뒤 시작 (종이 없이, 시간은 그 뒤부터)
    const def = stageDef(), prev = STAGES[S.stage - 1];
    if (prev && prev.tier !== def.tier && S.announced !== def.tier) {
      S.announced = def.tier;
      Object.assign(S, { mode: 'stage', running: false, stack: [], timeLeft: def.time });
      $('stack').innerHTML = ''; show('game'); $('controls').style.visibility = 'hidden';
      sheet = null; $('paperWrap').style.visibility = 'hidden'; hud(); // 설명하는 동안 종이는 나오지 않음 (사용자 확정)
      return PC.tutorial.talk(TIER_TALK[def.tier] || [], startStage);
    }
    Object.assign(S, { mode: 'stage', passed: 0, earned: 0, stack: [], timeLeft: stageDef().time, running: true, busy: false });
    $('stack').innerHTML = ''; $('controls').style.visibility = '';
    show('game'); newSheet(); hud();
    const t0 = performance.now(), total = S.timeLeft;
    clearInterval(timerId);
    timerId = setInterval(() => {
      S.timeLeft = Math.max(0, total - (performance.now() - t0) / 1000);
      hud();
      if (S.timeLeft <= 0) endStage();
    }, 100);
  }
  function endStage() {
    clearInterval(timerId); S.running = false; cur = null;
    $('shop').classList.add('hidden');
    // 시간이 끝났을 때 쓰던 종이도 글씨가 있으면 함께 냄 [임시]
    if (sheet && sheet.strokes.length && !flying) toStack();
    sheet = null; $('paperWrap').style.visibility = 'hidden'; $('controls').style.visibility = 'hidden';
    vacuum(judge);
  }
  function judge() {
    settle();
    const q = stageDef().quota, clear = S.passed >= q;
    if (!clear) S.lives--;
    hud();
    const txt = t('stageResult', { n: S.passed, q, m: S.earned });
    if (S.lives <= 0) return gameOver();
    const last = S.stage >= STAGES.length - 1 && clear;
    if (last) saveGame('ended');               // 끝까지 깸 → 이어하기는 보이되 못 누름
    else { if (clear) S.stage++; saveGame(); } // 결과가 나오는 순간 저장 (실패해 잃은 목숨도 저장)
    result(clear ? t('stageClear') : t('stageFail'), txt + (last ? '\n' + t('protoEnd') : ''),
      last ? t('restart') : t('nextStage'), () => { if (last) toTitle(); else startStage(); });
  }
  // 죽음: 교도관의 마지막 말 → 복면이 씌워지듯 암전 → 쿵(발판이 꺼짐) → 떨어지는 소리 → "당신은 죽었습니다."
  function gameOver() {
    saveGame('ended'); // 죽음도 엔딩 → 이어하기는 보이되 못 누름
    clearInterval(timerId); S.running = false; S.busy = true; cur = null;
    ['shop', 'result'].forEach(id => $(id).classList.add('hidden'));
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
      $('deathSub').textContent = t('deathSub', { n: S.stage + 1, m: S.money });
      $('death').classList.remove('hidden');
    });
  }
  function result(title, text, btn, fn) {
    $('resultTitle').textContent = title; $('resultText').textContent = text;
    const b = $('btnResult'); b.textContent = btn;
    b.onclick = () => { $('result').classList.add('hidden'); fn(); };
    $('result').classList.remove('hidden');
  }

  // ---------- 자동 저장 (사용자 확정): 튜토리얼을 마치고 1단계에 들어설 때 + 매 단계 결과 ----------
  // status: progress = 이어하기 가능 / ended = 엔딩을 봄(죽음 포함) → 이어하기 보이되 비활성 / 기록 없음 → 이어하기 숨김
  const SAVE_KEY = 'prison_of_calligraphy_save_v1';
  function saveGame(status = 'progress') {
    const d = { status, stage: S.stage, lives: S.lives, money: S.money, hand: S.hand, spares: S.spares, announced: S.announced || null };
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
    Object.assign(S, { stage: sv.stage, lives: sv.lives, money: sv.money, hand: sv.hand ?? 0, spares: sv.spares, announced: sv.announced, mode: 'stage' });
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
    $('deskArea').classList.toggle('hidden', !g); $('btnShop').classList.toggle('hidden', !g);
    $('hud').classList.toggle('hidden', !g || S.mode !== 'stage');
    if (g) fit();
  }
  function toTitle() {
    clearInterval(timerId); S.mode = 'title'; S.running = false; sheet = null;
    $('stack').innerHTML = ''; PC.tutorial.stop(); show('title'); playTitle(); updateContinue();
    ['hood', 'death', 'shop'].forEach(id => $(id).classList.add('hidden')); $('hood').classList.remove('drop'); S.busy = false;
  }
  function hud() {
    if (S.mode !== 'stage') return;
    $('hudStage').textContent = S.stage + 1;
    $('hudTime').textContent = S.timeLeft.toFixed(1);
    $('hudQuota').textContent = `${S.stack.length} / ${stageDef().quota}`;
    $('hudLives').textContent = '♥'.repeat(Math.max(0, S.lives)) + '♡'.repeat(Math.max(0, 3 - S.lives));
    $('hudMoney').textContent = S.money;
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
  $('btnShop').onclick = () => { if (S.mode !== 'title' && $('death').classList.contains('hidden')) openShop(); };
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
  PC.game = { S, T, PENCILS, PASS, get sheet() { return sheet; }, get flying() { return flying; },
    saveGame, newSheet, toStack, vacuum, settle, pop, toast, result, openShop, show, startGame, startStage, endStage, draw, hud };
})();
