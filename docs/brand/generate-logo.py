import sys
from fontTools.ttLib import TTCollection
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

def contours(font, ch):
    gs = font.getGlyphSet(); name = font.getBestCmap()[ord(ch)]
    rec = RecordingPen(); gs[name].draw(rec)
    out, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ('closePath', 'endPath'): out.append(cur); cur = []
    res = []
    for c in out:
        r = RecordingPen(); r.value = c
        b = BoundsPen(gs); r.replay(b)
        p = SVGPathPen(gs); r.replay(p)
        res.append((b.bounds, p.getCommands()))
    return res

def build(weight, bg, ink, accent=None, size=1024, rx=230, pad=0.165, gap=-0.02, tight=False):
    font = TTCollection(f'/usr/share/fonts/noto-cjk/NotoSansCJK-{weight}.ttc').fonts[0]
    chars = 'フリガナ'
    inner = size * (1 - 2 * pad); cell = (inner - size * gap) / 2
    scale = cell / 1000 * (1.12 if tight else 1.0)
    parts = []
    for i, ch in enumerate(chars):
        cs = contours(font, ch)
        xs = [b[0] for b, _ in cs] + [b[2] for b, _ in cs]; ys = [b[1] for b, _ in cs] + [b[3] for b, _ in cs]
        gx0, gx1, gy0, gy1 = min(xs), max(xs), min(ys), max(ys)
        col, row = i % 2, i // 2
        cx = size * pad + col * (cell + size * gap) + cell / 2
        cy = size * pad + row * (cell + size * gap) + cell / 2
        tx = cx - (gx0 + gx1) / 2 * scale; ty = cy + (gy0 + gy1) / 2 * scale
        small = sorted(range(len(cs)), key=lambda k: (cs[k][0][2]-cs[k][0][0])*(cs[k][0][3]-cs[k][0][1]))[:2] if ch == 'ガ' and accent else []
        main = ''.join(d for k, (_, d) in enumerate(cs) if k not in small)
        g = f'<g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.5f} {-scale:.5f})">'
        g += f'<path d="{main}" fill="{ink}"/>'
        if small: g += f'<path d="{"".join(cs[k][1] for k in small)}" fill="{accent}"/>'
        parts.append(g + '</g>')
    bgshape = f'<rect width="{size}" height="{size}" rx="{rx}" fill="{bg}"/>' if rx else f'<rect width="{size}" height="{size}" fill="{bg}"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">{bgshape}{"".join(parts)}</svg>'

variants = {
  'A-ink-on-paper':   dict(weight='Black',  bg='#F5F3EE', ink='#1C1C1E'),
  'B-white-on-indigo':dict(weight='Bold',   bg='#26324A', ink='#FFFFFF'),
  'C-vermilion-dakuten': dict(weight='Bold', bg='#FFFFFF', ink='#1C1C1E', accent='#E5483A'),
  'D-dark-accent':    dict(weight='Medium', bg='#1C1C1E', ink='#F5F3EE', accent='#E5483A'),
}
for k, v in variants.items():
    open(f'{k}.svg', 'w').write(build(**v))
    print(k)
