"""Assemble freshly generated whole-body/head sheets without deforming body parts.

Run with the project's Pillow/NumPy Python runtime. Raw assets are never changed.
The build is repeatable while walk sheets arrive; --require-complete rejects gaps.
"""
from __future__ import annotations
import argparse
from collections import deque
import json
from pathlib import Path
import statistics
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'public/assets/poses-v2'
CELL = 128
QUADS = ((0, 1, 4, 5), (2, 3, 6, 7), (8, 9, 12, 13), (10, 11, 14, 15))
DIRECTIONS = ['front', 'left', 'right', 'back']


def resting_registration(outfit):
    """Measure the actual preserved idle body, including its legacy y=-9 lift."""
    source = Image.open(ROOT/f'public/assets/bodies/body-{outfit+1}.png').convert('RGBA')
    x,y = neck_top(source)
    return {'neck':[round(x),round(y-9)],'feet':125}


def components(mask):
    """Four-connected pixel components, sorted largest first."""
    seen = np.zeros(mask.shape, dtype=bool)
    result = []
    h, w = mask.shape
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        q = deque([(int(x), int(y))]); seen[y, x] = True; pixels = []
        while q:
            px, py = q.popleft(); pixels.append((px, py))
            for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; q.append((nx, ny))
        if pixels:
            result.append(np.asarray(pixels, dtype=np.int32))
    result.sort(key=len, reverse=True)
    return result


def clean_image(path):
    rgba = np.array(Image.open(path).convert('RGBA'))
    r, g, b, a = [rgba[:, :, i].astype(np.int16) for i in range(4)]
    # The built-in generator sometimes returns alpha and low-opacity chroma debris.
    remove = (a < 64) | ((r > 85) & (b > 65) & (g < np.minimum(r,b)*.65))
    rgba[remove] = 0
    return Image.fromarray(rgba)


def grid_frames(path):
    sheet = clean_image(path)
    w, h = sheet.size
    # Generation can place a complete row a little above its nominal grid slot.
    # Find transparent inter-row gaps before extracting WHOLE subjects so long
    # hair and walking shoes never get split or copied into the neighboring row.
    occupancy = (np.asarray(sheet)[:, :, 3] >= 64).sum(axis=1)
    row_edges = [0]
    for row in range(1, 4):
        expected = round(row*h/4)
        lo, hi = expected-round(h/16), expected+round(h/16)
        clear = np.flatnonzero(occupancy[lo:hi] <= 3) + lo
        if len(clear):
            groups = np.split(clear, np.flatnonzero(np.diff(clear)>1)+1)
            run = min(groups, key=lambda a:abs(float(a.mean())-expected))
            row_edges.append(round(float(run.mean())))
        else:
            row_edges.append(expected)
    row_edges.append(h)
    frames = []
    for row in range(4):
        for col in range(4):
            frame = sheet.crop((round(col*w/4), row_edges[row], round((col+1)*w/4), row_edges[row+1]))
            rgba = np.array(frame)
            cc = components(rgba[:, :, 3] >= 64)
            if not cc:
                raise ValueError(f'Empty generated cell {path} {row},{col}')
            keep = np.zeros(rgba.shape[:2], dtype=bool)
            for comp in cc:
                if len(comp) >= max(8, len(cc[0]) * .015):
                    keep[comp[:, 1], comp[:, 0]] = True
            rgba[~keep] = 0
            frames.append(Image.fromarray(rgba))
    return frames


def source_for(stem):
    for suffix in ('.normalized.png', '-normalized.png', '.grid-clean.png', '.alpha-clean.png', '.png'):
        path = BASE / 'raw' / (stem + suffix)
        if path.exists():
            return path
    return None


def rgb_skin(image, strong=False):
    rgba = np.asarray(image).astype(np.int16)
    r, g, b, a = [rgba[:, :, i] for i in range(4)]
    low = 185 if strong else 135
    return (a >= 64) & (r > low) & (g > (125 if strong else 75)) & (b > 40) & (r-g > 17) & (r-g < 100) & (g-b > 17) & (g-b < 100)


