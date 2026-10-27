"""Export whole-creature turnarounds alongside the existing front/side atlases.

Requires Pillow, numpy, scipy. Characters stay complete; alpha ownership only
separates adjacent WHOLE drawings, never anatomical parts. No artificial upscaling.
"""
from pathlib import Path
import json
import sys
import numpy as np
from scipy import ndimage
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'apps/client/art-source/bosses/directions'
OUT = ROOT / 'apps/client/src/art'
SCALES = {'grumblecrag': .5, 'tidewyrm': .42, 'gloomshade': .32,
          'somnara': .5, 'prismatail': .45, 'emberwing': .49, 'storm-twins': .4}
FLYING_FEET = {
    'emberwing-back': [(443, 360), (1175, 380), (448, 825), (1178, 855)],
    'emberwing-side': [(574, 438), (1293, 455), (631, 919), (1340, 965)],
}


def extract(name, count, scale):
    rgba = np.array(Image.open(SOURCE / f'{name}.png').convert('RGBA'))
    alpha = rgba[:, :, 3]
    labels, _ = ndimage.label(alpha > 210)
    sizes = np.bincount(labels.ravel())
    ids = sorted(range(1, len(sizes)), key=lambda i: -sizes[i])[:count]
    centers = {i: ndimage.center_of_mass(alpha, labels, i) for i in ids}
    columns = count // 2
    rows = sorted(ids, key=lambda i: centers[i][0])
    ids = sorted(rows[:columns], key=lambda i: centers[i][1]) + sorted(rows[columns:], key=lambda i: centers[i][1])
    owned = np.where(np.isin(labels, ids), labels, 0)
    distance, indices = ndimage.distance_transform_edt(owned == 0, return_indices=True)
    owner = owned[indices[0], indices[1]]
    poses = []
    for index, component in enumerate(ids):
        ys, xs = np.where(labels == component)
        assert len(xs) > 10000, f'{name} pose {index} is not a complete creature'
        left, right = max(0, int(xs.min()) - 24), min(rgba.shape[1], int(xs.max()) + 25)
        top, bottom = max(0, int(ys.min()) - 24), min(rgba.shape[0], int(ys.max()) + 25)
        pixels = rgba[top:bottom, left:right].copy()
        keep = (owner[top:bottom, left:right] == component) & (distance[top:bottom, left:right] < 48)
        pixels[:, :, 3] = np.where(keep, pixels[:, :, 3], 0)
        foot_y = float(ys.max())
        foot_x = float(np.median(xs[ys > foot_y - 22]))
        if name.startswith(('grumblecrag', 'prismatail', 'emberwing-ground')):
            low = ys > foot_y - 50
            foot_x = float((xs[low].min() + xs[low].max()) / 2)
        if name.startswith('somnara'):
            foot_x = float(centers[component][1])
        if name in FLYING_FEET:
            foot_x, foot_y = FLYING_FEET[name][index]
        height = ys.max() - ys.min()
        core = [foot_x - left, foot_y - top - height * .48]
        if name.startswith('emberwing'):
            core[1] = foot_y - top - (125 if '-ground-' in name else 90)
        moon = [0, 0]
        if name.startswith('gloomshade'):
            r, g, b, a = [pixels[:, :, channel].astype(int) for channel in range(4)]
            gold = (r > 180) & (g > 130) & (b < 160) & (r > b * 1.3) & (a > 210)
            gl, _ = ndimage.label(gold)
            counts = np.bincount(gl.ravel())
            if len(counts) > 1:
                chosen = 1 + int(np.argmax(counts[1:]))
                my, mx = ndimage.center_of_mass(gold, gl, chosen)
                moon = [float(mx), float(my)]
        poses.append({'image': Image.fromarray(pixels), 'anchor': [foot_x-left, foot_y-top],
                      'core': core, 'moon': moon, 'scale': scale,
                      'source': [left, top, right, bottom], 'master': name, 'cell': index})
    return poses


def pack(items):
    positions = {}
    x = y = 8
    row_height = 0
    for index, item in sorted(enumerate(items), key=lambda p: -p[1]['image'].height):
        image = item['image']
        if x + image.width + 8 > 2048:
            x = 8; y += row_height + 8; row_height = 0
        positions[index] = (x, y)
        x += image.width + 8
        row_height = max(row_height, image.height)
    height = ((y + row_height + 39) // 32) * 32
    assert height <= 4096, f'Directional atlas exceeds mobile budget: {height}'
    atlas = Image.new('RGBA', (2048, height))
    entries = []
    for index, item in enumerate(items):
        image = item['image']; x, y = positions[index]
        atlas.alpha_composite(image, (x, y))
        entries.append({key: value for key, value in item.items() if key != 'image'} | {'rect': [x,y,image.width,image.height]})
    return atlas, entries


def selection(atlas, poses, flip=False):
    return {'atlas': atlas, 'poses': poses, 'flip': flip}


selected = set(sys.argv[1:])
metadata = json.loads((OUT / 'raid-directions-frames.json').read_text()) if selected else {}
for boss, scale in SCALES.items():
    if selected and boss not in selected:
        continue
    items = []
    def add(name, count=4, factor=scale):
        start = len(items)
        items.extend(extract(name, count, factor))
        return list(range(start, len(items)))
    def views(front, back, side, native_left=False):
        return {'front': front, 'back': back,
                'right': selection(side['atlas'], side['poses'], native_left),
                'left': selection(side['atlas'], side['poses'], not native_left)}
    if boss in ('tidewyrm', 'somnara'):
        front = selection('directions', add(f'{boss}-front'))
        back = selection('directions', add(f'{boss}-back'))
        body = views(front, back, selection('base', list(range(4))), boss == 'somnara')
    else:
        back_indices = add(f'{boss}-back', 8 if boss == 'storm-twins' else 4)
        side_indices = add(f'{boss}-side', 8 if boss == 'storm-twins' else 4)
        body = views(selection('base', list(range(4))), selection('directions', back_indices[:4]), selection('directions', side_indices[:4]))
    if boss == 'prismatail':
        body['front'] = selection('directions', add('prismatail-front'))
    modes = {'body': body}
    if boss == 'emberwing':
        ground_back = add('emberwing-ground-back', factor=.44)
        ground_side = add('emberwing-ground-side', factor=.44)
        modes['ground'] = views(selection('base', list(range(4,8))), selection('directions', ground_back), selection('directions', ground_side))
    if boss == 'tidewyrm':
        grounded = add('tidewyrm-ground-turns', factor=.30)
        modes['stranded'] = views(selection('directions', [grounded[0]]), selection('directions', [grounded[1]]), selection('base', [4]))
    if boss == 'storm-twins':
        modes['blue'] = views(selection('base', list(range(4,8))), selection('directions', back_indices[4:]), selection('directions', side_indices[4:]))
    atlas, entries = pack(items)
    atlas.save(OUT / f'raid-directions-{boss}.webp', quality=94, method=6)
    metadata[boss] = {'size': list(atlas.size), 'poses': entries, 'modes': modes}
    print(boss, atlas.size, len(entries), flush=True)
(OUT / 'raid-directions-frames.json').write_text(json.dumps(metadata, indent=2) + '\n')
