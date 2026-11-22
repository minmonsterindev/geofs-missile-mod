// ==UserScript==
// @name         GeoFS — Missile & Bomb Mod (avions militaires)
// @namespace    geofs-missile-mod
// @version      1.23.1
// @updated      2026-11-22
// @description  Missiles air-air et bombes pour les avions militaires de GeoFS : ciblage des joueurs, guidage, explosion, calibrage des points d'emport, HUD.
// @author       Buffy
// @updateURL    https://raw.githubusercontent.com/minmonsterindev/geofs-missile-mod/main/geofs-missile-mod.user.js
// @downloadURL  https://raw.githubusercontent.com/minmonsterindev/geofs-missile-mod/main/geofs-missile-mod.user.js
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://geo-fs.com/geofs.php*
// @match        https://beta.geo-fs.com/geofs.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/* Le code du mod est publié en huit fichiers `mod/1.js` … `mod/8.js`, dans
   l'ordre. Ce fichier ne fait que les télécharger et les exécuter d'un seul
   tenant : le source reste identique à celui qui est vérifié (les parties se
   recollent exactement), et une mise à jour ne demande pas de réinstaller le
   userscript. Le garde-fou « déjà chargé » est dans la partie 1. */

(function () {
    'use strict';

    var BASE = 'https://raw.githubusercontent.com/minmonsterindev/geofs-missile-mod/main/mod/';
    var COUNT = 8;

    function fail(err) {
        console.error('[MissileMod] chargement impossible', err);
    }

    var jobs = [];
    for (var i = 1; i <= COUNT; i++) {
        jobs.push(fetch(BASE + i + '.js?t=' + Date.now(), { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' sur ' + r.url);
                return r.text();
            }));
    }

    Promise.all(jobs).then(function (parts) {
        (0, eval)(parts.join('') + '\n//# sourceURL=geofs-missile-mod/1.23.1.js');
    }).catch(fail);
})();
