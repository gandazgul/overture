# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "Pillow",
# ]
# ///

import os
import glob
from PIL import Image, ImageChops

ASSETS_DIR = "public/assets"

def trim(im, fuzz=30):
    """
    Trims the solid background from an image. 
    Equivalent to ImageMagick's -trim +repage.
    """
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
        
    bg = Image.new(im.mode, im.size, im.getpixel((0,0)))
    diff = ImageChops.difference(im, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

def optimize_patrons():
    print("Optimizing Patron Cards...")
    for filepath in glob.glob(os.path.join(ASSETS_DIR, "patron_*.png")):
        with Image.open(filepath) as img:
            print(f"  Processing {os.path.basename(filepath)} (Original: {img.width}x{img.height})")
            
            # Trim the generated dark backgrounds slightly to focus on the character
            img = trim(img)
            
            # The game cards are 90x120, so 360x480 is plenty of resolution for crisp rendering
            img.thumbnail((360, 480), Image.Resampling.LANCZOS)
            
            # Save optimized
            img.save(filepath, format="PNG", optimize=True)
            print(f"    -> Saved (New: {img.width}x{img.height})")

def optimize_badges():
    print("Optimizing Trait Badges & Tokens...")
    badge_files = glob.glob(os.path.join(ASSETS_DIR, "badge_*.png")) 
    token_files = glob.glob(os.path.join(ASSETS_DIR, "*token*.png"))
    for filepath in badge_files + token_files:
        with Image.open(filepath) as img:
            print(f"  Processing {os.path.basename(filepath)} (Original: {img.width}x{img.height})")
            
            # Trim plain backgrounds to make the badge fill the whole frame cleanly
            img = trim(img)
            
            # The UI renders badges at exactly 24x24 or 28x28. 128x128 is hugely crisp!
            img.thumbnail((128, 128), Image.Resampling.LANCZOS)
            
            img.save(filepath, format="PNG", optimize=True)
            print(f"    -> Saved (New: {img.width}x{img.height})")

def optimize_backgrounds():
    print("Optimizing Theater Backgrounds...")
    for filepath in glob.glob(os.path.join(ASSETS_DIR, "bg_*.png")):
        with Image.open(filepath) as img:
            print(f"  Processing {os.path.basename(filepath)} (Original: {img.width}x{img.height})")
            
            # Backgrounds cover the full layout canvas. We do NOT trim these as they need to be expansive
            # Game canvas is usually 800x600 to 1920x1080. 1280x720 is an optimal web background size.
            img.thumbnail((1280, 720), Image.Resampling.LANCZOS)
            
            img.save(filepath, format="PNG", optimize=True)
            print(f"    -> Saved (New: {img.width}x{img.height})")

def main():
    if not os.path.exists(ASSETS_DIR):
        print(f"Error: {ASSETS_DIR} not found.")
        return
        
    optimize_patrons()
    optimize_badges()
    optimize_backgrounds()
    print("\n✅ All assets elegantly cropped and optimized!")

if __name__ == "__main__":
    main()
