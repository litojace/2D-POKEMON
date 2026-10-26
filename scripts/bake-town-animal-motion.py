"""Pack complete illustrated animal poses into a small runtime atlas.
Requires Pillow and numpy; originals remain untouched in art-source/town.
No image is divided into moving strips or deforming body fragments.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'apps/client/art-source/town/animal-motion'
OUT=ROOT/'apps/client/src/art/town-animal-motion.webp'
DOG_BOXES=[(28,104,366,355),(393,105,724,347),(769,103,1078,354),(1109,104,1427,350),(21,419,367,676),(392,422,721,672),(754,425,1080,681),(1116,419,1428,677),(33,732,363,1011),(398,756,740,1007),(763,740,1117,1009),(1123,725,1407,1008)]
HEN_BOXES=[(61,41,349,298),(427,38,691,298),(780,39,1045,297),(1132,37,1421,299),(55,310,341,562),(424,337,714,560),(762,354,1057,560),(1122,321,1401,561),(62,570,354,827),(430,569,695,828),(778,572,1061,828),(1128,569,1412,829),(63,830,348,1069),(429,852,721,1065),(779,862,1060,1063),(1132,836,1398,1070)]
GULL_BOXES=[(38,39,388,386),(482,73,836,386),(883,239,1339,386),(1388,274,1745,479),(40,674,413,850),(483,548,873,803),(939,518,1317,804),(1372,472,1737,805)]
GULL_CENTRES=[(224,335),(668,338),(1126,338),(1568,328),(220,752),(685,752),(1148,752),(1558,754)]

def complete_illustrations(im):
    alpha=np.array(im.getchannel('A'))>96
    height,width=alpha.shape
    components=[]
    for y,x in zip(*np.where(alpha)):
        if not alpha[y,x]: continue
        pending=[(int(x),int(y))];alpha[y,x]=False;pixels=[]
        while pending:
            x,y=pending.pop();pixels.append((x,y))
            for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0<=nx<width and 0<=ny<height and alpha[ny,nx]:
                    alpha[ny,nx]=False;pending.append((nx,ny))
        if len(pixels)>3000:
            xs,ys=zip(*pixels);box=(min(xs),min(ys),max(xs)+1,max(ys)+1)
            components.append((box,pixels))
    return components

atlas=Image.new('RGBA',(192*8,160*5))
index=0
for kind,boxes in [('dog',DOG_BOXES),('hens',HEN_BOXES),('gull',GULL_BOXES)]:
    original=Image.open(SOURCE/(kind+'.png')).convert('RGBA')
    objects=complete_illustrations(original)
    assert len(objects)==len(boxes),(kind,len(objects))
    for frame,expected in enumerate(boxes):
        bounds,pixels=min(objects,key=lambda item:sum(abs(a-b) for a,b in zip(item[0],expected)))
        assert sum(abs(a-b) for a,b in zip(bounds,expected))<50,(kind,frame,bounds)
        # Whole connected silhouettes remove stray pixels from neighbouring
        # illustrations without cropping a wing, foot or fur edge.
        a=np.zeros((original.height,original.width),dtype=np.uint8)
        for x,y in pixels:a[y,x]=255
        mask=Image.fromarray(a).filter(ImageFilter.MaxFilter(7))
        alpha=np.minimum(np.array(mask),np.array(original.getchannel('A')))
        isolated=original.copy();isolated.putalpha(Image.fromarray(alpha))
        l,t,r,b=bounds;crop=(max(0,l-4),max(0,t-4),min(original.width,r+4),min(original.height,b+4))
        whole=isolated.crop(crop)
        if kind=='dog':
            scale=.425;anchor=(r-170,b);target=(96,125)
        elif kind=='hens':
            scale=.51;anchor=(l+135,b);target=(96,157)
        else:
            scale=.235;anchor=GULL_CENTRES[frame];target=(96,80)
        w,h=round(whole.width*scale),round(whole.height*scale)
        whole=whole.resize((w,h),Image.Resampling.LANCZOS)
        x=round(target[0]-(anchor[0]-crop[0])*scale)
        y=round(target[1]-(anchor[1]-crop[1])*scale)
        assert x>=0 and y>=0 and x+w<=192 and y+h<=160,(kind,frame,x,y,w,h)
        atlas.alpha_composite(whole,(index%8*192+x,index//8*160+y))
        index+=1
OUT.parent.mkdir(parents=True,exist_ok=True)
atlas.save(OUT,quality=90,method=6)
print(f'{index} complete poses; {atlas.width}×{atlas.height}; {OUT.stat().st_size:,} bytes')
