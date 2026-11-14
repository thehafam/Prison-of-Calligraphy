// 문구: 기본 영어, 설정에서 한국어
(function () {
  const STR = {
    en: {
      title: 'Prison of Calligraphy', subtitle: 'Write beautifully. Or else.',
      start: 'Start', settings: 'Settings', language: 'Language', close: 'Close',
      stage: 'Stage', time: 'Time', quota: 'Submitted / Quota', lives: 'Lives', money: 'Nyang', pencil: 'Pencil', spares: 'spare',
      shop: 'Shop', submit: 'Submit', newSheet: 'New sheet', noPencil: 'No pencil!',
      accepted: 'Accepted', rejected: 'Rejected',
      pencilBroke: 'Snap! Your pencil broke.', swapped: 'You picked up a spare pencil.',
      buyPencil: 'No spare pencil. Buy one at the shop — the clock is still running.',
      freePencil: 'No money for a pencil. The guards take a life and toss you a shoddy pencil.',
      stageClear: 'Quota met.', stageFail: 'Quota not met. You lose a life.',
      stageResult: '{n} of {q} sheets accepted · +{m} nyang',
      nextStage: 'Next stage', gameOver: 'Your hands write no more.', restart: 'Back to title',
      buy: 'Buy', use: 'Use', inHand: 'In hand', breakRate: 'Break', price: 'Price', owned: 'Owned',
      protoEnd: 'End of prototype stages. Thanks for playing!',
      next: 'Next',
      tu_who: 'A voice beyond the window', tu_hint: '▸ click',
      tu_1: 'So. You are finally awake.',
      tu_2: "You don't understand what's going on, do you... Don't bother trying.",
      tu_3: 'This is the scriptorium beneath the earth. Up above, the esteemed ones collect beautiful handwriting.',
      tu_4: 'They took a liking to your hand, so they have decided to give you a chance. Consider yourself lucky.',
      tu_5: 'Your hands are bound, but your fingers still work. A sheet will come through this window. Trace what is written on it.',
      tu_ko: 'Hm, this one is Korean.', tu_en: 'Ah, this one is English.',
      tu_order: 'Start at ①, follow the arrows — stroke order counts. Press Submit when you are done.',
      tu_next: 'Next.', tu_again: 'Not good enough ({s}). Again — follow the numbers and arrows.',
      tu_ok: '{s}. Acceptable.', tu_meh: "{s}... Hmph. That'll do, for now.",
      tu_mixed: "Don't expect only one script. The esteemed ones have varied tastes — Korean, English, whatever comes through.",
      tu_snap: '...Snap. Did your pencil just break?',
      tu_breakRule1: "Cheap pencils break whenever they please. If you have a spare, you'll pick it up. If not, buy one at the Shop — the clock won't wait.",
      tu_breakRule2: 'And if you have neither a spare nor the money... it will cost you one of your three lives.',
      tu_free: 'This once, I will toss you a new one for free. Next time, there is no next time.',
      tu_finish: 'Finish that sheet.',
      tu_pile: 'Now, the real thing. Finished sheets go on the pile beside you. Nobody judges them on the spot.',
      tu_pile2: 'Write {N} sheets. No clock this time — think of it as mercy.',
      tu_count: 'Sheets on the pile: {n} / {N}',
      tu_collect: "That's enough. Time to collect.", tu_settleTitle: 'Settlement',
      tu_settle: 'Every sheet scoring 90 or more earns you 1 nyang. Anything less is waste paper.',
      tu_rules1: 'From now on, every stage has a time limit and a quota. When time runs out, the pile is collected and judged — just like that.',
      tu_rules2: 'Fall short of the quota and you lose a life. You have three. Do not waste them.',
      tu_rules3: 'The better you write, the harder it gets. Letters become words, words become sentences, and sentences become paragraphs.',
      tu_shop: 'Your nyang is spent at the Shop. Better pencils break less, and a spare can save your life. Take a look.',
      tu_shop2: 'You can open the Shop any time with the button below — even in the middle of a stage.',
      tu_go: "That's all. Now — write.",
      pencils: ['Shoddy Pencil', 'Pencil', 'Decent Pencil', 'Fairly Good Pencil', 'Fine Pencil', 'Unbreakable Pencil'],
    },
    ko: {
      title: '교필의 감옥', subtitle: '獄: 敎筆',
      start: '시작', settings: '설정', language: '언어', close: '닫기',
      stage: '단계', time: '시간', quota: '제출 / 할당', lives: '목숨', money: '냥', pencil: '연필', spares: '여분',
      shop: '상점', submit: '상납', newSheet: '새 종이', noPencil: '연필이 없다!',
      accepted: '인정', rejected: '퇴짜',
      pencilBroke: '뚝! 연필이 부러졌다.', swapped: '여분의 연필을 집어 들었다.',
      buyPencil: '여분이 없다. 상점에서 사야 한다 — 시간은 계속 흐른다.',
      freePencil: '연필 살 돈이 없다. 간수가 목숨 하나를 거두고 볼품없는 연필을 던져 준다.',
      stageClear: '할당량을 채웠다.', stageFail: '할당량을 채우지 못했다. 목숨이 하나 줄었다.',
      stageResult: '{q}장 중 {n}장 인정 · +{m}냥',
      nextStage: '다음 단계', gameOver: '더는 붓을 들 수 없다.', restart: '처음으로',
      buy: '구매', use: '쥐기', inHand: '손에 쥠', breakRate: '파손', price: '가격', owned: '보유',
      protoEnd: '시제품 단계는 여기까지입니다. 플레이해 주셔서 고맙습니다!',
      next: '다음',
      tu_who: '창구 너머의 목소리', tu_hint: '▸ 클릭',
      tu_1: '드디어 눈을 떴군.',
      tu_2: '지금 상황이 이해가 안 가겠지... 애쓸 것 없다.',
      tu_3: '여긴 땅 밑의 필사실이다. 저 위의 높으신 분들은 아름다운 글씨를 모으시지.',
      tu_4: '그분들께서 네 글씨체가 마음에 드셨다는군. 그래서 기회를 주기로 하셨다. 운이 좋은 줄 알아라.',
      tu_5: '손은 묶여 있어도 손가락은 움직이겠지. 이 창구로 종이가 들어간다. 그 위에 적힌 글씨를 그대로 따라 써라.',
      tu_ko: '흠, 이건 한국어군.', tu_en: '아, 이건 영어군.',
      tu_order: '①부터, 화살표를 따라 써라. 획 순서도 본다. 다 쓰면 「상납」을 눌러라.',
      tu_next: '다음.', tu_again: '모자라다 ({s}점). 다시. 번호와 화살표를 따라라.',
      tu_ok: '{s}점. 쓸 만하군.', tu_meh: '{s}점... 흥. 지금은 넘어가 주지.',
      tu_mixed: '한 가지 글만 나올 거라 생각하지 마라. 높으신 분들 취향은 다양하거든. 한국어든 영어든 들어오는 대로 써라.',
      tu_snap: '...뚝. 방금 연필이 부러졌나?',
      tu_breakRule1: '싸구려 연필은 제멋대로 부러진다. 여분이 있으면 그걸 쥐고, 없으면 상점에서 사라. 시간은 기다려 주지 않는다.',
      tu_breakRule2: '여분도 없고 살 돈도 없다면... 목숨 셋 중 하나로 값을 치르게 될 거다.',
      tu_free: '이번 한 번만 공짜로 하나 던져 주지. 다음은 없다.',
      tu_finish: '쓰던 종이를 마저 써라.',
      tu_pile: '이제 실전이다. 다 쓴 종이는 옆에 쌓아 둬라. 그 자리에서 판정하지 않는다.',
      tu_pile2: '{N}장을 써라. 이번엔 시간 제한이 없다. 자비라고 생각해라.',
      tu_count: '쌓인 종이: {n} / {N}',
      tu_collect: '됐다. 거둬 가지.', tu_settleTitle: '정산',
      tu_settle: '90점 이상인 종이마다 1냥. 그 아래는 휴지다.',
      tu_rules1: '이제부터는 단계마다 제한시간과 할당량이 있다. 시간이 끝나면 방금처럼 더미를 거둬 판정한다.',
      tu_rules2: '할당량을 못 채우면 목숨 하나를 잃는다. 셋뿐이니 아껴 써라.',
      tu_rules3: '잘 쓸수록 더 어려워진다. 낱자는 단어가, 단어는 문장이, 문장은 문단이 되지.',
      tu_shop: '번 돈은 상점에서 쓴다. 좋은 연필일수록 덜 부러지고, 여분 하나가 목숨을 살린다. 둘러봐라.',
      tu_shop2: '상점은 아래 단추로 언제든 열 수 있다. 단계 도중에도.',
      tu_go: '이상이다. 자, 써라.',
      pencils: ['볼품없는 연필', '연필', '괜찮은 연필', '제법 좋은 연필', '고급연필', '깨지지 않은 연필'],
    },
  };
  const KEY = 'prison_of_calligraphy_settings_v1';
  let lang = 'en';
  try { lang = JSON.parse(localStorage.getItem(KEY) || '{}').lang || 'en'; } catch (e) {}

  const t = (k, vars) => {
    let s = (STR[lang] && STR[lang][k]) ?? STR.en[k] ?? k;
    if (vars && typeof s === 'string') for (const v in vars) s = s.replace('{' + v + '}', vars[v]);
    return s;
  };
  const setLang = l => {
    lang = l;
    try { localStorage.setItem(KEY, JSON.stringify({ lang })); } catch (e) {}
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.documentElement.lang = l;
  };
  window.PC = Object.assign(window.PC || {}, { t, setLang, getLang: () => lang });
})();
