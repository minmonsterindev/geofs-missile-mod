// ==UserScript==
// @name         GeoFS — Missile & Bomb Mod (mise à jour automatique)
// @namespace    geofs-missile-mod
// @version      1.0.0
// @updated      2026-11-18
// @description  Charge toujours la dernière version du mod depuis GitHub : à installer une seule fois, plus rien à réinstaller ensuite.
// @author       Buffy
// @updateURL    https://raw.githubusercontent.com/minmonsterindev/geofs-missile-mod/main/geofs-mig31-autoupdate.user.js
// @downloadURL  https://raw.githubusercontent.com/minmonsterindev/geofs-missile-mod/main/geofs-mig31-autoupdate.user.js
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://geo-fs.com/geofs.php*
// @match        https://beta.geo-fs.com/geofs.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

// Ce fichier ne contient pas le mod : il va chercher le script principal sur
// GitHub à chaque ouverture de GeoFS, lit son numéro de version et l'exécute.
// Le mod se protège déjà contre un double chargement (window.__GMM_MISSILE_MOD__),
// donc garder l'ancien script installé ne crée pas de conflit : c'est simplement
// la version la plus récente qui tourne.
(function () {
    'use strict';

    var SOURCE = 'https://raw.githubusercontent.com/minmonsterindev/geofs-missile-mod/main/geofs-missile-mod.user.js';

    function remoteVersion(text) {
        var m = /^\/\/\s*@version\s+(\S+)/m.exec(text);
        return m ? m[1] : '?';
    }

    function run(text) {
        if (window.__GMM_MISSILE_MOD__) {
            console.info('[MissileMod] instance déjà en place — version distante ' + remoteVersion(text));
            return;
        }
        console.info('[MissileMod] chargement de la version ' + remoteVersion(text) + ' depuis GitHub');
        // eslint-disable-next-line no-eval
        (0, eval)(text);
    }

    // cache: 'no-store' + paramètre anti-cache : le CDN de GitHub garde 5 min,
    // ce qui suffit largement pour une mise à jour au chargement suivant.
    fetch(SOURCE + '?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        })
        .then(run)
        .catch(function (e) {
            console.warn('[MissileMod] mise à jour impossible (' + (e && e.message ? e.message : e) + ')');
        });
})();
