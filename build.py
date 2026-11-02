#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — Assemblage de l'application « Suivi de Chantier — BFR Systems »
Aucune dépendance externe (bibliothèque standard Python uniquement).
Produit :
  1. docs/                  -> Dossier PWA complet prêt pour GitHub Pages (hors connexion)
  2. Suivi-Chantier-BFR.html -> Fichier HTML unique autonome tout-en-un
"""
import hashlib
import json
import os
import shutil
import struct
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, 'app')
SRC = os.path.join(APP, 'src')
SITE = os.path.join(ROOT, 'docs')
OUT_SINGLE = os.path.join(ROOT, 'Suivi-Chantier-BFR.html')


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    t = 0.0
    if vx * vx + vy * vy > 0:
        t = max(0.0, min(1.0, (wx * vx + wy * vy) / (vx * vx + vy * vy)))
    dx, dy = wx - t * vx, wy - t * vy
    return (dx * dx + dy * dy) ** 0.5


def png_icon_chantier(size):
    """Icône PWA BFR Chantier : fond Bleu Nuit BFR (#332e72 -> #1f1c45),
    lignes de checklist Cyan BFR (#06baf2) et coche blanche."""
    navy1, navy2 = (51, 46, 114), (31, 28, 69)
    cyan = (6, 186, 242)
    blanc = (255, 255, 255)
    r = size * 0.22

    # 3 lignes horizontales de checklist à droite + coche à gauche
    ep_chk = size * 0.036
    ep_bar = size * 0.042

    # Coche 1 (en haut à gauche)
    c1a = (size * 0.19, size * 0.33)
    c1b = (size * 0.25, size * 0.39)
    c1c = (size * 0.35, size * 0.27)

    # Coche 2 (au milieu à gauche)
    c2a = (size * 0.19, size * 0.53)
    c2b = (size * 0.25, size * 0.59)
    c2c = (size * 0.35, size * 0.47)

    # Point en cours (en bas à gauche)
    dot = (size * 0.27, size * 0.73)
    dot_r = size * 0.048

    # Barres de tâches à droite
    b1a, b1b = (size * 0.45, size * 0.33), (size * 0.80, size * 0.33)
    b2a, b2b = (size * 0.45, size * 0.53), (size * 0.80, size * 0.53)
    b3a, b3b = (size * 0.45, size * 0.73), (size * 0.68, size * 0.73)

    rows = []
    for y in range(size):
        row = bytearray([0])
        cy = y + 0.5
        dy = min(cy, size - cy)
        for x in range(size):
            cx = x + 0.5
            dx = min(cx, size - cx)
            if dx < r and dy < r:
                if ((r - dx) ** 2 + (r - dy) ** 2) ** 0.5 > r:
                    row += bytes((0, 0, 0, 0))
                    continue

            t = (cx + cy) / (2.0 * size)
            col = [int(navy1[i] + (navy2[i] - navy1[i]) * t) for i in range(3)]

            # Barres Cyan BFR
            d_bar = min(
                seg_dist(cx, cy, b1a[0], b1a[1], b1b[0], b1b[1]),
                seg_dist(cx, cy, b2a[0], b2a[1], b2b[0], b2b[1]),
                seg_dist(cx, cy, b3a[0], b3a[1], b3b[0], b3b[1]),
            )
            d_dot = ((cx - dot[0]) ** 2 + (cy - dot[1]) ** 2) ** 0.5
            d_cyan = min(d_bar - ep_bar, d_dot - dot_r)
            if d_cyan < 1.0:
                a = 1.0 if d_cyan <= 0.0 else max(0.0, 1.0 - d_cyan)
                col = [int(col[i] + (cyan[i] - col[i]) * a) for i in range(3)]

            # Coches blanches
            d_chk = min(
                seg_dist(cx, cy, c1a[0], c1a[1], c1b[0], c1b[1]),
                seg_dist(cx, cy, c1b[0], c1b[1], c1c[0], c1c[1]),
                seg_dist(cx, cy, c2a[0], c2a[1], c2b[0], c2b[1]),
                seg_dist(cx, cy, c2b[0], c2b[1], c2c[0], c2c[1]),
            ) - ep_chk
            if d_chk < 1.0:
                a = 1.0 if d_chk <= 0.0 else max(0.0, 1.0 - d_chk)
                col = [int(col[i] + (blanc[i] - col[i]) * a) for i in range(3)]

            row += bytes((col[0], col[1], col[2], 255))
        rows.append(bytes(row))

    raw = b''.join(rows)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def ecrire_icones(dossier):
    os.makedirs(dossier, exist_ok=True)
    icons_src = os.path.join(APP, 'icons')
    os.makedirs(icons_src, exist_ok=True)
    tailles = {
        'icon-192.png': 192,
        'icon-512.png': 512,
        'apple-touch-icon.png': 180,
        'favicon.png': 64,
    }
    for nom, sz in tailles.items():
        chemin_src = os.path.join(icons_src, nom)
        if not os.path.isfile(chemin_src):
            with open(chemin_src, 'wb') as f:
                f.write(png_icon_chantier(sz))
        shutil.copy2(chemin_src, os.path.join(dossier, nom))


def lire(chemin):
    with open(chemin, 'r', encoding='utf-8') as f:
        return f.read()


def construire_html(avec_pwa):
    html = lire(os.path.join(APP, 'index.html'))
    blocs = {
        'CSS': lire(os.path.join(SRC, 'style.css')),
        'PDF': lire(os.path.join(SRC, 'pdf.js')),
        'DOCX': lire(os.path.join(SRC, 'docx.js')),
        'LOGO': lire(os.path.join(SRC, 'logo-bfr.js')),
        'ICONS': lire(os.path.join(SRC, 'icons.js')),
        'ANNOT': lire(os.path.join(SRC, 'annotate.js')),
        'IMPORT': lire(os.path.join(SRC, 'import-tasks.js')),
        'REPORT': lire(os.path.join(SRC, 'report.js')),
        'APP': lire(os.path.join(SRC, 'app.js')),
    }
    for nom, code in blocs.items():
        motif = '/*<!--%s-->*/' % nom
        if motif not in html:
            raise SystemExit('Motif manquant dans app/index.html : %s' % motif)
        if '</script>' in code or '</style>' in code:
            raise SystemExit('Balise fermante interdite dans %s' % nom)
        html = html.replace(motif, code)

    if avec_pwa:
        html = html.replace(
            '<meta name="description"',
            '<link rel="manifest" href="manifest.json">\n'
            '<link rel="icon" href="favicon.png">\n'
            '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n'
            '<meta name="description"',
        )
    return html


SW_TEMPLATE = """/* Service Worker — BFR Chantier (100 % hors connexion) */
const CACHE = 'bfr-chantier-__VERSION__';
const FICHIERS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];
const DELAI_RESEAU = 3500;
const delai = (ms) => new Promise((ok) => setTimeout(ok, ms));

function servir(requete, estPage) {
  const opts = (estPage || requete.url.includes('manifest')) ? { cache: 'no-cache' } : {};
  const reseau = fetch(requete, opts).then((rep) => {
    if (rep && rep.ok) {
      const copie = rep.clone();
      caches.open(CACHE).then((c) => c.put(requete, copie)).catch(() => {});
    }
    return rep && rep.ok ? rep : null;
  }).catch(() => null);

  return Promise.race([reseau, delai(DELAI_RESEAU)]).then((vite) =>
    vite || caches.match(requete)
      .then((c) => c || (estPage ? caches.match('./') : null))
      .then((c) => c || reseau)
      .then((c) => c || new Response('Hors connexion', { status: 503 }))
  );
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

const ORIGINES_POLICES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
function servirPolice(requete) {
  return caches.open(CACHE).then((c) => c.match(requete).then((enCache) => {
    const reseau = fetch(requete).then((rep) => {
      if (rep && (rep.ok || rep.type === 'opaque')) c.put(requete, rep.clone()).catch(() => {});
      return rep;
    }).catch(() => null);
    return enCache || reseau.then((rep) => rep || new Response('', { status: 504 }));
  }));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const origine = new URL(e.request.url).origin;
  if (ORIGINES_POLICES.indexOf(origine) !== -1) { e.respondWith(servirPolice(e.request)); return; }
  if (origine !== self.location.origin) return;
  e.respondWith(servir(e.request, e.request.mode === 'navigate'));
});
"""

MANIFEST = {
    "id": "bfr-chantier-suivi-v1",
    "name": "BFR Chantier — Suivi & Rapport Quotidien",
    "short_name": "BFR Chantier",
    "description": "Suivi de tâches de chantier multi-jours, photos annotées et envoi du rapport quotidien BFR Systems. Fonctionne hors connexion.",
    "lang": "fr",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#f4f6f9",
    "theme_color": "#332e72",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
    ],
}


def main():
    os.makedirs(SITE, exist_ok=True)
    ecrire_icones(SITE)

    html_pwa = construire_html(avec_pwa=True)
    html_single = construire_html(avec_pwa=False)

    with open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html_pwa)

    with open(OUT_SINGLE, 'w', encoding='utf-8') as f:
        f.write(html_single)

    with open(os.path.join(SITE, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(MANIFEST, f, ensure_ascii=False, indent=2)

    empreinte = hashlib.sha256(html_pwa.encode('utf-8')).hexdigest()[:10]
    with open(os.path.join(SITE, 'sw.js'), 'w', encoding='utf-8') as f:
        f.write(SW_TEMPLATE.replace('__VERSION__', empreinte))

    with open(os.path.join(SITE, '.nojekyll'), 'w', encoding='utf-8') as f:
        f.write('')

    print(f"Build OK — version {empreinte}")
    print(f"  -> GitHub Pages (PWA) : {SITE}/index.html ({len(html_pwa) // 1024} Ko)")
    print(f"  -> Fichier autonome   : {OUT_SINGLE} ({len(html_single) // 1024} Ko)")


if __name__ == '__main__':
    main()
