// 튜토리얼 (새 게임마다 반드시 거침): 눈을 뜸 → 창구 너머 목소리의 설명 → 따라 쓰기 → 연필 파손 → 더미·정산 → 규칙 → 상점 → 1단계
(function () {
  const $ = id => document.getElementById(id);
  const t = PC.t;
  const BASIC = [...['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'].map(k => ['ko', k]), ...['a', 'b', 'c', 'd'].map(k => ['en', k])];
  const PRACTICE = 10; // 연습 더미 장수 [임시]
  const STOP = {};
  let token = 0, clickResolve = null, introduced = false; // 교도관이 스스로 소개하기 전엔 '???'

  // ---------- 대사 ----------
  function say(key, vars, hold = true, extra = '') {
    $('dlg').classList.remove('hidden');
    $('dlgWho').textContent = introduced ? t('tu_who') : '???';
    $('dlgText').textContent = t(key, vars) + (extra ? ' ' + extra : '');
    $('dlgHint').classList.toggle('hidden', !hold);
    return hold ? new Promise(r => { clickResolve = r; }) : Promise.resolve();
  }
  function advance() { if (clickResolve) { const r = clickResolve; clickResolve = null; r(); } }
  $('dlg').addEventListener('click', advance);
  addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !$('dlg').classList.contains('hidden')) { e.preventDefault(); advance(); } });

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const G = () => PC.game;
  function writing(on) { G().T.allowDraw = on; $('controls').style.visibility = on ? '' : 'hidden'; }
  const langLine = sh => t(sh.lang === 'ko' ? 'tu_ko' : 'tu_en');

  // 한 장 따라 쓰기: 90점 이상이거나 세 번 시도하면 통과. opt.breakAt이면 그 지점에서 연필이 부러짐
  function traceOne(opt, intro) {
    return new Promise(res => {
      const g = G(), sh = g.newSheet(opt);
      // 첫 장: '이건 한국어군. ①부터…' / 다음 장: '다음. 아, 이건 영어군.'
      say('tu_next', null, false); $('dlgText').textContent = intro ? `${langLine(sh)} ${t(intro)}` : `${t('tu_next')} ${langLine(sh)}`;
      writing(true);
      let tries = 0;
      g.T.onSubmit = () => {
        const s = PC.score(sh.tpl, sh.strokes, 7 * sh.g), ok = s >= g.PASS;
        g.pop(s, ok); tries++;
        if (ok || tries >= 3) { writing(false); g.T.onSubmit = null; say(ok ? 'tu_ok' : 'tu_meh', { s }, false); setTimeout(res, 1100); }
        else { say('tu_again', { s }, false); sh.strokes = []; sh.ink = 0; g.draw(); }
      };
      g.T.onBreak = async () => {
        writing(false);
        await say('tu_snap'); await say('tu_breakRule1'); await say('tu_breakRule2'); await say('tu_free');
        g.S.hand = 0; say('tu_finish', null, false); writing(true);
      };
    });
  }

  async function run() {
    const my = ++token, step = async p => { await p; if (my !== token) throw STOP; };
    const g = G();
    try {
      g.S.mode = 'tutorial'; writing(false);
      g.show('game'); $('paperWrap').style.visibility = 'hidden'; $('stack').innerHTML = '';
      // 1. 검은 화면에서 눈을 뜸
      $('eyes').classList.remove('hidden', 'open'); $('bg').classList.add('blurry');
      await step(wait(600));
      void $('eyes').offsetWidth; $('eyes').classList.add('open'); $('bg').classList.remove('blurry');
      await step(wait(3400)); $('eyes').classList.add('hidden');
      // 2. 상황 설명
      introduced = false;
      for (const k of ['tu_1', 'tu_2', 'tu_intro', 'tu_3', 'tu_4', 'tu_5']) { if (k === 'tu_3') introduced = true; await step(say(k)); }
      // 3. 따라 쓰기: 한글·영어 둘 다 맛보기 (언어는 게임 언어와 무관)
      const first = BASIC[Math.floor(Math.random() * BASIC.length)];
      await step(traceOne({ lang: first[0], key: first[1] }, 'tu_order'));
      await step(say('tu_mixed'));
      const other = BASIC.filter(x => x[0] !== first[0]);
      const second = other[Math.floor(Math.random() * other.length)];
      await step(traceOne({ lang: second[0], key: second[1] }));
      // 4. 연필이 부러지는 장
      await step(traceOne({ pool: BASIC, breakAt: 0.5 }));
      // 5. 더미에 쌓기 → 거둬 가 정산
      await step(say('tu_pile')); await step(say('tu_pile2', { N: PRACTICE }));
      await step(new Promise(res => {
        let n = 0;
        say('tu_count', { n, N: PRACTICE }, false); writing(true); g.newSheet({ pool: BASIC });
        g.T.onSubmit = () => {
          g.toStack(); n++; say('tu_count', { n, N: PRACTICE }, false);
          if (n >= PRACTICE) { writing(false); g.T.onSubmit = null; res(); } else g.newSheet({ pool: BASIC });
        };
      }));
      await step(say('tu_collect', null, false));
      await step(new Promise(r => g.vacuum(r)));
      g.settle();
      await step(new Promise(r => g.result(t('tu_settleTitle'), t('stageResult', { n: g.S.passed, q: PRACTICE, m: g.S.earned }), t('next'), r)));
      await step(say('tu_settle'));
      // 6. 규칙·난이도
      for (const k of ['tu_rules1', 'tu_rules2', 'tu_rules3']) await step(say(k));
      // 7. 상점
      await step(say('tu_shop'));
      g.T.allowShop = true; g.openShop();
      await step(new Promise(r => { g.T.onShopClose = r; }));
      g.T.onShopClose = null;
      await step(say('tu_shop2'));
      // 볼품없는 연필 세 자루(손에 하나, 여분 둘)와 경고
      g.S.hand = 0; g.S.spares[0] += 2;
      await step(say('tu_pencils1')); await step(say('tu_pencils2')); await step(say('tu_go'));
      $('dlg').classList.add('hidden'); g.T.allowShop = false; g.T.onBreak = null;
      g.startStage();
    } catch (e) { if (e !== STOP) throw e; }
  }

  function stop() {
    token++; clickResolve = null;
    const T = G().T; Object.assign(T, { allowDraw: false, allowShop: false, onSubmit: null, onBreak: null, onShopClose: null });
    $('dlg').classList.add('hidden'); $('eyes').classList.add('hidden'); $('bg').classList.remove('blurry');
  }

  // 단계 사이 교도관 대사 (난이도가 오를 때)
  async function talk(keys, done) {
    const my = ++token; introduced = true;
    for (const k of keys) { await say(k); if (my !== token) return; }
    $('dlg').classList.add('hidden'); done();
  }

  PC.tutorial = { run, stop, talk };
})();
