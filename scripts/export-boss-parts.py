"""Pack complete authored boss parts without resampling the PNG masters.

Pillow only. Source rectangles follow isolated parts, never body strips. Each
boss gets one filtered POT atlas; poses use the same pivots at any DPI.
"""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'apps/client/art-source/bosses/articulated'
OUT = ROOT / 'apps/client/src/art'
CROPS = {
 'emberwing': {
  'body':(34,92,466,441), 'head':(500,142,793,412),
  'wingL':(821,91,1219,455), 'wingR':(49,474,462,827),
  'footL':(514,530,752,797), 'footR':(944,529,1195,802),
  'crest':(64,867,401,1195), 'tail':(459,831,816,1195), 'core':(961,868,1153,1187),
 },
 'storm-twins': {
  'gold':(34,115,427,445), 'blue':(464,118,855,448),
  'capGold':(919,157,1221,441), 'capBlue':(59,552,390,846),
  'tailGold':(564,481,809,884), 'tailBlue':(979,482,1210,885),
  'boltGold':(141,914,322,1193), 'boltBlue':(591,917,774,1194), 'core':(953,965,1145,1170),
 },
 'grumblecrag': {
  'head':(78,16,401,439), 'body':(452,110,914,453),
  'armL':(930,50,1216,470), 'armR':(66,476,379,879),
  'footL':(458,556,793,831), 'footR':(892,556,1229,830),
  'core':(117,898,305,1202), 'armor':(461,878,849,1217), 'rock':(956,937,1187,1187),
 },
 'tidewyrm': {
  'head':(19,42,466,506), 'neck':(531,77,734,499), 'body':(813,19,1246,516),
  'finL':(72,569,383,911), 'finR':(464,569,775,911), 'belly':(988,546,1124,933),
  'core':(122,995,305,1177), 'tailFin':(529,948,821,1208), 'gill':(974,979,1191,1213),
 },
 'gloomshade': {
  'body':(399,103,862,536), 'earL':(31,98,373,479), 'earR':(897,98,1230,479),
  'armL':(84,596,361,846), 'armR':(526,599,796,845), 'tail':(878,563,1222,913),
  'footL':(68,951,384,1182), 'footR':(504,952,814,1183), 'core':(972,987,1127,1182),
 },
 'somnara': {
  'body':(29,103,896,580), 'tail':(903,80,1240,579),
  'finL':(127,671,405,924), 'finR':(502,645,816,937), 'cottage':(880,670,1222,937),
  'cap':(49,971,453,1214), 'core':(538,988,744,1187), 'cloud':(908,1024,1208,1196),
 },
 'prismatail': {
  'body':(29,82,498,518), 'head':(564,49,795,532), 'feather':(973,22,1238,531),
  'wingL':(45,588,411,889), 'wingR':(514,589,882,888), 'crest':(977,599,1204,879),
  'footL':(101,903,362,1207), 'footR':(576,900,836,1206), 'core':(981,936,1186,1192),
 },
}
metadata = {}
for boss, crops in CROPS.items():
    image = Image.open(SOURCE / f'{boss}.png').convert('RGBA')
    atlas = Image.new('RGBA', (2048, 1024))
    parts = {name: image.crop((max(0,x0-4),max(0,y0-4),min(image.width,x1+4),min(image.height,y1+4))) for name,(x0,y0,x1,y1) in crops.items()}
    x = y = row_height = 4
    metadata[boss] = {}
    for name, part in sorted(parts.items(), key=lambda p: -p[1].height):
        if x + part.width + 4 > atlas.width:
            x = 4
            y += row_height + 8
            row_height = 0
        if y + part.height + 4 > atlas.height:
            raise ValueError(f'{boss} does not fit the texture budget')
        atlas.alpha_composite(part, (x,y))
        metadata[boss][name] = [x,y,part.width,part.height]
        x += part.width + 8
        row_height = max(row_height,part.height)
    atlas.save(OUT / f'raid-painted-{boss}.webp', quality=94, method=6)
    print(boss, len(parts), (OUT / f'raid-painted-{boss}.webp').stat().st_size)
(OUT / 'raid-painted-frames.json').write_text(json.dumps(metadata,indent=2)+'\n')
