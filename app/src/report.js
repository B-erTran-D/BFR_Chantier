/* =========================================================================
   report.js — Génération du Rapport Quotidien de Chantier BFR Systems
   Charte officielle BFR Systems identique à BFR_Repport :
     - En-tête logo officiel BFR Systems + bloc Client / Projet
     - Grand titre Cyan BFR (#06BAF2) + bandeaux de section Cyan BFR
     - Barres de progression vectorielles (globale + par phase/lot)
     - Sans signature client quotidienne (rapport d'avancement journalier)
     - Export PDF (Pdf.Doc), Aperçu Canvas intégré (Pdf.Apercu) et Word (Docx.Doc)
   ========================================================================= */
(function (global) {
  'use strict';

  const M = { margin: 34 };
  const CYAN = [6 / 255, 186 / 255, 242 / 255];
  const NAVY = [51 / 255, 46 / 255, 114 / 255];

  const COULEURS_PDF = {
    cyan: CYAN,
    cyanClair: [0.906, 0.969, 0.988],
    navy: NAVY,
    bandeau: [0.965, 0.978, 0.995],
    bord: [0.84, 0.87, 0.91],
    bordFort: [0.55, 0.60, 0.66],
    texte: [0.22, 0.24, 0.28],
    gris: [0.45, 0.49, 0.55],
    blanc: [1, 1, 1]
  };

  const STATUTS = {
    fait:    { libelle: 'Fait',     court: 'FAIT',     couleur: '#15803d', fond: '#dcfce7' },
    encours: { libelle: 'En cours', court: 'EN COURS', couleur: '#b45309', fond: '#fef3c7' },
    bloque:  { libelle: 'Bloqué',   court: 'BLOQUÉ',   couleur: '#b91c1c', fond: '#fee2e2' },
    afaire:  { libelle: 'À faire',  court: 'À FAIRE',  couleur: '#64748b', fond: '#f1f5f9' }
  };

  const DOMAINES = {
    MECANIQUE:   'Mécanique',
    ELECTRIQUE:  'Électrique',
    AUTOMATISME: 'Automatisme'
  };

  const ORIGINES_BLOCAGE = {
    CLIENT: { libelle: 'Attente Client',    court: 'ATTENTE CLIENT', couleur: '#b91c1c' },
    BFR:    { libelle: 'Interne BFR',       court: 'INTERNE BFR',    couleur: '#332e72' },
    TIERS:  { libelle: 'Tiers / Fourn.',    court: 'TIERS / FOURN.', couleur: '#b45309' }
  };

  function poidsTache(t) {
    const p = Number(t && t.poids);
    return (p === 2 || p === 3) ? p : 1;
  }

  function acquisTache(t) {
    const w = poidsTache(t);
    if (!t) return 0;
    if (t.statut === 'fait') return w;
    if (t.statut === 'encours') {
      const pr = Math.min(95, Math.max(5, Number(t.progression) || 50));
      return w * (pr / 100);
    }
    return 0;
  }

  /** Regroupe les photos visibles par le client en paires AVANT/APRÈS + photos simples (exclut visibilite === 'interne'). */
  function grouperPhotosPourRapport(photosBrutes, inclureInterne) {
    const visibles = (photosBrutes || []).filter(ph => ph && ph.dataUrl && (inclureInterne || ph.visibilite !== 'interne'));
    const utilisees = new Set();
    const elements = [];

    for (let i = 0; i < visibles.length; i++) {
      if (utilisees.has(i)) continue;
      const ph = visibles[i];
      if (ph.avantApres === 'avant') {
        let idxApres = -1;
        if (ph.paireId) {
          idxApres = visibles.findIndex((x, k) => k !== i && !utilisees.has(k) && x.avantApres === 'apres' && x.paireId === ph.paireId);
        }
        if (idxApres < 0) {
          idxApres = visibles.findIndex((x, k) => k > i && !utilisees.has(k) && x.avantApres === 'apres' && !x.paireId);
        }
        if (idxApres >= 0) {
          utilisees.add(i);
          utilisees.add(idxApres);
          const phAp = visibles[idxApres];
          const leg = [valeur(ph.legende), valeur(phAp.legende)].filter((v, idx, a) => v && a.indexOf(v) === idx).join(' -> ');
          elements.push({ type: 'paire', avant: ph, apres: phAp, legende: leg });
          continue;
        }
      }
      utilisees.add(i);
      elements.push({
        type: 'simple',
        photo: ph,
        etiquette: ph.avantApres === 'avant' ? 'AVANT' : (ph.avantApres === 'apres' ? 'APRES' : '')
      });
    }
    return elements;
  }

  const ADRESSE_BFR = '50 allée des érables, 01150 Blyes, France';

  /* ===================== Outils ======================================= */
  function valeur(v) {
    return (v === undefined || v === null || String(v).trim() === '') ? '' : String(v).trim();
  }

  function hexRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return [0.2, 0.25, 0.33];
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function hexClair(hex, melange) {
    const [r, g, b] = hexRgb(hex);
    const k = melange == null ? 0.88 : melange;
    return [r + (1 - r) * k, g + (1 - g) * k, b + (1 - b) * k];
  }

  function slug(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 34) || 'Chantier';
  }

  function frDate(iso) {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    return m ? (m[3] + '/' + m[2] + '/' + m[1]) : String(iso);
  }

  function frDateCourte(iso) {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    return m ? (m[3] + '/' + m[2]) : String(iso);
  }

  function jourSemaineFr(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const noms = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
    return noms[d.getDay()] || '';
  }

  function nomComplet(t) {
    t = t || {};
    const prenom = valeur(t.prenom), nom = valeur(t.nom);
    if (prenom && nom) return prenom + ' ' + nom.toUpperCase();
    return prenom || nom;
  }

  function lignesPiedPage(s) {
    const so = (s && s.societe) || {};
    let adresses = String(so.piedPage || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!adresses.length) adresses = [ADRESSE_BFR];
    return [valeur(so.nom) || 'BFR SYSTEMS'].concat(adresses.slice(0, 2));
  }

  /** Convertit une image quelconque (PNG avec transparence ou JPEG) en JPEG sur fond blanc pour le PDF. */
  function toJpeg(dataUrl, maxLargeur, qualite) {
    return new Promise(function (resolve) {
      if (!dataUrl) { resolve(null); return; }
      if (/^data:image\/jpe?g;base64,/i.test(dataUrl)) {
        try {
          const bytes = Pdf.dataUrlToBytes(dataUrl);
          const d = Pdf.jpegDims(bytes);
          if (d && d.w && d.h && Math.max(d.w, d.h) <= (maxLargeur || 1200)) {
            resolve({ dataUrl: dataUrl, w: d.w, h: d.h });
            return;
          }
        } catch (_) {}
      }
      const img = new Image();
      img.onload = function () {
        try {
          const w0 = img.naturalWidth || img.width || 400;
          const h0 = img.naturalHeight || img.height || 120;
          const ratio = Math.min(1, (maxLargeur || 1200) / Math.max(w0, h0));
          const w = Math.max(1, Math.round(w0 * ratio));
          const h = Math.max(1, Math.round(h0 * ratio));
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: c.toDataURL('image/jpeg', qualite || 0.9), w: w, h: h });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.src = dataUrl;
    });
  }

  /* ===================== Calcul du bilan chantier & jour ============== */
  function estIsoDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  }

  function aujourdhuiLocalISO() {
    const d = new Date();
    const pad = (n) => ('0' + n).slice(-2);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function estWeekEnd(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return false;
    const wd = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
    return wd === 0 || wd === 6;
  }

  /** Génère la liste triée des journées planifiées entre dateDebut (J1) et dateFin. */
  function genererDatesPeriode(dateDebut, dateFin, inclureWeekEnd, joursExclus) {
    if (!estIsoDate(dateDebut)) return [];
    const fin = (estIsoDate(dateFin) && dateFin >= dateDebut) ? dateFin : dateDebut;
    const exclus = new Set(Array.isArray(joursExclus) ? joursExclus : []);
    const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateDebut);
    const cur = new Date(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));
    const pad = (n) => ('0' + n).slice(-2);
    const liste = [];
    let garde = 0;
    while (garde < 366) {
      const iso = cur.getFullYear() + '-' + pad(cur.getMonth() + 1) + '-' + pad(cur.getDate());
      if (iso > fin) break;
      if (!exclus.has(iso)) {
        const borne = (iso === dateDebut || iso === fin);
        if (inclureWeekEnd || borne || !estWeekEnd(iso)) {
          liste.push(iso);
        }
      }
      cur.setDate(cur.getDate() + 1);
      garde++;
    }
    if (!liste.length && !exclus.has(dateDebut)) liste.push(dateDebut);
    return liste;
  }

  /** Retourne les dates planifiées du chantier à partir de dateDebut / dateFinPrevue. */
  function datesPlanifieesChantier(chantier) {
    const c = chantier || {};
    if (!estIsoDate(c.dateDebut)) return [];
    const auj = aujourdhuiLocalISO();
    let fin = '';
    if (estIsoDate(c.dateFinPrevue) && c.dateFinPrevue >= c.dateDebut) {
      fin = c.dateFinPrevue;
    } else if (c.dateDebut <= auj) {
      // Chantier déjà démarré sans date de fin renseignée : couvrir de J1 (dateDebut) jusqu'à aujourd'hui
      fin = auj;
    } else {
      // Chantier futur sans date de fin renseignée : J1 = dateDebut
      fin = c.dateDebut;
    }
    return genererDatesPeriode(c.dateDebut, fin, !!c.inclureWeekEnd, c.joursExclus);
  }

  /** Indique si une journée ne contient aucune saisie ni tâche cochée (coquille vide). */
  function estJourVide(chantier, dateIso) {
    if (!chantier || !dateIso) return true;
    const j = chantier.jours && chantier.jours[dateIso];
    if (j) {
      if (valeur(j.synthese) || valeur(j.aleas) || valeur(j.prevuDemain) || valeur(j.envoyeLe)) return false;
      if (Array.isArray(j.photos) && j.photos.some(p => p && p.dataUrl)) return false;
      if (j.creeManuellement) return false;
    }
    const aTache = ((chantier.taches) || []).some(t => t && t.statut === 'fait' && t.faitLe === dateIso);
    if (aTache) return false;
    return true;
  }

  function datesJoursTriees(chantier, dateIncluse) {
    const c = chantier || {};
    const set = new Set();
    const planifiees = datesPlanifieesChantier(c);
    const setPlan = new Set(planifiees);
    const aDatesChantier = planifiees.length > 0;
    const exclus = new Set(Array.isArray(c.joursExclus) ? c.joursExclus : []);

    planifiees.forEach(d => set.add(d));

    if (c.jours && typeof c.jours === 'object') {
      Object.keys(c.jours).forEach(d => {
        if (!estIsoDate(d) || exclus.has(d)) return;
        // Ignorer les coquilles vides hors période du chantier (ex. date du jour créée par défaut avant configuration)
        if (aDatesChantier && !setPlan.has(d) && estJourVide(c, d)) return;
        set.add(d);
      });
    }

    ((c.taches) || []).forEach(t => {
      if (t && t.statut === 'fait' && estIsoDate(t.faitLe)) set.add(t.faitLe);
    });

    if (estIsoDate(dateIncluse) && !exclus.has(dateIncluse)) {
      if (!aDatesChantier || setPlan.has(dateIncluse) || !estJourVide(c, dateIncluse)) {
        set.add(dateIncluse);
      }
    }

    if (!set.size) {
      const def = (estIsoDate(c.dateDebut) && c.dateDebut) || (estIsoDate(dateIncluse) && dateIncluse) || aujourdhuiLocalISO();
      set.add(def);
    }
    return Array.from(set).sort();
  }

  function calculerBilan(chantier, dateJour) {
    const c = chantier || {};
    const dates = datesJoursTriees(c, dateJour);
    let d = dateJour || c.jourActif || dates[0] || aujourdhuiLocalISO();
    if (dates.indexOf(d) < 0) {
      const auj = aujourdhuiLocalISO();
      d = dates.indexOf(auj) >= 0 ? auj : dates[0];
    }
    const phases = Array.isArray(c.phases) && c.phases.length
      ? c.phases
      : [{ id: 'defaut', nom: 'Tâches du chantier' }];
    const taches = (Array.isArray(c.taches) ? c.taches : []).filter(t => t && valeur(t.titre));

    const mapPhase = {};
    phases.forEach(p => { mapPhase[p.id] = p.nom; });
    const nomPhase = (t) => mapPhase[t.phaseId] || phases[0].nom || 'Chantier';

    const faitTotal = taches.filter(t => t.statut === 'fait');
    const faitCeJour = faitTotal.filter(t => t.faitLe === d);
    const faitAvant = faitTotal.filter(t => t.faitLe !== d);
    const enCours = taches.filter(t => t.statut === 'encours');
    const bloques = taches.filter(t => t.statut === 'bloque');
    const aFaire = taches.filter(t => !t.statut || t.statut === 'afaire');

    const total = taches.length;
    const estPondere = taches.some(t => poidsTache(t) > 1);
    const poidsTotal = taches.reduce((s, t) => s + poidsTache(t), 0);
    const poidsAcquis = taches.reduce((s, t) => s + acquisTache(t), 0);
    const pctGlobal = poidsTotal ? Math.round((poidsAcquis / poidsTotal) * 100) : 0;

    // Détail par phase (dans l'ordre des phases)
    const parPhase = [];
    const idsVus = new Set();
    phases.forEach(ph => {
      idsVus.add(ph.id);
      const ts = taches.filter(t => t.phaseId === ph.id);
      const nbFait = ts.filter(t => t.statut === 'fait').length;
      const nbCours = ts.filter(t => t.statut === 'encours').length;
      const nbBloq = ts.filter(t => t.statut === 'bloque').length;
      const nbAfaire = ts.length - nbFait - nbCours - nbBloq;
      const pTot = ts.reduce((s, t) => s + poidsTache(t), 0);
      const pAcq = ts.reduce((s, t) => s + acquisTache(t), 0);
      parPhase.push({
        id: ph.id,
        nom: ph.nom,
        taches: ts,
        total: ts.length,
        fait: nbFait,
        encours: nbCours,
        bloque: nbBloq,
        afaire: nbAfaire,
        faitCeJour: ts.filter(t => t.statut === 'fait' && t.faitLe === d).length,
        pct: pTot ? Math.round((pAcq / pTot) * 100) : 0
      });
    });
    // Tâches orphelines éventuelles
    const orphelines = taches.filter(t => !idsVus.has(t.phaseId));
    if (orphelines.length) {
      const nbFait = orphelines.filter(t => t.statut === 'fait').length;
      const pTot = orphelines.reduce((s, t) => s + poidsTache(t), 0);
      const pAcq = orphelines.reduce((s, t) => s + acquisTache(t), 0);
      parPhase.push({
        id: '_autres',
        nom: 'Autres tâches',
        taches: orphelines,
        total: orphelines.length,
        fait: nbFait,
        encours: orphelines.filter(t => t.statut === 'encours').length,
        bloque: orphelines.filter(t => t.statut === 'bloque').length,
        afaire: orphelines.filter(t => !t.statut || t.statut === 'afaire').length,
        faitCeJour: orphelines.filter(t => t.statut === 'fait' && t.faitLe === d).length,
        pct: pTot ? Math.round((pAcq / pTot) * 100) : 0
      });
    }

    const numeroJour = Math.max(1, dates.indexOf(d) + 1);
    const nbJoursTotal = dates.length;
    const pctDelai = nbJoursTotal > 0 ? Math.round((numeroJour / nbJoursTotal) * 100) : 0;
    const auj = aujourdhuiLocalISO();

    // Indicateur Cadence : Avancement réel (%) vs Jours écoulés (%)
    let cadence;
    if (nbJoursTotal < 2) {
      cadence = { code: 'unique', libelle: 'Intervention 1 jour', couleur: '#06baf2', pctDelai: 100, ecart: 0, actif: false };
    } else if (d > auj && faitTotal.length === 0 && enCours.length === 0) {
      cadence = { code: 'planifie', libelle: 'Chantier planifié', couleur: '#64748b', pctDelai: 0, ecart: 0, actif: false };
    } else {
      const ecart = pctGlobal - pctDelai;
      if (pctGlobal >= 100) {
        cadence = { code: 'ok', libelle: 'Terminé (100 %)', couleur: '#15803d', pctDelai: pctDelai, ecart: ecart, actif: true };
      } else if (ecart >= 10) {
        cadence = { code: 'ok', libelle: 'En avance sur planning', couleur: '#15803d', pctDelai: pctDelai, ecart: ecart, actif: true };
      } else if (ecart >= -10) {
        cadence = { code: 'ok', libelle: 'Dans le planning', couleur: '#15803d', pctDelai: pctDelai, ecart: ecart, actif: true };
      } else if (ecart >= -22) {
        cadence = { code: 'derive', libelle: 'Légère dérive planning', couleur: '#b45309', pctDelai: pctDelai, ecart: ecart, actif: true };
      } else {
        cadence = { code: 'retard', libelle: 'Retard sur planning', couleur: '#b91c1c', pctDelai: pctDelai, ecart: ecart, actif: true };
      }
    }

    // Répartition des blocages par origine & trace des blocages levés ce jour
    const bloquesClient = bloques.filter(t => (t.blocageOrigine || 'CLIENT') === 'CLIENT');
    const bloquesBfr = bloques.filter(t => t.blocageOrigine === 'BFR');
    const bloquesTiers = bloques.filter(t => t.blocageOrigine === 'TIERS');

    const blocagesLevesCeJour = [];
    const blocagesLevesTotal = [];
    taches.forEach(t => {
      (t.historiqueBlocages || []).forEach(h => {
        if (!h) return;
        const item = { tache: t, phaseNom: nomPhase(t), hist: h };
        blocagesLevesTotal.push(item);
        if (h.leveLe === d) blocagesLevesCeJour.push(item);
      });
    });

    const jour = Object.assign({
      date: d,
      horaires: '',
      equipeJour: '',
      synthese: '',
      aleas: '',
      prevuDemain: '',
      photos: [],
      envoyeLe: ''
    }, (c.jours && c.jours[d]) || {});

    const compterClient = (arr) => (arr || []).filter(p => p && p.dataUrl && p.visibilite !== 'interne').length;
    const compterInterne = (arr) => (arr || []).filter(p => p && p.dataUrl && p.visibilite === 'interne').length;

    const nbPhotosJour = compterClient(jour.photos) +
      faitCeJour.reduce((acc, t) => acc + compterClient(t.photos), 0) +
      bloques.reduce((acc, t) => acc + compterClient(t.photos), 0) +
      enCours.reduce((acc, t) => acc + compterClient((t.photos || []).filter(p => !p.datePrise || p.datePrise === d)), 0);

    const nbPhotosInterne = compterInterne(jour.photos) +
      taches.reduce((acc, t) => acc + compterInterne(t.photos), 0);

    return {
      dateJour: d,
      numeroJour: numeroJour,
      nbJoursTotal: nbJoursTotal,
      datesJours: dates,
      jour: jour,
      total: total,
      estPondere: estPondere,
      poidsTotal: poidsTotal,
      poidsAcquis: poidsAcquis,
      cadence: cadence,
      faitTotal: faitTotal,
      faitCeJour: faitCeJour,
      faitAvant: faitAvant,
      enCours: enCours,
      bloques: bloques,
      bloquesClient: bloquesClient,
      bloquesBfr: bloquesBfr,
      bloquesTiers: bloquesTiers,
      blocagesLevesCeJour: blocagesLevesCeJour,
      blocagesLevesTotal: blocagesLevesTotal,
      aFaire: aFaire,
      pctGlobal: pctGlobal,
      parPhase: parPhase,
      nomPhase: nomPhase,
      nbPhotosJour: nbPhotosJour,
      nbPhotosInterne: nbPhotosInterne
    };
  }

  /* ===================== Génération PDF officielle BFR ================ */
  class RapportQuotidienPDF {
    constructor(chantier, reglages, dateJour, opts) {
      this.c = chantier || {};
      this.s = reglages || {};
      this.opts = opts || {};
      this.bilan = calculerBilan(this.c, dateJour);
      this.pdf = this.opts.apercu
        ? new Pdf.Apercu({ margin: M.margin })
        : new Pdf.Doc({ margin: M.margin });
      this.M = this.pdf.margin;
      this.W = this.pdf.W;
      this.H = this.pdf.H;
      this.CW = this.pdf.contentWidth;
      this.C = COULEURS_PDF;
      this.numeroPhoto = 0;
    }

    limiteBas() { return this.H - this.M - 32; }

    saut(hauteur) {
      if (this.pdf.y + (hauteur || 0) > this.limiteBas()) {
        this.pdf.newPage();
        this.enteteSuite();
        return true;
      }
      return false;
    }

    /* En-tête de la page 1 : calqué sur la charte officielle BFR Systems */
    entetePrincipale() {
      const p = this.pdf, c = this.c, s = this.s, b = this.bilan, C = this.C;

      if (this.logo) {
        const w = 9.6 * 28.35;
        const h = w * (this.logo.h / this.logo.w);
        p.image(this.logo.bytes, this.M, p.y, w, h);
        // Badge discret en haut à droite : N° d'affaire + Jour N
        const refDroite = [valeur(c.affaire) ? 'Affaire ' + valeur(c.affaire) : '', 'Jour ' + b.numeroJour].filter(Boolean).join('  ·  ');
        p.text(refDroite, this.W - this.M, p.y + h * 0.62, { size: 10, font: 'F2', color: C.navy, align: 'right' });
        p.y += h + 16;
      }

      // Bloc Client (gauche) + Logo Client éventuel (droite)
      const cli = c.client || {};
      const logoCli = this.logoClient;
      const haut = p.y;
      const largLogo = logoCli ? Math.min(135, 75 * (logoCli.w / logoCli.h)) : 0;
      const largGauche = this.CW - (largLogo ? largLogo + 16 : 0);
      let y = haut;
      if (valeur(cli.nom)) {
        p.text(Pdf.trunc(cli.nom, largGauche, 12.5, true), this.M, y + 10, { size: 12.5, font: 'F2', color: C.texte, bold: true });
        y += 16;
      }
      if (valeur(cli.lieu) || valeur(cli.adresse)) {
        p.text(Pdf.trunc(valeur(cli.lieu) || valeur(cli.adresse).replace(/\n+/g, ', '), largGauche, 9.8), this.M, y + 9, { size: 9.8, color: C.gris });
        y += 14;
      }
      if (valeur(cli.contact)) {
        const txtContact = 'Contact : ' + valeur(cli.contact) + (valeur(cli.fonction) ? ' (' + valeur(cli.fonction) + ')' : '');
        p.text(Pdf.trunc(txtContact, largGauche, 9.8), this.M, y + 9, { size: 9.8, color: C.texte });
        y += 14;
      }
      if (logoCli) {
        const h = Math.min(54, largLogo * (logoCli.h / logoCli.w));
        p.image(logoCli.bytes, this.W - this.M - largLogo, haut, largLogo, h);
        y = Math.max(y, haut + h);
      }
      p.y = y + 16;

      // Grand titre Cyan officiel BFR Systems
      const titreDoc = 'Rapport quotidien de chantier';
      let taille = 24;
      while (taille > 16 && Pdf.measure(titreDoc, taille, true) > this.CW * 0.92) taille -= 1;
      p.text(titreDoc, this.W / 2, p.y + taille, { size: taille, font: 'F2', color: CYAN, align: 'center', bold: true });
      p.y += taille + 6;

      const sousTitreDate = 'Jour ' + b.numeroJour + (b.nbJoursTotal > 1 ? ' / ' + b.nbJoursTotal : '') + ' — ' + frDate(b.dateJour);
      p.text(sousTitreDate, this.W / 2, p.y + 14, { size: 14.5, font: 'F2', color: CYAN, align: 'center', bold: true });
      p.y += 22;

      if (valeur(c.nom)) {
        const intitule = valeur(c.nom) + (valeur(c.affaire) ? '  (' + valeur(c.affaire) + ')' : '');
        p.text(Pdf.trunc(intitule, this.CW * 0.94, 11.5, true), this.W / 2, p.y + 11, { size: 11.5, font: 'F2', color: C.navy, align: 'center', bold: true });
        p.y += 20;
      }

      // Bandeau compact « Votre contact BFR Systems » sur 2 colonnes équilibrées
      const t = s.technicien || {};
      const respNom = valeur(c.responsable) || nomComplet(t) || 'Équipe BFR Systems';
      const respCoord = [valeur(t.fonction) || 'Chargé de chantier BFR', valeur(t.tel) ? 'Tél. ' + valeur(t.tel) : '', valeur(t.email)].filter(Boolean).join('  ·  ');
      const equipeTxt = valeur(b.jour.equipeJour) || valeur(c.equipe);
      const hContact = equipeTxt ? 44 : 32;
      p.rect(this.M, p.y, this.CW, hContact, { fill: C.bandeau, stroke: C.bord, lineWidth: 0.6 });
      p.rect(this.M, p.y, 3.5, hContact, { fill: CYAN });
      p.text('VOTRE INTERLOCUTEUR CHANTIER BFR SYSTEMS :', this.M + 10, p.y + 11, { size: 7.6, font: 'F2', color: C.gris, bold: true });
      p.text(Pdf.trunc(respNom + (respCoord ? '  —  ' + respCoord : ''), this.CW - 18, 9.6, true), this.M + 10, p.y + 23.5, { size: 9.6, font: 'F2', color: C.texte, bold: true });
      if (equipeTxt) {
        p.text(Pdf.trunc('Équipe présente sur site : ' + equipeTxt + (valeur(b.jour.horaires) ? '  |  Horaires : ' + valeur(b.jour.horaires) : ''), this.CW - 18, 8.8),
          this.M + 10, p.y + 36.5, { size: 8.8, color: C.gris });
      } else if (valeur(b.jour.horaires)) {
        p.text('Horaires : ' + valeur(b.jour.horaires), this.W - this.M - 10, p.y + 11, { size: 8.4, color: C.gris, align: 'right' });
      }
      p.y += hContact + 14;
    }

    /* En-tête des pages suivantes */
    enteteSuite() {
      const p = this.pdf, C = this.C, c = this.c, b = this.bilan;
      const rappel = [
        valeur(c.affaire) || valeur(c.nom) || 'Chantier',
        valeur(c.client && c.client.nom),
        'J' + b.numeroJour + ' (' + frDate(b.dateJour) + ')'
      ].filter(Boolean).join(' — ');

      if (this.logo) {
        const w = 5.0 * 28.35;
        const h = w * (this.logo.h / this.logo.w);
        p.image(this.logo.bytes, this.M, p.y, w, h);
        p.text(Pdf.trunc(rappel, this.CW * 0.66, 9.0), this.W - this.M, p.y + h - 3, { size: 9.0, color: C.gris, align: 'right' });
        p.y += h + 7;
      } else {
        p.text(valeur(this.s.societe && this.s.societe.nom) || 'BFR SYSTEMS', this.M, p.y + 10, { size: 10.5, font: 'F2', color: CYAN, bold: true });
        p.text(Pdf.trunc(rappel, this.CW * 0.66, 9.0), this.W - this.M, p.y + 10, { size: 9.0, color: C.gris, align: 'right' });
        p.y += 15;
      }
      p.line(this.M, p.y, this.W - this.M, p.y, { color: C.bord, width: 0.7 });
      p.y += 14;
    }

    /* Bandeau de section officiel BFR Cyan */
    titreSection(txt, sousTitre, reserver) {
      this.saut(36 + (reserver || 0));
      const p = this.pdf, y = p.y, C = this.C;
      let taille = 11.2;
      const maxW = this.CW - 16 - (sousTitre ? Pdf.measure(sousTitre, 8.8, false) + 14 : 0);
      while (taille > 8.0 && Pdf.measure(txt.toUpperCase(), taille, true) > maxW) taille -= 0.5;
      p.rect(this.M, y, this.CW, 20, { fill: CYAN });
      p.text(txt.toUpperCase(), this.M + 8, y + 13.8, { size: taille, font: 'F2', color: C.blanc, bold: true });
      if (sousTitre) {
        p.text(sousTitre, this.W - this.M - 8, y + 13.6, { size: 8.8, color: C.blanc, align: 'right' });
      }
      p.y = y + 26;
    }

    kv(pairs) {
      pairs = (pairs || []).filter(it => it[0] && valeur(it[1]));
      if (!pairs.length) return;
      const p = this.pdf, C = this.C, gap = 8, colW = (this.CW - gap) / 2;
      let k = 0;
      while (k < pairs.length) {
        const ligne = [];
        while (k < pairs.length && ligne.length < 2) {
          if (pairs[k][2] && ligne.length === 1) break;
          ligne.push(pairs[k]);
          k++;
        }
        const largeurs = ligne.length === 2 ? [colW, colW] : [ligne[0][2] ? this.CW : colW];
        let h = 0;
        ligne.forEach((it, idx) => {
          h = Math.max(h, 14 + Pdf.wrap(valeur(it[1]), largeurs[idx] - 14, 9.4).length * 12.2);
        });
        this.saut(h + 2);
        const y = p.y;
        let x = this.M;
        for (let idx = 0; idx < ligne.length; idx++) {
          p.rect(x, y, largeurs[idx], h, { fill: C.bandeau, stroke: C.bord, lineWidth: 0.5 });
          p.text(ligne[idx][0], x + 7, y + 10.8, { size: 7.5, font: 'F2', color: C.gris, bold: true });
          p.paragraph(valeur(ligne[idx][1]), x + 7, y + 12.2, largeurs[idx] - 14, { size: 9.4, lineHeight: 12.2, color: C.texte });
          x += largeurs[idx] + gap;
        }
        p.y = y + h + 2;
      }
      p.y += 5;
    }

    blocTexte(etiquette, contenu, couleurBordGauche, couleurFond) {
      const texte = valeur(contenu);
      if (!texte) return;
      const p = this.pdf, C = this.C;
      const lh = 13.0;
      const lignes = Pdf.wrap(texte, this.CW - 18, 9.5);
      let idx = 0;
      while (idx < lignes.length) {
        const place = Math.floor((this.limiteBas() - p.y - (idx === 0 && etiquette ? 16 : 4)) / lh);
        if (place < 2) { p.newPage(); this.enteteSuite(); continue; }
        const n = Math.min(place, lignes.length - idx);
        if (idx === 0 && etiquette) {
          p.text(etiquette, this.M + 2, p.y + 9.5, { size: 8.8, font: 'F2', color: couleurBordGauche || C.navy, bold: true });
          p.y += 13;
        }
        const hCadre = n * lh + 9;
        p.rect(this.M, p.y, this.CW, hCadre, { fill: couleurFond || [1, 1, 1], stroke: C.bord, lineWidth: 0.6 });
        if (couleurBordGauche) p.rect(this.M, p.y, 3.5, hCadre, { fill: couleurBordGauche });
        for (let j = 0; j < n; j++) {
          p.text(lignes[idx + j], this.M + 9, p.y + 10.5 + j * lh, { size: 9.5, color: C.texte });
        }
        p.y += hCadre + 6;
        idx += n;
      }
    }

    /* Bloc Avancement Global + Cadence Planning + 4 KPIs + Tableau d'avancement par Phase */
    blocAvancement() {
      const p = this.pdf, C = this.C, b = this.bilan;
      const cad = b.cadence;
      const afficherCadence = b.nbJoursTotal >= 2;
      const hJauge = afficherCadence ? 52 : 38;

      // 1. Jauge principale d'avancement global + Cadence planning
      this.saut(hJauge + 50);
      const yJauge = p.y;
      p.rect(this.M, yJauge, this.CW, hJauge, { fill: C.cyanClair, stroke: CYAN, lineWidth: 0.7 });
      p.text('AVANCEMENT GLOBAL' + (b.estPondere ? ' (PONDERE)' : ''), this.M + 10, yJauge + 13, { size: 8.5, font: 'F2', color: C.navy, bold: true });
      const txtDroit = b.faitTotal.length + ' / ' + b.total + ' tâche' + (b.total > 1 ? 's' : '') + ' terminée' + (b.faitTotal.length > 1 ? 's' : '') + '  —  ' + b.pctGlobal + ' %';
      p.text(txtDroit, this.W - this.M - 12, yJauge + 13, { size: 9.4, font: 'F2', color: C.navy, align: 'right', bold: true });

      const barX = this.M + 10, barY = yJauge + 20, barW = this.CW - 20, barH = 10;
      p.rect(barX, barY, barW, barH, { fill: [1, 1, 1], stroke: C.bord, lineWidth: 0.5 });
      if (b.pctGlobal > 0) {
        const wFill = Math.max(4, (barW * Math.min(100, b.pctGlobal)) / 100);
        p.rect(barX, barY, wFill, barH, { fill: b.pctGlobal >= 100 ? hexRgb('#10b981') : CYAN });
      }
      // Repère vertical du délai théorique (Jour X / Y)
      if (cad && cad.actif && cad.pctDelai > 0 && cad.pctDelai < 100) {
        const tickX = barX + (barW * cad.pctDelai) / 100;
        p.rect(tickX - 1, barY - 1.5, 2, barH + 3, { fill: C.navy });
      }

      if (afficherCadence) {
        const txtDelai = 'Délai écoulé : Jour ' + b.numeroJour + ' / ' + b.nbJoursTotal + ' (' + cad.pctDelai + ' % du planning)';
        p.text(txtDelai, this.M + 10, yJauge + 44, { size: 8.2, color: C.gris });
        let txtCad = cad.libelle.toUpperCase();
        if (b.bloquesClient.length > 0) {
          txtCad += '  ·  ' + b.bloquesClient.length + ' ATTENTE' + (b.bloquesClient.length > 1 ? 'S' : '') + ' CLIENT';
        }
        p.text(txtCad, this.W - this.M - 12, yJauge + 44, { size: 8.2, font: 'F2', color: hexRgb(cad.couleur), align: 'right', bold: true });
      }

      p.y = yJauge + hJauge + 7;

      // 2. 4 Cartes Compteurs KPI (Fait ce jour / Total terminé / En cours / Bloqués)
      const libBloq = b.bloquesClient.length
        ? ('Bloqués (dont ' + b.bloquesClient.length + ' Client)')
        : 'Points bloquants';
      const kpis = [
        { n: '+' + b.faitCeJour.length, lib: 'Fait ce jour (' + frDateCourte(b.dateJour) + ')', coul: '#15803d' },
        { n: b.faitTotal.length + '/' + b.total, lib: 'Avancement : ' + b.pctGlobal + ' %', coul: '#0369a1' },
        { n: String(b.enCours.length), lib: 'En cours', coul: '#b45309' },
        { n: String(b.bloques.length), lib: libBloq, coul: b.bloques.length ? '#b91c1c' : '#64748b' }
      ];
      const gap = 6;
      const caseW = (this.CW - (kpis.length - 1) * gap) / kpis.length;
      const yKpi = p.y;
      kpis.forEach((k, idx) => {
        const x = this.M + idx * (caseW + gap);
        p.rect(x, yKpi, caseW, 34, { fill: hexClair(k.coul, 0.90), stroke: hexRgb(k.coul), lineWidth: 0.6 });
        p.text(k.n, x + caseW / 2, yKpi + 16.5, { size: 14.5, font: 'F2', color: hexRgb(k.coul), align: 'center', bold: true });
        p.text(Pdf.trunc(k.lib, caseW - 6, 7.5), x + caseW / 2, yKpi + 28, { size: 7.5, color: C.gris, align: 'center' });
      });
      p.y = yKpi + 42;

      // 3. Tableau d'avancement par Phase / Lot (s'il y a au moins 1 tâche)
      const phasesActives = b.parPhase.filter(ph => ph.total > 0);
      if (phasesActives.length > 0) {
        const hEnt = 18, hRow = 20;
        this.saut(hEnt + hRow * Math.min(2, phasesActives.length) + 8);
        const colNom = Math.round(this.CW * 0.48);
        const colBarre = Math.round(this.CW * 0.28);
        const colStat = this.CW - colNom - colBarre;

        const dessinerEntetePhases = () => {
          const y = p.y;
          p.rect(this.M, y, this.CW, hEnt, { fill: C.cyanClair, stroke: C.bordFort, lineWidth: 0.5 });
          p.text('Phase / Lot du chantier', this.M + 7, y + 12.2, { size: 8.5, font: 'F2', color: C.navy, bold: true });
          p.text('Progression', this.M + colNom + 7, y + 12.2, { size: 8.5, font: 'F2', color: C.navy, bold: true });
          p.text('État', this.M + colNom + colBarre + colStat - 7, y + 12.2, { size: 8.5, font: 'F2', color: C.navy, align: 'right', bold: true });
          p.y = y + hEnt;
        };

        dessinerEntetePhases();
        phasesActives.forEach(ph => {
          if (p.y + hRow > this.limiteBas()) {
            p.newPage();
            this.enteteSuite();
            dessinerEntetePhases();
          }
          const y = p.y;
          p.rect(this.M, y, this.CW, hRow, { fill: [1, 1, 1], stroke: C.bord, lineWidth: 0.4 });
          p.text(Pdf.trunc(ph.nom, colNom - 14, 9.0, true), this.M + 7, y + 13.2, { size: 9.0, font: 'F2', color: C.texte, bold: true });

          // Mini-barre de progression vectorielle
          const bx = this.M + colNom + 7, by = y + 6.5, bw = colBarre - 46, bh = 7;
          p.rect(bx, by, bw, bh, { fill: [0.92, 0.94, 0.96], stroke: C.bord, lineWidth: 0.3 });
          if (ph.pct > 0) {
            p.rect(bx, by, Math.max(2, (bw * ph.pct) / 100), bh, { fill: ph.pct >= 100 ? hexRgb('#15803d') : CYAN });
          }
          p.text(ph.pct + ' %', bx + bw + 6, y + 13, { size: 8.4, font: 'F2', color: ph.pct >= 100 ? hexRgb('#15803d') : C.navy, bold: true });

          let resumePh = ph.fait + '/' + ph.total + ' fait';
          if (ph.bloque) resumePh += ' · ' + ph.bloque + ' bloq.';
          else if (ph.faitCeJour) resumePh += ' (+' + ph.faitCeJour + ' auj.)';
          p.text(Pdf.trunc(resumePh, colStat - 10, 8.3), this.W - this.M - 7, y + 13,
            { size: 8.3, color: ph.bloque ? hexRgb('#b91c1c') : C.gris, align: 'right' });
          p.y = y + hRow;
        });
        p.y += 8;
      }
    }

    /* Cadre comparatif AVANT / APRES côte à côte */
    async photoPaireAvantApres(paire, contexte) {
      const jAv = await toJpeg(paire.avant.dataUrl, 1000, 0.85);
      const jAp = await toJpeg(paire.apres.dataUrl, 1000, 0.85);
      if (!jAv && !jAp) return;
      const p = this.pdf, C = this.C;
      const gap = 8;
      const colW = (this.CW - gap - 12) / 2;
      const hImg = 148;
      const legGlobale = [paire.legende, contexte].filter(Boolean)[0] || '';
      const hTot = 18 + 15 + hImg + (legGlobale ? 15 : 4) + 6;

      this.saut(hTot);
      const y0 = p.y;
      p.rect(this.M, y0, this.CW, hTot - 4, { fill: [0.985, 0.995, 1], stroke: CYAN, lineWidth: 0.6 });
      p.rect(this.M, y0, this.CW, 16, { fill: C.cyanClair });
      const numP = ++this.numeroPhoto;
      p.text('COMPARATIF AVANT / APRES  —  PHOTO ' + numP, this.M + 8, y0 + 11.2, { size: 8.0, font: 'F2', color: C.navy, bold: true });

      const dessinerSlot = (j, idx, label, coulHex) => {
        const sx = this.M + 6 + idx * (colW + gap);
        const sy = y0 + 20;
        p.rect(sx, sy, colW, 13, { fill: hexClair(coulHex, 0.86), stroke: hexRgb(coulHex), lineWidth: 0.4 });
        p.text(label, sx + colW / 2, sy + 9.4, { size: 7.8, font: 'F2', color: hexRgb(coulHex), align: 'center', bold: true });
        p.rect(sx, sy + 13, colW, hImg, { fill: [1, 1, 1], stroke: C.bord, lineWidth: 0.4 });
        if (j) {
          const bytes = Pdf.dataUrlToBytes(j.dataUrl);
          const rImg = j.w / j.h, rBox = (colW - 4) / (hImg - 4);
          let iw, ih;
          if (rImg >= rBox) { iw = colW - 4; ih = iw / rImg; }
          else { ih = hImg - 4; iw = ih * rImg; }
          p.image(bytes, sx + 2 + (colW - 4 - iw) / 2, sy + 15 + (hImg - 4 - ih) / 2, iw, ih);
        }
      };

      dessinerSlot(jAv, 0, 'AVANT', '#b45309');
      dessinerSlot(jAp, 1, 'APRES', '#15803d');

      if (legGlobale) {
        p.text(Pdf.trunc(legGlobale, this.CW - 18, 8.2), this.M + this.CW / 2, y0 + 20 + 13 + hImg + 11,
          { size: 8.2, color: C.gris, align: 'center' });
      }
      p.y = y0 + hTot + 3;
    }

    /* Photos harmonisées (exclut Mémo interne BFR + gère les duos Avant / Après) */
    async photos(liste, avecNumero, contexte) {
      const groupes = grouperPhotosPourRapport(liste, false);
      if (!groupes.length) return;
      const p = this.pdf, C = this.C;
      const gap = 10;
      const colW = (this.CW - gap) / 2;

      // Extraire d'abord les paires Avant/Après, puis grouper les photos simples par 1 ou 2
      const simples = [];
      for (const g of groupes) {
        if (g.type === 'paire') {
          if (simples.length) { await this._photosSimples(simples, avecNumero, colW, gap); simples.length = 0; }
          await this.photoPaireAvantApres(g, contexte);
        } else {
          simples.push({
            dataUrl: g.photo.dataUrl,
            legende: g.photo.legende || contexte || '',
            etiquette: g.etiquette || ''
          });
        }
      }
      if (simples.length) {
        await this._photosSimples(simples, avecNumero, colW, gap);
      }
    }

    async _photosSimples(valides, avecNumero, colW, gap) {
      const p = this.pdf, C = this.C;
      if (valides.length === 1) {
        const it = valides[0];
        const j = await toJpeg(it.dataUrl, 1200, 0.86);
        if (!j) return;
        const bytes = Pdf.dataUrlToBytes(j.dataUrl);
        const wBox = Math.min(this.CW, 340), hBox = 200;
        const rImg = j.w / j.h, rBox = (wBox - 4) / (hBox - 4);
        let iw, ih;
        if (rImg >= rBox) { iw = wBox - 4; ih = iw / rImg; }
        else { ih = hBox - 4; iw = ih * rImg; }
        const pref = it.etiquette ? ('[' + it.etiquette + '] ') : '';
        const leg = avecNumero ? ('Photo ' + (++this.numeroPhoto) + ' — ' + pref + (it.legende || '')).replace(/ — $/, '') : (pref + (it.legende || ''));
        const reqH = hBox + (leg ? 16 : 0) + 8;
        this.saut(reqH);
        const cx = this.M + (this.CW - wBox) / 2, cy = p.y;
        p.rect(cx, cy, wBox, hBox, { fill: [1, 1, 1], stroke: C.bord, lineWidth: 0.5 });
        p.image(bytes, cx + 2 + (wBox - 4 - iw) / 2, cy + 2 + (hBox - 4 - ih) / 2, iw, ih);
        if (leg) p.text(Pdf.trunc(leg, wBox, 8.4), cx + wBox / 2, cy + hBox + 11, { size: 8.4, color: C.gris, align: 'center' });
        p.y = cy + reqH;
        return;
      }

      const hBox = 155;
      for (let i = 0; i < valides.length; i += 2) {
        const lot = valides.slice(i, i + 2);
        const jpegs = await Promise.all(lot.map(it => toJpeg(it.dataUrl, 1000, 0.85)));
        const aLeg = avecNumero || lot.some(it => valeur(it.legende) || it.etiquette);
        const reqH = hBox + (aLeg ? 16 : 0) + 8;
        this.saut(reqH);
        const y = p.y;
        lot.forEach((it, k) => {
          const j = jpegs[k];
          if (!j) return;
          const bytes = Pdf.dataUrlToBytes(j.dataUrl);
          const rImg = j.w / j.h, rBox = (colW - 4) / (hBox - 4);
          let iw, ih;
          if (rImg >= rBox) { iw = colW - 4; ih = iw / rImg; }
          else { ih = hBox - 4; iw = ih * rImg; }
          const x = this.M + k * (colW + gap);
          p.rect(x, y, colW, hBox, { fill: [1, 1, 1], stroke: C.bord, lineWidth: 0.5 });
          p.image(bytes, x + 2 + (colW - 4 - iw) / 2, y + 2 + (hBox - 4 - ih) / 2, iw, ih);
          if (aLeg) {
            const pref = it.etiquette ? ('[' + it.etiquette + '] ') : '';
            const leg = avecNumero ? ('Photo ' + (++this.numeroPhoto) + ' — ' + pref + (it.legende || '')).replace(/ — $/, '') : (pref + (it.legende || ''));
            p.text(Pdf.trunc(leg, colW, 8.2), x, y + hBox + 11, { size: 8.2, color: C.gris });
          }
        });
        p.y = y + reqH;
      }
    }

    /* Carte détaillée d'une tâche (Fait ce jour, Bloqué ou En cours) avec notes, origine blocage et photos */
    async blocTacheDetail(t, mode) {
      const p = this.pdf, C = this.C, b = this.bilan;
      const st = STATUTS[mode] || STATUTS[t.statut] || STATUTS.afaire;
      const coul = hexRgb(st.couleur);
      const fond = hexClair(st.couleur, 0.92);
      const phNom = b.nomPhase(t);
      const domNom = DOMAINES[t.domaine] || '';
      const wPoids = poidsTache(t);

      let note = '';
      if (mode === 'bloque') {
        const infosBloq = [];
        if (valeur(t.bloqueDepuis)) {
          const idxJ = b.datesJours.indexOf(t.bloqueDepuis);
          infosBloq.push('Depuis le ' + frDate(t.bloqueDepuis) + (idxJ >= 0 ? ' (J' + (idxJ + 1) + ')' : ''));
        }
        if (valeur(t.blocageDuree)) infosBloq.push('Attente / impact : ' + valeur(t.blocageDuree));
        note = [
          valeur(t.blocage) ? 'Point bloquant : ' + valeur(t.blocage) : '',
          infosBloq.join('  ·  '),
          valeur(t.commentaire)
        ].filter(Boolean).join('\n');
      } else {
        note = valeur(t.commentaire);
      }

      const titreAffiche = valeur(t.titre) + (wPoids > 1 ? '  (x' + wPoids + ')' : '');
      const lignesTitre = Pdf.wrap(titreAffiche, this.CW - 20, 9.8, true);
      const lignesNote = note ? Pdf.wrap(note, this.CW - 22, 9.0) : [];
      const hCarte = 19 + lignesTitre.length * 13 + (lignesNote.length ? lignesNote.length * 12 + 6 : 4) + 5;

      this.saut(Math.min(hCarte, 140));
      const y0 = p.y;
      p.rect(this.M, y0, this.CW, hCarte, { fill: [1, 1, 1], stroke: C.bord, lineWidth: 0.5 });
      p.rect(this.M, y0, this.CW, 16, { fill: fond });
      p.rect(this.M, y0, 3.8, hCarte, { fill: coul });

      const metaGauche = phNom + (domNom ? '  ·  ' + domNom : '');
      p.text(Pdf.trunc(metaGauche, this.CW * 0.58, 8.3, true), this.M + 9, y0 + 11.2, { size: 8.3, font: 'F2', color: coul, bold: true });

      let badgeDroite = st.court;
      if (mode === 'encours' && t.progression) {
        badgeDroite = st.court + ' (' + t.progression + ' %)';
      } else if (mode === 'bloque') {
        const orig = ORIGINES_BLOCAGE[t.blocageOrigine || 'CLIENT'] || ORIGINES_BLOCAGE.CLIENT;
        badgeDroite = 'BLOQUE — ' + orig.court;
      }
      p.text(badgeDroite, this.W - this.M - 8, y0 + 11.2, { size: 7.9, font: 'F2', color: coul, align: 'right', bold: true });

      let yc = y0 + 28;
      lignesTitre.forEach(l => {
        p.text(l, this.M + 9, yc, { size: 9.8, font: 'F2', color: C.texte, bold: true });
        yc += 13;
      });
      if (lignesNote.length) {
        yc += 2;
        lignesNote.forEach(l => {
          p.text(l, this.M + 11, yc, { size: 9.0, color: mode === 'bloque' ? coul : C.gris });
          yc += 12;
        });
      }
      p.y = y0 + hCarte + 5;

      const phs = (t.photos || []).filter(ph => ph && ph.dataUrl && ph.visibilite !== 'interne');
      if (phs.length) {
        await this.photos(phs, true, valeur(t.titre));
      }
    }

    /* Carte de traçabilité d'un blocage levé sur la journée */
    blocLeveeBlocage(item) {
      const p = this.pdf, C = this.C;
      const t = item.tache, h = item.hist;
      const orig = ORIGINES_BLOCAGE[h.origine || 'CLIENT'] || ORIGINES_BLOCAGE.CLIENT;
      const coul = hexRgb('#15803d');
      const fond = hexClair('#15803d', 0.91);

      const trace = [
        h.debutLe ? ('Bloqué le ' + frDateCourte(h.debutLe) + ' -> Levé le ' + frDateCourte(h.leveLe || this.bilan.dateJour)) : ('Levé le ' + frDateCourte(h.leveLe || this.bilan.dateJour)),
        valeur(h.duree) ? ('Attente / impact : ' + valeur(h.duree)) : '',
        valeur(h.motif) ? ('Motif initial : ' + valeur(h.motif)) : '',
        valeur(h.noteLevee) ? ('Résolution : ' + valeur(h.noteLevee)) : ''
      ].filter(Boolean).join('  ·  ');

      const lignesTitre = Pdf.wrap(valeur(t.titre), this.CW - 20, 9.5, true);
      const lignesTrace = trace ? Pdf.wrap(trace, this.CW - 22, 8.7) : [];
      const hCarte = 19 + lignesTitre.length * 12.5 + (lignesTrace.length ? lignesTrace.length * 11.5 + 5 : 4) + 5;

      this.saut(Math.min(hCarte, 120));
      const y0 = p.y;
      p.rect(this.M, y0, this.CW, hCarte, { fill: [1, 1, 1], stroke: C.bord, lineWidth: 0.5 });
      p.rect(this.M, y0, this.CW, 16, { fill: fond });
      p.rect(this.M, y0, 3.8, hCarte, { fill: coul });

      p.text(Pdf.trunc(item.phaseNom + '  ·  ' + orig.libelle, this.CW * 0.62, 8.2, true), this.M + 9, y0 + 11.2, { size: 8.2, font: 'F2', color: coul, bold: true });
      p.text('POINT BLOQUANT LEVE CE JOUR', this.W - this.M - 8, y0 + 11.2, { size: 7.8, font: 'F2', color: coul, align: 'right', bold: true });

      let yc = y0 + 27.5;
      lignesTitre.forEach(l => {
        p.text(l, this.M + 9, yc, { size: 9.5, font: 'F2', color: C.texte, bold: true });
        yc += 12.5;
      });
      if (lignesTrace.length) {
        yc += 2;
        lignesTrace.forEach(l => {
          p.text(l, this.M + 11, yc, { size: 8.7, color: C.gris });
          yc += 11.5;
        });
      }
      p.y = y0 + hCarte + 5;
    }

    /* Tableau synthétique complet de toutes les tâches du chantier */
    blocChecklistComplete() {
      const p = this.pdf, C = this.C, b = this.bilan;
      const phasesNonVides = b.parPhase.filter(ph => ph.taches.length > 0);
      if (!phasesNonVides.length) return;

      const colStatW = 68;
      const colDateW = 62;
      const colDomW = 66;
      const colTacheW = this.CW - colStatW - colDateW - colDomW;
      const hEnt = 18;

      const tracerEntete = () => {
        const y = p.y;
        p.rect(this.M, y, this.CW, hEnt, { fill: C.cyanClair, stroke: C.bordFort, lineWidth: 0.5 });
        p.text('Tâche / Opération', this.M + 6, y + 12.2, { size: 8.4, font: 'F2', color: C.navy, bold: true });
        p.text('Domaine', this.M + colTacheW + 5, y + 12.2, { size: 8.4, font: 'F2', color: C.navy, bold: true });
        p.text('Statut', this.M + colTacheW + colDomW + colStatW / 2, y + 12.2, { size: 8.4, font: 'F2', color: C.navy, align: 'center', bold: true });
        p.text('Réalisé le', this.W - this.M - 6, y + 12.2, { size: 8.4, font: 'F2', color: C.navy, align: 'right', bold: true });
        p.y = y + hEnt;
      };

      tracerEntete();

      phasesNonVides.forEach(ph => {
        if (p.y + 36 > this.limiteBas()) {
          p.newPage();
          this.enteteSuite();
          tracerEntete();
        }
        // Sous-bandeau de phase
        const yp = p.y;
        p.rect(this.M, yp, this.CW, 16, { fill: [0.945, 0.955, 0.975], stroke: C.bord, lineWidth: 0.4 });
        p.text(Pdf.trunc(ph.nom, this.CW * 0.72, 8.6, true), this.M + 6, yp + 11.2, { size: 8.6, font: 'F2', color: C.navy, bold: true });
        p.text(ph.fait + '/' + ph.total + ' (' + ph.pct + ' %)', this.W - this.M - 6, yp + 11.2, { size: 8.2, font: 'F2', color: C.gris, align: 'right' });
        p.y = yp + 16;

        ph.taches.forEach(t => {
          const wP = poidsTache(t);
          const txtTache = valeur(t.titre) + (wP > 1 ? ' (x' + wP + ')' : '');
          const lignesT = Pdf.wrap(txtTache, colTacheW - 12, 8.7).slice(0, 3);
          const hRow = Math.max(18, lignesT.length * 11 + 6);
          if (p.y + hRow > this.limiteBas()) {
            p.newPage();
            this.enteteSuite();
            tracerEntete();
          }
          const y = p.y;
          const st = STATUTS[t.statut] || STATUTS.afaire;
          const estAuj = t.statut === 'fait' && t.faitLe === b.dateJour;
          p.rect(this.M, y, this.CW, hRow, { fill: estAuj ? [0.96, 0.995, 0.975] : [1, 1, 1], stroke: C.bord, lineWidth: 0.35 });

          lignesT.forEach((lt, idx) => {
            p.text(lt, this.M + 6, y + 11.5 + idx * 11, { size: 8.7, color: C.texte });
          });

          const domTxt = DOMAINES[t.domaine] || '—';
          p.text(Pdf.trunc(domTxt, colDomW - 8, 8.0), this.M + colTacheW + 5, y + 12, { size: 8.0, color: C.gris });

          p.text(st.court, this.M + colTacheW + colDomW + colStatW / 2, y + 12,
            { size: 8.0, font: 'F2', color: hexRgb(st.couleur), align: 'center', bold: true });

          const dateTxt = t.statut === 'fait'
            ? (estAuj ? 'Ce jour' : (frDateCourte(t.faitLe) || 'Fait'))
            : (t.statut === 'encours' && t.progression ? t.progression + ' %' : '—');
          p.text(dateTxt, this.W - this.M - 6, y + 12, { size: 8.0, font: estAuj ? 'F2' : 'F1', color: estAuj ? hexRgb('#15803d') : C.gris, align: 'right' });

          p.y = y + hRow;
        });
      });
      p.y += 8;
    }

    async generer() {
      const c = this.c, s = this.s, b = this.bilan, p = this.pdf;

      // Préparation logos JPEG
      const logoSrc = (s.societe && s.societe.logo) || global.LOGO_BFR || '';
      if (logoSrc) {
        const jl = await toJpeg(logoSrc, 1250, 0.92);
        if (jl) this.logo = { bytes: Pdf.dataUrlToBytes(jl.dataUrl), w: jl.w, h: jl.h };
      }
      if (c.client && c.client.logo) {
        const jc = await toJpeg(c.client.logo, 500, 0.88);
        if (jc) this.logoClient = { bytes: Pdf.dataUrlToBytes(jc.dataUrl), w: jc.w, h: jc.h };
      }

      // 1. En-tête principale BFR Systems
      this.entetePrincipale();

      // 2. Section 1 : Synthèse & Avancement Global
      let numSec = 1;
      this.titreSection((numSec++) + '. Synthèse & Avancement du chantier', 'Jour ' + b.numeroJour + ' · ' + frDate(b.dateJour), 95);

      this.kv([
        ['Chantier / Projet', valeur(c.nom) || '—', !valeur(c.equipement)],
        ['Équipement / Ligne', valeur(c.equipement)],
        ['N° d\'affaire', valeur(c.affaire)],
        ['Dates prévisionnelles', [frDate(c.dateDebut), frDate(c.dateFinPrevue)].filter(Boolean).join(' au ')],
        ['Lieu d\'intervention', valeur(c.client && c.client.lieu) || valeur(c.client && c.client.adresse)]
      ]);

      this.blocAvancement();

      if (valeur(b.jour.synthese)) {
        this.blocTexte('Compte rendu de la journée', b.jour.synthese, CYAN, [0.975, 0.99, 1]);
      }

      // 3. Section 2 : Points bloquants, attentes client & levées de blocage du jour
      if (b.bloques.length > 0 || b.blocagesLevesCeJour.length > 0 || valeur(b.jour.aleas)) {
        const partsBloq = [];
        if (b.bloques.length) partsBloq.push(b.bloques.length + ' actif' + (b.bloques.length > 1 ? 's' : ''));
        if (b.blocagesLevesCeJour.length) partsBloq.push(b.blocagesLevesCeJour.length + ' levé' + (b.blocagesLevesCeJour.length > 1 ? 's' : '') + ' ce jour');
        this.titreSection((numSec++) + '. Points bloquants, Attentes & Levées', partsBloq.join(' · ') || 'Signalement', 55);
        if (valeur(b.jour.aleas)) {
          this.blocTexte('Aléas / Points d\'attention signalés ce jour', b.jour.aleas, hexRgb('#b91c1c'), [1, 0.97, 0.97]);
        }
        for (const t of b.bloques) {
          await this.blocTacheDetail(t, 'bloque');
        }
        for (const item of b.blocagesLevesCeJour) {
          this.blocLeveeBlocage(item);
        }
      }

      // 4. Section 3 : Travaux & Tâches réalisés ce jour
      this.titreSection(
        (numSec++) + '. Travaux réalisés ce jour (' + frDate(b.dateJour) + ')',
        b.faitCeJour.length + ' tâche' + (b.faitCeJour.length > 1 ? 's' : ''),
        45
      );
      if (b.faitCeJour.length > 0) {
        for (const t of b.faitCeJour) {
          await this.blocTacheDetail(t, 'fait');
        }
      } else {
        this.blocTexte(null, 'Aucune tâche clôturée définitivement sur cette journée (voir les tâches en cours et le compte rendu ci-dessus).');
      }

      // 5. Section 4 : Tâches en cours & Programme prévu demain
      if (b.enCours.length > 0 || valeur(b.jour.prevuDemain)) {
        this.titreSection((numSec++) + '. En cours & Programme prévu pour la suite', b.enCours.length ? (b.enCours.length + ' en cours') : null, 50);
        for (const t of b.enCours) {
          await this.blocTacheDetail(t, 'encours');
        }
        if (valeur(b.jour.prevuDemain)) {
          this.blocTexte('Programme prévu demain / Prochaines étapes', b.jour.prevuDemain, NAVY, [0.97, 0.97, 0.995]);
        }
      }

      // 6. Section 5 : Photos complémentaires du jour (hors mémo interne BFR)
      const photosJour = (b.jour.photos || []).filter(ph => ph && ph.dataUrl && ph.visibilite !== 'interne');
      if (photosJour.length > 0) {
        this.titreSection((numSec++) + '. Photos d\'avancement du jour', photosJour.length + ' photo' + (photosJour.length > 1 ? 's' : ''), 175);
        await this.photos(photosJour, true, '');
      }

      // 7. Section 6 : État complet de la checklist chantier (sauf si désactivé dans les réglages)
      if (!s.rapport || s.rapport.inclureChecklist !== false) {
        if (b.total > 0) {
          this.titreSection((numSec++) + '. État récapitulatif de la checklist chantier', b.faitTotal.length + ' / ' + b.total + ' (' + b.pctGlobal + ' %)', 70);
          this.blocChecklistComplete();
        }
      }

      // Pied de page officiel BFR Systems sur toutes les pages
      const sieges = lignesPiedPage(s);
      p.addFooters(function (d, num, total) {
        const y = d.H - 20;
        d.line(d.margin, y - 26, d.W - d.margin, y - 26, { color: COULEURS_PDF.bord, width: 0.6 });
        const largeur = d.W - 2 * d.margin - 80;
        sieges.forEach(function (ligne, k) {
          d.text(Pdf.trunc(ligne, largeur, k === 0 ? 8.2 : 7.4, k === 0), d.margin, y - 16 + k * 9.2,
            { size: k === 0 ? 8.2 : 7.4, font: k === 0 ? 'F2' : 'F1', color: COULEURS_PDF.gris, bold: k === 0 });
        });
        d.text('Page ' + num + ' / ' + total, d.W - d.margin, y - 8, { size: 8.0, font: 'F2', color: COULEURS_PDF.gris, align: 'right', bold: true });
      });

      const fname = nomFichier(c, b, 'pdf');
      if (this.opts.apercu) return { apercu: p, filename: fname, bilan: b };
      return { blob: p.blob(), filename: fname, bilan: b };
    }
  }

  /* ===================== Génération Word (.docx) BFR ================== */
  async function genererWord(chantier, reglages, dateJour) {
    const c = chantier || {};
    const s = reglages || {};
    const b = calculerBilan(c, dateJour);
    const doc = new Docx.Doc({
      auteur: (s.societe && s.societe.nom) || 'BFR SYSTEMS',
      pied: lignesPiedPage(s)
    });

    const logoSrc = (s.societe && s.societe.logo) || global.LOGO_BFR || '';
    if (logoSrc) {
      const jl = await toJpeg(logoSrc, 1250, 0.92);
      if (jl) doc.logoEntete(jl.dataUrl);
    }

    doc.titreDoc = 'Rapport quotidien de chantier — Jour ' + b.numeroJour + ' (' + frDate(b.dateJour) + ')';

    const cli = c.client || {};
    if (valeur(cli.nom)) doc.para(cli.nom, { font: 'Poppins', gras: true, taille: 13, couleur: '332E72', apres: 40 });
    if (valeur(cli.lieu) || valeur(cli.adresse)) doc.para(valeur(cli.lieu) || valeur(cli.adresse), { taille: 10, couleur: '64748B', apres: 120 });

    doc.grandTitre('Rapport quotidien de chantier', 24);
    doc.para('Jour ' + b.numeroJour + ' — ' + frDate(b.dateJour), { font: 'Poppins', gras: true, taille: 14, couleur: '06BAF2', align: 'center', apres: 80 });
    if (valeur(c.nom)) {
      doc.para(valeur(c.nom) + (valeur(c.affaire) ? ' (' + valeur(c.affaire) + ')' : ''), { font: 'Poppins', gras: true, taille: 12, couleur: '332E72', align: 'center', apres: 180 });
    }

    const t = s.technicien || {};
    const respNom = valeur(c.responsable) || nomComplet(t) || 'Équipe BFR Systems';
    doc.para([
      { t: 'Interlocuteur BFR Systems : ', gras: true, couleur: '332E72' },
      { t: respNom + (valeur(t.tel) ? ' · Tél. ' + valeur(t.tel) : '') + (valeur(t.email) ? ' · ' + valeur(t.email) : '') }
    ], { encadre: true, apres: 180 });

    let numSec = 1;
    doc.bandeau((numSec++) + '. SYNTHÈSE & AVANCEMENT GLOBAL', '06BAF2', b.pctGlobal + ' % (' + b.faitTotal.length + '/' + b.total + ')');

    doc.tableau([
      [
        { texte: 'Fait ce jour', gras: true, align: 'center', couleur: '15803D', fond: 'DCFCE7' },
        { texte: 'Total terminé', gras: true, align: 'center', couleur: '0369A1', fond: 'E0F2FE' },
        { texte: 'En cours', gras: true, align: 'center', couleur: 'B45309', fond: 'FEF3C7' },
        { texte: 'Points bloquants', gras: true, align: 'center', couleur: 'B91C1C', fond: 'FEE2E2' }
      ],
      [
        { texte: '+' + b.faitCeJour.length, gras: true, taille: 14, align: 'center', couleur: '15803D' },
        { texte: b.faitTotal.length + ' / ' + b.total + ' (' + b.pctGlobal + ' %)', gras: true, taille: 13, align: 'center', couleur: '0369A1' },
        { texte: String(b.enCours.length), gras: true, taille: 14, align: 'center', couleur: 'B45309' },
        { texte: String(b.bloques.length), gras: true, taille: 14, align: 'center', couleur: b.bloques.length ? 'B91C1C' : '64748B' }
      ]
    ], { largeurs: [25, 25, 25, 25] });

    if (b.nbJoursTotal >= 2 && b.cadence) {
      doc.para([
        { t: 'Cadence planning : ', gras: true, couleur: '332E72' },
        { t: b.cadence.libelle, gras: true, couleur: b.cadence.couleur.replace('#', '').toUpperCase() },
        { t: ' — Avancement ' + b.pctGlobal + ' % pour ' + b.cadence.pctDelai + ' % du délai écoulé (Jour ' + b.numeroJour + ' / ' + b.nbJoursTotal + ')' }
      ], { avant: 80, apres: 80 });
    }

    if (valeur(b.jour.synthese)) {
      doc.para('Compte rendu de la journée :', { font: 'Poppins', gras: true, taille: 10.5, couleur: '332E72', avant: 120, apres: 40 });
      doc.para(b.jour.synthese, { apres: 140 });
    }

    async function insererPhotosWord(photosBrutes, contexte) {
      const groupes = grouperPhotosPourRapport(photosBrutes, false);
      for (const g of groupes) {
        if (g.type === 'paire') {
          doc.para('⚖ Comparatif AVANT / APRÈS' + (g.legende || contexte ? ' — ' + (g.legende || contexte) : ''), { gras: true, taille: 9.5, couleur: '332E72', avant: 60, apres: 30 });
          const jAv = await toJpeg(g.avant.dataUrl, 1000, 0.85);
          if (jAv) doc.image(jAv.dataUrl, 9.5, { legende: 'AVANT' + (g.avant.legende ? ' — ' + g.avant.legende : '') });
          const jAp = await toJpeg(g.apres.dataUrl, 1000, 0.85);
          if (jAp) doc.image(jAp.dataUrl, 9.5, { legende: 'APRÈS' + (g.apres.legende ? ' — ' + g.apres.legende : '') });
        } else {
          const jp = await toJpeg(g.photo.dataUrl, 1000, 0.85);
          const pref = g.etiquette ? '[' + g.etiquette + '] ' : '';
          if (jp) doc.image(jp.dataUrl, 11, { legende: pref + (g.photo.legende || contexte || '') });
        }
      }
    }

    if (b.bloques.length || b.blocagesLevesCeJour.length || valeur(b.jour.aleas)) {
      doc.bandeau((numSec++) + '. POINTS BLOQUANTS, ATTENTES & LEVÉES', 'DC2626', b.bloques.length + ' actif(s)');
      if (valeur(b.jour.aleas)) doc.para(b.jour.aleas, { couleur: '991B1B', gras: true, apres: 100 });
      for (const tc of b.bloques) {
        const orig = ORIGINES_BLOCAGE[tc.blocageOrigine || 'CLIENT'] || ORIGINES_BLOCAGE.CLIENT;
        doc.para([
          { t: '[' + orig.libelle + ' · ' + b.nomPhase(tc) + '] ', gras: true, couleur: 'B91C1C' },
          { t: tc.titre, gras: true }
        ], { apres: 30 });
        const detBloq = [
          valeur(tc.blocage),
          valeur(tc.bloqueDepuis) ? 'Depuis le ' + frDate(tc.bloqueDepuis) : '',
          valeur(tc.blocageDuree) ? 'Attente : ' + valeur(tc.blocageDuree) : '',
          valeur(tc.commentaire)
        ].filter(Boolean).join(' — ');
        if (detBloq) doc.para(detBloq, { couleur: '991B1B', apres: 90 });
        await insererPhotosWord(tc.photos, tc.titre);
      }
      for (const it of b.blocagesLevesCeJour) {
        const orig = ORIGINES_BLOCAGE[it.hist.origine || 'CLIENT'] || ORIGINES_BLOCAGE.CLIENT;
        doc.para([
          { t: '✓ [BLOCAGE LEVÉ CE JOUR · ' + orig.libelle + '] ', gras: true, couleur: '15803D' },
          { t: it.tache.titre, gras: true }
        ], { apres: 25 });
        const tr = [
          it.hist.debutLe ? ('Bloqué le ' + frDateCourte(it.hist.debutLe) + ' → Levé le ' + frDateCourte(it.hist.leveLe)) : '',
          valeur(it.hist.duree) ? ('Attente : ' + valeur(it.hist.duree)) : '',
          valeur(it.hist.motif)
        ].filter(Boolean).join(' · ');
        if (tr) doc.para(tr, { couleur: '475569', apres: 80 });
      }
    }

    doc.bandeau((numSec++) + '. TRAVAUX RÉALISÉS CE JOUR (' + frDate(b.dateJour) + ')', '06BAF2', b.faitCeJour.length + ' tâche(s)');
    if (b.faitCeJour.length) {
      for (const tc of b.faitCeJour) {
        const wP = poidsTache(tc);
        doc.para([
          { t: '✓ [' + b.nomPhase(tc) + '] ', gras: true, couleur: '15803D' },
          { t: tc.titre + (wP > 1 ? ' (×' + wP + ')' : ''), gras: true }
        ], { apres: 30 });
        if (valeur(tc.commentaire)) doc.para(tc.commentaire, { couleur: '475569', apres: 80 });
        await insererPhotosWord(tc.photos, tc.titre);
      }
    } else {
      doc.para('Aucune tâche clôturée définitivement sur cette journée.', { italique: true, couleur: '64748B' });
    }

    if (b.enCours.length || valeur(b.jour.prevuDemain)) {
      doc.bandeau((numSec++) + '. EN COURS & PROGRAMME PRÉVU DEMAIN', '06BAF2');
      for (const tc of b.enCours) {
        doc.para([
          { t: '• [' + b.nomPhase(tc) + '] ', gras: true, couleur: 'B45309' },
          { t: tc.titre + (tc.progression ? ' (' + tc.progression + ' %)' : '') },
          tc.commentaire ? { t: ' — ' + tc.commentaire, couleur: '64748B' } : { t: '' }
        ], { apres: 50 });
        await insererPhotosWord((tc.photos || []).filter(p => !p.datePrise || p.datePrise === b.dateJour), tc.titre);
      }
      if (valeur(b.jour.prevuDemain)) {
        doc.para('Prévu demain / Suite :', { font: 'Poppins', gras: true, taille: 10.5, couleur: '332E72', avant: 100, apres: 40 });
        doc.para(b.jour.prevuDemain);
      }
    }

    const photosJour = (b.jour.photos || []).filter(p => p && p.dataUrl && p.visibilite !== 'interne');
    if (photosJour.length) {
      doc.bandeau((numSec++) + '. PHOTOS DU JOUR', '06BAF2', photosJour.length + ' photo(s)');
      await insererPhotosWord(photosJour, '');
    }

    if ((!s.rapport || s.rapport.inclureChecklist !== false) && b.total > 0) {
      doc.bandeau((numSec++) + '. ÉTAT RÉCAPITULATIF DE LA CHECKLIST', '06BAF2', b.pctGlobal + ' %');
      const lignesTab = [[
        { texte: 'Phase / Lot', gras: true, couleur: '332E72', fond: 'EAF8FD' },
        { texte: 'Tâche', gras: true, couleur: '332E72', fond: 'EAF8FD' },
        { texte: 'Statut', gras: true, align: 'center', couleur: '332E72', fond: 'EAF8FD' },
        { texte: 'Date', gras: true, align: 'center', couleur: '332E72', fond: 'EAF8FD' }
      ]];
      b.parPhase.forEach(ph => {
        ph.taches.forEach(tc => {
          const st = STATUTS[tc.statut] || STATUTS.afaire;
          lignesTab.push([
            { texte: ph.nom, taille: 9.5, couleur: '475569' },
            { texte: tc.titre, taille: 9.5 },
            { texte: st.court, gras: true, taille: 9, align: 'center', couleur: st.couleur.replace('#', '').toUpperCase() },
            { texte: tc.statut === 'fait' ? (tc.faitLe === b.dateJour ? 'Ce jour' : frDateCourte(tc.faitLe)) : '—', taille: 9, align: 'center', couleur: '64748B' }
          ]);
        });
      });
      doc.tableau(lignesTab, { largeurs: [24, 48, 15, 13] });
    }

    return { blob: doc.blob(), filename: nomFichier(c, b, 'docx'), bilan: b };
  }

  function nomFichier(chantier, bilan, ext) {
    const d = (bilan.dateJour || '').replace(/-/g, '');
    const morceaux = [
      'Rapport-Chantier-BFR',
      'J' + bilan.numeroJour,
      d,
      chantier.affaire ? slug(chantier.affaire) : '',
      slug((chantier.client && chantier.client.nom) || chantier.nom || 'Chantier')
    ].filter(Boolean);
    return morceaux.join('_') + '.' + ext;
  }

  /* ===================== Objet & Corps d'e-mail pré-remplis =========== */
  function objetMail(chantier, reglages, dateJour) {
    const c = chantier || {};
    const b = calculerBilan(c, dateJour);
    const nomProjet = [valeur(c.affaire), valeur(c.nom), valeur(c.client && c.client.nom)].filter(Boolean).slice(0, 2).join(' - ') || 'Chantier BFR';
    const modele = valeur(reglages && reglages.mail && reglages.mail.objet);
    if (modele) {
      return modele
        .replace(/\{\{\s*chantier\s*\}\}/gi, valeur(c.nom) || 'Chantier')
        .replace(/\{\{\s*affaire\s*\}\}/gi, valeur(c.affaire) || '—')
        .replace(/\{\{\s*client\s*\}\}/gi, valeur(c.client && c.client.nom) || '—')
        .replace(/\{\{\s*jour\s*\}\}/gi, String(b.numeroJour))
        .replace(/\{\{\s*date\s*\}\}/gi, frDate(b.dateJour))
        .replace(/\{\{\s*avancement\s*\}\}/gi, b.pctGlobal + '%');
    }
    return '[BFR Systems] Rapport quotidien J' + b.numeroJour + ' (' + frDate(b.dateJour) + ') — ' + nomProjet + ' — ' + b.pctGlobal + '%';
  }

  function corpsMail(chantier, reglages, dateJour) {
    const c = chantier || {};
    const s = reglages || {};
    const b = calculerBilan(c, dateJour);
    const t = s.technicien || {};
    const signataire = valeur(c.responsable) || nomComplet(t) || 'Équipe BFR Systems';

    const lignes = [];
    lignes.push('Bonjour,');
    lignes.push('');
    lignes.push('Veuillez trouver ci-joint le rapport quotidien d\'avancement du chantier :');
    lignes.push('• Chantier : ' + (valeur(c.nom) || '—') + (valeur(c.affaire) ? ' (Affaire ' + valeur(c.affaire) + ')' : ''));
    if (valeur(c.client && c.client.nom)) {
      lignes.push('• Client / Site : ' + valeur(c.client.nom) + (valeur(c.client.lieu) ? ' — ' + valeur(c.client.lieu) : ''));
    }
    lignes.push('• Journée : Jour ' + b.numeroJour + (b.nbJoursTotal > 1 ? ' / ' + b.nbJoursTotal : '') + ' — ' + frDate(b.dateJour));
    lignes.push('• Avancement global : ' + b.pctGlobal + ' % (' + b.faitTotal.length + ' / ' + b.total + ' tâches terminées)' +
      (b.nbJoursTotal > 1 && b.cadence && b.cadence.actif ? ' — ' + b.cadence.libelle + ' (délai J' + b.numeroJour + '/' + b.nbJoursTotal + ' : ' + b.cadence.pctDelai + '%)' : ''));
    lignes.push('');

    if (valeur(b.jour.synthese)) {
      lignes.push('SYNTHÈSE DU JOUR :');
      lignes.push(valeur(b.jour.synthese));
      lignes.push('');
    }

    if (b.bloques.length > 0 || b.blocagesLevesCeJour.length > 0 || valeur(b.jour.aleas)) {
      lignes.push('⚠ POINTS BLOQUANTS / ATTENTES (' + b.bloques.length + ' actif' + (b.bloques.length > 1 ? 's' : '') + ') :');
      if (valeur(b.jour.aleas)) lignes.push('- ' + valeur(b.jour.aleas));
      b.bloques.forEach(tc => {
        const orig = ORIGINES_BLOCAGE[tc.blocageOrigine || 'CLIENT'] || ORIGINES_BLOCAGE.CLIENT;
        const details = [
          valeur(tc.blocage),
          valeur(tc.bloqueDepuis) ? 'depuis le ' + frDateCourte(tc.bloqueDepuis) : '',
          valeur(tc.blocageDuree) ? 'attente ' + valeur(tc.blocageDuree) : ''
        ].filter(Boolean).join(' · ');
        lignes.push('- [' + orig.libelle.toUpperCase() + ' — ' + b.nomPhase(tc) + '] ' + tc.titre + (details ? ' → ' + details : ''));
      });
      b.blocagesLevesCeJour.forEach(it => {
        const orig = ORIGINES_BLOCAGE[it.hist.origine || 'CLIENT'] || ORIGINES_BLOCAGE.CLIENT;
        lignes.push('✓ [LEVÉ CE JOUR — ' + orig.libelle + '] ' + it.tache.titre +
          (it.hist.debutLe ? ' (bloqué le ' + frDateCourte(it.hist.debutLe) + (valeur(it.hist.duree) ? ', attente ' + valeur(it.hist.duree) : '') + ')' : ''));
      });
      lignes.push('');
    }

    lignes.push('RÉALISÉ CE JOUR (' + b.faitCeJour.length + ') :');
    if (b.faitCeJour.length > 0) {
      b.faitCeJour.forEach(tc => {
        lignes.push('✓ [' + b.nomPhase(tc) + '] ' + tc.titre + (valeur(tc.commentaire) ? ' (' + valeur(tc.commentaire) + ')' : ''));
      });
    } else {
      lignes.push('- Travaux en cours (aucune tâche clôturée définitivement ce jour).');
    }
    lignes.push('');

    if (b.enCours.length > 0 || valeur(b.jour.prevuDemain)) {
      lignes.push('EN COURS & PRÉVU DEMAIN :');
      b.enCours.forEach(tc => {
        lignes.push('• [En cours' + (tc.progression ? ' ' + tc.progression + '%' : '') + '] ' + tc.titre);
      });
      if (valeur(b.jour.prevuDemain)) {
        lignes.push(valeur(b.jour.prevuDemain));
      }
      lignes.push('');
    }

    lignes.push('Cordialement,');
    lignes.push(signataire);
    lignes.push((valeur(t.fonction) || 'Chantier & Mise en service') + ' — BFR SYSTEMS');
    if (valeur(t.tel)) lignes.push('Tél. : ' + valeur(t.tel));

    return lignes.join('\n');
  }

  global.Report = {
    STATUTS: STATUTS,
    DOMAINES: DOMAINES,
    ORIGINES_BLOCAGE: ORIGINES_BLOCAGE,
    poidsTache: poidsTache,
    grouperPhotosPourRapport: grouperPhotosPourRapport,
    frDate: frDate,
    frDateCourte: frDateCourte,
    jourSemaineFr: jourSemaineFr,
    nomComplet: nomComplet,
    toJpeg: toJpeg,
    estWeekEnd: estWeekEnd,
    genererDatesPeriode: genererDatesPeriode,
    datesPlanifieesChantier: datesPlanifieesChantier,
    estJourVide: estJourVide,
    datesJoursTriees: datesJoursTriees,
    calculerBilan: calculerBilan,
    genererPDF: function (chantier, reglages, dateJour) {
      return new RapportQuotidienPDF(chantier, reglages, dateJour, { apercu: false }).generer();
    },
    genererApercu: function (chantier, reglages, dateJour) {
      return new RapportQuotidienPDF(chantier, reglages, dateJour, { apercu: true }).generer();
    },
    genererWord: genererWord,
    objetMail: objetMail,
    corpsMail: corpsMail
  };
})(window);
