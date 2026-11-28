#!/usr/bin/env python3
"""Ajoute / met à jour ?v=<empreinte> sur chaque fichier .js et .css local référencé
par les pages HTML (site et admin).

Pourquoi : GitHub Pages dit aux navigateurs de garder un fichier 10 minutes. Sans numéro de
version, un visiteur (ou l'application installée sur l'écran d'accueil) peut continuer à
utiliser l'ancien code après une mise à jour. L'empreinte ne change que si le contenu du
fichier change : les fichiers inchangés restent en cache, les autres sont rechargés.

Usage (avant de publier) :  python3 tools/bump-assets.py
"""
import hashlib, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = sorted(ROOT.glob('*.html')) + [ROOT / 'admin' / 'index.html']
REF = re.compile(r'''((?:src|href)=")((?:js|css)/[^"?#]+\.(?:js|css))(\?v=[0-9a-f]+|\?v=[^"]*)?(")''')

def digest(path):
    return hashlib.md5(path.read_bytes()).hexdigest()[:8]

changed = 0
for page in PAGES:
    if not page.exists():
        continue
    text = page.read_text(encoding='utf-8')
    def fix(m):
        target = page.parent / m.group(2)
        if not target.exists():
            print(f'  ! {page.relative_to(ROOT)} : fichier introuvable {m.group(2)}', file=sys.stderr)
            return m.group(0)
        return f'{m.group(1)}{m.group(2)}?v={digest(target)}{m.group(4)}'
    new = REF.sub(fix, text)
    if new != text:
        page.write_text(new, encoding='utf-8')
        changed += 1
print(f'{changed} page(s) mise(s) à jour')
