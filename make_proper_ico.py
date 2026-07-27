import os
from PIL import Image

src_img_path = r'C:\Users\23324\.gemini\antigravity\brain\e7aa75c0-100b-47fd-828f-c521a5a0a81f\.user_uploaded\media__1785151546120.jpg'
dest_ico_path = r'c:\Users\23324\Desktop\Project\furigana\liquid-glass\app_icon.ico'

# Open original image and convert to RGBA
img = Image.open(src_img_path).convert('RGBA')

# Create a square image with soft rounded corners or keep square
width, height = img.size
min_dim = min(width, height)

# Crop center square
left = (width - min_dim) / 2
top = (height - min_dim) / 2
right = (width + min_dim) / 2
bottom = (height + min_dim) / 2
img = img.crop((left, top, right, bottom))

# Resize to standard Windows ICO sizes
sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
icon_images = []
for s in sizes:
    resized = img.resize(s, Image.Resampling.LANCZOS)
    icon_images.append(resized)

# Save as true Windows ICO with multiple icon sizes
icon_images[0].save(
    dest_ico_path,
    format='ICO',
    sizes=[(im.width, im.height) for im in icon_images],
    append_images=icon_images[1:]
)

print(f"Successfully generated Windows ICO at {dest_ico_path}, size: {os.path.getsize(dest_ico_path)} bytes")
