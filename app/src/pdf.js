/* =========================================================================
   pdf.js — Moteur de génération PDF minimaliste (aucune dépendance externe)
   Écrit pour être embarqué dans un seul fichier HTML, fonctionne hors-ligne.
   Coordonnées exprimées en points (1 pt = 1/72"), origine en HAUT-GAUCHE
   (conversion interne vers l'origine PDF en bas-gauche).
   ========================================================================= */
(function (global) {
  'use strict';

  /* --- Largeurs des glyphes Helvetica (unités /1000) ------------------- */
  const W = {
    32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
    40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
    48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
    56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556,
    64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
    72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778,
    80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
    88: 667, 89: 667, 90: 611, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556,
    96: 333, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
    104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556,
    111: 556, 112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556,
    118: 500, 119: 722, 120: 500, 121: 500, 122: 500, 123: 334, 124: 260,
    125: 334, 126: 584
  };
  // En Helvetica, la largeur d'une lettre accentuée est celle de sa lettre de base
  const ACCENT_BASE = {
    'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Æ': 'A',
    'Ç': 'C', 'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E', 'Ì': 'I', 'Í': 'I',
    'Î': 'I', 'Ï': 'I', 'Ñ': 'N', 'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O',
    'Ö': 'O', 'Ø': 'O', 'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U', 'Ý': 'Y',
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'æ': 'a',
    'ç': 'c', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i',
    'î': 'i', 'ï': 'i', 'ñ': 'n', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o',
    'ö': 'o', 'ø': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ý': 'y',
    'ÿ': 'y', 'Œ': 'O', 'œ': 'o', '°': 'o', '€': 'E', '«': '"', '»': '"',
    '\u00A0': ' ', '\u2019': "'", '\u2018': "'", '\u201C': '"', '\u201D': '"',
    '\u2013': '-', '\u2014': '-', '\u2026': '.', '\u2022': '*'
  };
  const SUBST_BASE = { 'œ': 'c' }; // approximation largeur du digramme

  /* --- Encodage WinAnsi (Windows-1252) --------------------------------- */
  const WINANSI_MAP = {
    '\u20AC': 0x80, '\u201A': 0x82, '\u0192': 0x83, '\u201E': 0x84, '\u2026': 0x85,
    '\u2020': 0x86, '\u2021': 0x87, '\u02C6': 0x88, '\u2030': 0x89, '\u0160': 0x8A,
    '\u2039': 0x8B, '\u0152': 0x8C, '\u017D': 0x8E, '\u2018': 0x91, '\u2019': 0x92,
    '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
    '\u02DC': 0x98, '\u2122': 0x99, '\u0161': 0x9A, '\u203A': 0x9B, '\u0153': 0x9C,
    '\u017E': 0x9E, '\u0178': 0x9F
  };

  function toBytes(str) {
    str = String(str == null ? '' : str).normalize('NFC');
    const out = [];
    for (const ch of str) {
      const c = ch.codePointAt(0);
      if (WINANSI_MAP[ch] !== undefined) out.push(WINANSI_MAP[ch]);
      else if (c === 0x09) out.push(32);
      else if (c >= 32 && c <= 0x7E) out.push(c);
      else if (c >= 0xA0 && c <= 0xFF) out.push(c);
      else if (c < 32) out.push(32);
      /* Pictogrammes (emoji des domaines et catégories, flèches, puces…)
         absents de WinAnsi : on les laisse de côté plutôt que d'imprimer un
         « ? » au milieu du rapport. Les lettres non représentables (autres
         alphabets) continuent, elles, d'être signalées par un « ? ». */
      else if (c === 0x200D || (c >= 0xFE00 && c <= 0xFE0F) || c === 0x20E3 ||
               (c >= 0x2100 && c <= 0x214F) || (c >= 0x2190 && c <= 0x2BFF) ||
               (c >= 0x1F000 && c <= 0x1FAFF)) continue;
      else out.push(63); // '?' : caractère non représentable en WinAnsi
    }
    return out;
  }

  function escBytes(bytes) {
    let s = '';
    for (const b of bytes) {
      if (b === 0x28 || b === 0x29 || b === 0x5C) s += '\\' + String.fromCharCode(b);
      else if (b === 0x0A) s += '\\n';
      else if (b >= 32 && b <= 126) s += String.fromCharCode(b);
      else s += '\\' + ('000' + b.toString(8)).slice(-3);
    }
    return s;
  }

  function pdfString(str) { return escBytes(toBytes(str)); }

  /* Traduction des libellés du rapport (langues.js). Un texte qui n'est pas
     un libellé connu — donc une donnée saisie par le technicien — est rendu
     tel quel : le dictionnaire ne touche jamais aux données du terrain. */
  function traduire(str, langue) {
    if (!langue || langue === 'fr' || !global.I18N) return str;
    return global.I18N.traduire(str, langue);
  }

  function charWidth(code) {
    if (W[code]) return W[code];
    if (code === 0xA0) return 278;
    if (code >= 0x21 && code <= 0x7E) return W[code] || 556;
    return 556;
  }

  function measure(str, size, bold) {
    str = String(str == null ? '' : str).normalize('NFC');
    let total = 0;
    for (const ch of str) {
      const base = ACCENT_BASE[ch] || SUBST_BASE[ch] || ch;
      const code = base.codePointAt(0);
      total += charWidth(code);
    }
    const w = (total / 1000) * size;
    return bold ? w * 1.03 : w;
  }

  /** Tronque une chaîne à une largeur donnée, avec des points de suspension. */
  function trunc(str, maxWidth, size, bold) {
    str = String(str == null ? '' : str);
    if (measure(str, size, bold) <= maxWidth) return str;
    const ell = '\u2026';
    let out = '';
    for (const ch of str) {
      if (measure(out + ch + ell, size, bold) > maxWidth) break;
      out += ch;
    }
    return out.replace(/\s+$/, '') + ell;
  }

  function wrap(text, maxWidth, size, bold) {
    const lines = [];
    String(text == null ? '' : text).split(/\r?\n/).forEach(function (para) {
      const words = para.split(/\s+/).filter(function (w) { return w.length; });
      if (!words.length) { lines.push(''); return; }
      let line = '';
      words.forEach(function (word) {
        const test = line ? line + ' ' + word : word;
        if (measure(test, size, bold) <= maxWidth || !line) line = test;
        else { lines.push(line); line = word; }
      });
      lines.push(line);
    });
    return lines;
  }

  function dataUrlToBytes(dataUrl) {
    const i = dataUrl.indexOf(',');
    const b64 = dataUrl.slice(i + 1);
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    return arr;
  }

  /* --- Document -------------------------------------------------------- */
  class PdfDoc {
    constructor(opts) {
      opts = opts || {};
      this.W = opts.width || 595.28;   // A4 portrait
      this.H = opts.height || 841.89;
      this.margin = opts.margin != null ? opts.margin : 34;
      /* Langue du rapport : les libellés connus sont traduits par les packs
         de langue (langues.js). En français, rien n'est modifié. */
      this.langue = opts.langue || 'fr';
      this.pages = [];
      this.newPage();
    }

    newPage() {
      this.page = { ops: [], images: [] };
      this.pages.push(this.page);
      this.y = this.margin;
      return this.page;
    }

    get contentWidth() { return this.W - 2 * this.margin; }

    /** Reste-t-il assez de place ? Sinon nouvelle page. */
    ensure(height) {
      if (this.y + height > this.H - this.margin) { this.newPage(); return true; }
      return false;
    }

    _ty(y) { return this.H - y; }

    /** Rect / remplissage. y = bord supérieur. */
    rect(x, y, w, h, opt) {
      opt = opt || {};
      let op = 'q ';
      if (opt.fill) { op += opt.fill.join(' ') + ' rg '; op += `${f(x)} ${f(this._ty(y + h))} ${f(w)} ${f(h)} re f `; }
      if (opt.stroke) {
        op += `${f(opt.lineWidth || 0.7)} w ${opt.stroke.join(' ')} RG `;
        op += `${f(x)} ${f(this._ty(y + h))} ${f(w)} ${f(h)} re S `;
      }
      this.page.ops.push(op + 'Q');
    }

    line(x1, y1, x2, y2, opt) {
      opt = opt || {};
      const c = opt.color || [0.7, 0.7, 0.7];
      this.page.ops.push(`q ${f(opt.width || 0.7)} w ${c.join(' ')} RG ${f(x1)} ${f(this._ty(y1))} m ${f(x2)} ${f(this._ty(y2))} l S Q`);
    }

    /** Texte sur une ligne. y = ligne de base. */
    text(str, x, y, opt) {
      opt = opt || {};
      str = traduire(str, this.langue);
      const size = opt.size || 9;
      const font = opt.font || 'F1';
      const color = opt.color || [0.1, 0.1, 0.12];
      let px = x;
      if (opt.align === 'right') px = x - measure(str, size, opt.bold);
      else if (opt.align === 'center') px = x - measure(str, size, opt.bold) / 2;
      this.page.ops.push(
        `BT ${color.join(' ')} rg /${font} ${f(size)} Tf 1 0 0 1 ${f(px)} ${f(this._ty(y))} Tm (${pdfString(str)}) Tj ET`
      );
      return size * 1.15;
    }

    /** Paragraphe avec retour à la ligne automatique. Renvoie le nouveau y. */
    paragraph(str, x, y, width, opt) {
      opt = opt || {};
      str = traduire(str, this.langue);          // traduit avant le calcul des lignes
      const size = opt.size || 9;
      const lh = opt.lineHeight || size * 1.35;
      const lines = wrap(str, width, size, opt.bold);
      lines.forEach((l, i) => {
        this.text(l, x, y + i * lh + size, { size: size, font: opt.font, color: opt.color, bold: opt.bold });
      });
      return y + lines.length * lh;
    }

    paragraphHeight(str, width, size, bold) {
      size = size || 9;
      str = traduire(str, this.langue);
      return Math.max(1, wrap(str, width, size, bold).length) * (size * 1.35);
    }

    /** Image JPEG (Uint8Array) à la position x,y (coin haut-gauche), taille w×h. */
    image(jpegBytes, x, y, w, h) {
      const name = 'Im' + (this.page.images.length + 1);
      this.page.images.push({ name: name, bytes: jpegBytes, w: w, h: h });
      this.page.ops.push(`q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(this._ty(y + h))} cm /${name} Do Q`);
    }

    /** Ajoute un texte en pied de page sur toutes les pages (2e passe). */
    addFooters(fn) {
      const total = this.pages.length;
      this.pages.forEach((p, i) => {
        const saved = this.page;
        this.page = p;
        fn(this, i + 1, total);
        this.page = saved;
      });
    }

    /** Sérialise le document. */
    build() {
      const objs = [];
      let n = 0;
      const catalogNum = ++n, pagesNum = ++n;
      const fonts = [
        { num: ++n, base: 'Helvetica' },
        { num: ++n, base: 'Helvetica-Bold' },
        { num: ++n, base: 'Helvetica-Oblique' },
        { num: ++n, base: 'Helvetica-BoldOblique' }
      ];
      const F1 = fonts[0].num, F2 = fonts[1].num, F3 = fonts[2].num, F4 = fonts[3].num;

      const pageInfos = this.pages.map(p => {
        const info = { page: ++n, content: ++n, images: [] };
        p.images.forEach(im => { im.num = ++n; info.images.push(im); });
        return info;
      });

      const put = (num, body) => { objs.push({ num: num, body: body }); };

      put(catalogNum, `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`);
      put(pagesNum, `<< /Type /Pages /Kids [${pageInfos.map(p => p.page + ' 0 R').join(' ')}] /Count ${pageInfos.length} >>`);
      fonts.forEach(fo => put(fo.num, `<< /Type /Font /Subtype /Type1 /BaseFont /${fo.base} /Encoding /WinAnsiEncoding >>`));

      pageInfos.forEach((info, idx) => {
        const src = this.pages[idx];
        const ops = src.ops.join('\n');
        const stream = ops;
        const resImg = info.images.length
          ? '/XObject << ' + info.images.map(im => `/${im.name} ${im.num} 0 R`).join(' ') + ' >>'
          : '';
        put(info.page,
          `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${f(this.W)} ${f(this.H)}] ` +
          `/Resources << /Font << /F1 ${F1} 0 R /F2 ${F2} 0 R /F3 ${F3} 0 R /F4 ${F4} 0 R >> ${resImg} >> ` +
          `/Contents ${info.content} 0 R >>`);
        const sb = toAsciiBytes(stream);
        put(info.content, { stream: sb });
        info.images.forEach(im => {
          const imgDigits = jpegDims(im.bytes);
          put(im.num, {
            stream: im.bytes,
            dict: `<< /Type /XObject /Subtype /Image /Width ${imgDigits.w} /Height ${imgDigits.h} ` +
                  `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>`
          });
        });
      });

      objs.sort((a, b) => a.num - b.num);

      /* Assemblage du fichier */
      const chunks = [];
      let offset = 0;
      const push = (u8) => { chunks.push(u8); offset += u8.length; };
      const pushStr = (s) => push(toAsciiBytes(s));

      pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      const offsets = {};
      objs.forEach(o => {
        offsets[o.num] = offset;
        if (typeof o.body === 'string') {
          pushStr(`${o.num} 0 obj\n${o.body}\nendobj\n`);
        } else if (o.body.dict) {
          pushStr(`${o.num} 0 obj\n${o.body.dict}\nstream\n`);
          push(o.body.stream);
          pushStr('\nendstream\nendobj\n');
        } else {
          const len = o.body.stream.length;
          pushStr(`${o.num} 0 obj\n<< /Length ${len} >>\nstream\n`);
          push(o.body.stream);
          pushStr('\nendstream\nendobj\n');
        }
      });

      const maxNum = objs.length ? objs[objs.length - 1].num : 0;
      const xrefOffset = offset;
      let xref = `xref\n0 ${maxNum + 1}\n0000000000 65535 f \n`;
      for (let i = 1; i <= maxNum; i++) {
        xref += ('0000000000' + (offsets[i] || 0)).slice(-10) + ' 00000 n \n';
      }
      pushStr(xref);
      pushStr(`trailer\n<< /Size ${maxNum + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

      const total = chunks.reduce((a, c) => a + c.length, 0);
      const out = new Uint8Array(total);
      let p = 0;
      chunks.forEach(c => { out.set(c, p); p += c.length; });
      return out;
    }

    blob() { return new Blob([this.build()], { type: 'application/pdf' }); }
  }

  /* ======================================================================
     Aperçu à l'écran — même mise en page, dessinée sur des canvas
     ----------------------------------------------------------------------
     Chrome (et les visionneuses mobiles) refusent d'afficher un PDF dans un
     cadre : on rejoue donc la mise en page sur des canvas. Le rapport est
     ainsi visible dans l'application elle-même, sans visionneuse PDF.
     ====================================================================== */
  class PdfApercu {
    constructor(opts) {
      opts = opts || {};
      this.W = opts.width || 595.28;
      this.H = opts.height || 841.89;
      this.margin = opts.margin != null ? opts.margin : 34;
      this.langue = opts.langue || 'fr';        // comme le PDF : mêmes libellés
      this.pages = [];
      this.newPage();
    }
    newPage() {
      this.page = { ops: [] };
      this.pages.push(this.page);
      this.y = this.margin;
      return this.page;
    }
    get contentWidth() { return this.W - 2 * this.margin; }
    ensure(height) {
      if (this.y + height > this.H - this.margin) { this.newPage(); return true; }
      return false;
    }
    rect(x, y, w, h, opt) {
      opt = opt || {};
      this.page.ops.push({ t: 'rect', x: x, y: y, w: w, h: h, fill: opt.fill, stroke: opt.stroke, lw: opt.lineWidth || 0.7 });
    }
    line(x1, y1, x2, y2, opt) {
      opt = opt || {};
      this.page.ops.push({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, color: opt.color || [0.7, 0.7, 0.7], lw: opt.width || 0.7 });
    }
    text(str, x, y, opt) {
      opt = opt || {};
      str = traduire(str, this.langue);
      const size = opt.size || 9;
      const texte = String(str == null ? '' : str);
      const largeur = measure(texte, size, opt.bold);       // largeur de référence (Helvetica)
      let px = x;
      if (opt.align === 'right') px = x - largeur;
      else if (opt.align === 'center') px = x - largeur / 2;
      this.page.ops.push({ t: 'text', s: texte, x: px, y: y, size: size, w: largeur,
        font: opt.font || 'F1', color: opt.color || [0.1, 0.1, 0.12] });
      return size * 1.15;
    }
    paragraph(str, x, y, width, opt) {
      opt = opt || {};
      str = traduire(str, this.langue);
      const size = opt.size || 9;
      const lh = opt.lineHeight || size * 1.35;
      const lignes = wrap(str, width, size, opt.bold);
      lignes.forEach((l, i) => this.text(l, x, y + i * lh + size, { size: size, font: opt.font, color: opt.color, bold: opt.bold }));
      return y + lignes.length * lh;
    }
    paragraphHeight(str, width, size, bold) {
      size = size || 9;
      str = traduire(str, this.langue);
      return Math.max(1, wrap(str, width, size, bold).length) * (size * 1.35);
    }
    /* Les images arrivent ici en octets JPEG (comme dans le PDF) : on les garde
       en mémoire, elles seront dessinées après chargement par rendrePages(). */
    image(bytes, x, y, w, h) {
      this.page.ops.push({ t: 'img', bytes: bytes, x: x, y: y, w: w, h: h });
    }
    addFooters(fn) {
      const total = this.pages.length;
      this.pages.forEach((p, i) => {
        const saved = this.page;
        this.page = p;
        fn(this, i + 1, total);
        this.page = saved;
      });
    }
    /** Nombre de pages (utile pour l'affichage). */
    get nbPages() { return this.pages.length; }
  }

  function octetsVersDataUrl(bytes) {
    let bin = '';
    const pas = 8192;
    for (let i = 0; i < bytes.length; i += pas) {
      bin += String.fromCharCode.apply(null, bytes.subarray ? bytes.subarray(i, i + pas) : bytes.slice(i, i + pas));
    }
    return 'data:image/jpeg;base64,' + btoa(bin);
  }

  const COULEUR_CSS = (c) => 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
  const POLICE_CSS = (font, size, echelle) => {
    const gras = font === 'F2' || font === 'F4';
    const italique = font === 'F3' || font === 'F4';
    const family = gras
      ? '"Poppins", "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      : '"Open Sans", "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    return (italique ? 'italic ' : '') + (gras ? '700 ' : '400 ') + (size * echelle) + 'px ' + family;
  };

  /** Dessine un document d'aperçu sur des canvas (un par page).
      Les images (logo, photos, signatures) sont chargées d'abord, puis posées :
      chaque opération d'image reçoit sa référence chargée (o.img). */
  function rendrePages(doc, opts) {
    opts = opts || {};
    const echelle = opts.echelle || 1.4;
    const aCharger = [];
    doc.pages.forEach(function (page) {
      page.ops.forEach(function (o) {
        if (o.t === 'img' && !o.img && !o.erreur) aCharger.push(o);
      });
    });

    function charger(op) {
      return new Promise(function (resolve) {
        const img = new Image();
        img.onload = function () { op.img = img; resolve(); };
        img.onerror = function () { op.erreur = true; resolve(); };
        img.src = octetsVersDataUrl(op.bytes);
      });
    }

    return Promise.all(aCharger.map(charger)).then(function () {
      return doc.pages.map(function (page, indice) {
        const c = document.createElement('canvas');
        c.width = Math.round(doc.W * echelle);
        c.height = Math.round(doc.H * echelle);
        c.className = 'apercu-page';
        c.setAttribute('data-page', String(indice + 1));
        const ctx = c.getContext('2d');
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        const E = echelle;
        page.ops.forEach(function (o) {
          if (o.t === 'rect') {
            if (o.fill) { ctx.fillStyle = COULEUR_CSS(o.fill); ctx.fillRect(o.x * E, o.y * E, o.w * E, o.h * E); }
            if (o.stroke) {
              ctx.strokeStyle = COULEUR_CSS(o.stroke);
              ctx.lineWidth = Math.max(0.5, o.lw * E);
              ctx.strokeRect(o.x * E, o.y * E, o.w * E, o.h * E);
            }
          } else if (o.t === 'line') {
            ctx.strokeStyle = COULEUR_CSS(o.color);
            ctx.lineWidth = Math.max(0.5, o.lw * E);
            ctx.beginPath();
            ctx.moveTo(o.x1 * E, o.y1 * E);
            ctx.lineTo(o.x2 * E, o.y2 * E);
            ctx.stroke();
          } else if (o.t === 'text') {
            ctx.fillStyle = COULEUR_CSS(o.color);
            ctx.font = POLICE_CSS(o.font, o.size, E);
            /* La police de l'écran n'a pas forcément les mêmes largeurs que
               l'Helvetica du PDF : on comprime légèrement un texte trop long
               pour qu'il ne soit jamais coupé à l'affichage. */
            const dispo = (doc.W - (doc.margin || 34)) * E - o.x * E - 3;
            const largeur = ctx.measureText ? ctx.measureText(o.s).width : 0;
            let facteur = 1;
            if (largeur > 0 && o.w) {
              /* La police de l'écran (Roboto, DejaVu…) n'a pas les largeurs de
                 l'Helvetica du PDF : on cale chaque texte sur la largeur prévue,
                 bornée pour rester dans la marge. Ainsi, l'écran montre
                 exactement la même mise en page que le fichier PDF. */
              facteur = Math.min(o.w * E / largeur, dispo / largeur);
              facteur = Math.max(0.55, Math.min(facteur, 1.15));
            }
            if (Math.abs(facteur - 1) > 0.01) {
              ctx.save();
              ctx.translate(o.x * E, o.y * E);
              ctx.scale(facteur, facteur);
              ctx.fillText(o.s, 0, 0);
              ctx.restore();
            } else {
              ctx.fillText(o.s, o.x * E, o.y * E);
            }
          } else if (o.t === 'img' && o.img) {
            ctx.drawImage(o.img, o.x * E, o.y * E, o.w * E, o.h * E);
          }
        });
        return c;
      });
    });
  }

  function f(num) {
    const v = Math.round(num * 100) / 100;
    return String(v);
  }

  function toAsciiBytes(s) {
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 0xFF;
    return a;
  }

  /** Lit les dimensions réelles d'un JPEG (marqueur SOF). */
  function jpegDims(b) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      }
      const len = (b[i + 2] << 8) | b[i + 3];
      i += 2 + len;
    }
    return { w: 1000, h: 1000 }; // secours
  }

  global.Pdf = {
    Doc: PdfDoc,
    Apercu: PdfApercu,
    rendrePages: rendrePages,
    octetsVersDataUrl: octetsVersDataUrl,
    measure: measure,
    trunc: trunc,
    wrap: wrap,
    dataUrlToBytes: dataUrlToBytes,
    jpegDims: jpegDims
  };
})(typeof window !== 'undefined' ? window : this);
