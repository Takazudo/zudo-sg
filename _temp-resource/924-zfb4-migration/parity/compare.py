"""Compare all manifest pairs; retain full style deltas, not changed URLs/classes."""
import json
from pathlib import Path
from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
BASE = HERE.parent / 'baseline'
manifest = json.loads((BASE / 'states.json').read_text())
rows = []
for site in manifest['sites']:
    for state in site['states']:
        for viewport in manifest['viewports']:
            for theme in manifest['themes']:
                key = f"{site['id']}/{state['id']}-{viewport['width']}-{theme}"
                old = json.loads((BASE / 'states' / f'{key}.json').read_text())
                new = json.loads((HERE / 'states' / f'{key}.json').read_text())
                changes = []
                for selector in dict.fromkeys([*old['styles'], *new['styles']]):
                    a, b = old['styles'].get(selector), new['styles'].get(selector)
                    if a is None or b is None:
                        if a != b: changes.append({'selector': selector, 'property': 'presence', 'before': a, 'after': b})
                        continue
                    for prop in manifest['styleProperties']:
                        if a['styles'][prop] != b['styles'][prop]:
                            changes.append({'selector': selector, 'property': prop, 'before': a['styles'][prop], 'after': b['styles'][prop]})
                    if a['matchCount'] != b['matchCount']:
                        changes.append({'selector': selector, 'property': 'matchCount', 'before': a['matchCount'], 'after': b['matchCount']})
                a = Image.open(BASE / 'states' / f'{key}.png').convert('RGB')
                b = Image.open(HERE / 'states' / f'{key}.png').convert('RGB')
                canvas = (max(a.width,b.width), max(a.height,b.height))
                aa, bb = Image.new('RGB',canvas,'white'), Image.new('RGB',canvas,'white')
                aa.paste(a,(0,0)); bb.paste(b,(0,0))
                diff = ImageChops.difference(aa,bb)
                r, g, b = diff.split()
                maximum = ImageChops.lighter(ImageChops.lighter(r, g), b)
                changed = sum(maximum.histogram()[17:])
                rows.append({'key': key, 'beforeSize': list(a.size), 'afterSize': list(b.size), 'changedPixelsAbove16': changed, 'changedPercent': round(changed / (canvas[0]*canvas[1])*100,3), 'styleDeltas': changes})
(HERE / 'differences.json').write_text(json.dumps(rows, indent=2)+'\n')
for r in rows:
    print(r['key'], r['changedPercent'], len(r['styleDeltas']))
