#!/usr/bin/env python3
"""게임에 나오는 단어·문장 속 단어가 사전에 있는지 확인 (사용자 확정 규칙).
한국어: 표준국어대사전(stdict.korean.go.kr) 표제어와 정확히 일치 / 영어: Cambridge Dictionary(dictionary.cambridge.org) 표제어로 이어짐.
한국어 문장의 활용형은 아래 KO_LEMMA로 기본형을 적어 둠 — 문장을 새로 넣으면 여기에도 추가할 것.
사용: python3 -I tools/check_words.py   (src/glyphs.js의 POOLS를 node로 읽음, 결과는 tools/.word_cache.json에 저장)
"""
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'tools', '.word_cache.json')
KO_POOLS = ['word3', 'word5']                       # 게임에 쓰는 한글 단어 묶음 (낱자·한 글자 조합은 단어가 아님)
EN_POOLS = ['word1', 'word2', 'word3', 'word4']     # 영어 단어 묶음
SENT_POOLS = ['sent1', 'sent2', 'sent3']
# 한국어 문장 속 어절 → 사전 기본형 (조사·어미는 떼어 냄)
KO_LEMMA = {
    '별이': '별', '빛난다': '빛나다', '꽃이': '꽃', '핀다': '피다', '바람이': '바람', '분다': '불다', '달이': '달', '밝다': '밝다', '봄이': '봄',
    '온다': '오다', '노을이': '노을', '진다': '지다', '눈꽃이': '눈꽃', '하늘이': '하늘', '맑다': '맑다', '강물은': '강물', '흐른다': '흐르다',
    '시간은': '시간', '사랑은': '사랑', '꽃이다': '꽃', '꿈은': '꿈', '자란다': '자라다', '파도가': '파도', '친다': '치다', '새벽이': '새벽',
    '마음이': '마음', '따뜻하다': '따뜻하다', '숲이': '숲', '고요하다': '고요하다', '빗소리가': '빗소리', '좋다': '좋다', '오늘도': '오늘',
    '맑음': '맑다', '길은': '길', '이어진다': '이어지다', '희망은': '희망', '남는다': '남다',
    '별빛이': '별빛', '조용히': '조용히', '내려앉는다': '내려앉다', '나뭇잎을': '나뭇잎', '흔든다': '흔들다', '해는': '해', '다시': '다시',
    '뜬다': '뜨다', '작은': '작다', '길가에': '길가', '봄비가': '봄비', '창문을': '창문', '두드린다': '두드리다', '달빛': '달빛', '아래': '아래',
    '강물이': '강물', '새벽': '새벽', '공기가': '공기', '차고': '차다', '그리운': '그립다', '마음은': '마음', '늘': '늘', '눈': '눈',
    '덮인': '덮이다', '산이': '산', '파도': '파도', '소리가': '소리', '멀리': '멀리', '들린다': '들리다', '하늘을': '하늘', '붉게': '붉다',
    '물들인다': '물들이다', '구름': '구름', '사이로': '사이', '햇살이': '햇살', '비친다': '비치다', '푸른': '푸르다', '들판에': '들판',
    '언제나': '언제나', '곁에': '곁', '있다': '있다', '웃는다': '웃다', '꽃잎이': '꽃잎', '날린다': '날리다', '비가': '비', '그친다': '그치다',
    '해가': '해', '붉다': '붉다', '밤이': '밤', '깊다': '깊다', '바다가': '바다', '노래한다': '노래하다', '어둠이': '어둠', '걷힌다': '걷히다',
    '눈이': '눈', '내린다': '내리다', '세상이': '세상', '꿈을': '꿈', '꾼다': '꾸다',
}

def pools():
    js = ("global.window={};require(process.argv[1]);console.log(JSON.stringify(window.PC.POOLS))")
    return json.loads(subprocess.check_output(['node', '-e', js, os.path.join(ROOT, 'src', 'glyphs.js')]))

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.geturl(), r.read().decode('utf-8', 'replace')

def ko_ok(w):
    _, html = get('https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=' + urllib.parse.quote(w))
    heads = re.findall(r'searchView\.do\?word_no=\d+[^>]*>(.*?)</a>', html, re.S)
    return any(re.sub(r'[^가-힣]', '', re.sub(r'<sup.*?</sup>|<[^>]+>', '', h)) == w for h in heads)

def en_ok(w):
    url, _ = get('https://dictionary.cambridge.org/us/dictionary/english/' + urllib.parse.quote(w.lower()))
    return not url.rstrip('/').endswith('/dictionary/english')

def main():
    P = pools()
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    ko, en, missing_lemma = set(), set(), []
    for k in KO_POOLS: ko.update(P[k]['ko'])
    for k in EN_POOLS: en.update(w.lower() for w in P[k]['en'])
    for k in SENT_POOLS:
        for s in P[k]['ko']:
            for tok in re.findall(r'[가-힣]+', s):
                if tok in KO_LEMMA: ko.add(KO_LEMMA[tok])
                else: missing_lemma.append(tok)
        for s in P[k]['en']:
            en.update(t.lower() for t in re.findall(r"[A-Za-z']+", s))
    bad = []
    for lang, words, fn in (('ko', sorted(ko), ko_ok), ('en', sorted(en), en_ok)):
        for w in words:
            key = lang + ':' + w
            if key not in cache:
                try: cache[key] = fn(w)
                except Exception as e: print('ERR', key, e); continue
                time.sleep(0.3)
            if not cache[key]: bad.append(key)
    json.dump(cache, open(CACHE, 'w'), ensure_ascii=False, indent=0)
    print('checked', len(ko), 'ko /', len(en), 'en')
    if missing_lemma: print('NO LEMMA (KO_LEMMA에 추가):', ' '.join(sorted(set(missing_lemma))))
    print('NOT FOUND:', ' '.join(bad) if bad else 'none')
    sys.exit(1 if bad or missing_lemma else 0)

if __name__ == '__main__':
    main()