def neck_top(image):
    bbox = image.getbbox()
    x0, y0, x1, y1 = bbox
    a = np.asarray(image)[:, :, 3]
    # Torso center is more reliable than cell center: a raised wave can pull the
    # whole-body bounding box left, while a skin highlight can be nearly white.
    trunk_top = round(y0+(y1-y0)*.38)
    trunk_bottom = round(y0+(y1-y0)*.58)
    trunk_x = np.nonzero(a[trunk_top:trunk_bottom] >= 64)[1]
    center = float(np.median(trunk_x)) if len(trunk_x) else image.width/2
    # Raised hands may be above the neck: inspect only the narrow torso center.
    left, right = int(center-image.width*.065), int(center+image.width*.065)
    yy, xx = np.nonzero(a[y0:min(y1, y0+int((y1-y0)*.4)), left:right] >= 64)
    if not len(yy):
        return center, y0
    top = int(yy.min()) + y0
    near = np.nonzero(a[top:min(top+4, y1), left:right] >= 64)[1]
    return float(np.median(near)+left), float(top)


def body_mask(image, neck, outfit, action):
    weak = rgb_skin(image)
    strong = rgb_skin(image, True)
    rgb = np.asarray(image).astype(np.int16)
    r,g,b = rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    if outfit == 4:
        # Sand wool is less warm/saturated than the exposed skin. A stricter
        # chroma boundary keeps its connected sleeve out of the hand mask.
        warm = ((r > 230) & (r-g > 20)) | ((r > 170) & (r-g > 35))
        weak &= warm
        strong &= warm
    if outfit == 13:
        weak &= r-g > 23
        strong &= r-g > 23
    cc = components(weak)
    result = np.zeros(weak.shape, dtype=bool)
    nx, ny = neck
    h, w = weak.shape
    for comp in cc:
        xs, ys = comp[:, 0], comp[:, 1]
        if len(comp) < 5 or not strong[ys, xs].any():
            continue
        # A neck/hand/bare limb has a compact connected skin silhouette. Brown
        # jackets can satisfy RGB skin tests but form large torso components.
        bw, bh = int(xs.max()-xs.min()+1), int(ys.max()-ys.min()+1)
        cx, cy = float(xs.mean()), float(ys.mean())
        near_neck = abs(cx-nx) < 14 and ys.min() <= ny+5 and ys.max() < ny+28
        torso_fabric = len(comp) > 300 or (bw > 20 and bh > 24 and cy < 102)
        joined_clap = action == 'clap' and outfit not in (3,4,13) and len(comp) < 700 and ys.min() > ny+9 and ys.max() < ny+55
        if torso_fabric and not near_neck and not joined_clap:
            continue
        # Shoes are never part of the skin mask; exposed legs end above feet.
        take = ys < 122
        if near_neck or cy < 104 or outfit in (8,9,10,11,12,13,15):
            result[ys[take], xs[take]] = True
    rgba = np.zeros((h,w,4), dtype=np.uint8)
    rgba[result,:3] = 255
    rgba[result,3] = np.asarray(image)[:,:,3][result]
    return Image.fromarray(rgba)


def hand_anchor(mask, neck, action):
    cc = components(np.asarray(mask)[:,:,3] >= 64)
    candidates = []
    for comp in cc:
        xs, ys = comp[:,0], comp[:,1]
        cx, cy = float(xs.mean()), float(ys.mean())
        if len(comp) < 3 or cy > min(96,neck[1]+54) or ys.min() > neck[1]+51:
            continue
        if abs(cx-neck[0]) < 9 and ys.min() <= neck[1]+6:
            continue
        candidates.append((cx,cy,comp))
    if not candidates:
        return [round(neck[0]-16,2), 88]
    if action == 'wave':
        chosen = max(candidates,key=lambda c:c[0])
    elif action == 'clap':
        near = sorted(candidates,key=lambda c:abs(c[0]-neck[0])+abs(c[1]-70)*.4)[:2]
        return [round(statistics.mean(c[0] for c in near),2),round(statistics.mean(c[1] for c in near),2)]
    else:
        chosen = min(candidates,key=lambda c:c[0])
    comp = chosen[2]
    # Full bare forearms form one component; use the furthest point from shoulder
    # for a hand grip, while gloved/cuffed compact hand components use centroid.
    if comp[:,1].max()-comp[:,1].min() > 13:
        cy = np.quantile(comp[:,1], .80)
        low = comp[comp[:,1] >= cy]
        return [round(float(low[:,0].mean()),2),round(float(low[:,1].mean()),2)]
    return [round(chosen[0],2),round(chosen[1],2)]


