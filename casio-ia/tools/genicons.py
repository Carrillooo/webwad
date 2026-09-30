#!/usr/bin/env python3
"""Genera los iconos del menu (92x64) para el .g3a."""
from PIL import Image, ImageDraw, ImageFont

def icon(path, selected):
    W, H = 92, 64
    bg = (40, 90, 200) if selected else (235, 240, 250)
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    bubble = (255, 255, 255) if selected else (40, 90, 200)
    txt = (40, 90, 200) if selected else (255, 255, 255)
    d.rounded_rectangle((10, 6, 82, 46), radius=12, fill=bubble)
    d.polygon([(24, 44), (20, 58), (38, 45)], fill=bubble)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
    tw = d.textlength("IA", font=font)
    d.text(((W - tw) / 2, 11), "IA", font=font, fill=txt)
    img.save(path)

icon("res/icon_sel.png", True)
icon("res/icon_uns.png", False)
