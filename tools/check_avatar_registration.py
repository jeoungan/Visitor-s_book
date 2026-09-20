"""Check every hairstyle/outfit joint against the unchanged idle references."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'public/assets/poses-v2'
manifest=json.loads((BASE/'manifest.json').read_text())
heads=Image.open(BASE/'heads.png').convert('RGBA')
atlases={name:Image.open(BASE/f'{name}.png').convert('RGBA') for name in manifest['actions']}
skirts={8,9,10,11,12,13,15}

def idle_body(outfit):
    raw=Image.open(ROOT/f'public/assets/bodies/body-{outfit+1}.png').convert('RGBA')
    split=104 if outfit in skirts else 90
    result=Image.new('RGBA',(128,128))
    result.alpha_composite(raw.crop((0,0,128,split)),(0,-9))
    lower=raw.crop((0,split,128,118)).resize((128,118-split+9),Image.Resampling.NEAREST)
    result.alpha_composite(lower,(0,split-9));result.alpha_composite(raw.crop((0,118,128,128)),(0,118))
    return result

minimum=10**6;checked=0;failures=[];head_sizes=[]
for hair in range(16):
    original=Image.open(ROOT/f'public/assets/heads/head-{hair+1}.png').convert('RGBA')
    expected=Image.new('RGBA',(128,128));expected.alpha_composite(original,(0,-9))
    assert np.array_equal(np.asarray(expected),np.asarray(heads.crop((0,hair*128,128,(hair+1)*128)))),f'Front reference changed: {hair}'
    for outfit in range(16):
        baseline=manifest['resting'][outfit]['neck']
        samples=[('idle',0,0,idle_body(outfit),{'neck':baseline})]
        for action,rows in manifest['actions'].items():
            for frame,meta in enumerate(rows[outfit]):
                direction=frame//2 if action=='walk' else 0
                body=atlases[action].crop((frame*128,outfit*128,(frame+1)*128,(outfit+1)*128))
                samples.append((action,frame,direction,body,meta))
        for action,frame,direction,body,meta in samples:
            neck=meta['neck'];assert all(isinstance(n,int) for n in neck)
            head=heads.crop((direction*128,hair*128,(direction+1)*128,(hair+1)*128))
            placed=Image.new('RGBA',(128,128));placed.alpha_composite(head,(neck[0]-baseline[0],neck[1]-baseline[1]))
            a=np.asarray(placed)[:,:,3]>64;b=np.asarray(body)[:,:,3]>64
            x0,x1=max(0,neck[0]-5),min(128,neck[0]+6)
            y0,y1=max(0,neck[1]-2),min(128,neck[1]+14)
            overlap=int((a[y0:y1,x0:x1]&b[y0:y1,x0:x1]).sum())
            minimum=min(minimum,overlap);checked+=1
            if overlap<3:failures.append({'hair':hair,'outfit':outfit,'action':action,'frame':frame,'neckOverlap':overlap})
report={'combinations':checked,'minimumNeckOverlapPixels':minimum,'frontReferencesExact':16,'integerNeckAnchors':True,'failures':failures}
destination=ROOT/'artifacts/pose-renderer/registration-metrics.json';destination.parent.mkdir(parents=True,exist_ok=True)
destination.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
assert not failures,'Detached neck/head contact detected'
