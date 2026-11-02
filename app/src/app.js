/* =========================================================================
   app.js — Suivi de Chantier & Rapport Quotidien BFR Systems
   Application terrain mobile-first, 100 % hors connexion :
     - Suivi d'un chantier spécifique sur plusieurs jours (J1, J2, J3…)
     - Checklist par Phases / Lots : cocher au fil de l'eau, statuts terrain
       (À faire, En cours, Fait, Bloqué), commentaires vocaux, photos annotées
     - Import facile : copier-coller texte, Excel (.xlsx), CSV, JSON, modèles BFR
     - Génération et envoi quotidien du Rapport PDF (et Word) brandé BFR Systems
       aux personnes concernées par le projet (sans signature client chaque soir)
   ========================================================================= */
(function () {
  'use strict';

  const CLE_COURANT = 'bfr_chantier_v1.courantId';
  const CLE_INDEX   = 'bfr_chantier_v1.index';
  const CLE_SECOURS = 'bfr_chantier_v1.secours';
  const CLE_REGLAGES = 'bfr_chantier_v1.reglages';

  const DB_NAME = 'bfr_chantier_db';
  const DB_VERSION = 1;
  const STORE_CHANTIERS = 'chantiers';
  const STORE_PHOTOS = 'photos';

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function uid(p) {
    return (p || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function aujourdhuiISO() {
    const d = new Date();
    const pad = (n) => ('0' + n).slice(-2);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function hierISO() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = (n) => ('0' + n).slice(-2);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function heureCourte() {
    const d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* ===================== Notifications Toast ========================== */
  let toastTimer = null;
  function toast(msg, duree) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duree || 2400);
  }

  /* ===================== Boîtes de dialogue intégrées ================= */
  const Dialogue = {
    informer: function (msg, opts) {
      opts = opts || {};
      return new Promise(function (resolve) {
        const f = document.createElement('div');
        f.className = 'dlg-fond';
        f.innerHTML = `<div class="dlg">
          <p class="dlg-msg">${esc(msg)}</p>
          <div class="dlg-btns"><button type="button" class="btn principal sm" data-ok="1">${esc(opts.ok || 'Compris')}</button></div>
        </div>`;
        document.body.appendChild(f);
        f.addEventListener('click', (e) => {
          if (e.target === f || e.target.closest('[data-ok]')) { f.remove(); resolve(true); }
        });
      });
    },
    confirmer: function (msg, opts) {
      opts = opts || {};
      return new Promise(function (resolve) {
        const f = document.createElement('div');
        f.className = 'dlg-fond';
        f.innerHTML = `<div class="dlg">
          <p class="dlg-msg">${esc(msg)}</p>
          <div class="dlg-btns">
            <button type="button" class="btn grey sm" data-non="1">${esc(opts.annuler || 'Annuler')}</button>
            <button type="button" class="btn ${opts.danger ? 'danger' : 'principal'} sm" data-oui="1">${esc(opts.ok || 'Confirmer')}</button>
          </div>
        </div>`;
        document.body.appendChild(f);
        f.addEventListener('click', (e) => {
          if (e.target.closest('[data-oui]')) { f.remove(); resolve(true); }
          else if (e.target === f || e.target.closest('[data-non]')) { f.remove(); resolve(false); }
        });
      });
    },
    saisir: function (msg, valeurDefaut, placeholder) {
      return new Promise(function (resolve) {
        const f = document.createElement('div');
        f.className = 'dlg-fond';
        f.innerHTML = `<div class="dlg">
          <p class="dlg-msg" style="font-weight:600;color:var(--bfr-secondary)">${esc(msg)}</p>
          <input type="text" class="dlg-input" value="${esc(valeurDefaut || '')}" placeholder="${esc(placeholder || '')}">
          <div class="dlg-btns">
            <button type="button" class="btn grey sm" data-non="1">Annuler</button>
            <button type="button" class="btn principal sm" data-oui="1">Valider</button>
          </div>
        </div>`;
        document.body.appendChild(f);
        const inp = $('.dlg-input', f);
        setTimeout(() => { inp.focus(); inp.select(); }, 40);
        const valider = () => { const v = inp.value; f.remove(); resolve(v); };
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); valider(); }
          else if (e.key === 'Escape') { f.remove(); resolve(null); }
        });
        f.addEventListener('click', (e) => {
          if (e.target.closest('[data-oui]')) valider();
          else if (e.target === f || e.target.closest('[data-non]')) { f.remove(); resolve(null); }
        });
      });
    }
  };
  window.Dialogue = Dialogue;

  /* ===================== Panneaux modaux (Bottom Sheet) =============== */
  const Ouvrir = {
    ouvrir: function (html, branche, surFermeture) {
      $$('.sheet').forEach(x => x.remove());
      const overlay = document.createElement('div');
      overlay.className = 'sheet open';
      overlay.innerHTML = html;
      document.body.appendChild(overlay);
      const panneau = $('.panel', overlay);
      if (branche) branche(panneau, overlay);
      overlay.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-a]');
        if (ev.target === overlay || (b && b.dataset.a === 'fermer')) {
          overlay.remove();
          if (surFermeture) surFermeture();
          rendreTout();
        }
      });
      return panneau;
    },
    fermerTout: function () {
      $$('.sheet').forEach(x => x.remove());
    }
  };

  /* ===================== Stockage IndexedDB + Photos ================== */
  const BaseLocale = (function () {
    let dbPromise = null;
    const memPhotos = new Map();

    function ouvrir() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise(function (resolve) {
        try {
          if (!window.indexedDB) { resolve(null); return; }
          const req = window.indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = function (e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_CHANTIERS)) db.createObjectStore(STORE_CHANTIERS, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORE_PHOTOS)) db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
          };
          req.onsuccess = (e) => resolve(e.target.result);
          req.onerror = () => resolve(null);
          req.onblocked = () => resolve(null);
        } catch (_) { resolve(null); }
      });
      return dbPromise;
    }

    async function sauverPhoto(id, dataUrl, chantierId) {
      if (!id || !dataUrl) return false;
      memPhotos.set(id, dataUrl);
      const db = await ouvrir();
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction([STORE_PHOTOS], 'readwrite');
          tx.objectStore(STORE_PHOTOS).put({ id: id, dataUrl: dataUrl, chantierId: chantierId || '', maj: Date.now() });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) { resolve(false); }
      });
    }

    async function lirePhoto(id) {
      if (!id) return null;
      if (memPhotos.has(id)) return memPhotos.get(id);
      const db = await ouvrir();
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          const r = db.transaction([STORE_PHOTOS], 'readonly').objectStore(STORE_PHOTOS).get(id);
          r.onsuccess = () => {
            const d = r.result && r.result.dataUrl ? r.result.dataUrl : null;
            if (d) memPhotos.set(id, d);
            resolve(d);
          };
          r.onerror = () => resolve(null);
        } catch (_) { resolve(null); }
      });
    }

    function listerPhotosChantier(c) {
      const slots = [];
      if (!c) return slots;
      if (c.client && c.client.logo) {
        if (!c.client.logoId) c.client.logoId = 'logo_cli_' + c.id;
        slots.push({ id: c.client.logoId, get: () => c.client.logo, set: (v) => { c.client.logo = v; } });
      } else if (c.client && c.client.logoId) {
        slots.push({ id: c.client.logoId, get: () => c.client.logo, set: (v) => { c.client.logo = v; } });
      }
      (c.taches || []).forEach(t => {
        (t.photos || []).forEach((ph, i) => {
          if (!ph.id) ph.id = 'pht_' + c.id + '_' + t.id + '_' + i;
          slots.push({ id: ph.id, get: () => ph.dataUrl, set: (v) => { ph.dataUrl = v; } });
        });
      });
      Object.keys(c.jours || {}).forEach(d => {
        const j = c.jours[d];
        ((j && j.photos) || []).forEach((ph, i) => {
          if (!ph.id) ph.id = 'phj_' + c.id + '_' + d + '_' + i;
          slots.push({ id: ph.id, get: () => ph.dataUrl, set: (v) => { ph.dataUrl = v; } });
        });
      });
      return slots;
    }

    async function sauverChantier(c) {
      if (!c || !c.id) return false;
      c.maj = new Date().toISOString();
      const slots = listerPhotosChantier(c);
      const sauvees = new Set();
      await Promise.all(slots.map(async s => {
        const val = s.get();
        if (val) {
          const ok = await sauverPhoto(s.id, val, c.id);
          if (ok) sauvees.add(s.id);
        }
      }));

      // Copie allégée pour IndexedDB & localStorage
      const copie = JSON.parse(JSON.stringify(c));
      listerPhotosChantier(copie).forEach(s => {
        if (sauvees.has(s.id)) s.set('');
      });

      try { localStorage.setItem(CLE_SECOURS, JSON.stringify(copie)); } catch (_) {}

      const db = await ouvrir();
      if (!db) return true;
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction([STORE_CHANTIERS], 'readwrite');
          tx.objectStore(STORE_CHANTIERS).put(copie);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) { resolve(false); }
      });
    }

    async function chargerChantier(id) {
      const db = await ouvrir();
      let c = null;
      if (db && id) {
        c = await new Promise(function (resolve) {
          try {
            const r = db.transaction([STORE_CHANTIERS], 'readonly').objectStore(STORE_CHANTIERS).get(id);
            r.onsuccess = () => resolve(r.result || null);
            r.onerror = () => resolve(null);
          } catch (_) { resolve(null); }
        });
      }
      if (!c) {
        try {
          const sec = JSON.parse(localStorage.getItem(CLE_SECOURS) || 'null');
          if (sec && (!id || sec.id === id)) c = sec;
        } catch (_) {}
      }
      if (!c) return null;
      const slots = listerPhotosChantier(c);
      await Promise.all(slots.map(async s => {
        if (!s.get() && s.id) {
          const data = await lirePhoto(s.id);
          if (data) s.set(data);
        }
      }));
      return c;
    }

    async function listerTous() {
      const db = await ouvrir();
      if (!db) return [];
      return new Promise(function (resolve) {
        try {
          const r = db.transaction([STORE_CHANTIERS], 'readonly').objectStore(STORE_CHANTIERS).getAll();
          r.onsuccess = () => resolve(Array.isArray(r.result) ? r.result : []);
          r.onerror = () => resolve([]);
        } catch (_) { resolve([]); }
      });
    }

    async function supprimerChantier(id) {
      const db = await ouvrir();
      if (!db || !id) return;
      return new Promise(function (resolve) {
        try {
          const tx = db.transaction([STORE_CHANTIERS], 'readwrite');
          tx.objectStore(STORE_CHANTIERS).delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) { resolve(false); }
      });
    }

    return {
      sauverChantier: sauverChantier,
      chargerChantier: chargerChantier,
      listerTous: listerTous,
      supprimerChantier: supprimerChantier
    };
  })();

  /* ===================== Réglages & État par défaut =================== */
  const REGLAGES_DEFAUT = {
    societe: {
      nom: 'BFR SYSTEMS',
      piedPage: '50 allée des érables, 01150 Blyes, France',
      logo: ''
    },
    technicien: {
      prenom: '',
      nom: '',
      fonction: 'Chargé de chantier / Montage',
      tel: '',
      email: ''
    },
    mail: {
      destinatairesDefaut: [], // [{ nom, role, email, type: 'to'|'cc' }]
      objet: '[BFR Systems] Rapport quotidien J{{jour}} ({{date}}) — {{chantier}} — {{avancement}}'
    },
    rapport: {
      inclureChecklist: true
    }
  };

  function chargerReglages() {
    try {
      const brut = JSON.parse(localStorage.getItem(CLE_REGLAGES) || '{}');
      return {
        societe: Object.assign({}, REGLAGES_DEFAUT.societe, brut.societe || {}),
        technicien: Object.assign({}, REGLAGES_DEFAUT.technicien, brut.technicien || {}),
        mail: Object.assign({}, REGLAGES_DEFAUT.mail, brut.mail || {}),
        rapport: Object.assign({}, REGLAGES_DEFAUT.rapport, brut.rapport || {})
      };
    } catch (_) {
      return JSON.parse(JSON.stringify(REGLAGES_DEFAUT));
    }
  }

  function sauverReglages() {
    try { localStorage.setItem(CLE_REGLAGES, JSON.stringify(S)); } catch (_) {}
  }

  function nouveauChantierVierge(opts) {
    opts = opts || {};
    const auj = aujourdhuiISO();
    const modele = ImportTaches.depuisModele(opts.modeleId || 'vierge');
    const dests = ((S && S.mail && S.mail.destinatairesDefaut) || []).map(d => Object.assign({}, d, { id: uid('dst'), actif: true }));
    const J = {};
    J[auj] = {
      date: auj,
      horaires: '08h00 - 17h30',
      equipeJour: Report.nomComplet(S && S.technicien) || '',
      synthese: '',
      aleas: '',
      prevuDemain: '',
      photos: [],
      envoyeLe: ''
    };
    return {
      id: uid('ch'),
      estDemo: !!opts.estDemo,
      nom: opts.nom || '',
      affaire: opts.affaire || '',
      equipement: opts.equipement || '',
      dateDebut: auj,
      dateFinPrevue: '',
      responsable: Report.nomComplet(S && S.technicien) || '',
      equipe: '',
      client: {
        nom: '',
        lieu: '',
        adresse: '',
        contact: '',
        fonction: '',
        tel: '',
        email: '',
        logo: ''
      },
      destinataires: dests,
      phases: modele.phases,
      taches: modele.taches,
      jourActif: auj,
      jours: J,
      phasesPliees: {},
      maj: new Date().toISOString()
    };
  }

  /* Exemple réaliste chargé uniquement au tout premier lancement pour découvrir l'application */
  function creerChantierDemonstration() {
    const j1 = hierISO();
    const j2 = aujourdhuiISO();
    const ch = nouveauChantierVierge({ modeleId: 'installation_ligne', estDemo: true });
    ch.nom = 'Installation ligne d\'encaissage robotisée BFR';
    ch.affaire = 'AFF-2026-118';
    ch.equipement = 'Cellule d\'encaissage haute cadence + Convoyage amont/aval';
    ch.dateDebut = j1;
    ch.responsable = Report.nomComplet(S.technicien) || 'Technicien Chantier BFR';
    ch.equipe = '2 monteurs-câbleurs BFR';
    ch.client = {
      nom: 'Laiterie du Val d\'Ain',
      lieu: 'Usine de Bourg-en-Bresse — Hall Conditionnement Ligne 3',
      adresse: 'Zone Industrielle Nord, 01000 Bourg-en-Bresse',
      contact: 'M. Laurent Mercier',
      fonction: 'Responsable Travaux Neufs',
      tel: '06 42 18 55 90',
      email: 'l.mercier@client-exemple.fr',
      logo: ''
    };
    ch.destinataires = [
      { id: uid('dst'), nom: 'M. Laurent Mercier', role: 'Client — Resp. Travaux Neufs', email: 'l.mercier@client-exemple.fr', type: 'to', actif: true },
      { id: uid('dst'), nom: 'Chef de Projet BFR', role: 'BFR Systems — Chargé d\'affaires', email: 'projets@bfr-systems.example', type: 'to', actif: true },
      { id: uid('dst'), nom: 'Responsable Montage / SAV', role: 'BFR Systems — Coordination', email: 'sav@bfr-systems.example', type: 'cc', actif: true }
    ];

    // Marquage réaliste sur 2 jours (J1 hier + J2 aujourd'hui)
    const ts = ch.taches;
    [0, 1, 2, 3].forEach(i => { if (ts[i]) { ts[i].statut = 'fait'; ts[i].faitLe = j1; ts[i].progression = 100; } });
    if (ts[4]) { ts[4].statut = 'fait'; ts[4].faitLe = j2; ts[4].progression = 100; ts[4].commentaire = 'Assemblage mécanique validé entre cellule et convoyeur d\'entrée.'; }
    if (ts[5]) { ts[5].statut = 'fait'; ts[5].faitLe = j2; ts[5].progression = 100; ts[5].commentaire = 'Nivellement laser contrôlé sur toute la ligne (+/- 0,5 mm).'; }
    if (ts[6]) { ts[6].statut = 'fait'; ts[6].faitLe = j2; ts[6].progression = 100; }
    if (ts[8]) { ts[8].statut = 'fait'; ts[8].faitLe = j2; ts[8].progression = 100; }
    if (ts[9]) { ts[9].statut = 'encours'; ts[9].progression = 60; ts[9].commentaire = 'Câblage des capteurs cellule terminé, reste coffret convoyeur aval.'; }
    if (ts[10]) { ts[10].statut = 'encours'; ts[10].progression = 50; }
    if (ts[11]) {
      ts[11].statut = 'bloque';
      ts[11].blocage = 'Armoire générale 400V client consignée — attente intervention électricien site demain 08h30.';
      ts[11].commentaire = 'Câble tiré et prêt devant le sectionneur.';
    }

    ch.jours = {};
    ch.jours[j1] = {
      date: j1,
      horaires: '08h30 - 17h30',
      equipeJour: ch.equipe,
      synthese: 'Arrivée sur site, accueil sécurité, déchargement complet des camions et mise en place des châssis sur le traçage.',
      aleas: '',
      prevuDemain: 'Assemblage inter-modules, alignement laser, ancrage au sol et début du passage des câbles.',
      photos: [],
      envoyeLe: '17:45'
    };
    ch.jours[j2] = {
      date: j2,
      horaires: '08h00 - 17h30',
      equipeJour: ch.equipe,
      synthese: 'Fin de l\'assemblage mécanique, alignement laser et chevillage au sol réalisés. Démarrage du câblage électrique inter-châssis.',
      aleas: '',
      prevuDemain: 'Raccordement 400V avec le service maintenance client à 08h30, fin du câblage capteurs et mise sous tension 24V DC pour tests E/S.',
      photos: [],
      envoyeLe: ''
    };
    ch.jourActif = j2;
    return ch;
  }

  /* ===================== État courant de l'application ================ */
  let S = chargerReglages();
  let C = null;
  let filtreStatut = 'tous';  // 'tous' | 'afaire' | 'encours' | 'bloque' | 'fait_auj' | 'fait'
  let rechercheTexte = '';
  let timerSauvegarde = null;
  let dicteeActive = null;

  function assurerJour(dateIso) {
    const d = dateIso || C.jourActif || aujourdhuiISO();
    C.jourActif = d;
    C.jours = C.jours || {};
    if (!C.jours[d]) {
      C.jours[d] = {
        date: d,
        horaires: '08h00 - 17h30',
        equipeJour: C.equipe || Report.nomComplet(S.technicien) || '',
        synthese: '',
        aleas: '',
        prevuDemain: '',
        photos: [],
        envoyeLe: ''
      };
    }
    return C.jours[d];
  }

  function planifierSauvegarde() {
    clearTimeout(timerSauvegarde);
    timerSauvegarde = setTimeout(() => {
      if (!C) return;
      try { localStorage.setItem(CLE_COURANT, C.id); } catch (_) {}
      BaseLocale.sauverChantier(C);
    }, 220);
  }

  /* ===================== Compression Photo ============================ */
  function compresserImage(fichier, maxDim, qualite) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const s = Math.min(1, (maxDim || 1500) / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * s));
          canvas.height = Math.max(1, Math.round(img.height * s));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', qualite || 0.84));
        };
        img.onerror = reject;
        img.src = r.result;
      };
      r.onerror = reject;
      r.readAsDataURL(fichier);
    });
  }

  /* ===================== Dictée vocale ================================ */
  function basculerDictee(cibleTextarea, bouton) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast('Dictée vocale non prise en charge par ce navigateur');
      return;
    }
    if (dicteeActive) {
      const meme = dicteeActive.bouton === bouton;
      try { dicteeActive.rec.stop(); } catch (_) {}
      dicteeActive.bouton.classList.remove('actif');
      dicteeActive = null;
      if (meme) return;
    }
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = false;
    bouton.classList.add('actif');
    toast('🎤 Dictée en cours… appuyez à nouveau pour arrêter');

    rec.onresult = (ev) => {
      let ajout = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) ajout += ev.results[i][0].transcript.trim() + ' ';
      }
      if (ajout && cibleTextarea) {
        const cur = cibleTextarea.value.trim();
        cibleTextarea.value = (cur ? cur + ' ' : '') + ajout.trim();
        cibleTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    rec.onerror = () => {
      bouton.classList.remove('actif');
      dicteeActive = null;
    };
    rec.onend = () => {
      if (dicteeActive && dicteeActive.rec === rec) {
        bouton.classList.remove('actif');
        dicteeActive = null;
      }
    };
    try {
      rec.start();
      dicteeActive = { rec: rec, bouton: bouton };
    } catch (_) {
      bouton.classList.remove('actif');
    }
  }

  /* ===================== Rendu de l'interface principale ============== */
  function rendreTopbar(bilan) {
    const hdrT = $('#hdrTitre');
    const hdrS = $('#hdrSousTitre');
    if (hdrT) hdrT.textContent = C.affaire || 'CHANTIER';
    if (hdrS) hdrS.textContent = C.nom || (C.client && C.client.nom) || 'Suivi quotidien';
    const lblBas = $('#lblRapportBas');
    if (lblBas) {
      lblBas.textContent = 'Rapport J' + bilan.numeroJour + (bilan.faitCeJour.length ? ' (+' + bilan.faitCeJour.length + ')' : '');
    }
  }

  function rendrePilotage(bilan) {
    const el = $('#pilotageBarre');
    if (!el) return;
    const dates = bilan.datesJours;
    const idx = dates.indexOf(bilan.dateJour);
    const prec = idx > 0 ? dates[idx - 1] : '';
    const suiv = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : '';
    const jSem = Report.jourSemaineFr(bilan.dateJour);
    const estAuj = bilan.dateJour === aujourdhuiISO();

    el.innerHTML = `
      <div class="pilotage-jour-row">
        <div class="jour-nav">
          <button type="button" class="jour-nav-btn" data-jour-aller="${esc(prec)}" ${prec ? '' : 'disabled'} title="Journée précédente">
            ${ICO.chevronLeft(18)}
          </button>
          <button type="button" class="jour-select-btn" data-a="ouvrir-jours" title="Choisir ou gérer les journées du chantier">
            <span class="jour-num">Jour ${bilan.numeroJour} / ${bilan.nbJoursTotal}${estAuj ? ' · Aujourd\'hui' : ''}</span>
            <span class="jour-date">${esc(jSem)} ${esc(Report.frDate(bilan.dateJour))} ▾</span>
          </button>
          <button type="button" class="jour-nav-btn" data-jour-aller="${esc(suiv)}" ${suiv ? '' : 'disabled'} title="Journée suivante">
            ${ICO.chevronRight(18)}
          </button>
        </div>
        <button type="button" class="btn-nouveau-jour" data-a="nouveau-jour" title="Ouvrir une nouvelle journée de chantier">
          ${ICO.calendar(16)} <span>+ Jour</span>
        </button>
      </div>
      <div class="pilotage-prog-row">
        <div class="prog-track"><div class="prog-fill" style="width:${bilan.pctGlobal}%"></div></div>
        <div class="prog-pct">${bilan.faitTotal.length}/${bilan.total} · ${bilan.pctGlobal}%</div>
      </div>
      <div class="pilotage-badges">
        <span class="mini-badge auj">✓ +${bilan.faitCeJour.length} ce jour</span>
        ${bilan.enCours.length ? `<span class="mini-badge encours">🔄 ${bilan.enCours.length} en cours</span>` : ''}
        ${bilan.bloques.length ? `<span class="mini-badge bloque" data-filtre-rapide="bloque" style="cursor:pointer">🛑 ${bilan.bloques.length} bloqué${bilan.bloques.length > 1 ? 's' : ''}</span>` : ''}
        ${bilan.jour.envoyeLe ? `<span class="mini-badge envoye">📤 Envoyé (${esc(bilan.jour.envoyeLe)})</span>` : ''}
      </div>`;
  }

  function rendreBanniere(bilan) {
    const el = $('#zoneBanniere');
    if (!el) return;
    let html = '';

    if (C.estDemo) {
      html += `<div class="sticky-note" style="margin-bottom:12px;background:var(--bfr-primary-light);border-color:var(--bfr-primary-border);color:var(--bfr-secondary);display:flex;flex-direction:column;gap:8px">
        <div>
          <strong>👋 Exemple de chantier BFR pré-chargé</strong><br>
          <span style="font-size:12.5px;color:#334155">Testez le cochage des tâches et appuyez sur <strong>Aperçu PDF</strong> en bas pour voir le rapport quotidien BFR Systems. Quand vous êtes prêt :</span>
        </div>
        <div class="btnrow">
          <button type="button" class="btn sm principal" data-a="demarrer-propre">${ICO.plus(15)} Démarrer mon chantier</button>
          <button type="button" class="btn sm ghost" data-a="garder-demo">Masquer ce bandeau</button>
        </div>
      </div>`;
    }

    if (bilan.bloques.length > 0 && filtreStatut !== 'bloque') {
      html += `<div class="alerte-blocages" data-filtre-rapide="bloque" title="Afficher les points bloquants">
        <div style="flex-shrink:0;margin-top:2px">${ICO.shieldAlert(20, 'ico-danger')}</div>
        <div style="flex:1;min-width:0">
          <strong>${bilan.bloques.length} point${bilan.bloques.length > 1 ? 's' : ''} bloquant${bilan.bloques.length > 1 ? 's' : ''} / réserve${bilan.bloques.length > 1 ? 's' : ''} en cours</strong>
          <span>${esc(bilan.bloques[0].titre)}${bilan.bloques.length > 1 ? ' (+' + (bilan.bloques.length - 1) + ' autre' + (bilan.bloques.length > 2 ? 's' : '') + ')' : ''} — Appuyez pour filtrer</span>
        </div>
      </div>`;
    }

    el.innerHTML = html;
  }

  function rendreEntete() {
    const el = $('#zoneEntete');
    if (!el) return;
    const cli = C.client || {};
    const destActifs = (C.destinataires || []).filter(d => d && d.actif !== false && d.email);
    const estConfigure = !!(C.nom || cli.nom);

    if (!estConfigure) {
      el.innerHTML = `<div class="card">
        <h2>${ICO.building(19, 'ico-cyan')} Fiche du chantier</h2>
        <p class="hint">Renseignez les informations du chantier, le client et les personnes qui recevront le rapport quotidien par e-mail.</p>
        <div class="btnrow">
          <button type="button" class="btn principal" data-a="editer-chantier">${ICO.pen(16)} Configurer le chantier</button>
          <button type="button" class="btn ghost" data-a="ouvrir-import">${ICO.upload(16)} Importer une liste</button>
        </div>
      </div>`;
      return;
    }

    el.innerHTML = `<div class="card">
      <h2 style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span style="display:flex;align-items:center;gap:7px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${ICO.building(18, 'ico-cyan')} ${esc(C.nom || 'Chantier sans titre')}
        </span>
        ${C.affaire ? `<span class="pill">${esc(C.affaire)}</span>` : ''}
      </h2>
      <div class="recap" style="margin-bottom:10px;font-size:13.5px;color:var(--bfr-text);line-height:1.5">
        ${cli.nom ? `<div><strong style="color:var(--bfr-secondary)">${esc(cli.nom)}</strong>${cli.lieu ? ' — ' + esc(cli.lieu) : ''}</div>` : ''}
        ${C.equipement ? `<div style="color:var(--bfr-text-muted);font-size:12.5px">⚙️ ${esc(C.equipement)}</div>` : ''}
        <div style="color:var(--bfr-text-muted);font-size:12.5px;margin-top:3px">
          📧 Destinataires rapport : <strong style="color:var(--bfr-secondary)">${destActifs.length ? destActifs.length + ' personne' + (destActifs.length > 1 ? 's' : '') : 'aucun e-mail configuré'}</strong>
          ${cli.contact ? ` · Contact site : ${esc(cli.contact)}` : ''}
        </div>
      </div>
      <div class="btnrow">
        <button type="button" class="btn sm ghost" data-a="editer-chantier">${ICO.pen(14)} Chantier & Client</button>
        <button type="button" class="btn sm ghost" data-a="editer-destinataires">${ICO.mail(15)} Destinataires (${destActifs.length})</button>
      </div>
    </div>`;
  }

  function tacheCorrespondFiltre(t, dateJour) {
    if (filtreStatut === 'afaire' && (t.statut && t.statut !== 'afaire')) return false;
    if (filtreStatut === 'encours' && t.statut !== 'encours') return false;
    if (filtreStatut === 'bloque' && t.statut !== 'bloque') return false;
    if (filtreStatut === 'fait' && t.statut !== 'fait') return false;
    if (filtreStatut === 'fait_auj' && !(t.statut === 'fait' && t.faitLe === dateJour)) return false;
    if (rechercheTexte) {
      const q = ImportTaches.norm(rechercheTexte);
      if (q && ImportTaches.norm(t.titre + ' ' + (t.commentaire || '') + ' ' + (t.blocage || '')).indexOf(q) < 0) return false;
    }
    return true;
  }

  function iconeBoiteTache(statut) {
    if (statut === 'fait') return ICO.check(16);
    if (statut === 'encours') return '<span style="font-size:12px;font-weight:800">•••</span>';
    if (statut === 'bloque') return '<span style="font-size:14px;font-weight:800">!</span>';
    return '';
  }

  function rendreTaches(bilan) {
    const el = $('#zoneTaches');
    if (!el) return;

    const filtres = [
      { id: 'tous', lib: 'Toutes', n: bilan.total },
      { id: 'afaire', lib: 'À faire', n: bilan.aFaire.length },
      { id: 'encours', lib: 'En cours', n: bilan.enCours.length },
      { id: 'bloque', lib: 'Bloquées', n: bilan.bloques.length, cls: 'bloque' },
      { id: 'fait_auj', lib: 'Faites ce jour', n: bilan.faitCeJour.length },
      { id: 'fait', lib: 'Terminées', n: bilan.faitTotal.length }
    ];

    let corpsPhases = '';
    if (bilan.total === 0) {
      corpsPhases = `<div class="sticky-note" style="background:#f8fafc;border-color:var(--bfr-border);color:var(--bfr-text);text-align:center;padding:18px 14px">
        <strong style="display:block;font-family:var(--font-heading);color:var(--bfr-secondary);margin-bottom:6px">Aucune tâche dans la liste pour le moment</strong>
        <span style="display:block;font-size:13px;color:var(--bfr-text-muted);margin-bottom:12px">Ajoutez vos tâches manuellement, collez une liste texte ou importez un fichier Excel (.xlsx) / CSV.</span>
        <div class="btnrow">
          <button type="button" class="btn sm principal" data-a="ajouter-tache">${ICO.plus(15)} Ajouter une tâche</button>
          <button type="button" class="btn sm ghost" data-a="ouvrir-import">${ICO.upload(15)} Importer / Modèle BFR</button>
        </div>
      </div>`;
    } else {
      let nbAffichees = 0;
      bilan.parPhase.forEach(ph => {
        const visibles = ph.taches.filter(t => tacheCorrespondFiltre(t, bilan.dateJour));
        if (!visibles.length && (filtreStatut !== 'tous' || rechercheTexte)) return;
        nbAffichees += visibles.length;
        const pliee = !!(C.phasesPliees && C.phasesPliees[ph.id]) && filtreStatut === 'tous' && !rechercheTexte;
        const complet = ph.total > 0 && ph.fait === ph.total;

        corpsPhases += `<div class="phase-bloc${pliee ? ' pliee' : ''}" data-phase-id="${esc(ph.id)}">
          <div class="phase-hdr" data-a="plier-phase" data-id="${esc(ph.id)}">
            <div class="phase-hdr-left">
              <span class="phase-chev">${ICO.chevronDown(16)}</span>
              <span class="phase-titre">${esc(ph.nom)}</span>
            </div>
            <div class="phase-hdr-right">
              <span class="phase-stat${complet ? ' complet' : ''}">${ph.fait}/${ph.total}</span>
              <span class="phase-minibar${complet ? ' complet' : ''}"><span style="width:${ph.pct}%"></span></span>
              <button type="button" class="phase-add-btn" data-a="ajouter-tache-phase" data-phase="${esc(ph.id)}" title="Ajouter une tâche dans cette phase">+</button>
            </div>
          </div>
          <div class="phase-body">
            ${visibles.length ? visibles.map(t => rendreLigneTache(t, bilan.dateJour)).join('') : `<div style="padding:10px 14px;font-size:12.5px;color:var(--bfr-text-muted)">Aucune tâche dans cette phase — appuyez sur <strong>+</strong> pour en ajouter.</div>`}
          </div>
        </div>`;
      });

      if (!nbAffichees && (filtreStatut !== 'tous' || rechercheTexte)) {
        corpsPhases = `<div style="padding:18px;text-align:center;color:var(--bfr-text-muted);font-size:13.5px;background:#f8fafc;border-radius:8px;border:1px dashed var(--bfr-border)">
          Aucune tâche ne correspond au filtre sélectionné.
          <div style="margin-top:8px"><button type="button" class="btn sm grey" data-filtre-rapide="tous">Afficher toutes les tâches</button></div>
        </div>`;
      }
    }

    el.innerHTML = `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <h2 style="margin:0;display:flex;align-items:center;gap:7px">
          ${ICO.checklist(19, 'ico-cyan')} Checklist du chantier
        </h2>
        <div style="display:flex;gap:6px">
          <button type="button" class="btn sm ghost" data-a="gerer-phases" title="Gérer les phases / lots">Phases</button>
          <button type="button" class="btn sm ghost" data-a="ouvrir-import" title="Importer ou coller des tâches">${ICO.upload(14)} Importer</button>
        </div>
      </div>

      ${bilan.total > 0 ? `
      <div class="filtres-wrap">
        <div class="filtres-scroll">
          ${filtres.map(f => `<button type="button" class="filtre-chip ${f.cls || ''}${filtreStatut === f.id ? ' on' : ''}" data-filtre-rapide="${f.id}">
            ${esc(f.lib)} <span class="cnt">${f.n}</span>
          </button>`).join('')}
        </div>
        ${(bilan.total >= 6 || rechercheTexte) ? `
        <div class="search-box">
          <input type="search" id="champRechercheTache" value="${esc(rechercheTexte)}" placeholder="Rechercher une tâche, zone, note…">
          ${rechercheTexte ? `<button type="button" class="search-clear" data-a="vider-recherche" title="Effacer">✕</button>` : ''}
        </div>` : ''}
      </div>` : ''}

      ${corpsPhases}
    </div>`;

    const inpRech = $('#champRechercheTache', el);
    if (inpRech) {
      inpRech.addEventListener('input', () => {
        const pos = inpRech.selectionStart;
        rechercheTexte = inpRech.value;
        rendreTaches(Report.calculerBilan(C, C.jourActif));
        const nouv = $('#champRechercheTache');
        if (nouv) { nouv.focus(); try { nouv.setSelectionRange(pos, pos); } catch (_) {} }
      });
    }
  }

  function rendreLigneTache(t, dateJour) {
    const st = t.statut || 'afaire';
    const estFaitAuj = st === 'fait' && t.faitLe === dateJour;
    const nbPhotos = (t.photos || []).filter(p => p && p.dataUrl).length;
    const noteApercu = st === 'bloque'
      ? (t.blocage || t.commentaire || '')
      : (t.commentaire || '');

    let badgeStatut = '';
    if (st === 'fait') {
      badgeStatut = estFaitAuj
        ? `<span class="tache-tag fait-auj">✓ Fait ce jour</span>`
        : `<span class="tache-tag fait-avant">✓ Fait${t.faitLe ? ' le ' + esc(Report.frDateCourte(t.faitLe)) : ''}</span>`;
    } else if (st === 'encours') {
      badgeStatut = `<span class="tache-tag encours">En cours${t.progression ? ' · ' + t.progression + '%' : ''}</span>`;
    } else if (st === 'bloque') {
      badgeStatut = `<span class="tache-tag bloque">🛑 Bloqué / Réserve</span>`;
    }

    const domLabel = Report.DOMAINES[t.domaine] || '';

    return `<div class="tache-item st-${esc(st)}" data-tache-id="${esc(t.id)}">
      <button type="button" class="tache-check-zone" data-a="cocher-tache" data-id="${esc(t.id)}" aria-label="Cocher la tâche">
        <span class="tache-box">${iconeBoiteTache(st)}</span>
      </button>
      <div class="tache-main" data-a="ouvrir-tache" data-id="${esc(t.id)}">
        <div class="tache-titre">${esc(t.titre)}</div>
        ${(badgeStatut || domLabel || nbPhotos || (t.commentaire && st !== 'bloque')) ? `
        <div class="tache-meta">
          ${badgeStatut}
          ${domLabel ? `<span class="tache-tag">${ICO.domaine(t.domaine, 12)} ${esc(domLabel)}</span>` : ''}
          ${nbPhotos ? `<span class="tache-tag">📷 ${nbPhotos}</span>` : ''}
          ${(t.commentaire && st === 'bloque' && t.blocage) ? `<span class="tache-tag">💬 Note</span>` : ''}
        </div>` : ''}
        ${noteApercu ? `<div class="tache-note-apercu">${esc(noteApercu)}</div>` : ''}
        ${nbPhotos ? `<div class="tache-thumbs">${(t.photos || []).filter(p => p && p.dataUrl).slice(0, 4).map(p => `<img src="${p.dataUrl}" alt="Photo">`).join('')}</div>` : ''}
      </div>
    </div>`;
  }

  function rendreJournal(bilan) {
    const el = $('#zoneJournal');
    if (!el) return;
    const j = assurerJour(bilan.dateJour);
    const photosJ = (j.photos || []).filter(p => p && p.dataUrl);

    el.innerHTML = `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
        <h2 style="margin:0;display:flex;align-items:center;gap:7px">
          ${ICO.fileText(19, 'ico-cyan')} Journal du Jour ${bilan.numeroJour} (${esc(Report.frDate(bilan.dateJour))})
        </h2>
        <span class="pill">${bilan.faitCeJour.length} tâche${bilan.faitCeJour.length > 1 ? 's' : ''} clôturée${bilan.faitCeJour.length > 1 ? 's' : ''}</span>
      </div>
      <p class="hint">Ces notes concernent spécifiquement la journée du <strong>${esc(Report.frDate(bilan.dateJour))}</strong> et alimentent le rapport quotidien envoyé ce soir.</p>

      <div class="grid2">
        <div class="field">
          <label>Horaires sur site ce jour</label>
          <input type="text" data-jk="horaires" value="${esc(j.horaires || '')}" placeholder="Ex. 08h00 - 17h30">
        </div>
        <div class="field">
          <label>Équipe BFR présente</label>
          <input type="text" data-jk="equipeJour" value="${esc(j.equipeJour || '')}" placeholder="Ex. J. Durand, M. Martin">
        </div>
      </div>

      <div class="field">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px">
          <label style="margin:0">Synthèse / Compte rendu de la journée</label>
          <div style="display:flex;gap:5px">
            <button type="button" class="btn sm ghost" data-a="auto-synthese" style="min-height:30px;padding:3px 8px;font-size:11.5px" title="Générer un brouillon à partir des tâches du jour">${ICO.sparkles(13)} Brouillon auto</button>
            <button type="button" class="btn sm grey btn-dictee" data-dictee="jSynthese" style="min-height:30px;padding:3px 8px;font-size:11.5px">${ICO.mic(14)} Dicter</button>
          </div>
        </div>
        <textarea id="jSynthese" rows="3" data-jk="synthese" placeholder="Résumé de l'avancement du jour, coordination client, faits marquants…">${esc(j.synthese || '')}</textarea>
      </div>

      <div class="field">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px">
          <label style="margin:0">Programme prévu demain / Prochaines étapes</label>
          <button type="button" class="btn sm ghost" data-a="auto-demain" style="min-height:30px;padding:3px 8px;font-size:11.5px">${ICO.sparkles(13)} Pré-remplir la suite</button>
        </div>
        <textarea id="jDemain" rows="2" data-jk="prevuDemain" placeholder="Travaux prévus sur la prochaine journée…">${esc(j.prevuDemain || '')}</textarea>
      </div>

      <div class="field">
        <label>Aléas / Remarques générales hors checklist (facultatif)</label>
        <textarea rows="2" data-jk="aleas" placeholder="Ex. Attente nacelle, coupure réseau client, réserve diverse…">${esc(j.aleas || '')}</textarea>
      </div>

      <div class="field" style="margin-bottom:0">
        <label>Photos d'avancement du jour (${photosJ.length})</label>
        <div class="btnrow" style="margin-bottom:8px">
          <label class="btn sm ghost" style="cursor:pointer;margin:0">
            <input type="file" accept="image/*" capture="environment" data-photo-jour="camera" style="display:none">
            ${ICO.camera(16)} Prendre photo
          </label>
          <label class="btn sm grey" style="cursor:pointer;margin:0">
            <input type="file" accept="image/*" multiple data-photo-jour="galerie" style="display:none">
            ${ICO.image(16)} Galerie
          </label>
        </div>
        ${photosJ.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">
          ${photosJ.map((ph, idx) => `
            <div style="border:1px solid var(--bfr-border);border-radius:8px;overflow:hidden;background:#fff">
              <img src="${ph.dataUrl}" alt="Photo jour" data-a="annoter-photo-jour" data-idx="${idx}" style="width:100%;height:96px;object-fit:cover;display:block;cursor:pointer" title="Appuyer pour annoter au doigt">
              <div style="padding:5px 6px;display:flex;flex-direction:column;gap:4px">
                <input type="text" data-legende-jour="${idx}" value="${esc(ph.legende || '')}" placeholder="Légende…" style="font-size:11.5px;padding:4px 6px;border:1px solid var(--bfr-border);border-radius:4px;width:100%">
                <div style="display:flex;justify-content:space-between;gap:4px">
                  <button type="button" class="btn sm ghost" data-a="annoter-photo-jour" data-idx="${idx}" style="min-height:26px;padding:2px 6px;font-size:11px;flex:1">${ICO.pen(12)} Annoter</button>
                  <button type="button" class="btn sm danger" data-a="suppr-photo-jour" data-idx="${idx}" style="min-height:26px;padding:2px 6px;font-size:11px">${ICO.trash(12)}</button>
                </div>
              </div>
            </div>`).join('')}
        </div>` : ''}
      </div>
    </div>`;

    // Liaison directe sans re-rendre tout le DOM pendant la frappe
    $$('[data-jk]', el).forEach(inp => {
      inp.addEventListener('input', () => {
        const jour = assurerJour(C.jourActif);
        jour[inp.dataset.jk] = inp.value;
        planifierSauvegarde();
      });
    });
    $$('[data-legende-jour]', el).forEach(inp => {
      inp.addEventListener('input', () => {
        const jour = assurerJour(C.jourActif);
        const idx = Number(inp.dataset.legendeJour);
        if (jour.photos && jour.photos[idx]) {
          jour.photos[idx].legende = inp.value;
          planifierSauvegarde();
        }
      });
    });
    $$('[data-photo-jour]', el).forEach(inp => {
      inp.addEventListener('change', async () => {
        const files = Array.from(inp.files || []);
        if (!files.length) return;
        const jour = assurerJour(C.jourActif);
        jour.photos = jour.photos || [];
        for (const f of files) {
          try {
            const dataUrl = await compresserImage(f, 1500, 0.85);
            const ph = { id: uid('phj'), dataUrl: dataUrl, legende: '', annotations: [] };
            jour.photos.push(ph);
            if (files.length === 1 && typeof Annotation !== 'undefined') {
              Annotation.ouvrir(ph, { fin: () => { planifierSauvegarde(); rendreTout(); } });
            }
          } catch (_) { toast('Impossible de charger cette image'); }
        }
        planifierSauvegarde();
        rendreTout();
      });
    });
  }

  function rendreCloture(bilan) {
    const el = $('#zoneCloture');
    if (!el) return;
    const destActifs = (C.destinataires || []).filter(d => d && d.actif !== false && d.email);
    const toList = destActifs.filter(d => d.type !== 'cc').map(d => d.nom ? `${d.nom} <${d.email}>` : d.email);
    const ccList = destActifs.filter(d => d.type === 'cc').map(d => d.nom ? `${d.nom} <${d.email}>` : d.email);

    el.innerHTML = `<div class="card" id="carteRapportQuotidien">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
        <h2 style="margin:0;display:flex;align-items:center;gap:7px">
          ${ICO.send(18, 'ico-cyan')} Rapport quotidien — Jour ${bilan.numeroJour}
        </h2>
        ${bilan.jour.envoyeLe ? `<span class="pill ok">✓ Envoyé à ${esc(bilan.jour.envoyeLe)}</span>` : `<span class="pill">Prêt à transmettre</span>`}
      </div>
      <p class="hint">
        Rapport PDF officiel <strong>BFR Systems</strong> du <strong>${esc(Report.frDate(bilan.dateJour))}</strong> (sans signature client quotidienne) :
        avancement global <strong>${bilan.pctGlobal} %</strong>, <strong>${bilan.faitCeJour.length}</strong> tâche${bilan.faitCeJour.length > 1 ? 's' : ''} du jour,
        <strong>${bilan.bloques.length}</strong> point${bilan.bloques.length > 1 ? 's' : ''} bloquant${bilan.bloques.length > 1 ? 's' : ''},
        <strong>${bilan.nbPhotosJour}</strong> photo${bilan.nbPhotosJour > 1 ? 's' : ''}.
      </p>

      <button type="button" class="btn or wide" id="btnSoumettre" data-a="soumettre">
        ${ICO.send(18)} Envoyer le rapport quotidien (Jour ${bilan.numeroJour})
      </button>

      <div class="btnrow" style="margin-top:8px">
        <button type="button" class="btn ghost" data-a="apercu">${ICO.eye(18)} Aperçu PDF</button>
        <button type="button" class="btn grey" data-a="word">${ICO.fileText(18)} Word (.docx)</button>
      </div>

      <div style="margin-top:10px;padding-top:8px;border-top:1px dashed var(--bfr-border);font-size:12px;color:var(--bfr-text-muted);display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="min-width:0;overflow:hidden;text-overflow:ellipsis">
          ${destActifs.length
            ? `<strong>À :</strong> ${esc(toList.join(', ') || '—')}${ccList.length ? ` · <strong>Cc :</strong> ${esc(ccList.join(', '))}` : ''}`
            : `Aucun destinataire renseigné pour le projet.`}
        </div>
        <button type="button" class="btn sm ghost" data-a="editer-destinataires" style="min-height:28px;padding:3px 9px;font-size:11.5px;flex-shrink:0">Gérer</button>
      </div>
    </div>`;
  }

  function rendreTout() {
    if (!C) return;
    assurerJour(C.jourActif);
    const bilan = Report.calculerBilan(C, C.jourActif);
    rendreTopbar(bilan);
    rendrePilotage(bilan);
    rendreBanniere(bilan);
    rendreEntete();
    rendreTaches(bilan);
    rendreJournal(bilan);
    rendreCloture(bilan);
  }

  /* ===================== Actions Tâches =============================== */
  function cocherDecocherTache(id) {
    const t = (C.taches || []).find(x => x.id === id);
    if (!t) return;
    if (t.statut === 'fait') {
      t.statut = 'afaire';
      t.faitLe = '';
      t.progression = 0;
      toast('Tâche remise « À faire »');
    } else {
      t.statut = 'fait';
      t.faitLe = C.jourActif || aujourdhuiISO();
      t.progression = 100;
      const b = Report.calculerBilan(C, C.jourActif);
      toast('✓ Pointée Fait (Jour ' + b.numeroJour + ' · ' + b.pctGlobal + ' %)');
    }
    planifierSauvegarde();
    rendreTout();
  }

  function feuilleTache(tacheId, phaseParDefaut) {
    const estNouvelle = !tacheId;
    const phases = (C.phases && C.phases.length) ? C.phases : [{ id: uid('ph'), nom: 'Tâches du chantier' }];
    if (!C.phases || !C.phases.length) C.phases = phases;

    let t = estNouvelle
      ? {
          id: uid('tc'),
          phaseId: phaseParDefaut || phases[0].id,
          titre: '',
          domaine: '',
          statut: 'afaire',
          progression: 0,
          faitLe: '',
          commentaire: '',
          blocage: '',
          photos: []
        }
      : (C.taches || []).find(x => x.id === tacheId);

    if (!t) return;

    function construireContenu(panneau) {
      const st = t.statut || 'afaire';
      const phs = (t.photos || []).filter(p => p && p.dataUrl);

      panneau.innerHTML = `
        <div class="grab"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
          <h3 style="margin:0">${estNouvelle ? 'Nouvelle tâche' : 'Détail de la tâche'}</h3>
          ${!estNouvelle ? `<button type="button" class="btn sm danger" data-act="supprimer-tache" title="Supprimer cette tâche">${ICO.trash(14)} Supprimer</button>` : ''}
        </div>

        <div class="field">
          <label>Intitulé de la tâche *</label>
          <textarea id="tcTitre" rows="2" placeholder="Ex. Raccordement puissance 400V armoire principale…">${esc(t.titre)}</textarea>
        </div>

        <div class="grid2">
          <div class="field">
            <label>Phase / Lot</label>
            <select id="tcPhase">
              ${C.phases.map(p => `<option value="${esc(p.id)}"${p.id === t.phaseId ? ' selected' : ''}>${esc(p.nom)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Domaine (optionnel)</label>
            <select id="tcDomaine">
              <option value="">— Général —</option>
              <option value="MECANIQUE"${t.domaine === 'MECANIQUE' ? ' selected' : ''}>🔧 Mécanique</option>
              <option value="ELECTRIQUE"${t.domaine === 'ELECTRIQUE' ? ' selected' : ''}>⚡ Électrique</option>
              <option value="AUTOMATISME"${t.domaine === 'AUTOMATISME' ? ' selected' : ''}>🤖 Automatisme</option>
            </select>
          </div>
        </div>

        <label style="display:block;font-family:var(--font-heading);font-size:12.5px;font-weight:600;color:var(--bfr-secondary);margin-top:4px">Statut d'avancement</label>
        <div class="statut-grid">
          <button type="button" class="statut-opt ${st === 'afaire' ? 'on-afaire' : ''}" data-st="afaire">⬜ À faire</button>
          <button type="button" class="statut-opt ${st === 'encours' ? 'on-encours' : ''}" data-st="encours">🔄 En cours</button>
          <button type="button" class="statut-opt ${st === 'fait' ? 'on-fait' : ''}" data-st="fait">✅ Fait</button>
          <button type="button" class="statut-opt ${st === 'bloque' ? 'on-bloque' : ''}" data-st="bloque">🛑 Bloqué / Réserve</button>
        </div>

        ${st === 'encours' ? `
        <div class="field" style="background:var(--surv-bg);padding:10px;border-radius:8px;border:1px solid var(--surv-border)">
          <label style="color:#92400e">Avancement estimé de la tâche : <strong id="lblProg">${t.progression || 50} %</strong></label>
          <div class="btnrow" style="margin-top:6px">
            ${[25, 50, 75].map(v => `<button type="button" class="btn sm ${Number(t.progression || 50) === v ? 'principal' : 'grey'}" data-prog="${v}">${v} %</button>`).join('')}
          </div>
        </div>` : ''}

        ${st === 'fait' ? `
        <div class="field" style="background:var(--ok-bg);padding:10px;border-radius:8px;border:1px solid var(--ok-border)">
          <label style="color:#065f46">Journée de réalisation (apparaîtra dans le rapport de ce jour)</label>
          <input type="date" id="tcFaitLe" value="${esc(t.faitLe || C.jourActif || aujourdhuiISO())}">
        </div>` : ''}

        ${st === 'bloque' ? `
        <div class="field" style="background:var(--def-bg);padding:10px;border-radius:8px;border:1.5px solid var(--def-border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <label style="color:#991b1b;margin:0">🛑 Motif du blocage / Action attendue *</label>
            <button type="button" class="btn sm grey btn-dictee" data-dictee-tc="tcBlocage" style="min-height:28px;padding:2px 8px;font-size:11px">${ICO.mic(13)} Dicter</button>
          </div>
          <textarea id="tcBlocage" rows="2" placeholder="Ex. Attente alimentation 400V client, pièce manquante, réserve…">${esc(t.blocage || '')}</textarea>
        </div>` : ''}

        <div class="field">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <label style="margin:0">Commentaire / Observation technique</label>
            <button type="button" class="btn sm grey btn-dictee" data-dictee-tc="tcComm" style="min-height:28px;padding:2px 8px;font-size:11px">${ICO.mic(13)} Dicter</button>
          </div>
          <textarea id="tcComm" rows="2" placeholder="Précision technique, valeur mesurée, remarque pour le rapport…">${esc(t.commentaire || '')}</textarea>
        </div>

        <div class="field">
          <label>Photos sur cette tâche (${phs.length}) — annotables au doigt</label>
          <div class="btnrow" style="margin-bottom:8px">
            <label class="btn sm ghost" style="cursor:pointer;margin:0">
              <input type="file" accept="image/*" capture="environment" id="tcPhotoCam" style="display:none">
              ${ICO.camera(16)} Appareil photo
            </label>
            <label class="btn sm grey" style="cursor:pointer;margin:0">
              <input type="file" accept="image/*" multiple id="tcPhotoGal" style="display:none">
              ${ICO.image(16)} Galerie
            </label>
          </div>
          ${phs.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:8px">
            ${phs.map((ph, idx) => `
              <div style="border:1px solid var(--bfr-border);border-radius:8px;overflow:hidden;background:#fff">
                <img src="${ph.dataUrl}" alt="Photo tâche" data-act="annoter-tc-photo" data-idx="${idx}" style="width:100%;height:88px;object-fit:cover;display:block;cursor:pointer">
                <div style="padding:5px">
                  <input type="text" data-tc-leg="${idx}" value="${esc(ph.legende || '')}" placeholder="Légende…" style="font-size:11px;padding:4px 6px;border:1px solid var(--bfr-border);border-radius:4px;width:100%;margin-bottom:4px">
                  <div style="display:flex;gap:4px">
                    <button type="button" class="btn sm ghost" data-act="annoter-tc-photo" data-idx="${idx}" style="min-height:25px;padding:2px 5px;font-size:11px;flex:1">${ICO.pen(11)} Annoter</button>
                    <button type="button" class="btn sm danger" data-act="suppr-tc-photo" data-idx="${idx}" style="min-height:25px;padding:2px 6px;font-size:11px">${ICO.trash(11)}</button>
                  </div>
                </div>
              </div>`).join('')}
          </div>` : ''}
        </div>

        <div class="btnrow" style="margin-top:12px">
          <button type="button" class="btn grey" data-a="fermer">Annuler</button>
          <button type="button" class="btn principal" data-act="enregistrer-tache">${ICO.check(17)} ${estNouvelle ? 'Ajouter la tâche' : 'Enregistrer'}</button>
        </div>`;

      const synchroniserChamps = () => {
        const elTitre = $('#tcTitre', panneau);
        if (elTitre) t.titre = elTitre.value;
        const elPh = $('#tcPhase', panneau);
        if (elPh) t.phaseId = elPh.value;
        const elDom = $('#tcDomaine', panneau);
        if (elDom) t.domaine = elDom.value;
        const elComm = $('#tcComm', panneau);
        if (elComm) t.commentaire = elComm.value;
        const elBloc = $('#tcBlocage', panneau);
        if (elBloc) t.blocage = elBloc.value;
        const elFaitLe = $('#tcFaitLe', panneau);
        if (elFaitLe) t.faitLe = elFaitLe.value;
        $$('[data-tc-leg]', panneau).forEach(inp => {
          const i = Number(inp.dataset.tcLeg);
          if (t.photos && t.photos[i]) t.photos[i].legende = inp.value;
        });
      };

      const gererAjoutPhotos = async (files) => {
        synchroniserChamps();
        for (const f of files) {
          try {
            const dataUrl = await compresserImage(f, 1500, 0.85);
            const ph = { id: uid('pht'), dataUrl: dataUrl, legende: '', annotations: [] };
            t.photos = t.photos || [];
            t.photos.push(ph);
            if (files.length === 1 && typeof Annotation !== 'undefined') {
              Annotation.ouvrir(ph, { fin: () => construireContenu(panneau) });
              return;
            }
          } catch (_) { toast('Image illisible'); }
        }
        construireContenu(panneau);
      };

      const cam = $('#tcPhotoCam', panneau);
      const gal = $('#tcPhotoGal', panneau);
      if (cam) cam.addEventListener('change', () => gererAjoutPhotos(Array.from(cam.files || [])));
      if (gal) gal.addEventListener('change', () => gererAjoutPhotos(Array.from(gal.files || [])));

      if (estNouvelle && !t.titre) {
        setTimeout(() => { const el = $('#tcTitre', panneau); if (el) el.focus(); }, 60);
      }
    }

    Ouvrir.ouvrir('<div class="panel"></div>', (panneau, overlay) => {
      construireContenu(panneau);

      panneau.addEventListener('click', async (e) => {
        const sync = () => {
          const elTitre = $('#tcTitre', panneau); if (elTitre) t.titre = elTitre.value;
          const elPh = $('#tcPhase', panneau); if (elPh) t.phaseId = elPh.value;
          const elDom = $('#tcDomaine', panneau); if (elDom) t.domaine = elDom.value;
          const elComm = $('#tcComm', panneau); if (elComm) t.commentaire = elComm.value;
          const elBloc = $('#tcBlocage', panneau); if (elBloc) t.blocage = elBloc.value;
          const elFaitLe = $('#tcFaitLe', panneau); if (elFaitLe) t.faitLe = elFaitLe.value;
          $$('[data-tc-leg]', panneau).forEach(inp => {
            const i = Number(inp.dataset.tcLeg);
            if (t.photos && t.photos[i]) t.photos[i].legende = inp.value;
          });
        };

        const btnSt = e.target.closest('[data-st]');
        if (btnSt) {
          sync();
          const nv = btnSt.dataset.st;
          t.statut = nv;
          if (nv === 'fait') {
            if (!t.faitLe) t.faitLe = C.jourActif || aujourdhuiISO();
            t.progression = 100;
          } else if (nv === 'encours') {
            if (!t.progression || t.progression === 100) t.progression = 50;
          } else {
            t.progression = 0;
          }
          construireContenu(panneau);
          return;
        }

        const btnProg = e.target.closest('[data-prog]');
        if (btnProg) {
          sync();
          t.progression = Number(btnProg.dataset.prog);
          construireContenu(panneau);
          return;
        }

        const btnDic = e.target.closest('[data-dictee-tc]');
        if (btnDic) {
          const cible = $('#' + btnDic.dataset.dicteeTc, panneau);
          if (cible) basculerDictee(cible, btnDic);
          return;
        }

        const act = e.target.closest('[data-act]');
        if (!act) return;
        const nomAct = act.dataset.act;

        if (nomAct === 'annoter-tc-photo') {
          sync();
          const idx = Number(act.dataset.idx);
          const ph = t.photos && t.photos[idx];
          if (ph && typeof Annotation !== 'undefined') {
            Annotation.ouvrir(ph, { fin: () => construireContenu(panneau) });
          }
        } else if (nomAct === 'suppr-tc-photo') {
          sync();
          const idx = Number(act.dataset.idx);
          if (t.photos) t.photos.splice(idx, 1);
          construireContenu(panneau);
        } else if (nomAct === 'supprimer-tache') {
          if (await Dialogue.confirmer('Supprimer définitivement cette tâche de la liste ?', { ok: 'Supprimer', danger: true })) {
            C.taches = (C.taches || []).filter(x => x.id !== t.id);
            planifierSauvegarde();
            overlay.remove();
            rendreTout();
            toast('Tâche supprimée');
          }
        } else if (nomAct === 'enregistrer-tache') {
          sync();
          if (!t.titre.trim()) {
            toast('Indiquez l\'intitulé de la tâche');
            const elT = $('#tcTitre', panneau); if (elT) elT.focus();
            return;
          }
          t.titre = t.titre.trim();
          if (estNouvelle) {
            C.taches = C.taches || [];
            C.taches.push(t);
            toast('Tâche ajoutée');
          } else {
            toast('Tâche mise à jour');
          }
          planifierSauvegarde();
          overlay.remove();
          rendreTout();
        }
      });
    });
  }

  /* ===================== Gestion des Phases / Lots ==================== */
  function feuillePhases() {
    function dessiner(panneau) {
      const phases = C.phases || [];
      panneau.innerHTML = `
        <div class="grab"></div>
        <h3>Phases / Lots du chantier</h3>
        <p class="sub">Organisez votre liste de tâches par grandes étapes (ex. Implantation, Montage mécanique, Câblage, Essais…).</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
          ${phases.map((ph, idx) => {
            const nb = (C.taches || []).filter(t => t.phaseId === ph.id).length;
            return `<div style="display:flex;align-items:center;gap:6px;background:#fff;padding:8px;border:1px solid var(--bfr-border);border-radius:8px">
              <input type="text" data-ph-nom="${idx}" value="${esc(ph.nom)}" style="flex:1;padding:7px 10px;border:1px solid var(--bfr-border);border-radius:6px;font-weight:600">
              <span class="pill" style="flex-shrink:0">${nb}</span>
              <button type="button" class="btn sm grey" data-ph-monter="${idx}" ${idx === 0 ? 'disabled' : ''} style="padding:4px 8px;min-height:32px">↑</button>
              <button type="button" class="btn sm danger" data-ph-suppr="${idx}" style="padding:4px 8px;min-height:32px">${ICO.trash(14)}</button>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          <input type="text" id="nouvPhaseNom" placeholder="Nom de la nouvelle phase…" style="flex:1;padding:10px 12px;border:1.5px solid var(--bfr-border);border-radius:8px">
          <button type="button" class="btn principal sm" data-ph-ajouter="1">${ICO.plus(16)} Ajouter</button>
        </div>
        <button type="button" class="btn wide" data-a="fermer">Terminé</button>`;

      $$('[data-ph-nom]', panneau).forEach(inp => {
        inp.addEventListener('input', () => {
          const i = Number(inp.dataset.phNom);
          if (C.phases[i]) { C.phases[i].nom = inp.value; planifierSauvegarde(); }
        });
      });
    }

    Ouvrir.ouvrir('<div class="panel"></div>', (panneau) => {
      dessiner(panneau);
      panneau.addEventListener('click', async (e) => {
        if (e.target.closest('[data-ph-ajouter]')) {
          const inp = $('#nouvPhaseNom', panneau);
          const v = (inp && inp.value || '').trim();
          if (!v) { toast('Saisissez le nom de la phase'); return; }
          C.phases.push({ id: uid('ph'), nom: v });
          planifierSauvegarde();
          dessiner(panneau);
          return;
        }
        const m = e.target.closest('[data-ph-monter]');
        if (m) {
          const i = Number(m.dataset.phMonter);
          if (i > 0) {
            const tmp = C.phases[i - 1];
            C.phases[i - 1] = C.phases[i];
            C.phases[i] = tmp;
            planifierSauvegarde();
            dessiner(panneau);
          }
          return;
        }
        const s = e.target.closest('[data-ph-suppr]');
        if (s) {
          const i = Number(s.dataset.phSuppr);
          const ph = C.phases[i];
          if (!ph) return;
          const nb = (C.taches || []).filter(t => t.phaseId === ph.id).length;
          if (C.phases.length <= 1) { toast('Il faut conserver au moins une phase'); return; }
          if (nb > 0 && !(await Dialogue.confirmer(`Cette phase contient ${nb} tâche(s). Les déplacer vers la première phase et supprimer « ${ph.nom} » ?`))) return;
          C.phases.splice(i, 1);
          const cible = C.phases[0].id;
          (C.taches || []).forEach(t => { if (t.phaseId === ph.id) t.phaseId = cible; });
          planifierSauvegarde();
          dessiner(panneau);
        }
      });
    });
  }

  /* ===================== Import de tâches & Modèles BFR =============== */
  function integrerTachesImportees(res, remplacer) {
    if (remplacer) {
      C.phases = res.phases.length ? res.phases : [{ id: uid('ph'), nom: 'Tâches du chantier' }];
      C.taches = res.taches;
      C.estDemo = false;
    } else {
      C.phases = C.phases || [];
      C.taches = C.taches || [];
      const mapPh = {};
      C.phases.forEach(p => { mapPh[ImportTaches.norm(p.nom)] = p.id; });
      const remap = {};
      res.phases.forEach(p => {
        const cle = ImportTaches.norm(p.nom);
        if (mapPh[cle]) remap[p.id] = mapPh[cle];
        else { C.phases.push(p); mapPh[cle] = p.id; remap[p.id] = p.id; }
      });
      res.taches.forEach(t => {
        t.phaseId = remap[t.phaseId] || (C.phases[0] && C.phases[0].id);
        C.taches.push(t);
      });
      C.estDemo = false;
    }
    planifierSauvegarde();
    rendreTout();
  }

  function feuilleImport(ongletInitial) {
    let onglet = ongletInitial || 'texte';

    function dessiner(panneau) {
      panneau.innerHTML = `
        <div class="grab"></div>
        <h3>Importer ou préparer les tâches</h3>
        <p class="sub">Configurez la checklist du chantier en quelques secondes :</p>

        <div class="import-tabs">
          <button type="button" class="import-tab ${onglet === 'texte' ? 'on' : ''}" data-tab="texte">📋 Copier-coller</button>
          <button type="button" class="import-tab ${onglet === 'fichier' ? 'on' : ''}" data-tab="fichier">📊 Excel / CSV</button>
          <button type="button" class="import-tab ${onglet === 'modele' ? 'on' : ''}" data-tab="modele">⚙️ Modèles BFR</button>
        </div>

        ${onglet === 'texte' ? `
          <div class="card" style="margin-bottom:10px">
            <p class="hint" style="margin-top:0">Collez votre liste (depuis un mail, Word, Notes ou WhatsApp). Astuce : une ligne finissant par <strong>:</strong> ou précédée de <strong>#</strong> crée automatiquement une Phase/Lot !</p>
            <textarea id="txtImportColler" rows="8" placeholder="# 1. Montage mécanique\n- Mise en place et alignement châssis\n- Chevillage au sol\n\n# 2. Câblage & Automatisme\n- Raccordement 400V\n- Test chaîne des arrêts d'urgence" style="width:100%;font-size:13.5px"></textarea>
            <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="chkRemplacerTxt" ${(C.taches || []).length === 0 || C.estDemo ? 'checked' : ''}>
              <label for="chkRemplacerTxt" style="font-size:13px">Remplacer la liste actuelle (${(C.taches || []).length} tâche${(C.taches || []).length > 1 ? 's' : ''})</label>
            </div>
            <button type="button" class="btn principal wide" style="margin-top:10px" data-imp="analyser-texte">${ICO.check(17)} Importer cette liste</button>
          </div>
        ` : ''}

        ${onglet === 'fichier' ? `
          <div class="card" style="margin-bottom:10px">
            <p class="hint" style="margin-top:0">Importez un classeur <strong>Excel (.xlsx)</strong>, un fichier <strong>.csv</strong> ou une sauvegarde <strong>.json</strong> de chantier (fonctionne hors connexion).</p>
            <div style="margin-bottom:10px;display:flex;align-items:center;gap:8px">
              <input type="checkbox" id="chkRemplacerFic" ${(C.taches || []).length === 0 || C.estDemo ? 'checked' : ''}>
              <label for="chkRemplacerFic" style="font-size:13px">Remplacer la liste actuelle</label>
            </div>
            <label class="btn principal wide" style="cursor:pointer;margin-bottom:10px">
              <input type="file" id="inpFichierTaches" accept=".xlsx,.csv,.txt,.json" style="display:none">
              ${ICO.upload(18)} Choisir un fichier (.xlsx, .csv, .json)
            </label>
            <button type="button" class="btn ghost wide sm" data-imp="modele-csv">${ICO.download(15)} Télécharger un modèle Excel / CSV vierge</button>
          </div>
        ` : ''}

        ${onglet === 'modele' ? `
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
            ${ImportTaches.MODELES_BFR.map(m => `
              <button type="button" class="menu-item" data-imp-modele="${esc(m.id)}" style="margin:0">
                <span class="ico">${ICO.checklist(18)}</span>
                <span>
                  <strong>${esc(m.nom)}</strong>
                  <small>${esc(m.description)}</small>
                </span>
              </button>
            `).join('')}
          </div>
        ` : ''}

        <button type="button" class="btn grey wide" data-a="fermer">Fermer</button>`;

      const inpF = $('#inpFichierTaches', panneau);
      if (inpF) {
        inpF.addEventListener('change', async () => {
          const f = inpF.files && inpF.files[0];
          if (!f) return;
          const remplacer = !!($('#chkRemplacerFic', panneau) && $('#chkRemplacerFic', panneau).checked);
          const buf = await f.arrayBuffer();
          const res = await ImportTaches.lireFichier(buf);
          if (res.erreur) { Dialogue.informer(res.erreur); return; }
          if (res.type === 'chantier' && res.chantier) {
            C = res.chantier;
            if (!C.id) C.id = uid('ch');
            C.estDemo = false;
            planifierSauvegarde();
            Ouvrir.fermerTout();
            rendreTout();
            toast('Chantier complet importé (' + (C.taches || []).length + ' tâches)');
            return;
          }
          integrerTachesImportees(res, remplacer);
          Ouvrir.fermerTout();
          toast(res.taches.length + ' tâche(s) importée(s) avec succès');
        });
      }
    }

    Ouvrir.ouvrir('<div class="panel"></div>', (panneau) => {
      dessiner(panneau);
      panneau.addEventListener('click', async (e) => {
        const tb = e.target.closest('[data-tab]');
        if (tb) { onglet = tb.dataset.tab; dessiner(panneau); return; }

        const bMod = e.target.closest('[data-imp-modele]');
        if (bMod) {
          const id = bMod.dataset.impModele;
          if ((C.taches || []).length > 0 && !C.estDemo) {
            const ok = await Dialogue.confirmer('Remplacer la liste actuelle par ce modèle BFR Systems ?', { ok: 'Appliquer le modèle' });
            if (!ok) return;
          }
          const res = ImportTaches.depuisModele(id);
          integrerTachesImportees(res, true);
          Ouvrir.fermerTout();
          toast(res.taches.length ? (res.taches.length + ' tâches BFR chargées') : 'Chantier vierge prêt');
          return;
        }

        const act = e.target.closest('[data-imp]');
        if (!act) return;
        if (act.dataset.imp === 'analyser-texte') {
          const txt = ($('#txtImportColler', panneau) && $('#txtImportColler', panneau).value) || '';
          const res = ImportTaches.analyserTexte(txt);
          if (!res.taches.length) { toast('Collez au moins une ligne de tâche'); return; }
          const remplacer = !!($('#chkRemplacerTxt', panneau) && $('#chkRemplacerTxt', panneau).checked);
          integrerTachesImportees(res, remplacer);
          Ouvrir.fermerTout();
          toast(res.taches.length + ' tâche(s) ajoutée(s)');
        } else if (act.dataset.imp === 'modele-csv') {
          telecharger(ImportTaches.modeleCSV(), 'Modele-Taches-Chantier-BFR.csv');
        }
      });
    });
  }

  /* ===================== Fiche Chantier & Client ====================== */
  function feuilleChantier() {
    const cli = C.client || {};
    const html = `<div class="panel">
      <div class="grab"></div>
      <h3>Informations du chantier</h3>
      <p class="sub">Ces données figurent dans l'en-tête de chaque rapport quotidien BFR Systems.</p>

      <div class="card">
        <h2>Projet / Chantier BFR</h2>
        <div class="field"><label>Intitulé du chantier / Projet *</label>
          <input type="text" data-ck="nom" value="${esc(C.nom || '')}" placeholder="Ex. Installation ligne d'encaissage robotisée"></div>
        <div class="grid2">
          <div class="field"><label>N° d'affaire / Commande</label>
            <input type="text" data-ck="affaire" value="${esc(C.affaire || '')}" placeholder="Ex. AFF-2026-118"></div>
          <div class="field"><label>Équipement / Ligne</label>
            <input type="text" data-ck="equipement" value="${esc(C.equipement || '')}" placeholder="Ex. Ligne 3 - Encaisseuse"></div>
        </div>
        <div class="grid2">
          <div class="field"><label>Début du chantier</label>
            <input type="date" data-ck="dateDebut" value="${esc(C.dateDebut || '')}"></div>
          <div class="field"><label>Fin prévisionnelle</label>
            <input type="date" data-ck="dateFinPrevue" value="${esc(C.dateFinPrevue || '')}"></div>
        </div>
        <div class="grid2">
          <div class="field"><label>Responsable chantier BFR</label>
            <input type="text" data-ck="responsable" value="${esc(C.responsable || Report.nomComplet(S.technicien) || '')}" placeholder="Prénom NOM"></div>
          <div class="field"><label>Équipe / Collègues sur site</label>
            <input type="text" data-ck="equipe" value="${esc(C.equipe || '')}" placeholder="Ex. M. Martin, P. Bernard"></div>
        </div>
      </div>

      <div class="card">
        <h2>Client & Lieu d'intervention</h2>
        <div class="field"><label>Nom du client *</label>
          <input type="text" data-clik="nom" value="${esc(cli.nom || '')}" placeholder="Ex. Laiterie du Val d'Ain"></div>
        <div class="field"><label>Site / Atelier / Ville</label>
          <input type="text" data-clik="lieu" value="${esc(cli.lieu || '')}" placeholder="Ex. Usine de Bourg-en-Bresse — Hall 2"></div>
        <div class="grid2">
          <div class="field"><label>Contact client sur site</label>
            <input type="text" data-clik="contact" value="${esc(cli.contact || '')}" placeholder="Ex. M. Laurent Mercier"></div>
          <div class="field"><label>Fonction</label>
            <input type="text" data-clik="fonction" value="${esc(cli.fonction || '')}" placeholder="Ex. Resp. Travaux Neufs"></div>
        </div>
        <div class="grid2">
          <div class="field"><label>Téléphone client</label>
            <input type="tel" data-clik="tel" value="${esc(cli.tel || '')}" placeholder="06 00 00 00 00"></div>
          <div class="field"><label>E-mail client</label>
            <input type="email" data-clik="email" value="${esc(cli.email || '')}" placeholder="contact@client.fr"></div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label>Logo du client (facultatif — imprimé en haut à droite du PDF)</label>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <label class="btn sm ghost" style="cursor:pointer;margin:0">
              <input type="file" id="inpLogoClient" accept="image/*" style="display:none">
              ${ICO.image(15)} ${cli.logo ? 'Changer le logo' : 'Choisir un logo'}
            </label>
            ${cli.logo ? `<img id="apercuLogoCli" src="${cli.logo}" style="max-height:38px;border:1px solid var(--bfr-border);border-radius:4px;background:#fff;padding:2px">
              <button type="button" class="btn sm danger" id="btnSupprLogoCli">${ICO.trash(13)}</button>` : ''}
          </div>
        </div>
      </div>

      <button type="button" class="btn principal wide" data-valider-chantier="1">${ICO.check(18)} Enregistrer</button>
    </div>`;

    Ouvrir.ouvrir(html, (panneau, overlay) => {
      const inpLogo = $('#inpLogoClient', panneau);
      if (inpLogo) {
        inpLogo.addEventListener('change', async () => {
          const f = inpLogo.files && inpLogo.files[0];
          if (!f) return;
          C.client.logo = await compresserImage(f, 500, 0.88);
          planifierSauvegarde();
          overlay.remove();
          feuilleChantier();
        });
      }
      const btnSupLogo = $('#btnSupprLogoCli', panneau);
      if (btnSupLogo) {
        btnSupLogo.addEventListener('click', () => {
          C.client.logo = '';
          planifierSauvegarde();
          overlay.remove();
          feuilleChantier();
        });
      }

      panneau.addEventListener('click', (e) => {
        if (!e.target.closest('[data-valider-chantier]')) return;
        $$('[data-ck]', panneau).forEach(inp => { C[inp.dataset.ck] = inp.value.trim(); });
        C.client = C.client || {};
        $$('[data-clik]', panneau).forEach(inp => { C.client[inp.dataset.clik] = inp.value.trim(); });
        // Si le client a un e-mail et n'est pas encore dans les destinataires, le proposer automatiquement
        if (C.client.email && !(C.destinataires || []).some(d => d.email.toLowerCase() === C.client.email.toLowerCase())) {
          C.destinataires = C.destinataires || [];
          C.destinataires.unshift({
            id: uid('dst'),
            nom: C.client.contact || C.client.nom || 'Client',
            role: C.client.fonction || 'Client',
            email: C.client.email,
            type: 'to',
            actif: true
          });
        }
        C.estDemo = false;
        planifierSauvegarde();
        overlay.remove();
        rendreTout();
        toast('Informations du chantier enregistrées');
      });
    });
  }

  /* ===================== Destinataires du projet ====================== */
  function feuilleDestinataires() {
    function dessiner(panneau) {
      C.destinataires = C.destinataires || [];
      panneau.innerHTML = `
        <div class="grab"></div>
        <h3>Destinataires du rapport quotidien</h3>
        <p class="sub">Personnes concernées par ce chantier (Client, Chef de projet BFR, Chargé d'affaires, Responsable SAV…). Appuyez sur <strong>À</strong> / <strong>Cc</strong> pour basculer.</p>

        <div class="dest-liste">
          ${C.destinataires.length ? C.destinataires.map((d, i) => `
            <div class="dest-row ${d.actif === false ? 'inactif' : ''}">
              <input type="checkbox" data-dest-actif="${i}" ${d.actif === false ? '' : 'checked'} style="width:20px;height:20px">
              <button type="button" class="dest-type-btn ${d.type === 'cc' ? 'cc' : ''}" data-dest-type="${i}" title="Basculer À / Cc">${d.type === 'cc' ? 'Cc' : 'À'}</button>
              <div class="dest-info">
                <strong>${esc(d.nom || d.email)}${d.role ? ` <span style="font-weight:400;color:var(--bfr-text-muted)">· ${esc(d.role)}</span>` : ''}</strong>
                <small>${esc(d.email)}</small>
              </div>
              <button type="button" class="btn sm danger" data-dest-suppr="${i}" style="min-height:30px;padding:4px 8px">${ICO.trash(13)}</button>
            </div>
          `).join('') : `<div class="sticky-note" style="background:#f8fafc;border-color:var(--bfr-border);color:var(--bfr-text-muted)">Aucun destinataire configuré pour l'instant. Ajoutez les personnes concernées ci-dessous.</div>`}
        </div>

        <div class="card" style="margin-top:12px">
          <h2>Ajouter une personne au projet</h2>
          <div class="grid2">
            <div class="field"><label>Nom</label><input type="text" id="dstNom" placeholder="Ex. Marc Lefèvre"></div>
            <div class="field"><label>Rôle / Service</label><input type="text" id="dstRole" placeholder="Ex. Chef de projet BFR"></div>
          </div>
          <div class="grid2">
            <div class="field"><label>Adresse e-mail *</label><input type="email" id="dstEmail" placeholder="prenom.nom@bfr-systems.fr"></div>
            <div class="field"><label>Type d'envoi</label>
              <select id="dstType">
                <option value="to">À (Destinataire principal)</option>
                <option value="cc">Cc (En copie)</option>
              </select>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <input type="checkbox" id="dstMemoBfr">
            <label for="dstMemoBfr" style="font-size:12.5px;color:var(--bfr-text-muted)">Mémoriser aussi pour mes prochains chantiers (équipe BFR)</label>
          </div>
          <button type="button" class="btn ghost wide sm" data-dest-ajouter="1">${ICO.plus(15)} Ajouter ce destinataire</button>
        </div>

        <button type="button" class="btn principal wide" data-a="fermer">Valider</button>`;
    }

    Ouvrir.ouvrir('<div class="panel"></div>', (panneau) => {
      dessiner(panneau);
      panneau.addEventListener('change', (e) => {
        if (e.target.dataset.destActif !== undefined) {
          const i = Number(e.target.dataset.destActif);
          if (C.destinataires[i]) {
            C.destinataires[i].actif = e.target.checked;
            planifierSauvegarde();
            dessiner(panneau);
          }
        }
      });
      panneau.addEventListener('click', (e) => {
        const bt = e.target.closest('[data-dest-type]');
        if (bt) {
          const i = Number(bt.dataset.destType);
          if (C.destinataires[i]) {
            C.destinataires[i].type = C.destinataires[i].type === 'cc' ? 'to' : 'cc';
            planifierSauvegarde();
            dessiner(panneau);
          }
          return;
        }
        const bs = e.target.closest('[data-dest-suppr]');
        if (bs) {
          const i = Number(bs.dataset.destSuppr);
          C.destinataires.splice(i, 1);
          planifierSauvegarde();
          dessiner(panneau);
          return;
        }
        if (e.target.closest('[data-dest-ajouter]')) {
          const email = ($('#dstEmail', panneau).value || '').trim();
          const nom = ($('#dstNom', panneau).value || '').trim();
          const role = ($('#dstRole', panneau).value || '').trim();
          const type = $('#dstType', panneau).value || 'to';
          const memo = $('#dstMemoBfr', panneau).checked;
          if (!email || email.indexOf('@') < 1) {
            toast('Saisissez une adresse e-mail valide');
            $('#dstEmail', panneau).focus();
            return;
          }
          const item = { id: uid('dst'), nom: nom, role: role, email: email, type: type, actif: true };
          C.destinataires.push(item);
          if (memo) {
            S.mail.destinatairesDefaut = S.mail.destinatairesDefaut || [];
            if (!S.mail.destinatairesDefaut.some(x => x.email.toLowerCase() === email.toLowerCase())) {
              S.mail.destinatairesDefaut.push({ nom: nom, role: role, email: email, type: type });
              sauverReglages();
            }
          }
          planifierSauvegarde();
          dessiner(panneau);
          toast('Destinataire ajouté');
        }
      });
    });
  }

  /* ===================== Gestion Multi-Jours ========================== */
  function feuilleJours() {
    const dates = Report.datesJoursTriees(C, C.jourActif);
    const auj = aujourdhuiISO();

    const html = `<div class="panel">
      <div class="grab"></div>
      <h3>Journées d'intervention du chantier</h3>
      <p class="sub">Naviguez d'un jour à l'autre pour consulter l'historique ou éditer le rapport d'une journée précise.</p>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
        ${dates.map((d, idx) => {
          const b = Report.calculerBilan(C, d);
          const actif = d === C.jourActif;
          return `<button type="button" class="menu-item" data-choisir-jour="${esc(d)}" style="margin:0;${actif ? 'border-color:var(--bfr-primary);background:var(--bfr-primary-light)' : ''}">
            <span class="ico" style="${actif ? 'background:var(--bfr-primary);color:#fff' : ''}">J${idx + 1}</span>
            <span style="flex:1">
              <strong>Jour ${idx + 1} — ${esc(Report.jourSemaineFr(d))} ${esc(Report.frDate(d))}${d === auj ? ' (Aujourd\'hui)' : ''}</strong>
              <small>${b.faitCeJour.length} tâche${b.faitCeJour.length > 1 ? 's' : ''} réalisée${b.faitCeJour.length > 1 ? 's' : ''}${b.jour.envoyeLe ? ' · ✓ Rapport envoyé à ' + esc(b.jour.envoyeLe) : ' · Rapport non envoyé'}</small>
            </span>
          </button>`;
        }).join('')}
      </div>

      <div class="card">
        <h2>Ouvrir / Ajouter une autre date</h2>
        <div style="display:flex;gap:8px">
          <input type="date" id="inpNouvDateJour" value="${esc(auj)}" style="flex:1">
          <button type="button" class="btn principal sm" data-ouvrir-date="1">${ICO.plus(16)} Ouvrir ce jour</button>
        </div>
      </div>

      <button type="button" class="btn grey wide" data-a="fermer">Fermer</button>
    </div>`;

    Ouvrir.ouvrir(html, (panneau, overlay) => {
      panneau.addEventListener('click', (e) => {
        const bj = e.target.closest('[data-choisir-jour]');
        if (bj) {
          assurerJour(bj.dataset.choisirJour);
          planifierSauvegarde();
          overlay.remove();
          rendreTout();
          return;
        }
        if (e.target.closest('[data-ouvrir-date]')) {
          const val = ($('#inpNouvDateJour', panneau).value || '').trim();
          if (!val) return;
          assurerJour(val);
          planifierSauvegarde();
          overlay.remove();
          rendreTout();
          toast('Journée du ' + Report.frDate(val) + ' ouverte');
        }
      });
    });
  }

  function creerNouveauJourRapide() {
    const auj = aujourdhuiISO();
    const dates = Report.datesJoursTriees(C, C.jourActif);
    // Si aujourd'hui n'existe pas encore, l'ouvrir directement ; sinon proposer le lendemain du dernier jour
    if (dates.indexOf(auj) < 0) {
      assurerJour(auj);
      planifierSauvegarde();
      rendreTout();
      toast('Journée d\'aujourd\'hui (' + Report.frDate(auj) + ') ouverte');
      return;
    }
    const dern = dates[dates.length - 1];
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dern);
    const dSuiv = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1) : new Date();
    const pad = (n) => ('0' + n).slice(-2);
    const isoSuiv = dSuiv.getFullYear() + '-' + pad(dSuiv.getMonth() + 1) + '-' + pad(dSuiv.getDate());
    assurerJour(isoSuiv);
    planifierSauvegarde();
    rendreTout();
    const b = Report.calculerBilan(C, isoSuiv);
    toast('Jour ' + b.numeroJour + ' (' + Report.frDate(isoSuiv) + ') créé');
  }

  /* ===================== Auto-remplissage intelligent du Journal ====== */
  function genererSyntheseAuto() {
    const b = Report.calculerBilan(C, C.jourActif);
    const j = assurerJour(C.jourActif);
    const parties = [];
    if (b.faitCeJour.length) {
      parties.push('Travaux réalisés ce jour (' + b.faitCeJour.length + ') : ' + b.faitCeJour.map(t => t.titre).join(' ; ') + '.');
    }
    if (b.enCours.length) {
      parties.push('En cours : ' + b.enCours.map(t => t.titre + (t.progression ? ' (' + t.progression + '%)' : '')).join(' ; ') + '.');
    }
    if (b.bloques.length) {
      parties.push('Points bloquants à lever : ' + b.bloques.map(t => t.titre + (t.blocage ? ' (' + t.blocage + ')' : '')).join(' ; ') + '.');
    }
    parties.push('Avancement global du chantier : ' + b.pctGlobal + ' % (' + b.faitTotal.length + '/' + b.total + ').');
    j.synthese = parties.join('\n');
    planifierSauvegarde();
    rendreTout();
    toast('Synthèse pré-remplie');
  }

  function genererPrevuDemainAuto() {
    const b = Report.calculerBilan(C, C.jourActif);
    const j = assurerJour(C.jourActif);
    const suite = b.enCours.concat(b.aFaire).slice(0, 5);
    if (!suite.length) {
      toast('Toutes les tâches sont déjà terminées !');
      return;
    }
    j.prevuDemain = suite.map(t => '• ' + (t.statut === 'encours' ? 'Poursuite : ' : '') + t.titre).join('\n');
    planifierSauvegarde();
    rendreTout();
    toast('Programme du lendemain pré-rempli');
  }

  /* ===================== Téléchargement & Aperçu PDF & Envoi Mail ===== */
  function telecharger(blob, nom) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
  }

  function copierPressePapiers(txt, messageToast) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        () => toast(messageToast || 'Copié dans le presse-papiers'),
        () => toast('Copie automatique indisponible')
      );
    }
  }

  async function afficherApercuPDF() {
    toast('Préparation de l\'aperçu PDF…', 1500);
    try {
      const res = await Report.genererApercu(C, S, C.jourActif);
      const canvases = await Pdf.rendrePages(res.apercu, { echelle: 1.5 });
      const html = `<div class="panel" style="max-height:94vh">
        <div class="grab"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
          <h3 style="margin:0">Aperçu PDF — Jour ${res.bilan.numeroJour}</h3>
          <span class="pill">${canvases.length} page${canvases.length > 1 ? 's' : ''}</span>
        </div>
        <div class="apercu-zone" id="zoneCanvasApercu"></div>
        <div class="btnrow" style="margin-top:12px">
          <button type="button" class="btn grey" data-a="fermer">Fermer</button>
          <button type="button" class="btn ghost" data-ap="dl-pdf">${ICO.download(16)} PDF</button>
          <button type="button" class="btn principal" data-ap="envoyer">${ICO.send(16)} Envoyer par mail</button>
        </div>
      </div>`;

      Ouvrir.ouvrir(html, (panneau, overlay) => {
        const zone = $('#zoneCanvasApercu', panneau);
        canvases.forEach((cv, i) => {
          const wrap = document.createElement('div');
          wrap.className = 'apercu-feuille';
          const num = document.createElement('div');
          num.className = 'apercu-num';
          num.textContent = 'Page ' + (i + 1) + ' / ' + canvases.length;
          wrap.appendChild(cv);
          wrap.appendChild(num);
          zone.appendChild(wrap);
        });

        panneau.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-ap]');
          if (!b) return;
          if (b.dataset.ap === 'dl-pdf') {
            const pdfReel = await Report.genererPDF(C, S, C.jourActif);
            telecharger(pdfReel.blob, pdfReel.filename);
            toast('PDF téléchargé');
          } else if (b.dataset.ap === 'envoyer') {
            overlay.remove();
            soumettreRapportQuotidien();
          }
        });
      });
    } catch (err) {
      console.error(err);
      Dialogue.informer('Erreur lors de l\'aperçu PDF : ' + (err && err.message ? err.message : err));
    }
  }

  function destinatairesActifs() {
    const actifs = (C.destinataires || []).filter(d => d && d.actif !== false && d.email);
    const to = actifs.filter(d => d.type !== 'cc').map(d => d.email.trim());
    const cc = actifs.filter(d => d.type === 'cc').map(d => d.email.trim());
    return {
      to: to,
      cc: cc,
      toStr: to.join(', '),
      ccStr: cc.join(', '),
      tousStr: to.concat(cc).join(', ')
    };
  }

  function construireUrlMailto(dests, objet, corps) {
    const toPart = dests.to.map(encodeURIComponent).join(',');
    const params = [];
    if (dests.cc.length) params.push('cc=' + dests.cc.map(encodeURIComponent).join(','));
    if (objet) params.push('subject=' + encodeURIComponent(objet));
    if (corps) params.push('body=' + encodeURIComponent(corps));
    return 'mailto:' + toPart + (params.length ? '?' + params.join('&') : '');
  }

  function dansUnCadre() {
    try { return window.self !== window.top; } catch (_) { return true; }
  }

  async function soumettreRapportQuotidien() {
    const btn = $('#btnSoumettre');
    const txtOrig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Génération du rapport BFR…'; }

    try {
      const pdfRes = await Report.genererPDF(C, S, C.jourActif);
      let wordRes = null;
      try { wordRes = await Report.genererWord(C, S, C.jourActif); } catch (_) { wordRes = null; }

      const dests = destinatairesActifs();
      const objet = Report.objetMail(C, S, C.jourActif);
      const corps = Report.corpsMail(C, S, C.jourActif);
      const mailtoUrl = construireUrlMailto(dests, objet, corps);
      const b = pdfRes.bilan;

      const html = `<div class="panel">
        <div class="grab"></div>
        <h3>Envoyer le rapport quotidien — Jour ${b.numeroJour}</h3>
        <p class="sub">Document officiel BFR Systems du <strong>${esc(Report.frDate(b.dateJour))}</strong> prêt (${esc(pdfRes.filename)}) :</p>

        <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;line-height:1.5">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis"><strong style="color:var(--bfr-secondary)">À :</strong> <span style="font-family:ui-monospace,monospace;color:#1e293b">${esc(dests.toStr || 'aucun destinataire configuré')}</span></div>
            ${dests.toStr ? `<button type="button" class="btn sm ghost" data-copier="${esc(dests.toStr)}" style="padding:2px 8px;font-size:11px;min-height:26px">Copier</button>` : `<button type="button" class="btn sm ghost" data-gerer-dest="1" style="padding:2px 8px;font-size:11px;min-height:26px">Ajouter</button>`}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:6px;padding-top:6px;border-top:1px dashed #cbd5e1">
            <div style="min-width:0;overflow:hidden;text-overflow:ellipsis"><strong style="color:var(--bfr-secondary)">Cc :</strong> <span style="font-family:ui-monospace,monospace;color:#1e293b">${esc(dests.ccStr || 'aucune')}</span></div>
            ${dests.ccStr ? `<button type="button" class="btn sm ghost" data-copier="${esc(dests.ccStr)}" style="padding:2px 8px;font-size:11px;min-height:26px">Copier</button>` : ''}
          </div>
        </div>

        <button type="button" class="menu-item" data-env="partager" style="background:#e0f2fe;border:2px solid var(--bfr-primary)">
          <span class="ico" style="background:var(--bfr-primary);color:#fff">${ICO.send(20)}</span>
          <span>
            <strong style="font-size:14.5px;color:var(--bfr-secondary)">Envoyer par e-mail (PDF BFR joint)</strong>
            <small>Gmail / Outlook mobile — PDF attaché, résumé pré-rempli &amp; destinataires copiés</small>
          </span>
        </button>

        <div style="text-align:center;margin:6px 0 10px">
          <a href="${esc(mailtoUrl)}" data-env="mailto" class="small" style="color:var(--bfr-primary);text-decoration:underline;font-size:12px">
            Ouvrir directement la messagerie avec À, Cc et le résumé pré-remplis (+ téléchargement du PDF)
          </a>
        </div>

        <button type="button" class="menu-item" data-env="dl-pdf">
          <span class="ico">${ICO.download(18)}</span>
          <span>Télécharger le PDF (${esc(pdfRes.filename)})</span>
        </button>
        ${wordRes ? `<button type="button" class="menu-item" data-env="dl-word">
          <span class="ico">${ICO.fileText(18)}</span>
          <span>Télécharger la version Word (.docx)</span>
        </button>` : ''}
        <button type="button" class="menu-item" data-env="copier-corps">
          <span class="ico">${ICO.copy(18)}</span>
          <span>Copier l'objet et le texte du mail</span>
        </button>

        <button type="button" class="btn grey wide" style="margin-top:8px" data-a="fermer">Fermer</button>
      </div>`;

      Ouvrir.ouvrir(html, (panneau, overlay) => {
        panneau.addEventListener('click', async (e) => {
          const bc = e.target.closest('[data-copier]');
          if (bc) {
            copierPressePapiers(bc.dataset.copier, 'Adresses copiées : ' + bc.dataset.copier);
            return;
          }
          if (e.target.closest('[data-gerer-dest]')) {
            overlay.remove();
            feuilleDestinataires();
            return;
          }
          const be = e.target.closest('[data-env]');
          if (!be) return;
          if (be.tagName === 'A') e.preventDefault();
          const act = be.dataset.env;

          const marquerEnvoye = () => {
            const j = assurerJour(C.jourActif);
            j.envoyeLe = heureCourte();
            planifierSauvegarde();
            rendreTout();
          };

          if (act === 'partager') {
            if (dests.tousStr) copierPressePapiers(dests.toStr || dests.tousStr);
            const fichierPdf = new File([pdfRes.blob], pdfRes.filename, { type: 'application/pdf', lastModified: Date.now() });
            let peutShare = false;
            if (navigator.canShare && !dansUnCadre()) {
              try { peutShare = navigator.canShare({ files: [fichierPdf] }); } catch (_) { peutShare = false; }
            }
            if (peutShare) {
              try {
                await navigator.share({
                  files: [fichierPdf],
                  title: objet,
                  text: corps
                });
                marquerEnvoye();
                toast('✓ Rapport quotidien transmis');
              } catch (err) {
                if (err && err.name !== 'AbortError') {
                  telecharger(pdfRes.blob, pdfRes.filename);
                  marquerEnvoye();
                  window.location.href = mailtoUrl;
                }
              }
            } else {
              telecharger(pdfRes.blob, pdfRes.filename);
              marquerEnvoye();
              toast('PDF téléchargé — ouverture de votre messagerie…', 3200);
              setTimeout(() => {
                try { window.open(mailtoUrl, '_blank') || (window.location.href = mailtoUrl); } catch (_) {}
              }, 350);
            }
          } else if (act === 'mailto') {
            telecharger(pdfRes.blob, pdfRes.filename);
            marquerEnvoye();
            toast('PDF téléchargé : pensez à le joindre au mail', 3400);
            setTimeout(() => {
              try { window.open(mailtoUrl, '_blank') || (window.location.href = mailtoUrl); } catch (_) {}
            }, 350);
          } else if (act === 'dl-pdf') {
            telecharger(pdfRes.blob, pdfRes.filename);
            toast('PDF téléchargé');
          } else if (act === 'dl-word' && wordRes) {
            telecharger(wordRes.blob, wordRes.filename);
            toast('Document Word téléchargé');
          } else if (act === 'copier-corps') {
            copierPressePapiers(objet + '\n\n' + corps, 'Objet et texte du mail copiés');
          }
        });
      });
    } catch (err) {
      console.error(err);
      Dialogue.informer('Impossible de générer le rapport : ' + (err && err.message ? err.message : err));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = txtOrig; }
    }
  }

  /* ===================== Menu Principal ☰, Mes Chantiers & Réglages === */
  function ouvrirMenuPrincipal() {
    const html = `<div class="panel">
      <div class="grab"></div>
      <h3>Menu — BFR Chantier</h3>
      <p class="sub">Suivi de chantier multi-jours &amp; rapports quotidiens BFR Systems</p>

      <button type="button" class="menu-item" data-m="mes-chantiers">
        <span class="ico">${ICO.folder(18)}</span>
        <span><strong>Mes chantiers</strong><small>Changer de chantier, en créer un nouveau ou archiver</small></span>
      </button>

      <button type="button" class="menu-item" data-m="import">
        <span class="ico">${ICO.upload(18)}</span>
        <span><strong>Importer des tâches (.xlsx, .csv, texte)</strong><small>Charger une liste préparée au bureau ou un modèle BFR</small></span>
      </button>

      <button type="button" class="menu-item" data-m="identite">
        <span class="ico">${ICO.user(18)}</span>
        <span><strong>Mes informations (Intervenant BFR)</strong><small>${esc(Report.nomComplet(S.technicien) || 'Nom, téléphone et e-mail affichés sur les rapports')}</small></span>
      </button>

      <button type="button" class="menu-item" data-m="reglages">
        <span class="ico">${ICO.gear(18)}</span>
        <span><strong>Réglages BFR &amp; Rapport</strong><small>Pied de page société, logo et options d'impression PDF</small></span>
      </button>

      <button type="button" class="menu-item" data-m="sauvegarde-json">
        <span class="ico">${ICO.download(18)}</span>
        <span><strong>Exporter / Sauvegarder ce chantier (.json)</strong><small>Pour transmettre le chantier complet à un collègue</small></span>
      </button>

      <button type="button" class="btn grey wide" style="margin-top:8px" data-a="fermer">Fermer</button>
    </div>`;

    Ouvrir.ouvrir(html, (panneau, overlay) => {
      panneau.addEventListener('click', (e) => {
        const bm = e.target.closest('[data-m]');
        if (!bm) return;
        const action = bm.dataset.m;
        overlay.remove();
        if (action === 'mes-chantiers') feuilleMesChantiers();
        else if (action === 'import') feuilleImport('texte');
        else if (action === 'identite') feuilleIdentite();
        else if (action === 'reglages') feuilleReglages();
        else if (action === 'sauvegarde-json') exporterChantierJSON();
      });
    });
  }

  function exporterChantierJSON() {
    const payload = {
      type: 'bfr-chantier',
      exporteLe: new Date().toISOString(),
      chantier: C
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const nom = 'Chantier-BFR_' + ((C.affaire || C.nom || 'export').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 35)) + '.json';
    telecharger(blob, nom);
    toast('Sauvegarde JSON téléchargée');
  }

  async function feuilleMesChantiers() {
    await BaseLocale.sauverChantier(C);
    const liste = await BaseLocale.listerTous();
    if (!liste.some(x => x.id === C.id)) liste.unshift(C);
    liste.sort((a, b) => String(b.maj || '').localeCompare(String(a.maj || '')));

    const html = `<div class="panel">
      <div class="grab"></div>
      <h3>Mes chantiers sur ce téléphone</h3>
      <p class="sub">Basculez d'un chantier à un autre ou démarrez un nouveau chantier.</p>

      <button type="button" class="btn principal wide" style="margin-bottom:12px" data-mc="nouveau">
        ${ICO.plus(18)} Créer un nouveau chantier
      </button>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        ${liste.map(it => {
          const b = Report.calculerBilan(it, it.jourActif);
          const estActif = it.id === C.id;
          return `<div style="display:flex;align-items:center;gap:8px;background:#fff;border:${estActif ? '2px solid var(--bfr-primary)' : '1px solid var(--bfr-border)'};border-radius:10px;padding:10px 12px">
            <div style="flex:1;min-width:0;cursor:pointer" data-mc-ouvrir="${esc(it.id)}">
              <strong style="display:block;font-family:var(--font-heading);font-size:14px;color:var(--bfr-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                ${esc(it.nom || 'Chantier sans titre')} ${estActif ? '<span class="pill" style="margin-left:4px">Actif</span>' : ''}
              </strong>
              <small style="color:var(--bfr-text-muted);font-size:12px">
                ${esc((it.client && it.client.nom) || 'Client non renseigné')} · ${b.faitTotal.length}/${b.total} (${b.pctGlobal} %) · ${b.nbJoursTotal} j.
              </small>
            </div>
            ${!estActif ? `<button type="button" class="btn sm danger" data-mc-suppr="${esc(it.id)}" style="min-height:32px;padding:4px 8px">${ICO.trash(14)}</button>` : ''}
          </div>`;
        }).join('')}
      </div>

      <label class="btn ghost wide sm" style="cursor:pointer;margin-bottom:10px">
        <input type="file" id="inpImportChantierJson" accept=".json" style="display:none">
        ${ICO.upload(15)} Importer un fichier chantier (.json)
      </label>

      <button type="button" class="btn grey wide" data-a="fermer">Fermer</button>
    </div>`;

    Ouvrir.ouvrir(html, (panneau, overlay) => {
      const inpJson = $('#inpImportChantierJson', panneau);
      if (inpJson) {
        inpJson.addEventListener('change', async () => {
          const f = inpJson.files && inpJson.files[0];
          if (!f) return;
          const res = await ImportTaches.lireFichier(await f.arrayBuffer());
          if (res.type === 'chantier' && res.chantier) {
            C = res.chantier;
            C.id = uid('ch');
            C.estDemo = false;
            await BaseLocale.sauverChantier(C);
            localStorage.setItem(CLE_COURANT, C.id);
            overlay.remove();
            rendreTout();
            toast('Chantier importé avec succès');
          } else {
            Dialogue.informer(res.erreur || 'Ce fichier JSON ne contient pas un chantier complet.');
          }
        });
      }

      panneau.addEventListener('click', async (e) => {
        if (e.target.closest('[data-mc="nouveau"]')) {
          overlay.remove();
          demarrerNouveauChantierPropre();
          return;
        }
        const bo = e.target.closest('[data-mc-ouvrir]');
        if (bo) {
          const charge = await BaseLocale.chargerChantier(bo.dataset.mcOuvrir);
          if (charge) {
            C = charge;
            localStorage.setItem(CLE_COURANT, C.id);
            overlay.remove();
            rendreTout();
            toast('Chantier ouvert');
          }
          return;
        }
        const bs = e.target.closest('[data-mc-suppr]');
        if (bs) {
          if (await Dialogue.confirmer('Supprimer définitivement ce chantier de ce téléphone ?', { ok: 'Supprimer', danger: true })) {
            await BaseLocale.supprimerChantier(bs.dataset.mcSuppr);
            overlay.remove();
            feuilleMesChantiers();
          }
        }
      });
    });
  }

  function demarrerNouveauChantierPropre() {
    const html = `<div class="panel">
      <div class="grab"></div>
      <h3>Nouveau chantier</h3>
      <p class="sub">Choisissez votre point de départ :</p>

      ${ImportTaches.MODELES_BFR.map(m => `
        <button type="button" class="menu-item" data-nouv-mod="${esc(m.id)}">
          <span class="ico">${ICO.checklist(18)}</span>
          <span><strong>${esc(m.nom)}</strong><small>${esc(m.description)}</small></span>
        </button>
      `).join('')}

      <button type="button" class="btn grey wide" style="margin-top:8px" data-a="fermer">Annuler</button>
    </div>`;

    Ouvrir.ouvrir(html, (panneau, overlay) => {
      panneau.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-nouv-mod]');
        if (!b) return;
        // Si le chantier actuel était la démo, on la remplace proprement
        const ancienDemoId = C && C.estDemo ? C.id : null;
        C = nouveauChantierVierge({ modeleId: b.dataset.nouvMod, estDemo: false });
        if (ancienDemoId) await BaseLocale.supprimerChantier(ancienDemoId);
        await BaseLocale.sauverChantier(C);
        try { localStorage.setItem(CLE_COURANT, C.id); } catch (_) {}
        overlay.remove();
        rendreTout();
        feuilleChantier();
      });
    });
  }

  function feuilleIdentite() {
    const t = S.technicien || {};
    const html = `<div class="panel">
      <div class="grab"></div>
      <h3>Mes informations</h3>
      <p class="sub">Conservées sur votre téléphone et reprises automatiquement dans l'encadré « Votre interlocuteur BFR Systems » de chaque rapport quotidien.</p>

      <div class="card">
        <div class="grid2">
          <div class="field"><label>Prénom</label><input type="text" id="idPrenom" value="${esc(t.prenom || '')}" placeholder="Ex. Julien"></div>
          <div class="field"><label>Nom</label><input type="text" id="idNom" value="${esc(t.nom || '')}" placeholder="Ex. DURAND"></div>
        </div>
        <div class="field"><label>Fonction</label><input type="text" id="idFonction" value="${esc(t.fonction || '')}" placeholder="Ex. Chargé de chantier / Automaticien BFR"></div>
        <div class="grid2">
          <div class="field"><label>Téléphone</label><input type="tel" id="idTel" value="${esc(t.tel || '')}" placeholder="06 12 34 56 78"></div>
          <div class="field"><label>E-mail BFR</label><input type="email" id="idEmail" value="${esc(t.email || '')}" placeholder="prenom.nom@bfr-systems.fr"></div>
        </div>
      </div>

      <button type="button" class="btn principal wide" data-save-id="1">${ICO.check(18)} Enregistrer mes coordonnées</button>
    </div>`;

    Ouvrir.ouvrir(html, (panneau, overlay) => {
      panneau.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save-id]')) return;
        S.technicien = {
          prenom: $('#idPrenom', panneau).value.trim(),
          nom: $('#idNom', panneau).value.trim(),
          fonction: $('#idFonction', panneau).value.trim(),
          tel: $('#idTel', panneau).value.trim(),
          email: $('#idEmail', panneau).value.trim()
        };
        sauverReglages();
        if (!C.responsable || C.estDemo) C.responsable = Report.nomComplet(S.technicien);
        planifierSauvegarde();
        overlay.remove();
        rendreTout();
        toast('Coordonnées mémorisées');
      });
    });
  }

  function feuilleReglages() {
    const so = S.societe || {};
    const rp = S.rapport || {};
    const html = `<div class="panel">
      <div class="grab"></div>
      <h3>Réglages BFR Systems</h3>
      <p class="sub">Personnalisation du modèle de rapport quotidien et de l'objet d'e-mail.</p>

      <div class="card">
        <h2>En-tête &amp; Pied de page PDF</h2>
        <div class="field"><label>Nom de la société</label>
          <input type="text" id="regNomSoc" value="${esc(so.nom || 'BFR SYSTEMS')}"></div>
        <div class="field"><label>Adresse du pied de page</label>
          <textarea id="regPied" rows="2">${esc(so.piedPage || '50 allée des érables, 01150 Blyes, France')}</textarea></div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          <input type="checkbox" id="regChkComplete" ${rp.inclureChecklist !== false ? 'checked' : ''}>
          <label for="regChkComplete" style="font-size:13.5px">Joindre le tableau récapitulatif complet de la checklist en fin de PDF</label>
        </div>
      </div>

      <div class="card">
        <h2>Modèle d'objet d'e-mail quotidien</h2>
        <div class="field" style="margin-bottom:4px">
          <input type="text" id="regObjetMail" value="${esc((S.mail && S.mail.objet) || REGLAGES_DEFAUT.mail.objet)}">
        </div>
        <p class="hint" style="margin:0">Variables disponibles : <code>{{jour}}</code>, <code>{{date}}</code>, <code>{{chantier}}</code>, <code>{{affaire}}</code>, <code>{{client}}</code>, <code>{{avancement}}</code></p>
      </div>

      <button type="button" class="btn principal wide" data-save-reg="1">${ICO.check(18)} Enregistrer les réglages</button>
    </div>`;

    Ouvrir.ouvrir(html, (panneau, overlay) => {
      panneau.addEventListener('click', (e) => {
        if (!e.target.closest('[data-save-reg]')) return;
        S.societe.nom = $('#regNomSoc', panneau).value.trim() || 'BFR SYSTEMS';
        S.societe.piedPage = $('#regPied', panneau).value.trim();
        S.rapport.inclureChecklist = $('#regChkComplete', panneau).checked;
        S.mail.objet = $('#regObjetMail', panneau).value.trim() || REGLAGES_DEFAUT.mail.objet;
        sauverReglages();
        overlay.remove();
        rendreTout();
        toast('Réglages enregistrés');
      });
    });
  }

  /* ===================== Délégation globale des clics ================= */
  function brancherEvenementsGlobaux() {
    $('#btnMenu').addEventListener('click', ouvrirMenuPrincipal);
    $('#btnAjouterTache').addEventListener('click', () => feuilleTache(null));
    $('#btnRapportBas').addEventListener('click', () => {
      const carte = $('#carteRapportQuotidien');
      if (carte) carte.scrollIntoView({ behavior: 'smooth', block: 'center' });
      soumettreRapportQuotidien();
    });

    document.addEventListener('click', (e) => {
      // Ignorer les clics déjà dans une feuille modale
      if (e.target.closest('.sheet') || e.target.closest('.annot-editeur') || e.target.closest('.dlg-fond')) return;

      const btnJourNav = e.target.closest('[data-jour-aller]');
      if (btnJourNav) {
        const cible = btnJourNav.dataset.jourAller;
        if (cible) {
          assurerJour(cible);
          planifierSauvegarde();
          rendreTout();
        }
        return;
      }

      const btnFiltre = e.target.closest('[data-filtre-rapide]');
      if (btnFiltre) {
        const nv = btnFiltre.dataset.filtreRapide;
        filtreStatut = (filtreStatut === nv && nv !== 'tous') ? 'tous' : nv;
        rendreTout();
        return;
      }

      const btnDic = e.target.closest('[data-dictee]');
      if (btnDic) {
        const zone = $('#' + btnDic.dataset.dictee);
        if (zone) basculerDictee(zone, btnDic);
        return;
      }

      const actEl = e.target.closest('[data-a]');
      if (!actEl) return;
      const a = actEl.dataset.a;

      if (a === 'cocher-tache') {
        e.stopPropagation();
        cocherDecocherTache(actEl.dataset.id);
      } else if (a === 'ouvrir-tache') {
        feuilleTache(actEl.dataset.id);
      } else if (a === 'ajouter-tache') {
        feuilleTache(null);
      } else if (a === 'ajouter-tache-phase') {
        e.stopPropagation();
        feuilleTache(null, actEl.dataset.phase);
      } else if (a === 'plier-phase') {
        if (e.target.closest('[data-a="ajouter-tache-phase"]')) return;
        const pid = actEl.dataset.id;
        C.phasesPliees = C.phasesPliees || {};
        C.phasesPliees[pid] = !C.phasesPliees[pid];
        planifierSauvegarde();
        rendreTaches(Report.calculerBilan(C, C.jourActif));
      } else if (a === 'vider-recherche') {
        rechercheTexte = '';
        rendreTaches(Report.calculerBilan(C, C.jourActif));
      } else if (a === 'gerer-phases') {
        feuillePhases();
      } else if (a === 'ouvrir-import') {
        feuilleImport('texte');
      } else if (a === 'editer-chantier') {
        feuilleChantier();
      } else if (a === 'editer-destinataires') {
        feuilleDestinataires();
      } else if (a === 'ouvrir-jours') {
        feuilleJours();
      } else if (a === 'nouveau-jour') {
        creerNouveauJourRapide();
      } else if (a === 'auto-synthese') {
        genererSyntheseAuto();
      } else if (a === 'auto-demain') {
        genererPrevuDemainAuto();
      } else if (a === 'annoter-photo-jour') {
        const j = assurerJour(C.jourActif);
        const ph = j.photos && j.photos[Number(actEl.dataset.idx)];
        if (ph && typeof Annotation !== 'undefined') {
          Annotation.ouvrir(ph, { fin: () => { planifierSauvegarde(); rendreTout(); } });
        }
      } else if (a === 'suppr-photo-jour') {
        const j = assurerJour(C.jourActif);
        if (j.photos) {
          j.photos.splice(Number(actEl.dataset.idx), 1);
          planifierSauvegarde();
          rendreTout();
        }
      } else if (a === 'apercu') {
        afficherApercuPDF();
      } else if (a === 'soumettre') {
        soumettreRapportQuotidien();
      } else if (a === 'word') {
        Report.genererWord(C, S, C.jourActif).then(res => {
          telecharger(res.blob, res.filename);
          toast('Document Word téléchargé');
        }).catch(err => Dialogue.informer('Erreur Word : ' + err));
      } else if (a === 'demarrer-propre') {
        demarrerNouveauChantierPropre();
      } else if (a === 'garder-demo') {
        C.estDemo = false;
        planifierSauvegarde();
        rendreTout();
      }
    });
  }

  /* ===================== Enregistrement du Service Worker PWA ========= */
  function enregistrerServiceWorker() {
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  /* ===================== Démarrage ==================================== */
  async function initialiser() {
    brancherEvenementsGlobaux();
    let idCourant = '';
    try { idCourant = localStorage.getItem(CLE_COURANT) || ''; } catch (_) {}

    if (idCourant) {
      C = await BaseLocale.chargerChantier(idCourant);
    }
    if (!C) {
      const tous = await BaseLocale.listerTous();
      if (tous.length) {
        tous.sort((a, b) => String(b.maj || '').localeCompare(String(a.maj || '')));
        C = await BaseLocale.chargerChantier(tous[0].id);
      }
    }
    if (!C) {
      C = creerChantierDemonstration();
      await BaseLocale.sauverChantier(C);
      try { localStorage.setItem(CLE_COURANT, C.id); } catch (_) {}
    }

    rendreTout();
    enregistrerServiceWorker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialiser);
  } else {
    initialiser();
  }
})();
