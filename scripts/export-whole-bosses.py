"""Export complete authored boss poses; never split character anatomy.

Requires Pillow, numpy and scipy. The alpha ownership step separates adjacent
WHOLE CREATURES in the source sheet (some lunging silhouettes cross grid cells).
It preserves source pixels/scale and assigns soft fringes to the nearest complete
silhouette; it does not construct a character out of body parts.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'apps/client/art-source/bosses/whole'
OUT=ROOT/'apps/client/src/art'
CORES={
 'grumblecrag':[(459,352),(1120,376),(452,839),(1194,798)],
 'tidewyrm':[(401,128),(1202,273),(899,716),(1264,658)],
 'tidewyrm-ground':[(1874,466)],
 'prismatail':[(549,348),(1230,336),(588,867),(1326,861)],
 'gloomshade':[(464,315),(1055,430),(507,810),(1134,795)],
 'somnara':[(320,340),(1080,333),(310,760),(1090,830)],
 'emberwing':[(391,300),(1153,310),(391,755),(1161,790)],
 'emberwing-ground':[(434,330),(1152,380),(430,790),(1157,800)],
 'storm-twins':[(182,316),(560,320),(965,285),(1367,315),(183,798),(560,821),(980,770),(1371,806)]
}
MOONS=[(210,145),(1380,175),(710,650),(1415,700)]
SCALE={'grumblecrag' :.5,'tidewyrm':.42,'gloomshade':.32,'somnara':.5,'prismatail':.45,'emberwing':.49,'storm-twins':.4}

def poses(name,count,scale):
    im=Image.open(SOURCE/f'{name}.png').convert('RGBA')
    rgba=np.array(im);alpha=rgba[:,:,3]
    labels,_=ndimage.label(alpha>210)
    sizes=np.bincount(labels.ravel());ids=sorted(range(1,len(sizes)),key=lambda i:-sizes[i])[:count]
    # Each retained label is a connected complete creature, not an anatomical part.
    centroids={i:ndimage.center_of_mass(alpha,labels,i) for i in ids}
    by_y=sorted(ids,key=lambda i:centroids[i][0]);columns=max(1,count//2)
    ids=sorted(by_y[:columns],key=lambda i:centroids[i][1])+sorted(by_y[columns:],key=lambda i:centroids[i][1])
    owned=np.where(np.isin(labels,ids),labels,0)
    distance,indices=ndimage.distance_transform_edt(owned==0,return_indices=True)
    owner=owned[indices[0],indices[1]]
    result=[]
    for index,component in enumerate(ids):
        ys,xs=np.where(labels==component)
        x0=max(0,int(xs.min())-24);x1=min(im.width,int(xs.max())+25)
        y0=max(0,int(ys.min())-24);y1=min(im.height,int(ys.max())+25)
        pixels=rgba[y0:y1,x0:x1].copy()
        keep=(owner[y0:y1,x0:x1]==component)&(distance[y0:y1,x0:x1]<48)
        pixels[:,:,3]=np.where(keep,pixels[:,:,3],0)
        bottom=ys.max();floor=xs[ys>=bottom-7]
        anchor=[float(np.median(floor))-x0,float(bottom)-y0]
        balanced_feet={'grumblecrag':[414,1093,453,1177], 'prismatail':[466,1186,506,1246]}
        if name in balanced_feet:anchor[0]=balanced_feet[name][index]-x0
        if name=='emberwing':
            # Flying sprites include long tail plumes below their talons.
            feet=[(391,382),(1153,405),(391,832),(1161,880)][index]
            anchor=[feet[0]-x0,feet[1]-y0]
        if name=='somnara':anchor[0]=float(centroids[component][1])-x0
        core=[CORES[name][index][0]-x0,CORES[name][index][1]-y0]
        moon=[MOONS[index][0]-x0,MOONS[index][1]-y0] if name=='gloomshade' else [0,0]
        pose_image=Image.fromarray(pixels);ratio=min(1,1900/pose_image.width)
        if ratio<1:
            pose_image=pose_image.resize((round(pose_image.width*ratio),round(pose_image.height*ratio)),Image.Resampling.LANCZOS)
        result.append({'image':pose_image,'anchor':[v*ratio for v in anchor],'core':[v*ratio for v in core],'moon':[v*ratio for v in moon],'scale':scale/ratio,'source':[x0,y0,x1,y1]})
    return result

metadata={}
for boss,scale in SCALE.items():
    items=poses(boss,8 if boss=='storm-twins' else 4,scale)
    if boss=='emberwing':items+=poses('emberwing-ground',4,.44)
    if boss=='tidewyrm':items+=poses('tidewyrm-ground',1,.18)
    placements={};x=y=8;row=0
    for index,item in sorted(enumerate(items),key=lambda p:-p[1]['image'].height):
        image=item['image']
        if x+image.width+8>2048:x=8;y+=row+8;row=0
        placements[index]=(x,y);x+=image.width+8;row=max(row,image.height)
    height=((y+row+8+31)//32)*32
    atlas=Image.new('RGBA',(2048,height));entries=[]
    for index,item in enumerate(items):
        image=item['image'];x,y=placements[index];atlas.alpha_composite(image,(x,y))
        entries.append({'rect':[x,y,image.width,image.height],'anchor':item['anchor'],'core':item['core'],'moon':item['moon'],'scale':item['scale'],'source':item['source']})
    atlas.save(OUT/f'raid-whole-{boss}.webp',quality=94,method=6)
    metadata[boss]={'size':[2048,height],'poses':entries}
    print(boss,atlas.size,len(items),flush=True)
(OUT/'raid-whole-frames.json').write_text(json.dumps(metadata,indent=2)+'\n')
