"""Optional offline comparison, isolated from app and Windows packaging dependencies.

pip install sudachipy sudachidict_core fugashi unidic-lite
python tools/compare-native.py corpus.json native-results.json

corpus.json is exported by tools/audit-scripts.mjs. Native output preserves spaces
and every character, even when a tokenizer omits whitespace. No network calls.
"""
import json
from pathlib import Path
import sys

from sudachipy import dictionary, tokenizer
import fugashi


def compare(corpus):
    sudachi = dictionary.Dictionary().tokenizer()
    mecab = fugashi.Tagger()
    results = {}
    for document in corpus:
        entry = {}
        for name, tagger in [
            ('sudachi', lambda text: sudachi.tokenize(text, tokenizer.Tokenizer.SplitMode.C)),
            ('mecab', mecab),
        ]:
            rows = []
            for text in document['text'].split('\n'):
                tokens = []
                offset = 0
                for word in tagger(text):
                    surface = word.surface() if name == 'sudachi' else word.surface
                    position = text.find(surface, offset)
                    if position < 0:
                        raise ValueError(f'{name}: token does not match source text')
                    if position > offset:
                        tokens.append({'surface': text[offset:position], 'reading': ''})
                    reading = word.reading_form() if name == 'sudachi' else word.feature.kana
                    tokens.append({'surface': surface, 'reading': reading or ''})
                    offset = position + len(surface)
                if offset < len(text):
                    tokens.append({'surface': text[offset:], 'reading': ''})
                rows.append(tokens)
            entry[name] = rows
        results[document['name']] = entry
    return results


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python tools/compare-native.py corpus.json native-results.json')
    corpus = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    Path(sys.argv[2]).write_text(json.dumps(compare(corpus), ensure_ascii=False), encoding='utf-8')
    print(f'Compared {len(corpus)} documents')
