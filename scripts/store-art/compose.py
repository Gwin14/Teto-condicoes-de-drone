"""Monta as imagens da App Store do Teto a partir das capturas do simulador.

Uso: python compose.py store/art/raw store/art   (precisa de Pillow)

As capturas em store/art/raw vêm do simulador (iPhone 6,3", `xcrun simctl io <udid> screenshot`),
com barra de status 9:41, região pt_BR e o Pro liberado só no build usado para as fotos.
Legendas e telas de cada imagem ficam em copy.json.

Gera:
- screenshots/NN-*.png  1206x2622 (iPhone 6,3")
- header-5244x2950.png   cabeçalho da página do produto
- header-3840x1646.png   cabeçalho panorâmico
- search-1920x1280.png   ativo dos resultados de busca
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
FONT = '/System/Library/Fonts/SFNS.ttf'

TOP = (14, 43, 132)       # #0E2B84 — azul do ícone (topo)
BOTTOM = (88, 141, 232)   # #588DE8 — azul do ícone (base)
WHITE = (255, 255, 255)


def font(size: int, weight: str = 'Bold') -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight)
    return f


def gradient(w: int, h: int, top=TOP, bottom=BOTTOM, horizontal=False) -> Image.Image:
    n = w if horizontal else h
    strip = Image.new('RGB', (n, 1) if horizontal else (1, n))
    px = strip.load()
    for i in range(n):
        t = i / max(1, n - 1)
        c = tuple(round(top[k] + (bottom[k] - top[k]) * t) for k in range(3))
        px[(i, 0) if horizontal else (0, i)] = c
    img = strip.resize((w, h))
    # brilho suave no alto, como céu aberto
    glow = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(glow)
    r = int(max(w, h) * 0.55)
    cx, cy = int(w * 0.72), int(-h * 0.08)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(r * 0.45))
    img = Image.composite(Image.new('RGB', (w, h), (150, 190, 255)), img, glow)
    return img


def rounded_mask(size, radius):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return m


def phone(shot: Image.Image, width: int) -> Image.Image:
    """Moldura de iPhone desenhada (sem ativos da Apple): borda escura, ilha dinâmica e cantos do aparelho."""
    sw = width
    sh = round(shot.height * sw / shot.width)
    screen = shot.convert('RGB').resize((sw, sh), Image.LANCZOS)
    scale = sw / 1206
    bezel = max(6, round(30 * scale))
    rim = max(2, round(7 * scale))
    r_screen = round(165 * scale)
    W, H = sw + 2 * (bezel + rim), sh + 2 * (bezel + rim)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((0, 0, W - 1, H - 1), r_screen + bezel + rim, fill=(74, 78, 92, 255))  # aro de titânio
    d.rounded_rectangle((rim, rim, W - 1 - rim, H - 1 - rim), r_screen + bezel, fill=(10, 11, 14, 255))
    out.paste(screen, (bezel + rim, bezel + rim), rounded_mask((sw, sh), r_screen))
    # ilha dinâmica (o `simctl io screenshot` não a inclui); posição medida no iPhone 6,3"
    iw, ih = round(284 * scale), round(109 * scale)
    ix = (W - iw) // 2
    iy = bezel + rim + round(42 * scale)
    d.rounded_rectangle((ix, iy, ix + iw, iy + ih), ih // 2, fill=(0, 0, 0, 255))
    return out


def shadowed(layer: Image.Image, blur: int, offset=(0, 0), alpha=110) -> Image.Image:
    pad = blur * 3
    out = Image.new('RGBA', (layer.width + 2 * pad, layer.height + 2 * pad), (0, 0, 0, 0))
    a = layer.split()[3].point(lambda v: v * alpha // 255)
    sh = Image.new('RGBA', layer.size, (5, 15, 50, 0))
    sh.putalpha(a)
    out.alpha_composite(sh, (pad + offset[0], pad + offset[1]))
    out = out.filter(ImageFilter.GaussianBlur(blur))
    out.alpha_composite(layer, (pad, pad))
    return out


def wrap(draw, text, fnt, max_w):
    lines = []
    for para in text.split('\n'):
        cur = ''
        for word in para.split(' '):
            test = (cur + ' ' + word).strip()
            if draw.textlength(test, font=fnt) <= max_w:
                cur = test
            else:
                lines.append(cur)
                cur = word
        lines.append(cur)
    return lines


def text_block(img, text, fnt, center_x, top, max_w, fill=WHITE, spacing=1.12, align='center'):
    d = ImageDraw.Draw(img)
    y = top
    lh = round(fnt.size * spacing)
    for line in wrap(d, text, fnt, max_w):
        w = d.textlength(line, font=fnt)
        x = center_x - w / 2 if align == 'center' else center_x
        d.text((x, y), line, font=fnt, fill=fill)
        y += lh
    return y


def screenshot(shot_path: Path, title: str, subtitle: str, out: Path):
    W, H = 1206, 2622
    img = gradient(W, H).convert('RGBA')
    y = text_block(img, title, font(104, 'Bold'), W / 2, 170, W - 150, spacing=1.08)
    y = text_block(img, subtitle, font(48, 'Medium'), W / 2, y + 24, W - 220, fill=(225, 235, 255), spacing=1.3)
    ph = phone(Image.open(shot_path), 930)
    ph = shadowed(ph, 40, (0, 24))
    img.alpha_composite(ph, ((W - ph.width) // 2, y + 70 - 120))
    img.convert('RGB').save(out, optimize=True)


def place(canvas, shot_path, width, center, angle=0.0, blur=50):
    ph = phone(Image.open(shot_path), width)
    if angle:
        ph = ph.rotate(angle, resample=Image.BICUBIC, expand=True)
    ph = shadowed(ph, blur, (0, blur // 2))
    canvas.alpha_composite(ph, (round(center[0] - ph.width / 2), round(center[1] - ph.height / 2)))


def app_icon(size):
    ic = Image.open(ROOT / 'assets/images/icon.png').convert('RGBA').resize((size, size), Image.LANCZOS)
    m = rounded_mask((size, size), round(size * 0.2237))
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(ic, (0, 0), m)
    return out


def header(shots, out, W, H, title, subtitle):
    img = gradient(W, H, horizontal=False).convert('RGBA')
    s = H / 1646                      # escala do texto (altura)
    sp = min(s, W / 3840 * 1.15)      # escala dos aparelhos (não deixa o leque invadir o texto em 16:9)
    # três aparelhos em leque à direita
    pw = round(560 * sp)
    cx = W - 1.25 * pw - 0.03 * W
    cy = H * 0.56
    first_left = cx - 640 * sp - pw * 0.6
    # bloco de texto à esquerda, até onde o leque começa
    left = round(W * 0.075)
    max_w = round(first_left - left - 0.03 * W)
    tsize = round(150 * s)
    while font(tsize).getlength(title) > max_w and tsize > 60:
        tsize -= 4
    ic = shadowed(app_icon(round(250 * s)), round(30 * s), (0, round(12 * s)), 90)
    img.alpha_composite(ic, (left - round(90 * s), round(H * 0.5 - 520 * s) - round(90 * s)))
    y = round(H * 0.5 - 200 * s)
    y = text_block(img, title, font(tsize, 'Bold'), left, y, max_w, align='left', spacing=1.04)
    text_block(img, subtitle, font(round(tsize * 0.41), 'Medium'), left, y + round(36 * s), max_w,
               fill=(225, 235, 255), align='left', spacing=1.3)
    place(img, shots[0], pw, (cx - 640 * sp, cy + 120 * sp), 6, round(60 * sp))
    place(img, shots[2], pw, (cx + 640 * sp, cy + 120 * sp), -6, round(60 * sp))
    place(img, shots[1], round(pw * 1.08), (cx, cy), 0, round(70 * sp))
    img.convert('RGB').save(out, optimize=True)


def search(shots, out, W, H, title):
    img = gradient(W, H).convert('RGBA')
    s = W / 1920
    y = text_block(img, title, font(round(84 * s), 'Bold'), W / 2, round(80 * s), round(W * 0.8), spacing=1.08)
    pw = round(430 * s)
    top = y + round(70 * s)
    ph_h = round(pw * 2622 / 1206)
    cy = top + ph_h / 2
    place(img, shots[0], pw, (W / 2 - 520 * s, cy + 60 * s), 0, round(40 * s))
    place(img, shots[2], pw, (W / 2 + 520 * s, cy + 60 * s), 0, round(40 * s))
    place(img, shots[1], round(pw * 1.06), (W / 2, cy), 0, round(48 * s))
    img.convert('RGB').save(out, optimize=True)


def main():
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    cfg = json.loads((HERE / 'copy.json').read_text())
    (dst / 'screenshots').mkdir(parents=True, exist_ok=True)
    for i, item in enumerate(cfg['screenshots'], 1):
        screenshot(src / item['file'], item['title'], item['subtitle'],
                   dst / 'screenshots' / f"{i:02d}-{Path(item['file']).stem}.png")
    hero = [src / f for f in cfg['hero']]
    header(hero, dst / 'header-3840x1646.png', 3840, 1646, cfg['header']['title'], cfg['header']['subtitle'])
    header(hero, dst / 'header-5244x2950.png', 5244, 2950, cfg['header']['title'], cfg['header']['subtitle'])
    search(hero, dst / 'search-1920x1280.png', 1920, 1280, cfg['search']['title'])
    search(hero, dst / 'search-3840x2560.png', 3840, 2560, cfg['search']['title'])


if __name__ == '__main__':
    main()
