"""
Furigana Dubbing Studio - Python Native Annotation Engine
Powered by Fugashi (MeCab) + UniDic-Lite with Contextual Disambiguation (前後文上下文消歧)
"""

import re
import random
import string

# Kanji Unicode Range Test
KANJI_REGEX = re.compile(r'[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]')

ROMAJI_MAP = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'o', 'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'っ': 'tsu', 'ゃ': 'ya', 'ゅ': 'yu', 'ょ': 'yo', 'ー': '-'
}

# High-priority idiom dictionary
GRAMMAR_PATTERNS = {
    '一日中': 'いちにちじゅう',
    '大好きな': 'だいすきな',
    '大好きだ': 'だいすきだ',
    '大好き': 'だいすき',
    '大嫌い': 'だいきらい',
    '大部分': 'だいぶぶん',
    '大丈夫': 'だいじょうぶ',
    '大変': 'たいへん',
    '大切': 'たいせつ',
    '大事': 'だいじ',
    'そんな風に': 'そんなふうに',
    'こんな風に': 'こんなふうに',
    'あんな風に': 'あんなふうに',
    'どんな風に': 'どんなふうに',
    'そんな風': 'そんなふう',
    'こんな風': 'こんなふう',
    '読み方': 'よみかた',
    '書き方': 'かきかた',
    '考え方': 'かんがえかた',
    '話し方': 'はなしかた',
    '使い方': 'つかいかた',
    '教え方': 'おしえかた',
    '仕方': 'しかた',
    '何人': 'なんにん',
    '何日': 'なんにち',
    '何時': 'なんじ',
    '何年': 'なんねん',
    '何回': 'なんかい',
    '何度': 'なんど',
    '何分': 'なんぷん',
    '何秒': 'なんびょう',
    '何個': 'なんこ',
    '何本': 'なんほん',
    '何枚': 'なんまい',
}

# Fallback Dictionary
KANJI_READINGS = {
    '私': 'わたし', '僕': 'ぼく', '俺': 'おれ', '君': 'きみ', '人': 'ひと',
    '今日': 'きょう', '明日': 'あした', '昨日': 'きのう', '今': 'いま',
    '日本': 'にほん', '日本語': 'にほんご', '世界': 'せかい', '学校': 'がっこう',
    '先生': 'せんせい', '学生': 'がくせい', '友達': 'ともだち', '声優': 'せいゆう',
    '台本': 'だいほん', '字幕': 'じまく', '吹替': 'ふきかえ', '役割': 'やくわり',
    '時間': 'じかん', '心': 'こころ', '愛': 'あい', '光': 'ひかり', '空': 'そら',
    '海': 'うみ', '風': 'かぜ', '雨': 'あめ', '花': 'はな', '夢': 'ゆめ',
    '声': 'こえ', '物語': 'ものがたり', '奇跡': 'きせき', '未来': 'みらい',
    '希望': 'きぼう', '絶望': 'ぜつぼう', '真実': 'しんじつ', '嘘': 'うそ',
    '約束': 'やくそく', '冒険': 'ぼうけん', '戦い': 'たたかい', '勝利': 'しょうり',
    '仲間': 'なかま', '絆': 'きずな', '感情': 'かんじょう', '記憶': 'きおく',
    '言葉': 'ことば', '運命': 'うんめい', '地球': 'ちきゅう', '宇宙': 'うちゅう',
    '星': 'ほし', '太陽': 'たいよう', '月': 'つき', '夜': 'よる', '朝': 'あさ',
    '昼': 'ひる', '季節': 'きせつ', '春': 'はる', '夏': 'なつ', '秋': 'あき',
    '冬': 'ふゆ', '桜': 'さくら', '雪': 'ゆき', '神': 'かみ', '悪魔': 'あくま',
    '勇者': 'ゆうしゃ', '魔王': 'まおう', '魔法': 'まほう', '科学': 'かがく',
    '技術': 'ぎじゅつ', '力': 'ちから', '能力': 'のうりょく', '限界': 'げんかい',
    '山田': 'やまだ', '佐藤': 'さとう', '鈴木': 'すずき', '田中': 'たなか'
}

# Try loading fugashi tagger with unidic
try:
    import fugashi
    _tagger = fugashi.Tagger()
except Exception:
    _tagger = None


def katakana_to_hiragana(text: str) -> str:
    return ''.join(chr(ord(c) - 0x60) if '\u30A1' <= c <= '\u30F6' else c for c in text)


def kana_to_romaji(hira_text: str) -> str:
    res = ''
    for char in hira_text:
        res += ROMAJI_MAP.get(char, char)
    return res


def format_reading(reading: str, ruby_type: str = 'hiragana') -> str:
    if ruby_type == 'katakana':
        return ''.join(chr(ord(c) + 0x60) if '\u3041' <= c <= '\u3096' else c for c in reading)
    elif ruby_type == 'romaji':
        return kana_to_romaji(reading)
    return reading