def place_body_group(frames, outfit, action):
    infos = [(frame.getbbox(),neck_top(frame)) for frame in frames]
    heights = [box[3]-neck[1] for box,neck in infos]
    rest = resting_registration(outfit)
    scale = (rest['feet']-rest['neck'][1]) / statistics.median(heights)
    for box,neck in infos:
        scale = min(scale, 60/max(neck[0]-box[0],box[2]-neck[0]), 116/(box[3]-box[1]))
    outputs=[]; masks=[]; metas=[]
    for frame,(box,neck) in zip(frames,infos):
        crop = frame.crop(box)
        size = (max(1,round(crop.width*scale)),max(1,round(crop.height*scale)))
        resized = crop.resize(size,Image.Resampling.NEAREST)
        x = round(rest['neck'][0]-(neck[0]-box[0])*scale)
        y = 125-size[1]
        out = Image.new('RGBA',(CELL,CELL));out.alpha_composite(resized,(x,y))
        mapped = [round(x+(neck[0]-box[0])*scale),round(y+(neck[1]-box[1])*scale)]
        mask = body_mask(out,mapped,outfit,action)
        outputs.append(out);masks.append(mask)
        metas.append({'neck':mapped,'hand':hand_anchor(mask,mapped,action),'scale':round(scale,6),'bounds':list(out.getbbox())})
    return outputs,masks,metas


def neck_bottom(image, fallback=None):
    skin=rgb_skin(image)
    h,w=skin.shape
    skin[:,:round(w*.29)]=False;skin[:,round(w*.71):]=False
    yy,xx=np.nonzero(skin)
    if len(yy)<6:
        return fallback or (w/2,image.getbbox()[3])
    bottom=int(yy.max())+1
    xs=xx[yy>=bottom-5]
    return float(np.median(xs)),float(bottom)


def mask_for_head(image):
    rgba=np.zeros((CELL,CELL,4),dtype=np.uint8)
    skin=rgb_skin(image)
    rgba[skin,:3]=255;rgba[skin,3]=np.asarray(image)[:,:,3][skin]
    return Image.fromarray(rgba)


def skin_bounds(image):
    ys,xs=np.nonzero(rgb_skin(image))
    if not len(xs):return None
    return [int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]


def build_heads(manifest):
    atlas=Image.new('RGBA',(CELL*4,CELL*16));masks=Image.new('RGBA',atlas.size)
    metadata=[]
    for start in range(0,16,4):
        path=source_for(f'heads-{start}-{start+3}')
        if not path:raise FileNotFoundError(f'Missing generated head batch {start}')
        cells=grid_frames(path)
        for local in range(4):
            hair=start+local
            original=Image.open(ROOT/f'public/assets/heads/head-{hair+1}.png').convert('RGBA')
            front=Image.new('RGBA',(CELL,CELL));front.alpha_composite(original,(0,-9))
            source_front=cells[local*4]
            front_neck=neck_bottom(source_front)
            target_top=front.getbbox()[1]
            legacy_scale=(47-target_top)/(front_neck[1]-source_front.getbbox()[1])
            target_face,source_face=skin_bounds(front),skin_bounds(source_front)
            # Register to the preserved face, not the hairstyle silhouette.
            # A bun, fringe or wave must not change skull/face size on turning.
            scale=(target_face[3]-target_face[1])/(source_face[3]-source_face[1])
            target_neck=tuple(round(n) for n in neck_bottom(front))
            row=[]
            for direction in range(4):
                if direction==0:
                    out=front
                else:
                    raw=cells[local*4+direction]
                    neck=neck_bottom(raw,front_neck)
                    # Long back hair covers the neck; use the source front neck
                    # height, not the lowermost hair pixel or a stray ear pixel.
                    if direction==3 and neck[1]<front_neck[1]-raw.height*.06:
                        neck=(raw.width/2,front_neck[1])
                    box=raw.getbbox();crop=raw.crop(box)
                    size=(max(1,round(crop.width*scale)),max(1,round(crop.height*scale)))
                    resized=crop.resize(size,Image.Resampling.NEAREST)
                    x=round(target_neck[0]-(neck[0]-box[0])*scale);y=round(target_neck[1]-(neck[1]-box[1])*scale)
                    out=Image.new('RGBA',(CELL,CELL));out.alpha_composite(resized,(x,y))
                atlas.alpha_composite(out,(direction*CELL,hair*CELL))
                masks.alpha_composite(mask_for_head(out),(direction*CELL,hair*CELL))
                row.append({'neck':list(target_neck),'bounds':list(out.getbbox()),'faceBounds':skin_bounds(out),'scale':1 if direction==0 else round(scale,6),'accessoryTransform':{'scale':1 if direction==0 else round(scale/legacy_scale,6),'from':[64,47],'to':list(target_neck)}})
            metadata.append(row)
    atlas.save(BASE/'heads.png');masks.save(BASE/'heads-skin.png')
    manifest['heads']=metadata


