"""Normalize complete HD illustrations to the existing authored crop/foot.
Pillow only. Keep the masters; POT GPU storage enables filtered mip levels.
"""
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'apps/client/art-source/town/architecture-hd'
OUT=ROOT/'apps/client/src/art'
# Canonical crop w/h, ink width, doorstep within crop; shared world geometry.
FRAMES={
 'red':(423,506,392,211,494),
 'teal':(422,506,391,210,494),
 'plum':(425,495,394,210,486),
 'market':(453,418,422,221,383),
 'tower':(368,486,337,184,465),
 'windmill':(385,505,356,189,483),
 'coliseum':(1187,972,1165,589,954),
 'raidHall':(1430,961,1399,715,940),
}
for name,(cw,ch,ink,ax,ay) in FRAMES.items():
 im=Image.open(SOURCE/(name+'.png')).convert('RGBA')
 bounds=im.getchannel('A').point(lambda a:255 if a>96 else 0).getbbox()
 whole=im.crop(bounds)
 # A bounded, per-building source; no multi-megapixel atlas duplicated for
 # each cottage. Do not invent detail by interpolating beyond the master.
 scale=min(whole.width/ink,whole.height/ay,1024/cw if name not in ['coliseum','raidHall'] else 1.4)
 w,h=round(cw*scale),round(ch*scale)
 canvas=Image.new('RGBA',(w,h))
 whole=whole.resize((round(ink*scale),round(ay*scale)),Image.Resampling.LANCZOS)
 canvas.alpha_composite(whole,(round((ax-ink/2)*scale),0))
 # Store rectangular art in a compact power-of-two texture. Runtime maps it
 # back to the canonical world rectangle, preserving the exact proportions.
 # These storage dimensions do not represent extra authored source detail.
 canvas=canvas.resize((2048,1024) if name in ['coliseum','raidHall'] else (1024,1024),Image.Resampling.LANCZOS)
 path=OUT/('town-hd-'+name+'.webp');canvas.save(path,quality=94,method=6)
 print(name,canvas.size,path.stat().st_size)

im=Image.open(SOURCE/'obelisk.png').convert('RGBA')
bounds=im.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
im=im.crop(bounds);im=im.resize((512,1024),Image.Resampling.LANCZOS)
im.save(OUT/'town-hd-obelisk.webp',quality=94,method=6)
print('obelisk',im.size)
