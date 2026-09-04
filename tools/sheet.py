"""Crop the stage area out of each capture and tile them into one contact sheet."""
import sys, pathlib
from PIL import Image, ImageDraw

names = sys.argv[1:]
CROP = (430, 120, 1180, 830)   # the character, panel excluded
CW, CH = 280, 265
cols = 3
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGB", (cols * CW, rows * (CH + 20)), (10, 14, 24))
draw = ImageDraw.Draw(sheet)

for i, n in enumerate(names):
    img = Image.open(f"shots/{n}.png").convert("RGB").crop(CROP).resize((CW, CH), Image.LANCZOS)
    x, y = (i % cols) * CW, (i // cols) * (CH + 20)
    sheet.paste(img, (x, y + 20))
    draw.text((x + 6, y + 5), n, fill=(190, 210, 235))

sheet.save("shots/sheet.png")
print("shots/sheet.png", sheet.size)
