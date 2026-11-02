/* =========================================================================
   docx.js — Générateur de documents Word (.docx) sans dépendance
   Écrit un paquet OOXML minimal : titres, paragraphes, tableaux, images.
   Fonctionne entièrement dans le navigateur (ZIP « store » + CRC32).
   ========================================================================= */
(function (global) {
  'use strict';

  /* --- Encodage UTF-8 (sans dépendre de TextEncoder) ------------------ */
  function utf8(texte) {
    texte = String(texte);
    const octets = [];
    for (let i = 0; i < texte.length; i++) {
      let c = texte.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < texte.length) {          // paire de substitution
        const d = texte.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
      }
      if (c < 0x80) octets.push(c);
      else if (c < 0x800) octets.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) octets.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else octets.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(octets);
  }

  /* --- CRC32 ---------------------------------------------------------- */
  const TABLE_CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = TABLE_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* --- ZIP (méthode « store », suffisant et lisible par Word) --------- */
  function zip(fichiers) {
    /* fichiers : [{ nom, donnees: Uint8Array }] */
    const morceaux = [];
    const central = [];
    let offset = 0;

    function u16(n) { return [n & 0xFF, (n >> 8) & 0xFF]; }
    function u32(n) { return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >>> 24) & 0xFF]; }
    /* Date et heure du jour au format DOS (sinon les fichiers s'affichent datés de 1980). */
    const d = new Date();
    const heureDos = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const dateDos = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();

    fichiers.forEach(function (f) {
      const nom = utf8(f.nom);
      const crc = crc32(f.donnees);
      const taille = f.donnees.length;
      const entete = new Uint8Array([].concat(
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(heureDos), u16(dateDos),
        u32(crc), u32(taille), u32(taille), u16(nom.length), u16(0)
      ));
      morceaux.push(entete, nom, f.donnees);
      central.push({ nom: nom, crc: crc, taille: taille, offset: offset });
      offset += entete.length + nom.length + taille;
    });

    const finCentral = [];
    let tailleCentral = 0;
    central.forEach(function (c) {
      const e = new Uint8Array([].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(heureDos), u16(dateDos),
        u32(c.crc), u32(c.taille), u32(c.taille), u16(c.nom.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(c.offset)
      ));
      finCentral.push(e, c.nom);
      tailleCentral += e.length + c.nom.length;
    });

    const fin = new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(tailleCentral), u32(offset), u16(0)
    ));

    const tous = morceaux.concat(finCentral, [fin]);
    let total = 0;
    tous.forEach(function (m) { total += m.length; });
    const out = new Uint8Array(total);
    let p = 0;
    tous.forEach(function (m) { out.set(m, p); p += m.length; });
    return out;
  }

  /* --- Traduction des libellés (langues.js) ---------------------------- */
  /* Un texte qui n'est pas un libellé connu — donc une donnée saisie par le
     technicien — est rendu tel quel. */
  function traduire(txt, langue) {
    if (!langue || langue === 'fr' || !global.I18N) return txt;
    return global.I18N.traduire(txt, langue);
  }

  /* --- Aide XML ------------------------------------------------------- */
  function x(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
      // les caractères de contrôle sont interdits en XML
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
  }
  function dataUrlToBytes(dataUrl) {
    const i = dataUrl.indexOf(',');
    const bin = atob(dataUrl.slice(i + 1));
    const arr = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    return arr;
  }
  const CM = 360000;   // 1 cm en EMU

  /* ===================================================================== */
  class DocWord {
    constructor(opts) {
      opts = opts || {};
      this.corps = [];
      this.images = [];         // { rid, nom, donnees, ext }
      this.ridSuivant = 10;
      this.idDessin = 1;
      /* Langue du document : les libellés connus sont traduits par les packs
         de langue (langues.js). En français, rien n'est modifié. */
      this.langue = opts.langue || 'fr';
      this.demande = '(' + (opts.auteur || 'Application SAV') + ')';
      /* Mise en page du modèle « Compte rendu d'intervention » BFR :
         A4, marges 1,9 cm (côtés) et 2,5 cm (haut/bas), Open Sans 11 pt. */
      this.entete = opts.entete || null;        // dataURL du logo, répété en haut de chaque page
      this.enteteLargeurCm = opts.enteteLargeurCm || 10.2;
      this.pied = opts.pied || [];              // lignes de texte du pied de page
      this.numeroPage = opts.numeroPage !== false;
    }

    /* --- éléments de base --- */
    para(texte, opt) {
      opt = opt || {};
      if (typeof texte === 'string' && texte.indexOf('\n') !== -1) {
        const lignes = texte.split(/\r?\n/);
        const self = this;
        lignes.forEach(function (l, idx) {
          self.para(l, Object.assign({}, opt, { apres: idx === lignes.length - 1 ? (opt.apres == null ? 100 : opt.apres) : 40 }));
        });
        return this;
      }
      const langue = this.langue;
      const props = [];
      const align = { center: 'center', right: 'right', both: 'both' }[opt.align] || 'left';
      if (align !== 'left') props.push(`<w:jc w:val="${align}"/>`);
      if (opt.avecSuivant) props.push('<w:keepNext/><w:keepLines/>');
      props.push(`<w:spacing w:before="${opt.avant || 0}" w:after="${opt.apres == null ? 100 : opt.apres}"/>`);
      if (opt.encadre) {
        props.push('<w:pBdr><w:top w:val="single" w:sz="6" w:color="BFD0E8"/><w:left w:val="single" w:sz="12" w:color="0B3D91"/>' +
          '<w:bottom w:val="single" w:sz="6" w:color="BFD0E8"/><w:right w:val="single" w:sz="6" w:color="BFD0E8"/></w:pBdr>');
        props.push('<w:shd w:val="clear" w:fill="F2F7FD"/>');
      }
      const runs = [];
      const morceaux = Array.isArray(texte) ? texte : [{ t: texte }];
      morceaux.forEach(function (m) {
        if (typeof m === 'string') m = { t: m };
        // propriétés dans l'ordre du schéma Word : rFonts, b, i, color, sz
        const rpr = [];
        const font = m.mono ? 'Consolas' : (m.font || opt.font);
        if (font) rpr.push(`<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`);
        if (m.gras || opt.gras) rpr.push('<w:b/>');
        if (m.italique || opt.italique) rpr.push('<w:i/>');
        const couleur = m.couleur || opt.couleur;
        if (couleur) rpr.push(`<w:color w:val="${couleur}"/>`);
        const taille = m.taille || opt.taille;
        if (taille) rpr.push(`<w:sz w:val="${Math.round(taille * 2)}"/>`);
        runs.push(`<w:r>${rpr.length ? '<w:rPr>' + rpr.join('') + '</w:rPr>' : ''}` +
          (m.saut ? '<w:br/>' : '') +
          `<w:t xml:space="preserve">${x(traduire(m.t || '', langue))}</w:t></w:r>`);
      });
      this.corps.push(`<w:p><w:pPr>${props.join('')}</w:pPr>${runs.join('')}</w:p>`);
      return this;
    }

    titre(texte, niveau) {
      const tailles = { 1: 22, 2: 15, 3: 12.5 };
      const couleurs = { 1: '0B3D91', 2: '0B3D91', 3: '334155' };
      niveau = niveau || 1;
      return this.para(texte, {
        font: 'Poppins',
        gras: true, taille: tailles[niveau] || 12.5, couleur: couleurs[niveau] || '334155',
        avant: niveau === 1 ? 0 : 240, apres: 120
      });
    }

    /** Bandeau de section du modèle : fond cyan BFR, texte blanc en petites
        capitales (style « Titre 1 » du Google Doc de référence). */
    bandeau(texte, couleurFond, droit) {
      texte = traduire(texte, this.langue);
      droit = droit ? traduire(droit, this.langue) : droit;
      const fond = couleurFond || '06BAF2';
      this.corps.push('<w:p><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/>' +
        '<w:pBdr><w:top w:val="single" w:sz="4" w:color="' + fond + '"/>' +
        '<w:left w:val="single" w:sz="4" w:color="' + fond + '"/>' +
        '<w:bottom w:val="single" w:sz="4" w:color="' + fond + '"/>' +
        '<w:right w:val="single" w:sz="4" w:color="' + fond + '"/></w:pBdr>' +
        `<w:shd w:val="clear" w:fill="${fond}"/><w:jc w:val="left"/></w:pPr>` +
        `<w:r><w:rPr><w:rFonts w:ascii="Poppins" w:hAnsi="Poppins" w:cs="Poppins"/><w:b/><w:smallCaps/><w:color w:val="FFFFFF"/><w:sz w:val="26"/></w:rPr>` +
        `<w:t xml:space="preserve">${x(texte)}</w:t></w:r>` +
        (droit ? `<w:r><w:rPr><w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans" w:cs="Open Sans"/><w:color w:val="FFFFFF"/><w:sz w:val="18"/></w:rPr>` +
          `<w:t xml:space="preserve">  ${x(droit)}</w:t></w:r>` : '') + '</w:p>');
      return this;
    }

    /** Titre du document, comme dans le modèle : cyan BFR, gras, centré. */
    grandTitre(texte, taille) {
      return this.para(texte, { font: 'Poppins', gras: true, taille: taille || 30, couleur: '06BAF2', align: 'center', apres: 60 });
    }

    tableau(lignes, opt) {
      opt = opt || {};
      const self = this;
      const langue = this.langue;
      const largeurs = opt.largeurs || null;      // en pourcentage (somme = 100)
      const bordures = opt.sansBordures
        ? '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (c) {
            return `<w:${c} w:val="none" w:sz="0" w:color="auto"/>`;
          }).join('') + '</w:tblBorders>'
        : '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (c) {
            return `<w:${c} w:val="single" w:sz="4" w:color="C9D4E2"/>`;
          }).join('') + '</w:tblBorders>';
      let xml = '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>' + bordures +
        '<w:tblLayout w:type="fixed"/></w:tblPr>';
      if (largeurs) {
        xml += '<w:tblGrid>' + largeurs.map(function (p) {
          return `<w:gridCol w:w="${Math.round(p * 90)}"/>`;
        }).join('') + '</w:tblGrid>';
      }
      lignes.forEach(function (ligne, iL) {
        // une ligne n'est jamais coupée entre deux pages (photo et sa légende restent ensemble)
        xml += '<w:tr><w:trPr><w:cantSplit/></w:trPr>';
        (Array.isArray(ligne) ? ligne : [ligne]).forEach(function (cellule, iC) {
          const c = (cellule && (cellule.texte !== undefined || cellule.image !== undefined)) ? cellule : { texte: cellule };
          let contenu = '';
          if (c.image) {
            try {
              const im = self.ajouterImage(c.image);
              im.place = true;   // sans cela l'image n'est pas déclarée dans le .docx (case vide)
              const cmW = c.imageCm || 1.5;
              const cmH = cmW * (im.ratio || 1);
              const CM = 360000;
              contenu = `<w:p><w:pPr><w:spacing w:before="20" w:after="20"/>${c.align && c.align !== 'left' ? `<w:jc w:val="${c.align}"/>` : '<w:jc w:val="center"/>'}</w:pPr><w:r>` +
                self.dessin(im, Math.round(cmW * CM), Math.round(cmH * CM), im.nom, im.idDessin, im.rid) +
                '</w:r></w:p>';
              if (c.legende) {
                contenu += '<w:p><w:pPr><w:spacing w:before="0" w:after="60"/><w:jc w:val="center"/></w:pPr>' +
                  '<w:r><w:rPr><w:i/><w:color w:val="64748B"/><w:sz w:val="18"/></w:rPr>' +
                  `<w:t xml:space="preserve">${x(traduire(c.legende, langue))}</w:t></w:r></w:p>`;
              }
            } catch (_) {}
          }
          if (!contenu) {
            /* Une cellule contient soit du texte (multi-lignes), soit des « runs »
               (tableau d'objets { t, gras, taille, couleur }) comme un paragraphe.
               Les propriétés du run complètent celles de la cellule ; elles sont écrites
               dans l'ordre imposé par Word (b, i, color, sz), sans doublon. */
            const paragraphes = Array.isArray(c.texte) ? [c.texte] : String(c.texte == null ? '' : c.texte).split('\n');
            contenu = paragraphes.map(function (p) {
              const morceaux = Array.isArray(p) ? p : [{ t: p }];
              const runsCellule = morceaux.map(function (m) {
                if (typeof m === 'string') m = { t: m };
                const r2 = [];
                if (m.gras || c.gras || (iL === 0 && opt.enteteGras)) r2.push('<w:b/>');
                if (m.italique) r2.push('<w:i/>');
                const coul = m.couleur || c.couleur;
                if (coul) r2.push(`<w:color w:val="${coul}"/>`);
                const t2 = m.taille || c.taille;
                if (t2) r2.push(`<w:sz w:val="${Math.round(t2 * 2)}"/>`);
                return `<w:r>${r2.length ? '<w:rPr>' + r2.join('') + '</w:rPr>' : ''}` +
                  (m.saut ? '<w:br/>' : '') + `<w:t xml:space="preserve">${x(traduire(m.t || '', langue))}</w:t></w:r>`;
              }).join('');
              return `<w:p><w:pPr><w:spacing w:before="20" w:after="20"/>${c.align && c.align !== 'left' ? `<w:jc w:val="${c.align}"/>` : ''}</w:pPr>${runsCellule}</w:p>`;
            }).join('');
          }
          const fond = (c.fond || (iL === 0 && opt.enteteFond)) ? `<w:shd w:val="clear" w:fill="${c.fond || opt.enteteFond}"/>` : '';
          xml += `<w:tc><w:tcPr>${largeurs ? `<w:tcW w:w="${Math.round(largeurs[iC] * 90)}" w:type="dxa"/>` : ''}<w:vAlign w:val="${c.vAlign || 'center'}"/>${fond}</w:tcPr>${contenu}</w:tc>`;
        });
        xml += '</w:tr>';
      });
      xml += '</w:tbl>';
      this.corps.push(xml);
      // petit espace après le tableau
      this.para('', { taille: 4, apres: 0 });
      return this;
    }

    /** XML du dessin (image en ligne) — réutilisé par le corps et l'en-tête. */
    dessin(im, cx, cy, nom, idDessin, rid) {
      return '<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
        `<wp:extent cx="${cx}" cy="${cy}"/>` +
        `<wp:docPr id="${idDessin}" name="Image ${idDessin}"/>` +
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<pic:pic><pic:nvPicPr>' +
        `<pic:cNvPr id="${idDessin}" name="${nom}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
        '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>';
    }

    /** Enregistre une image (JPEG ou PNG) et renvoie sa fiche, sans la placer. */
    ajouterImage(dataUrl) {
      const estPng = /^data:image\/png/i.test(dataUrl);
      const ext = estPng ? 'png' : 'jpg';
      const donnees = dataUrlToBytes(dataUrl);
      const dims = estPng ? dimsPng(donnees) : dimsJpeg(donnees);
      const rid = 'rId' + (this.ridSuivant++);
      const nom = 'image' + this.images.length + '.' + ext;
      const im = { rid: rid, nom: nom, donnees: donnees, ext: ext, cible: 'media/' + nom,
                   w: dims.w, h: dims.h, ratio: dims.h / dims.w, idDessin: this.idDessin++, place: false };
      this.images.push(im);
      return im;
    }

    /** Ajoute une image (JPEG ou PNG en dataURL) centrée, largeur max en cm. */
    image(dataUrl, largeurCm, opt) {
      opt = opt || {};
      const im = this.ajouterImage(dataUrl);
      im.place = true;

      const maxCm = largeurCm || 15;
      let cm = maxCm;
      let cmH = cm * im.ratio;
      const maxH = opt.hauteurMaxCm || 11;
      if (cmH > maxH) { cmH = maxH; cm = cmH / im.ratio; }

      this.corps.push(`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="${opt.legende ? 0 : 120}"/></w:pPr>` +
        '<w:r>' + this.dessin(im, Math.round(cm * CM), Math.round(cmH * CM), im.nom, im.idDessin, im.rid) + '</w:r></w:p>');
      if (opt.legende) this.para(opt.legende, { font: 'Open Sans', taille: 9.5, couleur: '64748B', align: 'center', apres: 160, italique: true });
      return this;
    }

    /** Logo en haut de page, hors du flux (l'en-tête se répète à chaque page). */
    logoEntete(dataUrl) { this.entete = dataUrl; return this; }

    sautDePage() {
      this.corps.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
      return this;
    }

    /* --- styles du document (police du modèle) --- */
    stylesXml() {
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        '<w:docDefaults><w:rPrDefault><w:rPr>' +
        '<w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans" w:cs="Open Sans" w:eastAsia="Open Sans"/>' +
        '<w:sz w:val="22"/><w:szCs w:val="22"/>' +
        '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr>' +
        '<w:spacing w:after="100" w:line="259" w:lineRule="auto"/>' +
        '</w:pPr></w:pPrDefault></w:docDefaults>' +
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>' +
        '<w:qFormat/></w:style>' +
        '<w:style w:type="paragraph" w:styleId="Bandeau"><w:name w:val="Bandeau"/>' +
        '<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr>' +
        '<w:rPr><w:rFonts w:ascii="Poppins" w:hAnsi="Poppins" w:cs="Poppins"/><w:b/><w:smallCaps/><w:color w:val="FFFFFF"/><w:sz w:val="26"/></w:rPr></w:style>' +
        '</w:styles>';
    }

    /* --- en-tête et pied de page (comme le modèle) --- */
    enteteXml() {
      if (!this.entete && !this.enteteImage) return null;
      const im = this.enteteImage;
      if (!im) return null;
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
        'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
        '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>' +
        '<w:r>' + this.dessin(im, Math.round(this.enteteLargeurCm * 360000), Math.round(this.enteteLargeurCm * im.ratio * 360000), im.nom, im.idDessin, im.rid) + '</w:r>' +
        '</w:p></w:hdr>';
    }

    piedXml() {
      const lignes = (this.pied || []).filter(Boolean);
      if (!lignes.length && this.numeroPage === false) return null;
      const paragraphes = lignes.map((l, i) => '<w:p><w:pPr><w:spacing w:before="0" w:after="' + (i === lignes.length - 1 ? 0 : 20) + '"/><w:jc w:val="center"/></w:pPr>' +
        `<w:r><w:rPr><w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans" w:cs="Open Sans"/><w:color w:val="808080"/><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve">${x(traduire(l, this.langue))}</w:t></w:r></w:p>`).join('');
      const pageNum = this.numeroPage
        ? '<w:p><w:pPr><w:spacing w:before="40" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans" w:cs="Open Sans"/><w:color w:val="808080"/><w:sz w:val="17"/></w:rPr>' +
          '<w:t xml:space="preserve">Page </w:t></w:r>' +
          '<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans" w:cs="Open Sans"/><w:color w:val="808080"/><w:sz w:val="17"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>' +
          '<w:r><w:rPr><w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans" w:cs="Open Sans"/><w:color w:val="808080"/><w:sz w:val="17"/></w:rPr><w:t xml:space="preserve"> / </w:t></w:r>' +
          '<w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:rFonts w:ascii="Open Sans" w:hAnsi="Open Sans" w:cs="Open Sans"/><w:color w:val="808080"/><w:sz w:val="17"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>' +
          '</w:p>'
        : '';
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        paragraphes + pageNum + '</w:ftr>';
    }

    /* --- sérialisation --- */
    build() {
      const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
        'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
        'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

      /* En-tête : le logo du modèle est enregistré comme une image à part. */
      if (this.entete && !this.enteteImage) {
        this.enteteImage = this.ajouterImage(this.entete);
        this.enteteImage.entete = true;
      }
      const hdr = this.enteteImage ? this.enteteXml() : null;
      const ftr = this.piedXml();

      const refs = [];
      if (hdr) refs.push('<w:headerReference w:type="default" r:id="rIdHdr"/>');
      if (ftr) refs.push('<w:footerReference w:type="default" r:id="rIdFtr"/>');

      const document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        `<w:document ${NS}><w:body>${this.corps.join('')}` +
        '<w:sectPr>' + refs.join('') +
        '<w:pgSz w:w="11906" w:h="16838"/>' +
        '<w:pgMar w:top="1418" w:right="1077" w:bottom="1418" w:left="1077" w:header="709" w:footer="113" w:gutter="0"/>' +
        '</w:sectPr></w:body></w:document>';

      const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        (hdr ? '<Relationship Id="rIdHdr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' : '') +
        (ftr ? '<Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' : '') +
        this.images.filter(function (im) { return im.place || im.entete; }).map(function (im) {
          return `<Relationship Id="${im.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${im.cible}"/>`;
        }).join('') + '</Relationships>';

      /* Relations de l'en-tête : l'image du logo y est rattachée. */
      const relsEntete = hdr ? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="${this.enteteImage.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${this.enteteImage.cible}"/>` +
        '</Relationships>' : null;

      const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="jpg" ContentType="image/jpeg"/>' +
        '<Default Extension="png" ContentType="image/png"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        (hdr ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' : '') +
        (ftr ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' : '') +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        '</Types>';

      const racines = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="word/styles.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
        '</Relationships>';

      const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
      const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        `<dc:title>${x(this.titreDoc || 'Rapport')}</dc:title>` +
        `<dc:creator>${x(this.demande.replace(/[()]/g, ''))}</dc:creator>` +
        `<cp:lastModifiedBy>${x(this.demande.replace(/[()]/g, ''))}</cp:lastModifiedBy>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${date}</dcterms:created>` +
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${date}</dcterms:modified>` +
        '</cp:coreProperties>';

      const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
        '<Application>Application SAV</Application></Properties>';

        const fichiers = [
        { nom: '[Content_Types].xml', donnees: utf8(contentTypes) },
        { nom: '_rels/.rels', donnees: utf8(racines) },
        { nom: 'docProps/core.xml', donnees: utf8(core) },
        { nom: 'docProps/app.xml', donnees: utf8(app) },
        { nom: 'word/document.xml', donnees: utf8(document) },
        { nom: 'word/_rels/document.xml.rels', donnees: utf8(rels) },
        { nom: 'word/styles.xml', donnees: utf8(this.stylesXml()) }
      ];
      if (hdr) {
        fichiers.push({ nom: 'word/header1.xml', donnees: utf8(hdr) });
        fichiers.push({ nom: 'word/_rels/header1.xml.rels', donnees: utf8(relsEntete) });
      }
      if (ftr) fichiers.push({ nom: 'word/footer1.xml', donnees: utf8(ftr) });
      this.images.forEach(function (im) {
        fichiers.push({ nom: 'word/media/' + im.nom, donnees: im.donnees });
      });
      return zip(fichiers);
    }

    blob() {
      return new Blob([this.build()], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }
  }

  /* --- Lecture des dimensions ---------------------------------------- */
  function dimsJpeg(b) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
    return { w: 1000, h: 750 };
  }
  function dimsPng(b) {
    return { w: (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19], h: (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23] };
  }

  global.Docx = { Doc: DocWord, dataUrlToBytes: dataUrlToBytes, crc32: crc32, dimsJpeg: dimsJpeg, dimsPng: dimsPng, utf8: utf8, zip: zip };
})(window);
