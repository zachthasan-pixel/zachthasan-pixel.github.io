# Makes the 480px-wide grid thumbnails for every cover in images/covers.
# Run after adding a cover:  python3 scripts/make-thumbs.py
import os, sys
from PIL import Image
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src = os.path.join(root, "images", "covers"); dst = os.path.join(src, "thumbs")
os.makedirs(dst, exist_ok=True); made = 0
for f in sorted(os.listdir(src)):
    if not f.lower().endswith(".jpg"): continue
    out = os.path.join(dst, f)
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(os.path.join(src, f)): continue
    im = Image.open(os.path.join(src, f)).convert("RGB")
    w = 480; h = round(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(out, quality=82, optimize=True, progressive=True); made += 1
print(f"thumbnails: {made} made, {len(os.listdir(dst))} total")
