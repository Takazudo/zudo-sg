"""Recover skip-SSR markers omitted by the S1 text inventories."""
import json
import re
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SHA = json.loads((HERE.parent / 'baseline/states.json').read_text())['baseSha']
CACHE = Path.home() / '.cache/zudo-sg-zfb4-baseline' / SHA

def markers(text):
    return {a or b or c for a, b, c in re.findall(r'data-zfb-island(?:-skip-ssr)?=(?:"([^"]+)"|\x27([^\x27]+)\x27|([^\s>]+))', text)}

report = {}
for site, dist in [('root', 'dist'), ('demo', 'apps/demo/dist'), ('doc', 'doc/dist')]:
    old, new = set(), set()
    with tarfile.open(CACHE / f'{site}.tar.gz') as archive:
        for item in archive:
            if item.name.endswith('.html'):
                old.update(markers(archive.extractfile(item).read().decode()))
    for path in (REPO / dist).rglob('*.html'):
        new.update(markers(path.read_text()))
    report[site] = {'baseline': sorted(old), 'actual': sorted(new), 'missing': sorted(old-new), 'added': sorted(new-old)}
(HERE / 'inventory-comparison.json').write_text(json.dumps(report, indent=2)+'\n')
