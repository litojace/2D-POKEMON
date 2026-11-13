"""Render the original elemental gem emblem at PWA icon sizes (no third-party art).

`python3 scripts/generate-icons.py ios` renders the iPhone app's icon
(1024 x 1024, no transparency, as the App Store asks) and its launch screen
(the emblem small on the game's dark background) instead.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import math
import sys
folder = Path('apps/client/public/icons')
colors = ['#f6df7f','#f69769','#77d9ec','#c39be9','#9ecb89','#cfedfb','#9e82c4','#d6aa80']

def emblem(size, background='#111c31', canvas=None):
 """The emblem drawn to fill a size x size square (on a larger canvas if given)."""
 scale = 4
 full = (canvas or size)*scale
 im=Image.new('RGB',(full,full),background)
 d=ImageDraw.Draw(im)
 center=full/2
 radius=size*scale*.29
 for i,color in enumerate(colors):
  a=i*math.pi/4-math.pi/2
  x=center+math.cos(a)*radius;y=center+math.sin(a)*radius
  r=size*scale*.09
  d.polygon([(x,y-r),(x+r*.72,y),(x,y+r),(x-r*.72,y)],fill=color)
 r=size*scale*.14
 d.polygon([(center,center-r),(center+r,center),(center,center+r),(center-r,center)],fill='#e9b955')
 d.polygon([(center,center-r),(center,center+r),(center-r,center)],fill='#fff0a5')
 d.polygon([(center,center-r),(center+r,center),(center,center)],fill='#f7d779')
 return im.resize((canvas or size,)*2,Image.Resampling.LANCZOS)

if sys.argv[1:] == ['ios']:
 assets = Path('apps/client/ios/App/App/Assets.xcassets')
 emblem(1024).save(assets/'AppIcon.appiconset'/'AppIcon-512@2x.png')
 # The launch screen: the app's background (#0b1020, capacitor.config.ts)
 # with the emblem at a fifth of the square, centred.
 splash = emblem(546, '#0b1020', 2732)
 for name in ['splash-2732x2732.png','splash-2732x2732-1.png','splash-2732x2732-2.png']:
  splash.save(assets/'Splash.imageset'/name)
 print('Rendered the iPhone app icon and launch screen.')
 sys.exit()

for name,size in [('arena-192.png',192),('arena-512.png',512),('arena-maskable-512.png',512),('apple-touch-icon.png',180)]:
 emblem(size).save(folder/name)
print('Rendered original elemental PWA icons.')
