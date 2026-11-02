/* =========================================================================
   ICÔNES OFFICIELLES BFR SYSTEMS — MONOCHROMES & DUAL-TONES ÉPURÉES
   Remplacement de tous les émojis par des icônes vectorielles SVG sobres,
   tracées et calquées sur la charte technique BFR Systems.
   ========================================================================= */

(function (root) {
  'use strict';

  function svg(path, sz, cls, extra) {
    var s = sz || 18;
    return '<svg class="' + (cls || 'bfr-ico') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" ' +
      'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      (extra || '') + '>' + path + '</svg>';
  }

  function duo(bgPath, fgPath, sz, cls, extra) {
    var s = sz || 18;
    return '<svg class="' + (cls || 'bfr-ico bfr-ico-duo') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" ' +
      (extra || '') + '>' +
      '<g class="duo-bg" fill="currentColor" opacity="0.2">' + bgPath + '</g>' +
      '<g class="duo-fg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + fgPath + '</g>' +
      '</svg>';
  }

  var ICO = {
    // Topbar & navigation
    menu: function (sz, cls) {
      return svg('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>', sz || 22, cls || 'bfr-ico', 'stroke-width="2.2"');
    },
    close: function (sz, cls) {
      return svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', sz || 18, cls || 'bfr-ico', 'stroke-width="2.2"');
    },
    plus: function (sz, cls) {
      return svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', sz || 18, cls || 'bfr-ico', 'stroke-width="2.5"');
    },

    // Validations & états
    check: function (sz, cls) {
      return svg('<polyline points="20 6 9 17 4 12"/>', sz || 18, cls || 'bfr-ico', 'stroke-width="2.4"');
    },
    checkCircle: function (sz, cls) {
      return duo(
        '<circle cx="12" cy="12" r="10"/>',
        '<circle cx="12" cy="12" r="10"/><polyline points="16 9 11 15 8 12"/>',
        sz || 18, cls
      );
    },

    // Actions document & signature
    signature: function (sz, cls) {
      return svg('<g stroke-width="1.7"><path d="M11 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h9.5a2 2 0 0 0 2-2v-4.5"/><path d="M11 2l5 5"/><path d="M11 2v4.5a.5.5 0 0 0 .5.5H16v3"/><line x1="6" y1="5.5" x2="9" y2="5.5"/><line x1="6" y1="8" x2="13" y2="8"/><line x1="6" y1="10.5" x2="13" y2="10.5"/><line x1="6" y1="13" x2="11.5" y2="13"/><line x1="6" y1="15.5" x2="10" y2="15.5"/><path d="M5.5 19c.8-.9 1.6.9 2.4 0s1.6.9 2.4 0"/><path d="m10.3 19 1.2-2.5 1.9 1.9-2.5 1.2a.4.4 0 0 1-.6-.6z"/><line x1="11.5" y1="16.5" x2="13.4" y2="18.4"/><path d="m11.5 16.5 6.3-6.3 1.9 1.9-6.3 6.3z"/><line x1="17.8" y1="10.2" x2="19.7" y2="12.1"/><path d="m17.8 10.2 1.1-1.1a1.35 1.35 0 0 1 1.9 1.9l-1.1 1.1"/><path d="m19.7 12.1 1.1 1.1a.4.4 0 0 1 0 .6l-2.4 2.4"/></g>', sz || 18, cls);
    },
    pen: function (sz, cls) {
      return svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>', sz || 16, cls);
    },
    trash: function (sz, cls) {
      return svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', sz || 16, cls);
    },
    send: function (sz, cls) {
      return svg('<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>', sz || 18, cls);
    },
    eye: function (sz, cls) {
      return duo(
        '<circle cx="12" cy="12" r="3"/>',
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        sz || 18, cls
      );
    },
    fileText: function (sz, cls) {
      return duo(
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>',
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
        sz || 18, cls
      );
    },
    copy: function (sz, cls) {
      return svg('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', sz || 18, cls);
    },

    // Médias & saisie
    camera: function (sz, cls) {
      return duo(
        '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>',
        '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
        sz || 18, cls
      );
    },
    image: function (sz, cls) {
      return duo(
        '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>',
        '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
        sz || 18, cls
      );
    },
    mic: function (sz, cls) {
      return duo(
        '<rect x="9" y="2" width="6" height="11" rx="3"/>',
        '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
        sz || 18, cls
      );
    },
    speaker: function (sz, cls) {
      return svg('<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>', sz || 18, cls);
    },

    // Technique, Pièces, Machine, Chrono
    gear: function (sz, cls) {
      return duo(
        '<circle cx="12" cy="12" r="4"/>',
        '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        sz || 18, cls
      );
    },
    palette: function (sz, cls) {
      return duo(
        '<circle cx="13.5" cy="6.5" r=".8" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".8" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".8" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".8" fill="currentColor"/>',
        '<circle cx="13.5" cy="6.5" r=".8"/><circle cx="17.5" cy="10.5" r=".8"/><circle cx="8.5" cy="7.5" r=".8"/><circle cx="6.5" cy="12.5" r=".8"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z"/>',
        sz || 18, cls
      );
    },
    wrench: function (sz, cls) {
      return duo(
        '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
        '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
        sz || 18, cls
      );
    },
    bolt: function (sz, cls) {
      return duo(
        '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
        '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
        sz || 18, cls
      );
    },
    cpu: function (sz, cls) {
      return duo(
        '<rect x="7" y="7" width="10" height="10" rx="1"/>',
        '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
        sz || 18, cls
      );
    },
    package: function (sz, cls) {
      return duo(
        '<polygon points="12 2.2 20.7 7.2 12 12.2 3.3 7.2"/>',
        '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
        sz || 18, cls
      );
    },
    clock: function (sz, cls) {
      return duo(
        '<circle cx="12" cy="12" r="10"/>',
        '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        sz || 18, cls
      );
    },
    play: function (sz, cls) {
      return '<svg class="' + (cls || 'bfr-ico') + '" viewBox="0 0 24 24" width="' + (sz || 16) + '" height="' + (sz || 16) + '" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
    },
    pause: function (sz, cls) {
      return '<svg class="' + (cls || 'bfr-ico') + '" viewBox="0 0 24 24" width="' + (sz || 16) + '" height="' + (sz || 16) + '" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
    },
    stop: function (sz, cls) {
      return '<svg class="' + (cls || 'bfr-ico') + '" viewBox="0 0 24 24" width="' + (sz || 16) + '" height="' + (sz || 16) + '" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
    },

    // Alertes & priorités
    shieldAlert: function (sz, cls) {
      return duo(
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
        sz || 18, cls
      );
    },
    flame: function (sz, cls) {
      return duo(
        '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z"/>',
        '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3.5z"/>',
        sz || 18, cls
      );
    },
    arrowUp: function (sz, cls) {
      return svg('<polyline points="18 15 12 9 6 15"/>', sz || 18, cls, 'stroke-width="2.5"');
    },
    arrowDown: function (sz, cls) {
      return svg('<polyline points="6 9 12 15 18 9"/>', sz || 18, cls, 'stroke-width="2.5"');
    },
    info: function (sz, cls) {
      return duo(
        '<circle cx="12" cy="12" r="10"/>',
        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
        sz || 18, cls
      );
    },

    // Tiroir & administration
    user: function (sz, cls) {
      return duo(
        '<circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>',
        '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        sz || 18, cls
      );
    },
    users: function (sz, cls) {
      return duo(
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        sz || 18, cls
      );
    },
    // Formation des opérateurs : toque de diplômé
    formation: function (sz, cls) {
      return duo(
        '<path d="M22 9 12 4 2 9l10 5 10-5z"/>',
        '<path d="M22 9 12 4 2 9l10 5 10-5z"/><path d="M6 11.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.8"/><line x1="22" y1="9" x2="22" y2="15"/>',
        sz || 18, cls
      );
    },
    folder: function (sz, cls) {
      return duo(
        '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
        '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
        sz || 18, cls
      );
    },
    download: function (sz, cls) {
      return svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', sz || 18, cls);
    },
    mail: function (sz, cls) {
      return duo(
        '<rect x="2" y="4" width="20" height="16" rx="2"/>',
        '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
        sz || 18, cls
      );
    },
    sms: function (sz, cls) {
      return duo(
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        sz || 18, cls
      );
    },
    help: function (sz, cls) {
      return duo(
        '<circle cx="12" cy="12" r="10"/>',
        '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        sz || 18, cls
      );
    },

    // Spécifiques Suivi de Chantier
    checklist: function (sz, cls) {
      return duo(
        '<rect x="3" y="4" width="6" height="6" rx="1.5"/><rect x="3" y="14" width="6" height="6" rx="1.5"/>',
        '<polyline points="4 7 6 9 9.5 5"/><rect x="3" y="14" width="6" height="6" rx="1.5"/><line x1="13" y1="7" x2="21" y2="7"/><line x1="13" y1="17" x2="21" y2="17"/>',
        sz || 18, cls
      );
    },
    calendar: function (sz, cls) {
      return duo(
        '<rect x="3" y="4" width="18" height="18" rx="2"/>',
        '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        sz || 18, cls
      );
    },
    upload: function (sz, cls) {
      return svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>', sz || 18, cls);
    },
    building: function (sz, cls) {
      return duo(
        '<rect x="4" y="2" width="16" height="20" rx="2"/>',
        '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9.01" y2="6"/><line x1="15" y1="6" x2="15.01" y2="6"/><line x1="9" y1="10" x2="9.01" y2="10"/><line x1="15" y1="10" x2="15.01" y2="10"/><line x1="9" y1="14" x2="9.01" y2="14"/><line x1="15" y1="14" x2="15.01" y2="14"/><path d="M9 22v-4h6v4"/>',
        sz || 18, cls
      );
    },
    chevronLeft: function (sz, cls) {
      return svg('<polyline points="15 18 9 12 15 6"/>', sz || 18, cls, 'stroke-width="2.4"');
    },
    chevronRight: function (sz, cls) {
      return svg('<polyline points="9 18 15 12 9 6"/>', sz || 18, cls, 'stroke-width="2.4"');
    },
    chevronDown: function (sz, cls) {
      return svg('<polyline points="6 9 12 15 18 9"/>', sz || 18, cls, 'stroke-width="2.2"');
    },
    sparkles: function (sz, cls) {
      return duo(
        '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/>',
        '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16z"/>',
        sz || 18, cls
      );
    },

    // Mappeurs intelligents pour les domaines et catégories (supporte id ou ancien emoji)
    domaine: function (id, sz) {
      var s = sz || 20;
      var str = (id || '').toString().toUpperCase();
      if (str === 'MECANIQUE' || str.indexOf('MECAN') !== -1 || str.indexOf('🔧') !== -1) return ICO.wrench(s);
      if (str === 'ELECTRIQUE' || str.indexOf('ELEC') !== -1 || str.indexOf('⚡') !== -1) return ICO.bolt(s);
      if (str === 'AUTOMATISME' || str.indexOf('AUTO') !== -1 || str.indexOf('🤖') !== -1) return ICO.cpu(s);
      return ICO.wrench(s);
    },
    categorie: function (id, sz) {
      var s = sz || 18;
      var str = (id || '').toString().toUpperCase();
      if (str === 'SECURITE' || str.indexOf('SEC') !== -1 || str.indexOf('🛑') !== -1) return ICO.shieldAlert(s);
      if (str === 'URGENT' || str.indexOf('URG') !== -1 || str.indexOf('⚠') !== -1) return ICO.flame(s);
      if (str === 'HAUTE' || str.indexOf('HAUT') !== -1 || str.indexOf('🔺') !== -1) return ICO.arrowUp(s);
      if (str === 'BASSE' || str.indexOf('BASS') !== -1 || str.indexOf('🔽') !== -1) return ICO.arrowDown(s);
      if (str === 'INFO' || str.indexOf('INF') !== -1 || str.indexOf('ℹ') !== -1) return ICO.info(s);
      return ICO.info(s);
    }
  };

  root.ICO = ICO;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
