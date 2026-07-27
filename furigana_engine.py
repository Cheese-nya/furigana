import re

# Kanji Unicode Range Test
KANJI_REGEX = re.compile(r'[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]')

# Common Japanese Dubbing Kanji Dictionary (for offline high-speed client tokenizer)
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
    '技術': 'ぎじゅつ', '力': 'ちから', '能力': 'のうりょく', '限界': 'げんかい'
}

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

def kana_to_romaji(hira_text: str) -> str:
    res = ''
    for char in hira_text:
        res += ROMAJI_MAP.get(char, char)
    return res

def annotate_line(raw_line: str, ruby_type: str = 'hiragana'):
    """
    Tokenizes Japanese text line into tokens with Kanji readings, keeping original text intact.
    ruby_type can be 'hiragana', 'katakana', or 'romaji'.
    Returns a dict representing a ScriptLine.
    """
    content = raw_line
    tokens = []
    current_word = ''

    i = 0
    while i < len(content):
        matched = False
        for length in range(4, 0, -1):
            if i + length <= len(content):
                sub = content[i:i+length]
                if sub in KANJI_READINGS:
                    if current_word:
                        tokens.append({'surface': current_word, 'hasKanji': bool(KANJI_REGEX.search(current_word))})
                        current_word = ''
                    reading = KANJI_READINGS[sub]
                    if ruby_type == 'katakana':
                        # Convert hiragana to katakana (shift unicode points by 0x60)
                        reading = ''.join(chr(ord(c) + 0x60) if '\u3041' <= c <= '\u3096' else c for c in reading)
                    elif ruby_type == 'romaji':
                        reading = kana_to_romaji(reading)
                    tokens.append({'surface': sub, 'ruby': reading, 'hasKanji': True})
                    i += length - 1
                    matched = True
                    break

        if not matched:
            char = content[i]
            if bool(KANJI_REGEX.search(char)):
                if current_word:
                    tokens.append({'surface': current_word, 'hasKanji': bool(KANJI_REGEX.search(current_word))})
                    current_word = ''
                fallback_ruby = 'かな'
                if ruby_type == 'katakana':
                    fallback_ruby = 'カナ'
                elif ruby_type == 'romaji':
                    fallback_ruby = 'kana'
                tokens.append({'surface': char, 'ruby': fallback_ruby, 'hasKanji': True})
            else:
                current_word += char
        i += 1

    if current_word:
        tokens.append({'surface': current_word, 'hasKanji': bool(KANJI_REGEX.search(current_word))})

    import random
    import string
    random_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))

    return {
        'id': random_id,
        'rawText': raw_line,
        'cleanText': content,
        'tokens': tokens,
    }