def write_review(action, atlas, manifest):
    # A full avatar sheet to inspect joints/scale; generation is never synthesized.
    heads=Image.open(BASE/'heads.png').convert('RGBA')
    cols=8 if action=='walk' else 4
    review=Image.new('RGBA',atlas.size,(237,234,219,255))
    for outfit,row in enumerate(manifest['actions'][action]):
        if row is None:continue
        for phase,meta in enumerate(row):
            tile=atlas.crop((phase*128,outfit*128,(phase+1)*128,(outfit+1)*128))
            direction=phase//2 if action=='walk' else 0
            hair=outfit
            head=heads.crop((direction*128,hair*128,(direction+1)*128,(hair+1)*128))
            rest=manifest['resting'][outfit]['neck']
            tile.alpha_composite(head,(round(meta['neck'][0]-rest[0]),round(meta['neck'][1]-rest[1])))
            review.alpha_composite(tile,(phase*128,outfit*128))
    artifact=ROOT/'artifacts/pose-atlas';artifact.mkdir(parents=True,exist_ok=True)
    review.convert('RGB').save(artifact/f'{action}-avatar-review.png')


def build_action(action, manifest):
    cols=8 if action=='walk' else 4
    atlas=Image.new('RGBA',(cols*128,16*128));masks=Image.new('RGBA',atlas.size)
    metadata=[None]*16;sources=[]
    if action=='walk':
        batches=[]
        for start in range(0,16,2):
            path=source_for(f'walk-{start}-{start+1}')
            if not path:continue
            cells=grid_frames(path)
            batches += [(start+i,[cells[d*4+i*2+p] for d in range(4) for p in range(2)]) for i in range(2)]
            sources.append(str(path.relative_to(ROOT)))
    else:
        batches=[]
        for start in range(0,16,4):
            sex='men' if start<8 else 'women'
            path=source_for(f'{sex}-{start}-{start+3}-{action}')
            if not path:continue
            cells=grid_frames(path)
            batches += [(start+i,[cells[n] for n in QUADS[i]]) for i in range(4)]
            sources.append(str(path.relative_to(ROOT)))
    for outfit,frames in batches:
        outputs,skin,metas=place_body_group(frames,outfit,action)
        for col,(image,mask) in enumerate(zip(outputs,skin)):
            atlas.alpha_composite(image,(col*128,outfit*128));masks.alpha_composite(mask,(col*128,outfit*128))
        metadata[outfit]=metas
    atlas.save(BASE/f'{action}.png');masks.save(BASE/f'{action}-skin.png')
    manifest['actions'][action]=metadata
    manifest['sources'][action]=sources
    manifest['missing'][action]=[i for i,row in enumerate(metadata) if row is None]
    write_review(action,atlas,manifest)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only',choices=['heads','wave','dance','clap','walk','all'],default='all')
    parser.add_argument('--require-complete',action='store_true')
    args=parser.parse_args()
    existing=BASE/'manifest.json'
    manifest=json.loads(existing.read_text()) if existing.exists() else {}
    manifest.update({'version':3,'cellSize':CELL,'directions':DIRECTIONS,'resting':[resting_registration(i) for i in range(16)],'registration':'original-idle-face-and-neck'})
    manifest.pop('headAnchor',None);manifest.pop('bodyAnchor',None)
    for key in ('actions','sources','missing'):manifest.setdefault(key,{})
    if args.only in ('all','heads') or not (BASE/'heads.png').exists():build_heads(manifest)
    for action in ('wave','dance','clap','walk'):
        if args.only in ('all',action):build_action(action,manifest)
    existing.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'built':args.only,'missing':manifest['missing'],'output':str(BASE)},ensure_ascii=False))
    if args.require_complete and any(manifest['missing'].values()):raise SystemExit('Missing generated outfit rows')


if __name__=='__main__':main()
