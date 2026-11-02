/* =========================================================================
   import-tasks.js — Import & Modèles de tâches de chantier (100% hors-ligne)
   Supporte :
     - Copier-coller de texte libre (mails, notes, listes à puces, phases)
     - Fichiers Excel (.xlsx) sans dépendance externe (ZIP + Deflate intégrés)
     - Fichiers CSV (séparateur ; , ou tabulation, UTF-8 ou Windows-1252)
     - Fichiers JSON (export complet d'un chantier préparé au bureau)
     - Modèles métiers BFR Systems prêts à l'emploi
   ========================================================================= */
(function (global) {
  'use strict';

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function norm(txt) {
    return String(txt == null ? '' : txt)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '');
  }

  function devinerDomaine(txt) {
    const u = norm(txt);
    if (!u) return '';
    if (u.indexOf('ELEC') >= 0 || u.indexOf('CABL') >= 0 || u.indexOf('ARMOIRE') >= 0 || u.indexOf('VARIATEUR') >= 0 || u.indexOf('CAPTEUR') >= 0 || u.indexOf('400V') >= 0 || u.indexOf('24V') >= 0) return 'ELECTRIQUE';
    if (u.indexOf('AUTO') >= 0 || u.indexOf('API') >= 0 || u.indexOf('PLC') >= 0 || u.indexOf('IHM') >= 0 || u.indexOf('ROBOT') >= 0 || u.indexOf('PROGRAM') >= 0 || u.indexOf('RESEAU') >= 0) return 'AUTOMATISME';
    if (u.indexOf('MECA') >= 0 || u.indexOf('CHASSIS') >= 0 || u.indexOf('CONVOY') >= 0 || u.indexOf('ALIGN') >= 0 || u.indexOf('ANCRAGE') >= 0 || u.indexOf('CARTER') >= 0 || u.indexOf('PNEUMA') >= 0) return 'MECANIQUE';
    return '';
  }

  function normaliserDomaine(val, fallbackTexte) {
    const u = norm(val);
    if (u.indexOf('MECA') >= 0) return 'MECANIQUE';
    if (u.indexOf('ELEC') >= 0) return 'ELECTRIQUE';
    if (u.indexOf('AUTO') >= 0) return 'AUTOMATISME';
    return devinerDomaine(fallbackTexte || '');
  }

  function normaliserStatut(val) {
    const u = norm(val);
    if (!u) return 'afaire';
    if (u === 'X' || u === 'OK' || u === 'OUI' || u === '100' || u.indexOf('FAIT') >= 0 || u.indexOf('TERM') >= 0 || u.indexOf('REALIS') >= 0 || u.indexOf('DONE') >= 0) return 'fait';
    if (u.indexOf('BLOQ') >= 0 || u.indexOf('RESERVE') >= 0 || u.indexOf('PROBLEME') >= 0 || u.indexOf('ATTENTE') >= 0 || u === 'KO') return 'bloque';
    if (u.indexOf('COURS') >= 0 || u.indexOf('WIP') >= 0) return 'encours';
    return 'afaire';
  }

  function normaliserPoids(val) {
    const s = String(val == null ? '' : val).trim();
    if (!s) return 1;
    if (/3|gros|lourd|fort|majeur|eleve|élevé/i.test(s)) return 3;
    if (/2|moyen|important/i.test(s)) return 2;
    return 1;
  }

  /* ===================== 1. Analyse de texte libre ====================== */
  function analyserTexte(texte) {
    const lignes = String(texte || '').replace(/\r/g, '').split('\n');
    const phasesMap = new Map();
    const phases = [];
    const taches = [];

    function obtenirPhase(nom) {
      const propre = String(nom || 'Général').trim() || 'Général';
      const cle = norm(propre) || 'GENERAL';
      if (phasesMap.has(cle)) return phasesMap.get(cle);
      const p = { id: uid('ph'), nom: propre };
      phasesMap.set(cle, p);
      phases.push(p);
      return p;
    }

    let phaseCourante = null;

    lignes.forEach(function (brut) {
      let l = brut.trim();
      if (!l) return;

      // Détection d'un titre de phase : "# Phase...", "## ...", "PHASE 1 - ...", ou ligne finissant par ":" sans puce
      const estMarkdownTitre = /^#{1,4}\s+(.+)$/.exec(l);
      const estMotPhase = /^(?:phase|lot|zone|etape|étape)\s*\d*\s*[:\-–]\s*(.+)$/i.exec(l);
      const aPuce = /^(?:[-*•◦▪▸►→]|\[[ xX✓✔!~\-]\]|\d+[.)]\s)/.test(l);

      if (estMarkdownTitre) {
        phaseCourante = obtenirPhase(estMarkdownTitre[1].replace(/:$/, '').trim());
        return;
      }
      if (!aPuce && estMotPhase && l.length < 90) {
        phaseCourante = obtenirPhase(l.replace(/:$/, '').trim());
        return;
      }
      if (!aPuce && /:$/.test(l) && l.length <= 75) {
        phaseCourante = obtenirPhase(l.slice(0, -1).trim());
        return;
      }

      // Extraction statut éventuel en début de ligne : [x], [ ], [!], [~]
      let statut = 'afaire';
      const mCase = /^(?:[-*•]\s*)?\[([ xX✓✔!~\-])\]\s*(.+)$/.exec(l);
      if (mCase) {
        const c = mCase[1];
        if (/[xX✓✔]/.test(c)) statut = 'fait';
        else if (c === '!') statut = 'bloque';
        else if (c === '~' || c === '-') statut = 'encours';
        l = mCase[2].trim();
      } else if (/^[✓✔✅]\s*/.test(l)) {
        statut = 'fait';
        l = l.replace(/^[✓✔✅]\s*/, '').trim();
      } else if (/^[🛑⚠❌]\s*/.test(l)) {
        statut = 'bloque';
        l = l.replace(/^[🛑⚠❌]\s*/, '').trim();
      } else {
        l = l.replace(/^(?:[-*•◦▪▸►→]+|\d+[.)])\s*/, '').trim();
      }

      if (!l) return;

      // Tag domaine optionnel entre crochets : [Méca], [Élec], [Auto]
      let domaine = '';
      const mDom = /^\[(m[eé]ca(?:nique)?|[eé]lec(?:trique)?|auto(?:matisme)?)\]\s*(.+)$/i.exec(l);
      if (mDom) {
        domaine = normaliserDomaine(mDom[1], mDom[2]);
        l = mDom[2].trim();
      } else {
        domaine = devinerDomaine(l);
      }

      // Pondération optionnelle : [x2], [x3], (x2), (x3), ×2, ×3 en début ou fin de ligne
      let poids = 1;
      const mPoidsDebut = /^[\[(]\s*[x×*]\s*([123])\s*[\])]\s*(.+)$/i.exec(l);
      const mPoidsFin = /^(.+?)\s*[\[(]\s*[x×*]\s*([123])\s*[\])]$/i.exec(l);
      if (mPoidsDebut) {
        poids = Number(mPoidsDebut[1]) || 1;
        l = mPoidsDebut[2].trim();
      } else if (mPoidsFin) {
        poids = Number(mPoidsFin[2]) || 1;
        l = mPoidsFin[1].trim();
      }

      const ph = phaseCourante || obtenirPhase('Tâches du chantier');
      taches.push({
        id: uid('tc'),
        phaseId: ph.id,
        titre: l,
        domaine: domaine,
        poids: poids,
        statut: statut,
        progression: statut === 'fait' ? 100 : (statut === 'encours' ? 50 : 0),
        faitLe: '',
        commentaire: '',
        blocage: '',
        blocageOrigine: statut === 'bloque' ? 'CLIENT' : '',
        bloqueDepuis: '',
        blocageDuree: '',
        historiqueBlocages: [],
        photos: []
      });
    });

    return { phases: phases, taches: taches };
  }

  /* ===================== 2. Analyse CSV ================================= */
  function decouperCSV(texte) {
    texte = String(texte || '').replace(/^\uFEFF/, '');
    const premLigne = texte.split(/\r?\n/)[0] || '';
    const nbPointVirgule = (premLigne.match(/;/g) || []).length;
    const nbTab = (premLigne.match(/\t/g) || []).length;
    const nbVirgule = (premLigne.match(/,/g) || []).length;
    const sep = nbTab > nbPointVirgule && nbTab > nbVirgule ? '\t' : (nbPointVirgule >= nbVirgule ? ';' : ',');

    const lignes = [];
    let ligne = [], champ = '', dansGuillemets = false;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (dansGuillemets) {
        if (c === '"') {
          if (texte[i + 1] === '"') { champ += '"'; i++; }
          else dansGuillemets = false;
        } else {
          champ += c;
        }
      } else if (c === '"') {
        dansGuillemets = true;
      } else if (c === sep) {
        ligne.push(champ.trim());
        champ = '';
      } else if (c === '\r') {
        continue;
      } else if (c === '\n') {
        ligne.push(champ.trim());
        if (ligne.some(x => x !== '')) lignes.push(ligne);
        ligne = [];
        champ = '';
      } else {
        champ += c;
      }
    }
    ligne.push(champ.trim());
    if (ligne.some(x => x !== '')) lignes.push(ligne);
    return lignes;
  }

  function depuisLignesTableur(lignes) {
    if (!Array.isArray(lignes) || !lignes.length) return { phases: [], taches: [] };

    const COLONNES = {
      phase: ['PHASE', 'PHASES', 'LOT', 'LOTS', 'ZONE', 'ZONES', 'CATEGORIE', 'SECTION', 'ETAPE', 'MACHINE'],
      titre: ['TACHE', 'TACHES', 'INTITULE', 'DESIGNATION', 'DESCRIPTION', 'LIBELLE', 'ACTION', 'TRAVAUX', 'POINT', 'ELEMENT'],
      domaine: ['DOMAINE', 'METIER', 'SPECIALITE', 'TYPE'],
      poids: ['POIDS', 'COEFF', 'COEFFICIENT', 'IMPORTANCE', 'CHARGE'],
      statut: ['STATUT', 'ETAT', 'AVANCEMENT', 'FAIT', 'REALISE'],
      commentaire: ['COMMENTAIRE', 'COMMENTAIRES', 'NOTE', 'NOTES', 'OBSERVATION', 'OBSERVATIONS', 'REMARQUE'],
      blocage: ['BLOCAGE', 'RESERVE', 'RESERVES', 'POINTBLOQUANT', 'ALERTE']
    };

    let mapCol = { phase: 0, titre: 1, domaine: 2, poids: -1, statut: 3, commentaire: 4, blocage: 5 };
    let idxEntete = -1;

    for (let k = 0; k < Math.min(lignes.length, 8); k++) {
      const cellules = (lignes[k] || []).map(norm);
      const trouve = {};
      Object.keys(COLONNES).forEach(cle => {
        trouve[cle] = cellules.findIndex(c => COLONNES[cle].indexOf(c) >= 0);
      });
      if (trouve.titre >= 0) {
        mapCol = trouve;
        idxEntete = k;
        break;
      }
    }

    // Si tableau à 1 seule colonne sans en-tête reconnu -> déléguer à l'analyseur texte
    if (idxEntete < 0 && lignes.every(r => (r || []).filter(Boolean).length <= 1)) {
      return analyserTexte(lignes.map(r => (r && r[0]) || '').join('\n'));
    }

    const phasesMap = new Map();
    const phases = [];
    const taches = [];
    let dernierePhaseNom = 'Tâches du chantier';

    function obtenirPhase(nom) {
      const propre = String(nom || 'Tâches du chantier').trim() || 'Tâches du chantier';
      const cle = norm(propre) || 'GENERAL';
      if (phasesMap.has(cle)) return phasesMap.get(cle);
      const p = { id: uid('ph'), nom: propre };
      phasesMap.set(cle, p);
      phases.push(p);
      return p;
    }

    const lireCol = (row, idx) => (idx != null && idx >= 0 && row[idx] != null) ? String(row[idx]).trim() : '';

    lignes.forEach(function (row, idx) {
      if (idx <= idxEntete || !Array.isArray(row)) return;
      const nonVides = row.filter(c => String(c == null ? '' : c).trim() !== '');
      if (!nonVides.length) return;

      let nomPhase = lireCol(row, mapCol.phase);
      let titre = lireCol(row, mapCol.titre);

      // Si une ligne n'a que la 1re colonne remplie alors que d'autres lignes ont 2+ colonnes, c'est un sous-titre de phase
      if (!titre && nomPhase && nonVides.length === 1) {
        dernierePhaseNom = nomPhase.replace(/:$/, '').trim();
        obtenirPhase(dernierePhaseNom);
        return;
      }
      if (!titre && idxEntete < 0 && row.length === 1) {
        titre = nomPhase;
        nomPhase = dernierePhaseNom;
      }
      if (!titre) return;

      if (nomPhase) dernierePhaseNom = nomPhase;
      const ph = obtenirPhase(dernierePhaseNom);
      const statut = normaliserStatut(lireCol(row, mapCol.statut));
      const dom = normaliserDomaine(lireCol(row, mapCol.domaine), titre);
      const poids = normaliserPoids(lireCol(row, mapCol.poids));
      const comm = lireCol(row, mapCol.commentaire);
      const bloc = lireCol(row, mapCol.blocage);
      const stFinal = bloc && statut === 'afaire' ? 'bloque' : statut;

      taches.push({
        id: uid('tc'),
        phaseId: ph.id,
        titre: titre,
        domaine: dom,
        poids: poids,
        statut: stFinal,
        progression: stFinal === 'fait' ? 100 : (stFinal === 'encours' ? 50 : 0),
        faitLe: '',
        commentaire: comm,
        blocage: bloc,
        blocageOrigine: stFinal === 'bloque' ? 'CLIENT' : '',
        bloqueDepuis: '',
        blocageDuree: '',
        historiqueBlocages: [],
        photos: []
      });
    });

    return { phases: phases, taches: taches };
  }

  /* ===================== 3. Lecteur .xlsx sans dépendance =============== */
  const Zip = {
    u16: (b, i) => b[i] | (b[i + 1] << 8),
    u32: (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0,
    entrees: function (b) {
      let fin = -1;
      for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
        if (this.u32(b, i) === 0x06054b50) { fin = i; break; }
      }
      if (fin < 0) throw new Error('Archive ZIP / Excel incomplète');
      const nb = this.u16(b, fin + 10);
      let p = this.u32(b, fin + 16);
      const out = {};
      const dec = new TextDecoder('utf-8');
      for (let k = 0; k < nb; k++) {
        if (this.u32(b, p) !== 0x02014b50) throw new Error('Répertoire ZIP invalide');
        const methode = this.u16(b, p + 10);
        const taille = this.u32(b, p + 20), tailleBrute = this.u32(b, p + 24);
        const lNom = this.u16(b, p + 28), lExtra = this.u16(b, p + 30), lCom = this.u16(b, p + 32);
        const local = this.u32(b, p + 42);
        const nom = dec.decode(b.subarray(p + 46, p + 46 + lNom));
        const debut = local + 30 + this.u16(b, local + 26) + this.u16(b, local + 28);
        out[nom] = { methode: methode, donnees: b.subarray(debut, debut + taille), taille: tailleBrute };
        p += 46 + lNom + lExtra + lCom;
      }
      return out;
    },
    extraire: async function (e) {
      if (e.methode === 0) return e.donnees;
      if (e.methode !== 8) throw new Error('Compression ZIP non prise en charge');
      if (typeof DecompressionStream === 'function') {
        try {
          const flux = new Blob([e.donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          return new Uint8Array(await new Response(flux).arrayBuffer());
        } catch (err) { /* repli inflate JS */ }
      }
      return inflate(e.donnees, e.taille);
    }
  };

  const BASE_LONG = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const BITS_LONG = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const BASE_DIST = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const BITS_DIST = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDRE_CL = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function arbre() { return { table: new Uint16Array(16), trans: new Uint16Array(288) }; }
  function construire(t, longueurs, debut, n) {
    t.table.fill(0);
    for (let i = 0; i < n; i++) t.table[longueurs[debut + i]]++;
    t.table[0] = 0;
    const offs = new Uint16Array(16);
    for (let i = 0, somme = 0; i < 16; i++) { offs[i] = somme; somme += t.table[i]; }
    for (let i = 0; i < n; i++) if (longueurs[debut + i]) t.trans[offs[longueurs[debut + i]]++] = i;
  }
  function inflate(src, tailleAttendue) {
    const d = { src: src, i: 0, tag: 0, nb: 0 };
    let out = new Uint8Array(Math.max(tailleAttendue || 0, 1024)), o = 0;
    const place = (n) => {
      if (o + n <= out.length) return;
      const plus = new Uint8Array(Math.max(out.length * 2, o + n));
      plus.set(out.subarray(0, o)); out = plus;
    };
    const bit = () => {
      if (!d.nb--) { if (d.i >= d.src.length) throw new Error('Données compressées tronquées'); d.tag = d.src[d.i++]; d.nb = 7; }
      const b = d.tag & 1; d.tag >>>= 1; return b;
    };
    const bits = (n, base) => { let v = 0; for (let k = 0; k < n; k++) v |= bit() << k; return v + base; };
    const symbole = (t) => {
      let somme = 0, cur = 0, len = 0;
      do { cur = 2 * cur + bit(); len++; if (len > 15) throw new Error('Code deflate invalide'); somme += t.table[len]; cur -= t.table[len]; } while (cur >= 0);
      return t.trans[somme + cur];
    };
    const fixeL = arbre(), fixeD = arbre();
    (function () {
      const l = new Uint8Array(288);
      l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
      construire(fixeL, l, 0, 288);
      const dd = new Uint8Array(30); dd.fill(5);
      construire(fixeD, dd, 0, 30);
    })();
    const bloc = (tl, td) => {
      for (;;) {
        let s = symbole(tl);
        if (s === 256) return;
        if (s < 256) { place(1); out[o++] = s; continue; }
        s -= 257;
        const long = bits(BITS_LONG[s], BASE_LONG[s]);
        const ds = symbole(td);
        const dist = bits(BITS_DIST[ds], BASE_DIST[ds]);
        place(long);
        for (let k = 0; k < long; k++, o++) out[o] = out[o - dist];
      }
    };
    let dernier;
    do {
      dernier = bit();
      const type = bits(2, 0);
      if (type === 0) {
        d.nb = 0;
        const len = d.src[d.i] | (d.src[d.i + 1] << 8);
        d.i += 4;
        place(len); out.set(d.src.subarray(d.i, d.i + len), o); o += len; d.i += len;
      } else if (type === 1) {
        bloc(fixeL, fixeD);
      } else if (type === 2) {
        const hlit = bits(5, 257), hdist = bits(5, 1), hclen = bits(4, 4);
        const longueurs = new Uint8Array(288 + 32);
        for (let k = 0; k < hclen; k++) longueurs[ORDRE_CL[k]] = bits(3, 0);
        const tcl = arbre(); construire(tcl, longueurs, 0, 19);
        longueurs.fill(0, 0, 19);
        for (let n = 0; n < hlit + hdist;) {
          const sym = symbole(tcl);
          if (sym < 16) { longueurs[n++] = sym; continue; }
          let rep, val = 0;
          if (sym === 16) { val = longueurs[n - 1]; rep = bits(2, 3); }
          else if (sym === 17) rep = bits(3, 3);
          else rep = bits(7, 11);
          while (rep--) longueurs[n++] = val;
        }
        const tl = arbre(), td = arbre();
        construire(tl, longueurs, 0, hlit); construire(td, longueurs, hlit, hdist);
        bloc(tl, td);
      } else throw new Error('Bloc deflate invalide');
    } while (!dernier);
    return out.subarray(0, o);
  }

  async function lireXlsx(octets) {
    const arch = Zip.entrees(octets);
    const dec = new TextDecoder('utf-8');
    const texte = async (chemin) => arch[chemin] ? dec.decode(await Zip.extraire(arch[chemin])) : '';
    const xml = (str) => new DOMParser().parseFromString(str, 'application/xml');
    const tous = (noeud, local) => Array.from(noeud.getElementsByTagNameNS('*', local));
    const enfants = (noeud, local) => Array.from(noeud.childNodes || []).filter(n => n.localName === local);

    const wb = await texte('xl/workbook.xml');
    if (!wb) throw new Error('Ce fichier n\'est pas un classeur Excel (.xlsx) valide.');
    const feuille1 = tous(xml(wb), 'sheet')[0];
    let cheminFeuille = 'xl/worksheets/sheet1.xml';
    const relsTxt = await texte('xl/_rels/workbook.xml.rels');
    if (relsTxt && feuille1) {
      const rid = feuille1.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || feuille1.getAttribute('r:id');
      tous(xml(relsTxt), 'Relationship').forEach(r => {
        if (r.getAttribute('Id') === rid) {
          let t = r.getAttribute('Target') || '';
          cheminFeuille = t.startsWith('/') ? t.slice(1) : ('xl/' + t.replace(/^\.\//, ''));
        }
      });
    }

    const partages = [];
    const ss = await texte('xl/sharedStrings.xml');
    if (ss) {
      tous(xml(ss), 'si').forEach(si => {
        let t = '';
        enfants(si, 't').forEach(x => { t += x.textContent; });
        enfants(si, 'r').forEach(r => enfants(r, 't').forEach(x => { t += x.textContent; }));
        partages.push(t);
      });
    }

    const colonne = (ref) => {
      const m = /^([A-Z]+)/.exec(ref || '');
      if (!m) return -1;
      let n = 0;
      for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
      return n - 1;
    };

    const xmlFeuille = await texte(cheminFeuille);
    if (!xmlFeuille) throw new Error('Feuille Excel introuvable.');
    const docF = xml(xmlFeuille);
    const lignes = [];
    tous(docF, 'row').forEach((row) => {
      const cols = [];
      let auto = 0;
      enfants(row, 'c').forEach(c => {
        const i = c.getAttribute('r') ? colonne(c.getAttribute('r')) : auto;
        auto = i + 1;
        const type = c.getAttribute('t');
        const v = enfants(c, 'v')[0];
        let val = '';
        if (type === 's') val = partages[parseInt(v && v.textContent, 10)] || '';
        else if (type === 'inlineStr') { const is = enfants(c, 'is')[0]; val = is ? is.textContent : ''; }
        else if (type === 'b') val = v && v.textContent === '1' ? 'OUI' : 'NON';
        else val = v ? v.textContent : '';
        cols[i] = val;
      });
      for (let i = 0; i < cols.length; i++) if (cols[i] === undefined) cols[i] = '';
      lignes.push(cols);
    });
    return lignes;
  }

  /* ===================== 4. Import universel de fichier ================= */
  async function lireFichier(arrayBuffer) {
    const b = new Uint8Array(arrayBuffer || []);
    if (!b.length) return { erreur: 'Le fichier sélectionné est vide.' };

    // Cas 1 : Classeur Excel .xlsx (signature ZIP PK\x03\x04)
    if (b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04) {
      try {
        const lignes = await lireXlsx(b);
        const res = depuisLignesTableur(lignes);
        if (!res.taches.length) return { erreur: 'Aucune tâche trouvée dans le classeur Excel (colonnes conseillées : Phase, Tâche, Domaine, Statut, Commentaire).' };
        return { type: 'taches', phases: res.phases, taches: res.taches };
      } catch (e) {
        return { erreur: 'Impossible de lire le classeur Excel : ' + ((e && e.message) || e) };
      }
    }

    // Cas 2 : Ancien .xls binaire
    if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) {
      return { erreur: 'Format Excel ancien (.xls) non supporté : enregistrez le fichier en .xlsx ou .csv.' };
    }

    // Cas 3 : Texte (JSON, CSV ou TXT)
    let texte = '';
    try {
      texte = new TextDecoder('utf-8', { fatal: true }).decode(b);
    } catch (_) {
      texte = new TextDecoder('windows-1252').decode(b);
    }
    texte = texte.replace(/^\uFEFF/, '').trim();
    if (!texte) return { erreur: 'Fichier vide.' };

    // JSON ?
    if (texte[0] === '{' || texte[0] === '[') {
      try {
        const data = JSON.parse(texte);
        if (data && data.type === 'bfr-chantier' && data.chantier) {
          return { type: 'chantier', chantier: data.chantier, reglages: data.reglages || null };
        }
        if (data && Array.isArray(data.taches)) {
          return { type: 'taches', phases: Array.isArray(data.phases) ? data.phases : [], taches: data.taches };
        }
        if (Array.isArray(data)) {
          const res = analyserTexte(data.map(x => typeof x === 'string' ? x : (x.titre || x.nom || '')).join('\n'));
          return { type: 'taches', phases: res.phases, taches: res.taches };
        }
      } catch (_) { /* pas du JSON valide, continuer en CSV/Texte */ }
    }

    // CSV avec séparateur ; , ou tab ?
    const prem = texte.split(/\r?\n/)[0] || '';
    if (prem.indexOf(';') >= 0 || prem.indexOf('\t') >= 0 || (prem.indexOf(',') >= 0 && /phase|lot|tache|tâche|statut|designation|désignation/i.test(prem))) {
      const res = depuisLignesTableur(decouperCSV(texte));
      if (res.taches.length) return { type: 'taches', phases: res.phases, taches: res.taches };
    }

    // Sinon : liste texte simple
    const resTxt = analyserTexte(texte);
    if (!resTxt.taches.length) return { erreur: 'Aucune tâche reconnue dans ce fichier.' };
    return { type: 'taches', phases: resTxt.phases, taches: resTxt.taches };
  }

  /* ===================== 5. Modèle CSV téléchargeable =================== */
  function modeleCSV() {
    const lignes = [
      'Phase;Tâche;Domaine;Poids;Statut;Commentaire',
      '1. Réception & Implantation;Contrôle de la zone d\'implantation et traçage au sol;Mécanique;1;À faire;',
      '1. Réception & Implantation;Déchargement et manutention des sous-ensembles en zone;Mécanique;2;À faire;',
      '2. Montage mécanique;Assemblage, alignement et mise à niveau des châssis;Mécanique;3;À faire;',
      '2. Montage mécanique;Fixation au sol (chevillage chimique) et montage carters;Mécanique;2;À faire;',
      '3. Câblage électrique & pneumatique;Raccordement puissance 400V et inter-châssis;Électrique;3;À faire;',
      '3. Câblage électrique & pneumatique;Raccordement réseau pneumatique et mise sous pression;Mécanique;1;À faire;',
      '4. Automatisme & Sécurités;Test de la chaîne des arrêts d\'urgence et barrières immatérielles;Automatisme;2;À faire;',
      '4. Automatisme & Sécurités;Tests E/S capteurs et sens de rotation moteurs;Automatisme;2;À faire;',
      '5. Essais & Mise en route;Essais à vide puis montée en cadence avec produits client;Automatisme;3;À faire;'
    ];
    return new Blob(['\uFEFF' + lignes.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  /* ===================== 6. Modèles métiers BFR Systems ================= */
  const MODELES_BFR = [
    {
      id: 'installation_ligne',
      nom: 'Installation & Mise en service ligne BFR',
      description: '20 tâches pondérées (×1 à ×3) en 5 phases : Implantation, Mécanique, Élec/Pneuma, Automatisme, Essais.',
      texte: [
        '# 1. Réception & Implantation',
        '- [Méca] Accueil sécurité site, permis de travail et balisage de la zone chantier (x1)',
        '- [Méca] Réception des camions, contrôle des colis et déchargement des modules (x2)',
        '- [Méca] Vérification du traçage au sol et des côtes d\'implantation ligne (x1)',
        '- [Méca] Mise en place des châssis et convoyeurs selon plan d\'implantation BFR (x2)',
        '# 2. Montage mécanique',
        '- [Méca] Assemblage mécanique inter-modules et jonctions convoyeurs (x3)',
        '- [Méca] Réglage des hauteurs, niveaux laser et alignement général de la ligne (x2)',
        '- [Méca] Ancrage / chevillage définitif au sol après validation alignement (x2)',
        '- [Méca] Montage des carters de protection, portes d\'accès et guides produits (x2)',
        '# 3. Câblage électrique & pneumatique',
        '- [Élec] Passage des chemins de câbles et liaisons inter-armoires (x2)',
        '- [Élec] Raccordement des capteurs, cellules, moteurs et variateurs déportés (x3)',
        '- [Méca] Raccordement alimentation air comprimé et test d\'étanchéité pneumatique (x1)',
        '- [Élec] Raccordement alimentation générale 400V + Terre et vérifications hors tension (x2)',
        '# 4. Automatisme, Robotique & Sécurités',
        '- [Auto] Mise sous tension 24V DC, chargement / vérification programmes API & IHM (x2)',
        '- [Auto] Validation complète de la chaîne de sécurité (AU, portes, barrières immatérielles) (x2)',
        '- [Auto] Pointage des entrées/sorties (E/S) et contrôle des sens de rotation moteurs (x2)',
        '- [Auto] Apprentissage des trajectoires / points de prise et dépose (x3)',
        '# 5. Essais produits & Mise en production',
        '- [Auto] Essais de fonctionnement à vide en mode manuel puis cycle automatique (x2)',
        '- [Auto] Passage des premiers produits client et ajustement des formats / guides (x3)',
        '- [Auto] Montée en cadence nominale et suivi fiabilité en production (x3)',
        '- [Méca] Nettoyage complet de la zone chantier, rangement outillage et point final client (x1)'
      ].join('\n')
    },
    {
      id: 'retrofit_machine',
      nom: 'Rétrofit / Modification machine sur site',
      description: '12 tâches pondérées en 4 phases : Consignation, Démontage & Mécanique, Intégration Élec/Auto, Remise en route.',
      texte: [
        '# 1. Consignation & Préparation',
        '- [Élec] Consignation électrique et pneumatique (LOTO) avec le référent client (x1)',
        '- [Auto] Sauvegarde complète des programmes API, IHM et paramètres variateurs existants (x1)',
        '- [Méca] Repérage et démontage des sous-ensembles à remplacer (x2)',
        '# 2. Adaptation mécanique',
        '- [Méca] Montage des nouveaux sous-ensembles mécaniques BFR (x3)',
        '- [Méca] Ajustement, alignement et contrôle des jeux fonctionnels (x2)',
        '- [Méca] Remontage des protecteurs et adaptation carterisation (x1)',
        '# 3. Câblage & Automatisme',
        '- [Élec] Câblage des nouveaux actionneurs / capteurs dans l\'armoire existante (x3)',
        '- [Auto] Mise à jour du programme automate et des écrans IHM (x2)',
        '- [Auto] Contrôle des sécurités machine et test E/S point à point (x2)',
        '# 4. Essais & Remise en service',
        '- [Auto] Déconsignation, essais à vide et validation des nouveaux cycles (x2)',
        '- [Auto] Essais en production avec les opérateurs et validation des cadences (x3)',
        '- [Méca] Remise au propre de la zone et restitution au service production (x1)'
      ].join('\n')
    },
    {
      id: 'vierge',
      nom: 'Chantier vierge (partir de zéro)',
      description: 'Crée 3 phases vides prêtes à accueillir vos propres tâches.',
      texte: ''
    }
  ];

  function depuisModele(modeleId) {
    const m = MODELES_BFR.find(x => x.id === modeleId);
    if (!m || !m.texte) {
      return {
        phases: [
          { id: uid('ph'), nom: '1. Préparation & Montage' },
          { id: uid('ph'), nom: '2. Câblage & Réglages' },
          { id: uid('ph'), nom: '3. Essais & Mise en route' }
        ],
        taches: []
      };
    }
    return analyserTexte(m.texte);
  }

  global.ImportTaches = {
    uid: uid,
    norm: norm,
    analyserTexte: analyserTexte,
    decouperCSV: decouperCSV,
    depuisLignesTableur: depuisLignesTableur,
    lireFichier: lireFichier,
    modeleCSV: modeleCSV,
    MODELES_BFR: MODELES_BFR,
    depuisModele: depuisModele
  };
})(window);
