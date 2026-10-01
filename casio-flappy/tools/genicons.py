#!/usr/bin/env python3
"""Genera los iconos del menu (92x64) de Flappy Casio."""
from PIL import Image, ImageDraw

def icon(path, selected):
    img = Image.new("RGB", (92, 64), (78, 192, 202) if not selected else (60, 160, 230))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 54, 91, 63), fill=(222, 216, 148))
    d.rectangle((0, 52, 91, 55), fill=(115, 190, 45))
    for x0 in (62,):
        d.rectangle((x0, 0, x0 + 16, 16), fill=(115, 190, 45), outline=(40, 70, 20))
        d.rectangle((x0 - 3, 16, x0 + 19, 22), fill=(115, 190, 45), outline=(40, 70, 20))
        d.rectangle((x0 - 3, 40, x0 + 19, 46), fill=(115, 190, 45), outline=(40, 70, 20))
        d.rectangle((x0, 46, x0 + 16, 52), fill=(115, 190, 45), outline=(40, 70, 20))
    cx, cy = 32, 30
    d.ellipse((cx - 15, cy - 11, cx + 15, cy + 11), fill=(250, 200, 30), outline=(0, 0, 0), width=2)
    d.ellipse((cx + 2, cy - 9, cx + 12, cy + 1), fill=(255, 255, 255), outline=(0, 0, 0), width=1)
    d.rectangle((cx + 8, cy - 6, cx + 10, cy - 3), fill=(0, 0, 0))
    d.rectangle((cx + 6, cy + 2, cx + 20, cy + 8), fill=(240, 90, 30), outline=(0, 0, 0))
    d.ellipse((cx - 14, cy - 3, cx - 2, cy + 6), fill=(255, 240, 170), outline=(0, 0, 0))
    if selected:
        d.rectangle((0, 0, 91, 63), outline=(255, 255, 255), width=2)
    img.save(path)

icon("res/icon_sel.png", True)
icon("res/icon_uns.png", False)
