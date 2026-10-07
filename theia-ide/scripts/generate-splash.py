from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

root = Path(r"C:\Users\PhuocNTB\Desktop\theia-ide")
brand = root / "applications" / "electron" / "resources" / "branding"
logo_path = brand / "logo-512.png"
if not logo_path.exists():
    raise SystemExit(f"missing {logo_path}")

logo = Image.open(logo_path).convert("RGBA")

# Canvas is fully transparent — only logo + text are opaque.
W, H = 420, 300
splash = Image.new("RGBA", (W, H), (0, 0, 0, 0))

logo_size = 160
logo_r = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
lx, ly = (W - logo_size) // 2, 24

# Soft shadow under the logo only (still transparent elsewhere)
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
alpha = logo_r.split()[-1]
shadow_layer = Image.new("RGBA", logo_r.size, (0, 0, 0, 0))
shadow_layer.putalpha(alpha.point(lambda p: int(p * 0.35) if p > 0 else 0))
shadow.paste(shadow_layer, (lx + 2, ly + 5), shadow_layer)
shadow = shadow.filter(ImageFilter.GaussianBlur(8))
splash = Image.alpha_composite(splash, shadow)
splash.paste(logo_r, (lx, ly), logo_r)

draw = ImageDraw.Draw(splash)
font_path = Path(r"C:\Windows\Fonts\segoeuib.ttf")
font_reg = Path(r"C:\Windows\Fonts\segoeui.ttf")
title_font = ImageFont.truetype(str(font_path), 36) if font_path.exists() else ImageFont.load_default()
sub_font = ImageFont.truetype(str(font_reg), 13) if font_reg.exists() else title_font

title = "RE SC IDE"
probe = draw.textbbox((0, 0), title, font=title_font)
tw = probe[2] - probe[0]
tx = (W - tw) // 2 - probe[0]
ty = 200 - probe[1]

# Slight text shadow for readability on dark IDE behind transparent splash
for ox, oy in ((1, 1), (0, 1)):
    draw.text((tx + ox, ty + oy), title, fill=(0, 0, 0, 110), font=title_font)
draw.text((tx, ty), title, fill=(255, 255, 255, 255), font=title_font)

title_box = draw.textbbox((tx, ty), title, font=title_font)

subtitle = "Secure Coding Environment"
sb = draw.textbbox((0, 0), subtitle, font=sub_font)
sw = sb[2] - sb[0]
sx = (W - sw) // 2 - sb[0]
sy = title_box[3] + 12 - sb[1]
draw.text((sx + 1, sy + 1), subtitle, fill=(0, 0, 0, 90), font=sub_font)
draw.text((sx, sy), subtitle, fill=(226, 232, 240, 255), font=sub_font)

out_png = brand / "splash.png"
deploy = root / "applications" / "electron" / "resources" / "RESCIDESplash.png"
splash.save(out_png, "PNG")
splash.save(deploy, "PNG")
print("wrote transparent splash", splash.size, deploy.stat().st_size)
