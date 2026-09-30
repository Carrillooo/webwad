#!/usr/bin/env python3
"""Genera src/font.h: fuente bitmap 7x13 (X11 misc-fixed, dominio publico)
con el juego Latin-1 completo (0x20-0xFF), asi hay tildes, ñ, ¿ y ¡."""
import gzip, io, os, sys, tempfile
from PIL import Image, ImageDraw, ImageFont, PcfFontFile

SRC = "/usr/share/fonts/X11/misc/7x13-ISO8859-1.pcf.gz"
OUT = sys.argv[1] if len(sys.argv) > 1 else "src/font.h"
W, H = 8, 13

pcf = PcfFontFile.PcfFontFile(io.BytesIO(gzip.open(SRC).read()), "iso8859-1")
tmp = tempfile.mkdtemp()
pcf.save(os.path.join(tmp, "f"))
font = ImageFont.load(os.path.join(tmp, "f.pil"))

rows = []
for c in range(0x20, 0x100):
    img = Image.new("1", (W, H), 0)
    ImageDraw.Draw(img).text((0, 0), bytes([c]).decode("latin-1"), font=font, fill=1)
    bits = []
    for y in range(H):
        b = 0
        for x in range(W):
            if img.getpixel((x, y)):
                b |= 0x80 >> x
        bits.append(b)
    rows.append((c, bits))

with open(OUT, "w") as f:
    f.write("/* Generado por tools/genfont.py (X11 misc-fixed 7x13, dominio publico) */\n")
    f.write("#define FONT_W %d\n#define FONT_H %d\n" % (W, H))
    f.write("static const unsigned char font_data[224][%d] = {\n" % H)
    for c, bits in rows:
        f.write("  {%s}, /* 0x%02X */\n" % (",".join("0x%02X" % b for b in bits), c))
    f.write("};\n")

if "--preview" in sys.argv:
    for c, bits in rows:
        if chr(c) in "Ag¿ñé":
            print(chr(c))
            for b in bits:
                print("".join("#" if b & (0x80 >> x) else "." for x in range(W)))
