from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import io
import base64

img = Image.open(
    r"C:\Users\PhuocNTB\.cursor\projects\c-Users-PhuocNTB-Desktop-theia-ide\assets\c__Users_PhuocNTB_Desktop_theia-ide_logo.jpg"
).convert("RGBA")
w, h = img.size
px = img.load()


def is_content(p):
    r, g, b, a = p
    if r > 180 and g < 80 and b < 80:
        return True  # red
    if b > 80 and r < 90 and g < 100 and (b - r) > 40:
        return True  # navy
    if r > 248 and g > 248 and b > 248:
        return True  # pure white
    return False


minx, miny, maxx, maxy = w, h, 0, 0
for y in range(h):
    for x in range(w):
        if is_content(px[x, y]):
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)

print("content", minx, miny, maxx, maxy, "size", maxx - minx, maxy - miny)

cx = (minx + maxx) / 2
cy = (miny + maxy) / 2
half = max(maxx - minx, maxy - miny) / 2 * 1.18
x0 = int(max(0, cx - half))
y0 = int(max(0, cy - half))
side = int(min(w - x0, h - y0, half * 2))
icon = img.crop((x0, y0, x0 + side, y0 + side))
print("final", icon.size, (x0, y0, x0 + side, y0 + side), "corner", icon.getpixel((2, 2)))

root = Path(r"C:\Users\PhuocNTB\Desktop\theia-ide")
brand = root / "applications" / "electron" / "resources" / "branding"
product_icons = root / "theia-extensions" / "product" / "src" / "browser" / "icons"
icon512 = icon.resize((512, 512), Image.Resampling.LANCZOS)

targets = [
    brand / "logo-512.png",
    root / "applications" / "electron" / "resources" / "icons" / "512x512.png",
    root / "applications" / "electron" / "resources" / "icons" / "WindowIcon" / "512-512.png",
    root / "applications" / "electron" / "resources" / "icons" / "LinuxLauncherIcons" / "512x512.png",
    product_icons / "512-512.png",
    product_icons / "512-512-next.png",
    root / "applications" / "electron" / "resources" / "icons" / "MacLauncherIcons" / "icon.icon" / "Assets" / "icon.png",
]
for p in targets:
    icon512.save(p, "PNG")

welcome = Image.new("RGBA", (500, 236), (255, 255, 255, 0))
wl = icon.resize((200, 200), Image.Resampling.LANCZOS)
welcome.paste(wl, ((500 - 200) // 2, (236 - 200) // 2), wl)
welcome.save(product_icons / "TheiaIDE.png", "PNG")
welcome.save(product_icons / "TheiaIDE-next.png", "PNG")

icon256 = icon.resize((256, 256), Image.Resampling.LANCZOS)
ico = root / "applications" / "electron" / "resources" / "icons" / "WindowsLauncherIcons" / "TheiaIDE.ico"
icon256.save(
    ico,
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("ico", ico.stat().st_size)

splash = Image.new("RGBA", (446, 276), (255, 255, 255, 255))
logo = icon.resize((140, 140), Image.Resampling.LANCZOS)
splash.paste(logo, ((446 - 140) // 2, 28), logo)
draw = ImageDraw.Draw(splash)
font = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 36)
title = "RE SC IDE"
bb = draw.textbbox((0, 0), title, font=font)
draw.text(((446 - (bb[2] - bb[0])) // 2, 185), title, fill=(26, 43, 90, 255), font=font)
splash.save(brand / "splash.png", "PNG")

buf = io.BytesIO()
splash.save(buf, "PNG")
b64 = base64.b64encode(buf.getvalue()).decode()
svg = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
    'width="446" height="276" viewBox="0 0 446 276">\n'
    f'  <image width="446" height="276" xlink:href="data:image/png;base64,{b64}"/>\n'
    "</svg>\n"
)
(root / "applications" / "electron" / "resources" / "TheiaIDESplash.svg").write_text(svg, encoding="utf-8")
print("ok")
