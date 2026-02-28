#!/usr/bin/env python3
"""Generate Android and PWA icons from icons/icon-512.png"""
from PIL import Image, ImageDraw
import os
import shutil

# Android density buckets (icon size, foreground size)
# Foreground for adaptive icons is 108dp vs 48dp for launcher icon
ANDROID_SIZES = [
    ("ldpi", 36, 54),
    ("mdpi", 48, 72),
    ("hdpi", 72, 108),
    ("xhdpi", 96, 144),
    ("xxhdpi", 144, 216),
    ("xxxhdpi", 192, 288),
]

source = "icons/icon-512.png"
res_dir = "android/app/src/main/res"

print(f"Loading source: {source}")
img = Image.open(source)
print(f"Original size: {img.size}, Mode: {img.mode}\n")

if img.mode != 'RGBA':
    img = img.convert('RGBA')

# --- Remove legacy adaptive icon XML files ---
print("=== Removing default Capacitor adaptive icon files ===")
files_to_remove = [
    os.path.join(res_dir, "mipmap-anydpi-v26", "ic_launcher.xml"),
    os.path.join(res_dir, "mipmap-anydpi-v26", "ic_launcher_round.xml"),
    os.path.join(res_dir, "drawable-v24", "ic_launcher_foreground.xml"),
    os.path.join(res_dir, "drawable", "ic_launcher_background.xml"),
]
for f in files_to_remove:
    if os.path.exists(f):
        os.remove(f)
        print(f"  Removed {f}")

# Remove empty dirs
for d in [os.path.join(res_dir, "mipmap-anydpi-v26"), os.path.join(res_dir, "drawable-v24")]:
    if os.path.exists(d) and not os.listdir(d):
        os.rmdir(d)
        print(f"  Removed empty dir {d}")

# --- Generate Android Icons ---
print("\n=== Generating Android Icons ===")
for dpi_name, size, fg_size in ANDROID_SIZES:
    mipmap_dir = os.path.join(res_dir, f"mipmap-{dpi_name}")
    os.makedirs(mipmap_dir, exist_ok=True)

    # Standard launcher icon
    print(f"Generating {dpi_name} ({size}x{size})...")
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    # Save with white background
    bg = Image.new('RGB', (size, size), (255, 255, 255))
    bg.paste(resized, mask=resized.split()[3] if resized.mode == 'RGBA' else None)
    output_path = os.path.join(mipmap_dir, "ic_launcher.png")
    bg.save(output_path, 'PNG')
    print(f"  ✓ {output_path}")

    # Round launcher icon (circular mask)
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size, size), fill=255)
    round_icon = Image.new('RGB', (size, size), (255, 255, 255))
    round_icon.paste(resized, mask=resized.split()[3] if resized.mode == 'RGBA' else None)
    # Apply circular mask
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(round_icon, mask=mask)
    output_path = os.path.join(mipmap_dir, "ic_launcher_round.png")
    result.save(output_path, 'PNG')
    print(f"  ✓ {output_path}")

    # Foreground icon for adaptive icons (108dp canvas with icon centered in 66dp safe zone)
    fg = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
    # The safe zone is the inner 66/108 of the canvas
    padding = int(fg_size * (108 - 66) / 108 / 2)
    inner_size = fg_size - 2 * padding
    icon_resized = img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    fg.paste(icon_resized, (padding, padding))
    output_path = os.path.join(mipmap_dir, "ic_launcher_foreground.png")
    fg.save(output_path, 'PNG')
    print(f"  ✓ {output_path}")

# --- Re-create adaptive icon XML for Android 8+ ---
print("\n=== Creating adaptive icon XML ===")
v26_dir = os.path.join(res_dir, "mipmap-anydpi-v26")
os.makedirs(v26_dir, exist_ok=True)

adaptive_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''

for fname in ["ic_launcher.xml", "ic_launcher_round.xml"]:
    path = os.path.join(v26_dir, fname)
    with open(path, 'w') as f:
        f.write(adaptive_xml)
    print(f"  ✓ {path}")

# Update background color to white
values_dir = os.path.join(res_dir, "values")
color_file = os.path.join(values_dir, "ic_launcher_background.xml")
if os.path.exists(color_file):
    with open(color_file, 'r') as f:
        content = f.read()
    # Replace whatever color with white
    import re
    content = re.sub(r'#[0-9A-Fa-f]{6}', '#FFFFFF', content)
    with open(color_file, 'w') as f:
        f.write(content)
    print(f"  ✓ Updated background color to white in {color_file}")

# --- Update PWA Icons ---
print("\n=== Updating PWA Icons ===")
pwa_sizes = [(192, "icon-192.png"), (512, "icon-512.png")]
for size, filename in pwa_sizes:
    resized = img.resize((size, size), Image.Resampling.LANCZOS)
    resized_rgb = resized.convert('RGB')
    output = os.path.join("icons", filename)
    resized_rgb.save(output, 'PNG')
    print(f"  ✓ icons/{filename}")

# --- Generate iOS Icon ---
print("\n=== Generating iOS Icon ===")
ios_icon_dir = os.path.join("ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset")
if os.path.exists(ios_icon_dir):
    ios_icon = img.resize((1024, 1024), Image.Resampling.LANCZOS)
    # iOS icons must be opaque (no alpha channel)
    ios_bg = Image.new('RGB', (1024, 1024), (255, 255, 255))
    ios_bg.paste(ios_icon, mask=ios_icon.split()[3] if ios_icon.mode == 'RGBA' else None)
    ios_output = os.path.join(ios_icon_dir, "AppIcon-512@2x.png")
    ios_bg.save(ios_output, 'PNG')
    print(f"  ✓ {ios_output}")
else:
    print(f"  ⚠ iOS directory not found at {ios_icon_dir}, skipping")

print("\n✓ All icons generated!")
print("\nNext steps:")
print("  npx cap sync")
print("  Rebuild in Android Studio / Xcode")
