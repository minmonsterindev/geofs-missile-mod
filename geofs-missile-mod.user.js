// ==UserScript==
// @name         GeoFS — Missile & Bomb Mod (avions militaires)
// @namespace    geofs-missile-mod
// @version      1.23.3
// @updated      2026-11-22
// @description  Missiles air-air et bombes pour les avions militaires de GeoFS : ciblage des joueurs, guidage, explosion, calibrage des points d'emport, HUD, compteur FPS et appels de dessin.
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
   l'ordre, générés depuis `src/geofs-missile-mod.js` (voir tools/build.js).
   Ce fichier ne fait que les télécharger et les exécuter d'un seul tenant : le
   source reste celui qui est testé (les parties se recollent exactement), et
   une mise à jour ne demande pas de réinstaller le userscript. Le garde-fou
   « déjà chargé » est dans la partie 1.

   Si une partie ne se charge pas — coupure réseau, dépôt renommé, CDN — le mod
   ne démarre pas du tout (il lui manquerait du code) : un bandeau rouge le dit
   alors en clair, au lieu d'un échec silencieux dans la console. */

(function () {
    'use strict';

    var BASE = 'https://raw.githubusercontent.com/minmonsterindev/geofs-missile-mod/main/mod/';
    var COUNT = 8;
    var failed = [];

    function banner(text) {
        try {
            var box = document.getElementById('gmm-loadfail');
            if (!box) {
                box = document.createElement('div');
                box.id = 'gmm-loadfail';
                box.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);' +
                    'z-index:2147483647;max-width:88vw;white-space:pre-wrap;text-align:center;' +
                    'background:#2a0808;border:1px solid #ff5252;border-radius:6px;padding:8px 14px;' +
                    'color:#ffd9d9;font:13px/1.5 ui-monospace,Consolas,monospace;' +
                    'box-shadow:0 6px 24px rgba(0,0,0,.55)';
                (document.body || document.documentElement).appendChild(box);
            }
            box.textContent = text;
        } catch (e) {
            console.error('[MissileMod]', text);
        }
    }

    function load(n) {
        var url = BASE + n + '.js?t=' + Date.now();
        return fetch(url, { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }).catch(function (err) {
            failed.push('partie ' + n + ' (' + err.message + ')');
            return null;
        });
    }

    var jobs = [];
    for (var i = 1; i <= COUNT; i++) jobs.push(load(i));

    Promise.all(jobs).then(function (parts) {
        if (failed.length) {
            console.error('[MissileMod] chargement incomplet : ' + failed.join(', '));
            banner('Missile Mod INCOMPLET — ' + failed.join(', ') +
                '\nRien n\'a été lancé : il manque du code. Recharge la page (Ctrl+Maj+R) ;' +
                ' si ça persiste, vérifie le dépôt geofs-missile-mod (dossier mod/).');
            return;
        }
        try {
            (0, eval)(parts.join('') + '\n//# sourceURL=geofs-missile-mod/1.23.3.js');
        } catch (err) {
            console.error('[MissileMod] défaut à l\'exécution', err);
            banner('Missile Mod : le code chargé a échoué (' + err.message +
                ') — recharge la page.');
        }
    });
})();
