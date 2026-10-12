"""Render the original elemental gem emblem at PWA icon sizes (no third-party art)."""
from pathlib import Path
from PIL import Image, ImageDraw
import math
folder = Path('apps/client/public/icons')
colors = ['#f6df7f','#f69769','#77d9ec','#c39be9','#9ecb89','#cfedfb','#9e82c4','#d6aa80']
for name,size in [('arena-192.png',192),('arena-512.png',512),('arena-maskable-512.png',512),('apple-touch-icon.png',180)]:
 scale = 4
 im=Image.new('RGB',(size*scale,size*scale),'#111c31')
 d=ImageDraw.Draw(im)
 center=size*scale/2
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
 im.resize((size,size),Image.Resampling.LANCZOS).save(folder/name)
print('Rendered original elemental PWA icons.')
