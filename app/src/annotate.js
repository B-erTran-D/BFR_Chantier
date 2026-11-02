/* =========================================================================
   annotate.js — Annotation d'une photo au doigt (flèche, cercle, texte, tracé)
   Les annotations sont mémorisées en coordonnées relatives (0 → 1) :
   elles se redessinent à n'importe quelle résolution à l'export.
   ========================================================================= */
(function (global) {
  'use strict';

  const COULEURS = ['#e11d48', '#f59e0b', '#22c55e', '#ffffff', '#111827'];
  const OUTILS = {
    crayon: {
      nom: 'Crayon',
      ico: '<svg class="bfr-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
    },
    fleche: {
      nom: 'Flèche',
      ico: '<svg class="bfr-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
    },
    cercle: {
      nom: 'Cercle',
      ico: '<svg class="bfr-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'
    },
    texte: {
      nom: 'Texte',
      ico: '<svg class="bfr-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="9" y1="20" x2="15" y2="20"/></svg>'
    }
  };

  /** Convertit une image (dataURL) en objet Image chargé. */
  function chargerImage(dataUrl) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /** Dessine une annotation sur un contexte, dans un rectangle cible. */
  function dessinerAnnotation(ctx, a, rect) {
    const X = (v) => rect.x + v * rect.w;
    const Y = (v) => rect.y + v * rect.h;
    const ep = Math.max(2, rect.w * 0.006);        // épaisseur proportionnelle
    ctx.save();
    ctx.strokeStyle = a.couleur;
    ctx.fillStyle = a.couleur;
    ctx.lineWidth = ep;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (a.type === 'crayon') {
      ctx.beginPath();
      a.points.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(X(p[0]), Y(p[1])); else ctx.lineTo(X(p[0]), Y(p[1]));
      });
      ctx.stroke();
    } else if (a.type === 'fleche') {
      const x1 = X(a.points[0][0]), y1 = Y(a.points[0][1]);
      const x2 = X(a.points[1][0]), y2 = Y(a.points[1][1]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const t = ep * 4.2;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - t * Math.cos(ang - 0.4), y2 - t * Math.sin(ang - 0.4));
      ctx.lineTo(x2 - t * Math.cos(ang + 0.4), y2 - t * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fill();
    } else if (a.type === 'cercle') {
      const cx = X(a.points[0][0]), cy = Y(a.points[0][1]);
      const rx = Math.abs(X(a.points[1][0]) - cx), ry = Math.abs(Y(a.points[1][1]) - cy);
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (a.type === 'texte') {
      const taille = Math.max(12, rect.w * (a.taille || 0.045));
      ctx.font = '600 ' + taille + 'px system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.lineWidth = Math.max(2, taille * 0.18);
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(a.texte, X(a.points[0][0]), Y(a.points[0][1]));
      ctx.fillStyle = a.couleur;
      ctx.fillText(a.texte, X(a.points[0][0]), Y(a.points[0][1]));
    }
    ctx.restore();
  }

  /** Calcule le rectangle « contain » de l'image dans un canvas. */
  function rectContain(iw, ih, cw, ch) {
    const ratio = Math.min(cw / iw, ch / ih);
    const w = iw * ratio, h = ih * ratio;
    return { x: (cw - w) / 2, y: (ch - h) / 2, w: w, h: h };
  }

  /* ===================================================================== */
  class Editeur {
    constructor(photo, callbacks) {
      /* photo : { dataUrl, annotations } */
      this.photo = photo;
      this.cb = callbacks || {};
      this.annotations = (photo.annotations || []).map(a => JSON.parse(JSON.stringify(a)));
      this.outil = null;
      this.couleur = '#e11d48';
      this.enCours = null;
      this.ouvrir();
    }

    ouvrir() {
      const overlay = document.createElement('div');
      overlay.className = 'annot-editeur';
      overlay.innerHTML = `
        <div class="annot-bar">
          <button type="button" class="iconbtn" data-a="annuler">${(window.ICO && window.ICO.close(20)) || '✕'}</button>
          <div class="annot-titre">Annoter la photo</div>
          <button type="button" class="btn sm" data-a="valider">Valider</button>
        </div>
        <div class="annot-zone"><canvas id="annotCanvas"></canvas>
          <p class="annot-vide">Choisissez un outil ci-dessous, puis annotez la photo au doigt.</p>
        </div>
        <div class="annot-outils">
          <div class="annot-ligne">
            ${Object.keys(OUTILS).map(o => `<button type="button" class="outil" data-outil="${o}"><span>${OUTILS[o].ico}</span>${OUTILS[o].nom}</button>`).join('')}
          </div>
          <div class="annot-ligne">
            ${COULEURS.map(c => `<button type="button" class="pastille" data-couleur="${c}" style="background:${c}"></button>`).join('')}
            <button type="button" class="btn sm grey" data-a="undo">Annuler</button>
            <button type="button" class="btn sm grey" data-a="vider">${(window.ICO && window.ICO.trash(14)) || ''} Tout</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      this.overlay = overlay;
      this.canvas = overlay.querySelector('#annotCanvas');

      overlay.addEventListener('click', (e) => {
        const o = e.target.closest('[data-outil]');
        if (o) {
          this.outil = o.dataset.outil;
          overlay.querySelectorAll('.outil').forEach(b => b.classList.toggle('on', b === o));
          overlay.querySelector('.annot-vide').style.display = 'none';
          return;
        }
        const p = e.target.closest('[data-couleur]');
        if (p) {
          this.couleur = p.dataset.couleur;
          overlay.querySelectorAll('.pastille').forEach(b => b.classList.toggle('on', b === p));
          return;
        }
        const a = e.target.closest('[data-a]');
        if (!a) return;
        if (a.dataset.a === 'annuler') this.fermer(false);
        else if (a.dataset.a === 'valider') this.valider();
        else if (a.dataset.a === 'undo') { this.annotations.pop(); this.redessiner(); }
        else if (a.dataset.a === 'vider') { this.annotations = []; this.redessiner(); }
      });

      this.canvas.addEventListener('pointerdown', (e) => this.pointerDown(e));
      this.canvas.addEventListener('pointermove', (e) => this.pointerMove(e));
      this.canvas.addEventListener('pointerup', (e) => this.pointerUp(e));
      this.canvas.addEventListener('pointercancel', (e) => this.pointerUp(e));
      window.addEventListener('resize', () => this.redimensionner());

      this.pret = chargerImage(this.photo.dataUrl).then((img) => {
        this.img = img;
        this.redimensionner();
      }).catch(() => { this.fermer(false); });
    }

    redimensionner() {
      if (!this.img) return;
      const zone = this.overlay.querySelector('.annot-zone');
      const rect = zone.getBoundingClientRect();
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      this.canvas.width = Math.max(280, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(220, Math.round(rect.height * dpr));
      this.rectImage = rectContain(this.img.width, this.img.height, this.canvas.width, this.canvas.height);
      this.redessiner();
    }

    redessiner() {
      if (!this.img) return;
      const ctx = this.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(this.img, this.rectImage.x, this.rectImage.y, this.rectImage.w, this.rectImage.h);
      this.annotations.forEach(a => dessinerAnnotation(ctx, a, this.rectImage));
      if (this.enCours) dessinerAnnotation(ctx, this.enCours, this.rectImage);
    }

    /** Position relative (0→1) dans l'image. */
    relatif(e) {
      const r = this.canvas.getBoundingClientRect();
      const cx = (e.clientX - r.left) * (this.canvas.width / (r.width || 1));
      const cy = (e.clientY - r.top) * (this.canvas.height / (r.height || 1));
      const im = this.rectImage;
      return [
        Math.min(1, Math.max(0, (cx - im.x) / im.w)),
        Math.min(1, Math.max(0, (cy - im.y) / im.h))
      ];
    }

    pointerDown(e) {
      if (!this.outil) { this.erreur('Choisissez d\'abord un outil (flèche, cercle, crayon ou texte)'); return; }
      if (!this.img) { this.erreur('Photo en cours de chargement'); return; }
      e.preventDefault();
      if (this.outil === 'texte') {
        const p = this.relatif(e);
        const demande = (typeof window !== 'undefined' && window.Dialogue)
          ? window.Dialogue.saisir('Texte à afficher sur la photo :')
          : Promise.resolve(prompt('Texte à afficher sur la photo :'));
        const couleur = this.couleur;
        demande.then((texte) => {
          if (texte && texte.trim()) {
            this.annotations.push({ type: 'texte', couleur: couleur, points: [p], texte: texte.trim(), taille: 0.045 });
            this.redessiner();
          }
        });
        return;
      }
      const p = this.relatif(e);
      this.enCours = { type: this.outil, couleur: this.couleur, points: [p] };
      if (this.outil === 'crayon') this.enCours.points = [p];
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }

    pointerMove(e) {
      if (!this.enCours) return;
      e.preventDefault();
      const p = this.relatif(e);
      if (this.enCours.type === 'crayon') this.enCours.points.push(p);
      else this.enCours.points[1] = p;
      this.redessiner();
    }

    pointerUp(e) {
      if (!this.enCours) return;
      const a = this.enCours;
      this.enCours = null;
      const assez = a.type === 'crayon'
        ? a.points.length > 2
        : (a.points[1] && (Math.abs(a.points[1][0] - a.points[0][0]) > 0.008 || Math.abs(a.points[1][1] - a.points[0][1]) > 0.008));
      if (assez) this.annotations.push(a);
      this.redessiner();
    }

    /** Exporte l'image annotée (JPEG) à une résolution raisonnable. */
    async exporter(largeurMax) {
      largeurMax = largeurMax || 1600;
      const ratio = Math.min(1, largeurMax / this.img.width);
      const w = Math.round(this.img.width * ratio);
      const h = Math.round(this.img.height * ratio);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(this.img, 0, 0, w, h);
      const rect = { x: 0, y: 0, w: w, h: h };
      this.annotations.forEach(a => dessinerAnnotation(ctx, a, rect));
      return c.toDataURL('image/jpeg', 0.85);
    }

    async valider() {
      if (!this.img) { this.erreur('Photo en cours de chargement — réessayez dans un instant'); return; }
      const dataUrl = await this.exporter();
      this.photo.dataUrl = dataUrl;
      this.photo.annotations = JSON.parse(JSON.stringify(this.annotations));
      this.fermer(true);
    }

    /** Message discret en bas de l'écran d'annotation. */
    erreur(message) {
      let el = this.overlay.querySelector('.annot-erreur');
      if (!el) {
        el = document.createElement('div');
        el.className = 'annot-erreur';
        this.overlay.appendChild(el);
      }
      el.textContent = message;
      clearTimeout(this._errTimer);
      this._errTimer = setTimeout(() => { if (el.parentNode) el.remove(); }, 2600);
    }

    fermer(valide) {
      this.overlay.remove();
      if (this.cb && this.cb.fin) this.cb.fin(!!valide, this.photo);
    }
  }

  global.Annotation = { ouvrir: function (photo, cb) { return new Editeur(photo, cb); }, dessinerAnnotation: dessinerAnnotation, chargerImage: chargerImage };
})(window);
