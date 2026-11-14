// 게임 흐름: 타이틀 → (튜토리얼) → 단계(제한시간 안에 90점 이상 종이를 할당량만큼) → 결과
(function () {
  const { t, GLYPHS, POOLS, TUTORIAL } = PC;
  const $ = id => document.getElementById(id);

  // 필기구: 파손 확률 7%p씩 감소(마지막은 0%), 가격 3배씩
  const PENCILS = [0.40, 0.33, 0.26, 0.19, 0.12, 0].map((p, i) => ({ p, price: 10 * 3 ** i }));
  // 단계: 첫 단계 30초 4장 (이후 수치는 시험하며 조정)
  const STAGES = [{ time: 30, quota: 4 }, { time: 30, quota: 5 }, { time: 30, quota: 6 }];
  const PASS = 90;
  const SWAP_MS = 1500; // 연필을 바꿔 쥐는 데 드는 시간 (시간은 계속 흐름)

  const S = { mode: 'title', stage: 0, lives: 3, money: 0, hand: 0, spares: [0, 0, 0, 0, 0, 0],
    timeLeft: 0, passed: 0, earned: 0, running: false, busy: false, tutStep: 0, tutTries: 0 };
  let sheet = null, cur = null, timerId = null;

  // ---------- 종이 그리기 ----------
  const cv = $('paper'), ctx = cv.getContext('2d');
  function fit() {
    const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
    draw();
  }
  window.addEventListener('resize', fit);

  function draw() {
    const u = cv.width / 100;
    ctx.setTransform(u, 0, 0, u, 0, 0);
    ctx.fillStyle = '#f1e7cf'; ctx.fillRect(0, 0, 100, 100);
    ctx.strokeStyle = '#8b7a5a'; ctx.lineWidth = 0.6; ctx.strokeRect(4, 4, 92, 92);
    ctx.setLineDash([1.5, 1.5]); ctx.strokeStyle = '#c9b996'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(50, 4); ctx.lineTo(50, 96); ctx.moveTo(4, 50); ctx.lineTo(96, 50); ctx.stroke();
    ctx.setLineDash([]);
    if (!sheet) return;
    ctx.lineCap = ctx.lineJoin = 'round';
    // 따라 쓸 글씨 (회색)
    ctx.strokeStyle = '#c4bcae'; ctx.lineWidth = 8;
    for (const s of sheet.tpl) poly(s);
    // 획 순서 화살표·번호
    const labels = [];
    sheet.tpl.forEach((s, i) => arrow(s, i + 1, labels));
    // 플레이어 글씨
    ctx.strokeStyle = '#26221d'; ctx.lineWidth = 3.4;
    for (const s of sheet.strokes) {
      if (s.length === 1) { ctx.fillStyle = '#26221d'; ctx.beginPath(); ctx.arc(s[0][0], s[0][1], 1.7, 0, 7); ctx.fill(); }
      else poly(s);
    }
  }
  function poly(s) { ctx.beginPath(); s.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.stroke(); }
  function arrow(s, n, labels) {
    ctx.strokeStyle = '#b8352b'; ctx.lineWidth = 0.7; poly(s);
    const a = s[s.length - 2], b = s[s.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    ctx.fillStyle = '#b8352b'; ctx.beginPath();
    ctx.moveTo(b[0] + Math.cos(ang) * 2.5, b[1] + Math.sin(ang) * 2.5);
    ctx.lineTo(b[0] + Math.cos(ang + 2.5) * 3, b[1] + Math.sin(ang + 2.5) * 3);
    ctx.lineTo(b[0] + Math.cos(ang - 2.5) * 3, b[1] + Math.sin(ang - 2.5) * 3);
    ctx.fill();
    // 번호: 시작점 뒤쪽·옆쪽 중 다른 번호와 겹치지 않는 자리
    const [x, y] = s[0], q = s[Math.min(3, s.length - 1)], L = Math.hypot(q[0] - x, q[1] - y) || 1;
    const ux = (q[0] - x) / L, uy = (q[1] - y) / L;
    const cand = [[-ux, -uy], [-uy, ux], [uy, -ux], [-ux - uy, -uy + ux], [-ux + uy, -uy - ux]].map(([a, b]) => [x + a * 6, y + b * 6]);
    const [lx, ly] = cand.find(c => labels.every(l => Math.hypot(l[0] - c[0], l[1] - c[1]) > 6.5)) || cand[0];
    labels.push([lx, ly]);
    const dx = lx - x, dy = ly - y;
    ctx.beginPath(); ctx.arc(x + dx, y + dy, 3, 0, 7); ctx.fillStyle = '#f1e7cf'; ctx.fill();
    ctx.strokeStyle = '#b8352b'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = '#b8352b'; ctx.font = 'bold 4px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n, x + dx, y + dy + 0.2);
  }

  // ---------- 종이 한 장 ----------
  function newSheet(key) {
    const lang = PC.getLang();
    if (!key) { const pool = POOLS[lang]; key = pool[Math.floor(Math.random() * pool.length)]; }
    const tpl = GLYPHS[lang][key];
    sheet = { key, tpl, strokes: [], ink: 0, breakAt: Infinity };
    // 파손: 장마다 연필 등급 확률로, 쓰는 도중 아무 순간에
    if (S.mode === 'stage' && S.hand !== null && Math.random() < PENCILS[S.hand].p) {
      const len = tpl.reduce((a, s) => a + PC.length(s), 0);
      sheet.breakAt = len * (0.1 + Math.random() * 0.8);
    }
    const w = $('paperWrap'); w.classList.remove('slide'); void w.offsetWidth; w.classList.add('slide');
    draw();
  }

  const canDraw = () => (S.mode === 'stage' ? S.running : S.mode === 'tutorial' && S.tutStep === 2) && S.hand !== null && !S.busy;
  function pt(e) { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100]; }
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
    sfxSnap(); toast(t('pencilBroke'));
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
      h += `<tr><td>${names[g]}</td><td>${Math.round(pc.p * 100)}%</td><td>${pc.price}</td><td>${own}</td><td>
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

  // ---------- 상납 ----------
  function submit() {
    if (!sheet || !sheet.strokes.length || S.busy) return;
    const s = PC.score(sheet.tpl, sheet.strokes), ok = s >= PASS;
    pop(s, ok);
    if (S.mode === 'tutorial') {
      S.tutTries++;
      if (ok) { toast(t('great', { s })); S.tutStep++; showTut(); }
      else { toast(t('tryAgain', { s })); newSheet(TUTORIAL[PC.getLang()]); if (S.tutTries >= 3) $('tutSkip').classList.remove('hidden'); }
      return;
    }
    if (!S.running) return;
    if (ok) { S.passed++; S.money++; S.earned++; }
    hud(); newSheet();
  }
  function pop(s, ok) {
    const p = $('scorePop'); p.textContent = s; p.style.color = ok ? 'var(--ok)' : 'var(--accent)';
    p.classList.remove('show'); void p.offsetWidth; p.classList.add('show');
  }

  // ---------- 단계 ----------
  const stageDef = () => STAGES[Math.min(S.stage, STAGES.length - 1)];
  function startGame() {
    Object.assign(S, { stage: 0, lives: 3, money: 0, hand: 0, spares: [0, 0, 0, 0, 0, 0] });
    startStage();
  }
  function startStage() {
    S.mode = 'stage'; S.passed = 0; S.earned = 0; S.timeLeft = stageDef().time; S.running = true; S.busy = false;
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
    result(t('gameOver'), txt, t('restart'), toTitle);
  }
  function result(title, text, btn, fn) {
    $('resultTitle').textContent = title; $('resultText').textContent = text;
    const b = $('btnResult'); b.textContent = btn;
    b.onclick = () => { $('result').classList.add('hidden'); fn(); };
    $('result').classList.remove('hidden');
  }

  // ---------- 튜토리얼 ----------
  function startTutorial() {
    S.mode = 'tutorial'; S.tutStep = 0; S.tutTries = 0; S.hand = 0; S.busy = false;
    show('game'); sheet = null; draw(); showTut();
  }
  function showTut() {
    const steps = t('tut');
    if (S.tutStep >= steps.length) { $('tutBox').classList.add('hidden'); return startGame(); }
    $('tutBox').classList.remove('hidden');
    $('tutText').textContent = steps[S.tutStep];
    const tracing = S.tutStep === 2;
    $('tutNext').textContent = S.tutStep === steps.length - 1 ? t('start') : t('next');
    $('tutNext').classList.toggle('hidden', tracing);
    $('tutSkip').classList.toggle('hidden', !tracing || S.tutTries < 3);
    if (S.tutStep === 1 || tracing) { if (!sheet) newSheet(TUTORIAL[PC.getLang()]); }
    $('controls').classList.toggle('hidden', !tracing);
  }
  $('tutNext').onclick = () => { S.tutStep++; showTut(); };
  $('tutSkip').onclick = () => { S.tutStep++; showTut(); };

  // ---------- 화면 ----------
  function show(which) {
    const g = which === 'game';
    $('title').classList.toggle('hidden', g);
    ['hud', 'deskArea'].forEach(id => $(id).classList.toggle('hidden', !g));
    $('controls').classList.remove('hidden');
    $('hud').classList.toggle('hidden', !g || S.mode !== 'stage');
    if (g) fit();
  }
  function toTitle() {
    clearInterval(timerId); S.mode = 'title'; S.running = false; sheet = null;
    $('tutBox').classList.add('hidden'); show('title');
  }
  function hud() {
    if (S.mode !== 'stage') return;
    $('hudStage').textContent = S.stage + 1;
    $('hudTime').textContent = S.timeLeft.toFixed(1);
    $('hudQuota').textContent = `${S.passed}/${stageDef().quota}`;
    $('hudLives').textContent = '♥'.repeat(Math.max(0, S.lives)) + '♡'.repeat(Math.max(0, 3 - S.lives));
    $('hudMoney').textContent = S.money;
    const spare = S.spares.reduce((a, b) => a + b, 0);
    $('hudPencil').textContent = (S.hand === null ? t('noPencil') : t('pencils')[S.hand]) + (spare ? ` (+${spare} ${t('spares')})` : '');
  }
  let toastId;
  function toast(m) { const e = $('toast'); e.textContent = m; e.classList.add('show'); clearTimeout(toastId); toastId = setTimeout(() => e.classList.remove('show'), 2600); }

  // 부러지는 소리 (Web Audio 합성)
  let ac;
  function sfxSnap() {
    try {
      ac = ac || new AudioContext();
      const n = ac.sampleRate * 0.12, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 1800; src.buffer = buf; src.connect(f).connect(ac.destination); src.start();
    } catch (e) {}
  }

  // ---------- 버튼 ----------
  $('btnSubmit').onclick = submit;
  $('btnNew').onclick = () => { if (S.mode === 'stage' && S.running && !S.busy) newSheet(); else if (S.mode === 'tutorial') newSheet(sheet && sheet.key); };
  $('btnShop').onclick = () => { if (S.mode === 'stage') openShop(); };
  $('btnShopClose').onclick = () => $('shop').classList.add('hidden');
  $('btnStart').onclick = startGame;
  $('btnTutorial').onclick = startTutorial;
  $('btnSettings').onclick = () => { $('selLang').value = PC.getLang(); $('settings').classList.remove('hidden'); };
  $('btnSettingsClose').onclick = () => $('settings').classList.add('hidden');
  $('selLang').onchange = e => { PC.setLang(e.target.value); hud(); };

  PC.setLang(PC.getLang());
  PC.game = { S, PENCILS, get sheet() { return sheet; }, startGame, startTutorial, endStage };
})();