def parse_compound_to_tokens(phrase: str, reading: str, ruby_type: str = 'hiragana'):
    if not KANJI_REGEX.search(phrase):
        return [{'surface': phrase, 'hasKanji': False}]

    prefix_len = 0
    while prefix_len < len(phrase) and not KANJI_REGEX.search(phrase[prefix_len]):
        prefix_len += 1

    suffix_len = 0
    while suffix_len < len(phrase) - prefix_len and not KANJI_REGEX.search(phrase[len(phrase) - 1 - suffix_len]):
        suffix_len += 1

    prefix_kana = phrase[:prefix_len]
    kanji_part = phrase[prefix_len:len(phrase) - suffix_len]
    suffix_kana = phrase[len(phrase) - suffix_len:]

    kanji_reading = reading
    if prefix_kana and kanji_reading.startswith(prefix_kana):
        kanji_reading = kanji_reading[len(prefix_kana):]
    if suffix_kana and kanji_reading.endswith(suffix_kana):
        kanji_reading = kanji_reading[:-len(suffix_kana)]

    tokens = []
    if prefix_kana:
        tokens.append({'surface': prefix_kana, 'hasKanji': False})

    if kanji_part:
        tokens.append({
            'surface': kanji_part,
            'ruby': format_reading(kanji_reading, ruby_type),
            'hasKanji': True
        })

    if suffix_kana:
        tokens.append({'surface': suffix_kana, 'hasKanji': False})

    return tokens


def annotate_line(raw_line: str, ruby_type: str = 'hiragana'):
    """
    Tokenizes Japanese text line into tokens with Kanji readings, keeping original text intact.
    Supports Fugashi/UniDic contextual tokenization with disambiguation rules.
    """
    content = raw_line
    tokens = []

    if _tagger is not None:
        words = list(_tagger(content))
        for i, w in enumerate(words):
            surface = w.surface
            if not KANJI_REGEX.search(surface):
                tokens.append({'surface': surface, 'hasKanji': False})
                continue

            raw_kana = getattr(w.feature, 'kana', '') or ''
            reading = katakana_to_hiragana(raw_kana) if raw_kana else (KANJI_READINGS.get(surface) or '')

            # Check grammar patterns override
            if surface in GRAMMAR_PATTERNS:
                reading = GRAMMAR_PATTERNS[surface]
            else:
                prev_surface = words[i - 1].surface if i > 0 else ''
                next_surface = words[i + 1].surface if i < len(words) - 1 else ''

                # Contextual disambiguation
                if surface == '辛い':
                    if re.search(r'味|料理|食べ|辛い物|塩|ラーメン|甘い|カレー|激辛|唐辛子|麻婆|舌|スープ', content):
                        reading = 'からい'
                    elif re.search(r'日々|思い|経験|現実|練習|別れ|人生|仕事|苦しい|切ない|悲しい', content):
                        reading = 'つらい'
                    else:
                        reading = 'からい'
                elif surface == '何':
                    if re.search(r'^(人|日|回|度|番|年|時|分|秒|個|本|枚|で|だ|です|の|と)', next_surface):
                        reading = 'なん'
                    else:
                        reading = 'なに'
                elif surface == '角':
                    local_text = ''
                    for j in range(max(0, i - 2), min(len(words), i + 3)):
                        local_text += words[j].surface
                    if re.search(r'曲が|交差点|通り|道|街|右|左', local_text):
                        reading = 'かど'
                    elif re.search(r'牛|鹿|羊|動物|鬼|生える|折れる', local_text):
                        reading = 'つの'
                    elif re.search(r'角度|直角|四角|三角|方角', local_text):
                        reading = 'かく'
                elif surface == '風':
                    if re.search(r'^(こんな|そんな|あんな|どんな|この|その|あの|和|洋)$', prev_surface) or next_surface == 'に':
                        reading = 'ふう'
                    else:
                        reading = 'かぜ'
                elif surface == '方':
                    if re.search(r'^(あの|この|その|どなた)$', prev_surface) or re.search(r'^(読み|書き|話し|使い方|考え|教え|行き|作り)$', prev_surface):
                        reading = 'かた'
                    else:
                        reading = 'ほう'
                elif surface == '一日':
                    if next_surface == '中' or '一日中' in content:
                        reading = 'いちにち'
                    elif next_surface == 'は' or re.search(r'月一日', content):
                        reading = 'ついたち'
                elif surface == '行く':
                    reading = 'いく'
                elif surface == '行う' or surface == '行なう':
                    reading = 'おこなう'

            sub = parse_compound_to_tokens(surface, reading, ruby_type)
            tokens.extend(sub)
    else:
        # Fallback greedy dictionary parser
        current_word = ''
        i = 0
        while i < len(content):
            matched = False

            # Check grammar patterns
            for pat, r in GRAMMAR_PATTERNS.items():
                if content.startswith(pat, i):
                    if current_word:
                        tokens.append({'surface': current_word, 'hasKanji': bool(KANJI_REGEX.search(current_word))})
                        current_word = ''
                    tokens.extend(parse_compound_to_tokens(pat, r, ruby_type))
                    i += len(pat)
                    matched = True
                    break

            if matched:
                continue

            for length in range(4, 0, -1):
                if i + length <= len(content):
                    sub = content[i:i + length]
                    if sub in KANJI_READINGS:
                        if current_word:
                            tokens.append({'surface': current_word, 'hasKanji': bool(KANJI_REGEX.search(current_word))})
                            current_word = ''
                        reading = KANJI_READINGS[sub]
                        tokens.extend(parse_compound_to_tokens(sub, reading, ruby_type))
                        i += length
                        matched = True
                        break

            if not matched:
                char = content[i]
                if bool(KANJI_REGEX.search(char)):
                    if current_word:
                        tokens.append({'surface': current_word, 'hasKanji': bool(KANJI_REGEX.search(current_word))})
                        current_word = ''
                    tokens.append({'surface': char, 'ruby': '', 'hasKanji': True})
                else:
                    current_word += char
                i += 1

        if current_word:
            tokens.append({'surface': current_word, 'hasKanji': bool(KANJI_REGEX.search(current_word))})

    random_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))
    return {
        'id': random_id,
        'rawText': raw_line,
        'cleanText': content,
        'tokens': tokens,
    }
