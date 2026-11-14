// 문구: 기본 영어, 설정에서 한국어
(function () {
  const STR = {
    en: {
      title: 'Prison of Calligraphy', subtitle: 'Write beautifully. Or else.',
      start: 'Start', tutorial: 'Tutorial', settings: 'Settings', language: 'Language', close: 'Close',
      stage: 'Stage', time: 'Time', quota: 'Accepted', lives: 'Lives', money: 'Nyang', pencil: 'Pencil', spares: 'spare',
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
      next: 'Next', skip: 'Skip', tryAgain: 'Not quite ({s}). Trace it again — follow the numbers and arrows.',
      great: 'Good ({s}). The masters will accept that.',
      tut: [
        'You are chained to a desk in an underground prison. Your hands are tied; only your pencil may move.',
        'Through the window ahead, a sheet of paper is slid onto your desk. Trace the letter on it.',
        'Follow the stroke order: start at ①, then ②, and follow each arrow\'s direction. Try it now — trace this letter and press Submit.',
        'Each sheet is scored 0–100 by how well you cover the line, how little you stray, and the stroke order. Only sheets scoring 90 or more are accepted.',
        'Each stage has a time limit (e.g. 30 seconds) and a quota of accepted sheets. Miss the quota and you lose one of your 3 lives.',
        'Every accepted sheet earns 1 nyang. Cheap pencils break at random — a shoddy pencil breaks 40% of the time. Buy better pencils and spares at the Shop.',
        'If your pencil breaks with no spare and no money, you lose a life. Now — write.',
      ],
      pencils: ['Shoddy Pencil', 'Pencil', 'Decent Pencil', 'Fairly Good Pencil', 'Fine Pencil', 'Unbreakable Pencil'],
    },
    ko: {
      title: '교필의 감옥', subtitle: '獄: 敎筆',
      start: '시작', tutorial: '튜토리얼', settings: '설정', language: '언어', close: '닫기',
      stage: '단계', time: '시간', quota: '인정', lives: '목숨', money: '냥', pencil: '연필', spares: '여분',
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
      next: '다음', skip: '건너뛰기', tryAgain: '아직 부족하다 ({s}점). 번호와 화살표를 따라 다시 써 보자.',
      great: '좋다 ({s}점). 이 정도면 높으신 분들도 받아 줄 것이다.',
      tut: [
        '지하감옥, 책상에 손이 묶인 채 앉아 있다. 움직일 수 있는 건 연필뿐이다.',
        '앞의 창구로 종이 한 장이 책상 위에 올라온다. 그 위의 글씨를 따라 써야 한다.',
        '획 순서를 지킨다: ①부터 시작해 ②로, 화살표 방향대로. 지금 직접 따라 쓰고 「상납」을 눌러 보자.',
        '종이마다 선을 얼마나 덮었는지, 얼마나 벗어나지 않았는지, 획 순서를 보고 0~100점을 매긴다. 90점 이상만 인정된다.',
        '단계마다 제한시간(예: 30초)과 인정받아야 할 장수가 있다. 채우지 못하면 목숨 3개 중 하나를 잃는다.',
        '인정된 종이 한 장에 1냥. 싼 연필은 아무 때나 부러진다 — 볼품없는 연필은 40%. 상점에서 좋은 연필과 여분을 사 두자.',
        '연필이 부러졌는데 여분도 돈도 없으면 목숨을 잃는다. 자, 써라.',
      ],
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
