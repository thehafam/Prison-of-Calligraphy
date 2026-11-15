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
    { time: 40, quota: 4, tier: 'word1' }, { time: 40, quota: 5, tier: 'word1' },
    { time: 50, quota: 4, tier: 'word2' }, { time: 60, quota: 4, tier: 'word3' },
    { time: 70, quota: 4, tier: 'word4', guide: false },
    { time: 80, quota: 3, tier: 'sent1', guide: false }];
  // 난이도가 오를 때 교도관의 설명 (guide: false = 7단계부터 획 순서 화살표·번호를 지움)
  const TIER_TALK = {
    word1: ['up_intro1', 'up_word1'],
    word2: ['up_intro2', 'up_word2'],
    word3: ['up_intro3', 'up_word3'],
    word4: ['up_intro4', 'up_word4', 'up_noguide1', 'up_noguide2'],
    sent1: ['up_intro5', 'up_sent1'],
  };
  const PASS = 90;
  const ICONS = ['assets/pencil_0.jpg', 'assets/pencil_1.jpg']; // 연필 아이콘 (나머지 4종은 이미지 오면 추가)
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
    const labels = [];
    if (sheet.guide) sheet.tpl.forEach((s, i) => arrow(s, i + 1, labels, g));
    // 플레이어 글씨
    ctx.strokeStyle = '#26221d'; ctx.lineWidth = 3.4 * g;
    for (const s of sheet.strokes) {
      if (s.length === 1) { ctx.fillStyle = '#26221d'; ctx.beginPath(); ctx.arc(s[0][0], s[0][1], 1.7 * g, 0, 7); ctx.fill(); }
      else poly(s);
    }
  }
  function poly(s) { ctx.beginPath(); s.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.stroke(); }
  function arrow(s, n, labels, g) {
    ctx.strokeStyle = '#b8352b'; ctx.lineWidth = 0.7 * g; poly(s);
    const a = s[s.length - 2], b = s[s.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.fillStyle = '#b8352b'; ctx.beginPath();
    ctx.moveTo(b[0] + Math.cos(ang) * 2.5 * g, b[1] + Math.sin(ang) * 2.5 * g);
    ctx.lineTo(b[0] + Math.cos(ang + 2.5) * 3 * g, b[1] + Math.sin(ang + 2.5) * 3 * g);
    ctx.lineTo(b[0] + Math.cos(ang - 2.5) * 3 * g, b[1] + Math.sin(ang - 2.5) * 3 * g);
    ctx.fill();
    // 번호: 시작점 뒤쪽·옆쪽 중 다른 번호와 겹치지 않는 자리
    const [x, y] = s[0], q = s[Math.min(3, s.length - 1)], L = Math.hypot(q[0] - x, q[1] - y) || 1;
    const ux = (q[0] - x) / L, uy = (q[1] - y) / L;
    const cand = [[-ux, -uy], [-uy, ux], [uy, -ux], [-ux - uy, -uy + ux], [-ux + uy, -uy - ux], [ux - uy, uy + ux], [ux + uy, uy - ux]].map(([a, b]) => [x + a * 6 * g, y + b * 6 * g]);
    const inside = c => c[0] > 5 && c[0] < sheet.w - 5 && c[1] > 5 && c[1] < 95; // 종이 밖으로 나가지 않게
    const [lx, ly] = cand.find(c => inside(c) && labels.every(l => Math.hypot(l[0] - c[0], l[1] - c[1]) > 6.5 * g)) || cand.find(inside) || cand[0];
    labels.push([lx, ly]);
    const dx = lx - x, dy = ly - y;
    ctx.beginPath(); ctx.arc(x + dx, y + dy, 3 * g, 0, 7); ctx.fillStyle = '#f1e7cf'; ctx.fill();
    ctx.strokeStyle = '#b8352b'; ctx.lineWidth = 0.5 * g; ctx.stroke();
    ctx.fillStyle = '#b8352b'; ctx.font = `bold ${4 * g}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n, x + dx, y + dy + 0.2);
  }

  // ---------- 종이 한 장: 글자는 게임 언어와 상관없이 한글·영어가 섞여 나옴 ----------
  function newSheet(opt = {}) {
    let { lang, key } = opt;
    if (!key) [lang, key] = opt.pool ? opt.pool[Math.floor(Math.random() * opt.pool.length)] : PC.pick(opt.tier || stageDef().tier);
    const { tpl, k, w = 100 } = PC.build(lang, key), g = Math.min(1, Math.max(0.5, k * 1.15)); // g: 작은 글자일수록 선·번호·허용 거리를 줄임
    setPaper(w);
    const guide = S.mode !== 'stage' || stageDef().guide !== false;
    sheet = { lang, key, tpl, g, w, guide, strokes: [], ink: 0, breakAt: Infinity };
    // 파손: 장마다 연필 등급 확률로, 쓰는 도중 아무 순간에 (튜토리얼은 정해 둔 장에서만)
    const len = tpl.reduce((a, s) => a + PC.length(s), 0);
    if (opt.breakAt) sheet.breakAt = len * opt.breakAt;
    else if (S.mode === 'stage' && S.hand !== null && Math.random() < PENCILS[S.hand].p) sheet.breakAt = len * (0.1 + Math.random() * 0.8);
    draw(); fly('arrive');
    return sheet;
  }

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
  const end = () => { cur = null; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

  // ---------- 연필 ----------
  function breakPencil() {
    cur = null; sheet.breakAt = Infinity; S.hand = null;
    sfxSnap();
    if (S.mode === 'tutorial') { hud(); return T.onBreak && T.onBreak(); }
    toast(t('pencilBroke'));
    const best = bestSpare();
    if (best >= 0) {
      S.busy = true;
      setTimeout(() => { S.spares[best]--; S.hand = best; S.busy = false; toast(t('swapped')); hud(); }, SWAP_MS);
    } else if (S.money >= PENCILS[0].price) {
      setTimeout(() => { toast(t('buyPencil')); openShop(); }, 700);
    } else {
      S.busy = true;
      setTimeout(() => {
        toast(t('freePencil')); S.lives--; S.hand = 0; S.busy = false; hud();
        if (S.lives <= 0) gameOver();
      }, SWAP_MS);
    }
    hud();
  }
  function bestSpare() { for (let g = PENCILS.length - 1; g >= 0; g--) if (S.spares[g] > 0) return g; return -1; }

  function openShop() { renderShop(); $('shop').classList.remove('hidden'); }
  function renderShop() {
    $('shopMoney').textContent = `${S.money} ${t('money')}`;
    const names = t('pencils');
    let h = `<tr><th></th><th>${t('breakRate')}</th><th>${t('price')}</th><th>${t('owned')}</th><th></th></tr>`;
    PENCILS.forEach((pc, g) => {
      const own = S.spares[g] + (S.hand === g ? ` · ${t('inHand')}` : '');
      const icon = ICONS[g] ? `<img class="pencil-icon" src="${ICONS[g]}" alt=""> ` : '';
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
      if (S.hand === null && !S.busy) S.hand = g; else S.spares[g]++;
    } else if (b.dataset.use) {
      const g = +b.dataset.use; if (!S.spares[g] || S.busy) return;
      S.spares[g]--; if (S.hand !== null) S.spares[S.hand]++; S.hand = g;
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
    S.stack.push({ tpl: sheet.tpl, strokes: sheet.strokes, g: sheet.g });
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
  // 정산: 더미의 종이를 채점해 90점 이상마다 1냥
  function settle() {
    const scores = S.stack.map(x => PC.score(x.tpl, x.strokes, 7 * x.g));
    S.passed = scores.filter(v => v >= PASS).length; S.earned = S.passed; S.money += S.passed;
    $('resultScores').innerHTML = scores.map(v => `<span class="chip ${v >= PASS ? 'ok' : ''}">${v}</span>`).join('');
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
    // 묶음(tier)이 바뀌는 단계에 처음 들어서면: 새 난이도 예시 종이를 띄우고 교도관이 설명한 뒤 시작 (시간은 그 뒤부터)
    const def = stageDef(), prev = STAGES[S.stage - 1];
    if (prev && prev.tier !== def.tier && S.announced !== def.tier) {
      S.announced = def.tier;
      Object.assign(S, { mode: 'stage', running: false, stack: [], timeLeft: def.time });
      $('stack').innerHTML = ''; show('game'); $('controls').style.visibility = 'hidden';
      newSheet({ tier: def.tier }); hud();
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
    if (S.lives <= 0) return gameOver(txt);
    const last = S.stage >= STAGES.length - 1 && clear;
    result(clear ? t('stageClear') : t('stageFail'), txt + (last ? '\n' + t('protoEnd') : ''),
      last ? t('restart') : t('nextStage'), () => { if (last) toTitle(); else { if (clear) S.stage++; startStage(); } });
  }
  function gameOver(txt = '') {
    clearInterval(timerId); S.running = false;
    if (!txt) $('resultScores').innerHTML = '';
    result(t('gameOver'), txt, t('restart'), toTitle);
  }
  function result(title, text, btn, fn) {
    $('resultTitle').textContent = title; $('resultText').textContent = text;
    const b = $('btnResult'); b.textContent = btn;
    b.onclick = () => { $('result').classList.add('hidden'); fn(); };
    $('result').classList.remove('hidden');
  }

  // ---------- 화면 ----------
  function show(which) {
    const g = which === 'game';
    $('title').classList.toggle('hidden', g);
    $('deskArea').classList.toggle('hidden', !g);
    $('hud').classList.toggle('hidden', !g || S.mode !== 'stage');
    if (g) fit();
  }
  function toTitle() {
    clearInterval(timerId); S.mode = 'title'; S.running = false; sheet = null;
    $('stack').innerHTML = ''; PC.tutorial.stop(); show('title');
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

  // ---------- 버튼 ----------
  $('btnSubmit').onclick = submit;
  $('btnNew').onclick = () => {
    if (flying || S.busy || !sheet) return;
    if (S.mode === 'stage' && S.running) newSheet();
    else if (S.mode === 'tutorial' && T.allowDraw) { sheet.strokes = []; sheet.ink = 0; draw(); } // 튜토리얼: 같은 글자를 지우고 다시
  };
  $('btnShop').onclick = () => { if (S.mode === 'stage' || T.allowShop) openShop(); };
  $('btnShopClose').onclick = () => { $('shop').classList.add('hidden'); if (T.onShopClose) T.onShopClose(); };
  $('btnStart').onclick = startGame;
  $('btnSettings').onclick = () => { $('selLang').value = PC.getLang(); $('settings').classList.remove('hidden'); };
  $('btnSettingsClose').onclick = () => $('settings').classList.add('hidden');
  $('selLang').onchange = e => { PC.setLang(e.target.value); hud(); };

  PC.setLang(PC.getLang());
  PC.game = { S, T, PENCILS, PASS, get sheet() { return sheet; }, get flying() { return flying; },
    newSheet, toStack, vacuum, settle, pop, toast, result, openShop, show, startGame, startStage, endStage, draw, hud };
})();
