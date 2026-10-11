"""Check the 14 live v2 spots still agree with the saved S1 evidence."""
import json
from pathlib import Path
from PIL import Image, ImageChops
HERE = Path(__file__).resolve().parent
rows = []
for path in sorted((HERE / 'live-states').glob('*/*.json')):
    key = path.relative_to(HERE / 'live-states')
    baseline = HERE.parent / 'baseline/states' / key
    old, new = json.loads(baseline.read_text()), json.loads(path.read_text())
    selectors = [selector for selector in old['styles'] if old['styles'][selector] != new['styles'][selector]]
    a, b = Image.open(baseline.with_suffix('.png')).convert('RGB'), Image.open(path.with_suffix('.png')).convert('RGB')
    percent = None
    if a.size == b.size:
        r, g, blue = ImageChops.difference(a, b).split()
        percent = round(sum(ImageChops.lighter(ImageChops.lighter(r, g), blue).histogram()[17:]) / (a.width*a.height)*100, 3)
    rows.append({'pair': str(key.with_suffix('')), 'styleSelectorsChanged': selectors, 'pixelChangePercent': percent, 'baselineSize': list(a.size), 'liveSize': list(b.size)})
(HERE / 'live-comparison.json').write_text(json.dumps(rows, indent=2)+'\n')
assert len(rows) == 14, f'Expected 14 live spots, got {len(rows)}'
assert all(not r['styleSelectorsChanged'] and r['pixelChangePercent'] == 0 for r in rows), 'Live v2 changed from S1; inspect evidence'
print('14/14 live v2 spots match S1 pixels/styles')
