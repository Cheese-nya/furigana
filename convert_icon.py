import shutil
from PIL import Image

src_img = r'C:\Users\23324\.gemini\antigravity\brain\e7aa75c0-100b-47fd-828f-c521a5a0a81f\.user_uploaded\media__1785151546120.jpg'
dest_public = r'c:\Users\23324\Desktop\Project\furigana\liquid-glass\public\logo.png'
dest_ico = r'c:\Users\23324\Desktop\Project\furigana\liquid-glass\app_icon.ico'

shutil.copyfile(src_img, dest_public)
img = Image.open(src_img)
img.save(dest_ico, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (32, 32)])
print("Successfully generated app_icon.ico and copied logo.png")
