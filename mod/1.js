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

(function () {
    'use strict';

    if (window.__GMM_MISSILE_MOD__) {
        console.warn('[MissileMod] déjà chargé — rien à faire');
        return;
    }
    window.__GMM_MISSILE_MOD__ = true;

    const VERSION = '1.23.3';

    /* =========================== CONFIGURATION ===========================
       Tout ce qui suit est réglable sans toucher au reste du script.       */

    const CFG = {
        // Touches de base = celles de la v1.1.0 (L Q U D).
        // Format : 'l' pour une lettre, 'shift+l' pour une combinaison, ou un
        // tableau de touches pour une même action (ex. bomb ci-dessous).
        // Les touches symboles sont reconnues même si elles demandent Maj.
        keys: {
            arm: 'l',
            fire: 'q',
            // ';' est le frein de parking dans GeoFS : on ne le prend pas.
            bomb: ['²', '`', '$', '!', ':', 'shift+q'],
            type: '*',
            target: 'u',
            reload: 'd',
            calibrate: 'shift+d'
            // Pas de raccourci pour le panneau : « u » sert déjà aux cibles et
            // les autres lettres libres sont rares. Le bouton de la barre suffit.
        },

        // Vol du missile : les performances propres à chaque missile sont dans
        // MISSILE_TYPES, il ne reste ici que les réglages communs.
        minLaunchSpeed: 160,    // m/s — vitesse minimale au lancement
        maxActive: 8,           // missiles simultanés max

        // Bombes
        bombGravity: 9.81,      // m/s²
        bombDrag: 0.028,        // traînée (fraction de vitesse perdue par seconde)
        bombLifetime: 120,      // s avant disparition
        bombCooldown: 220,      // ms entre deux largages
        maxBombsActive: 12,     // bombes simultanées max

        // Ciblage
        lockRange: 40000,       // m — portée radar de secours (sinon celle du missile)
        cooldown: 900,          // ms entre deux tirs

        // Rendu
        trailPoints: 70,        // points de sillage conservés
        forceAllAircraft: false // true = autoriser n'importe quel avion
    };

    // Avions reconnus. span = demi-envergure de secours (m) si le modèle 3D
    // ne fournit pas ses points de collision. missiles / bombs = emports.
    const AIRFRAMES = [
        { re: /f-?16|fighting falcon/i, name: 'F-16 Fighting Falcon', span: 4.9, missiles: 6, bombs: 4 },
        { re: /f\/?a-?18|hornet/i, name: 'F/A-18 Hornet', span: 6.1, missiles: 8, bombs: 4 },
        { re: /su-?35|su-?30|su-?27|flanker/i, name: 'Su-35 Flanker', span: 7.4, missiles: 12, bombs: 0 },
        { re: /rafale/i, name: 'Dassault Rafale', span: 5.4, missiles: 6, bombs: 4 },
        { re: /eurofighter|typhoon/i, name: 'Eurofighter Typhoon', span: 5.8, missiles: 8, bombs: 4 },
        { re: /f-?22|raptor/i, name: 'F-22 Raptor', span: 6.8, missiles: 8, bombs: 2 },
        { re: /f-?35|lightning/i, name: 'F-35 Lightning II', span: 5.3, missiles: 6, bombs: 4 },
        { re: /f-?15|eagle/i, name: 'F-15 Eagle', span: 6.5, missiles: 8, bombs: 6 },
        { re: /f-?14|tomcat/i, name: 'F-14 Tomcat', span: 6.3, missiles: 8, bombs: 0 },
        { re: /f-?4|phantom/i, name: 'F-4 Phantom', span: 5.9, missiles: 6, bombs: 6 },
        // MiG-31 : 8 emports sous le ventre, relevés sur le Mecabricks (voir README).
        { re: /mig-?31|foxhound/i, name: 'MiG-31 Foxhound', span: 6.75, missiles: 8, bombs: 0 },
        { re: /mig-?29|mig-?25|fulcrum/i, name: 'MiG-29 Fulcrum', span: 5.65, missiles: 6, bombs: 0 },
        { re: /a-?10|warthog|thunderbolt/i, name: 'A-10 Warthog', span: 8.8, missiles: 6, bombs: 8 },
        { re: /tornado/i, name: 'Panavia Tornado', span: 7.0, missiles: 6, bombs: 6 },
        { re: /gripen/i, name: 'Saab Gripen', span: 4.2, missiles: 6, bombs: 4 },
        { re: /j-?20|j-?10|chengdu|shenyang/i, name: 'Chengdu J-20', span: 6.6, missiles: 6, bombs: 2 },

        // --- Bombardiers ---
        { re: /b-?2\b|b-?2 spirit|spirit/i, name: 'B-2 Spirit', span: 26.2, missiles: 0, bombs: 16 },
        { re: /b-?52|stratofortress/i, name: 'B-52 Stratofortress', span: 28.2, missiles: 0, bombs: 20 },
        { re: /b-?1b|lancer/i, name: 'B-1B Lancer', span: 20.9, missiles: 0, bombs: 16 },
        { re: /tu-?160|blackjack/i, name: 'Tu-160 Blackjack', span: 27.7, missiles: 0, bombs: 12 },
        { re: /tu-?95|bear/i, name: 'Tu-95 Bear', span: 25.0, missiles: 0, bombs: 8 },
        { re: /concorde/i, name: 'Concorde', span: 12.9, missiles: 0, bombs: 8 }
    ];
    const GENERIC_FRAME = { name: 'Multirôle', span: 5.5, missiles: 6, bombs: 2 };

    // Types de missiles sélectionnables avec '*' avant l'armement.
    // body / nose / band = couleurs de la texture générée.
    // Géométrie : chaque type a ses vraies dimensions (m). caliber = diamètre
    // du corps, length = longueur totale, noseLen = ogive, finSpan / finChord =
    // ailettes arrière, canards = nombre d'ailerons avant (0 = aucun).
    const MISSILE_TYPES = [
        {
            name: 'AIM-120 AMRAAM', body: '#e9e9e9', nose: '#9aa0a6', band: '#4a6fa5',
            maxSpeed: 900, accel: 190, turnRate: 1.6, range: 40000, life: 45, proximity: 22,
            caliber: 0.178, length: 3.66, noseLen: 0.62, finSpan: 0.46, finChord: 0.40, canards: 0
        },
        {
            name: 'AIM-9X Sidewinder', body: '#f2f2f2', nose: '#8b5a3c', band: '#b04a2f',
            maxSpeed: 760, accel: 260, turnRate: 2.8, range: 15000, life: 30, proximity: 18,
            caliber: 0.127, length: 3.02, noseLen: 0.40, finSpan: 0.36, finChord: 0.30, canards: 4
        },
        {
            name: 'R-77 Adder', body: '#dde4d8', nose: '#6b7f5e', band: '#3f6b3a',
            maxSpeed: 860, accel: 210, turnRate: 2.0, range: 30000, life: 40, proximity: 20,
            caliber: 0.200, length: 3.60, noseLen: 0.55, finSpan: 0.52, finChord: 0.34, canards: 0
        },
        {
            name: 'R-73 Archer', body: '#e6e2d6', nose: '#7a6a4a', band: '#8a5a24',
            maxSpeed: 720, accel: 280, turnRate: 3.0, range: 12000, life: 26, proximity: 16,
            caliber: 0.170, length: 2.90, noseLen: 0.44, finSpan: 0.44, finChord: 0.28, canards: 4
        },
        {
            name: 'MBDA Meteor', body: '#dfe6ee', nose: '#7d8fa6', band: '#2f5f8a',
            maxSpeed: 1000, accel: 170, turnRate: 1.5, range: 60000, life: 55, proximity: 24,
            caliber: 0.178, length: 3.65, noseLen: 0.58, finSpan: 0.46, finChord: 0.42, canards: 4
        },
        {
            name: 'AIM-54 Phoenix', body: '#e4e0d4', nose: '#8a7a5a', band: '#5c4a2a',
            maxSpeed: 950, accel: 150, turnRate: 1.1, range: 80000, life: 70, proximity: 28,
            caliber: 0.380, length: 3.96, noseLen: 0.78, finSpan: 0.92, finChord: 0.56, canards: 4
        },
        // Arme relevée sur le MiG-31 du Mecabricks : les huit munitions du modèle
        // sont des engins courts à corps blanc et ailettes en croix.
        {
            name: 'R-60 Aphid (MiG-31)', body: '#fbfbfb', nose: '#9aa0a6', band: '#b8352f',
            maxSpeed: 700, accel: 300, turnRate: 3.2, range: 10000, life: 22, proximity: 14,
            caliber: 0.120, length: 2.10, noseLen: 0.34, finSpan: 0.30, finChord: 0.24, canards: 4
        }
    ];

    // Bombe lisse type Mk-82, assemblée avec les mêmes primitives.
    const BOMB_TYPE = {
        name: 'Mk-82', body: '#3f4a3f', nose: '#47543f', band: '#d9c433',
        caliber: 0.273, length: 2.22, noseLen: 0.66, finSpan: 0.52, finChord: 0.44
    };

    // Répartition de secours, un point tous les deux missiles (un par côté).
    // [écartement, position avant/arrière] en fractions de la demi-envergure et
    // de la demi-longueur. La hauteur n'est pas ici : elle est calculée sous le
    // plan de voilure (voir buildStations). Utilisée seulement si le modèle ne
    // nomme pas ses pylônes.
    const WING_SLOTS = [
        [0.95, -0.02],   // bout d'aile
        [0.72, -0.05],   // pylône externe
        [0.52, -0.03],   // pylône médian
        [0.34, 0.00],    // pylône interne
        [0.16, 0.03],    // sous entrée d'air
        [0.06, 0.06]     // sous fuselage
    ];

    /* ============================== ÉTAT ================================ */

    const S = {
        ready: false,
        armed: false,
        cooldownUntil: 0,
        bombCooldownUntil: 0,
        aircraftKey: null,
        profile: null,
        geo: { halfSpan: 5.5, halfLen: 6, belly: -0.6 },
        loadout: 0,          // missiles restants
        bombs: 0,            // bombes restantes
        typeIndex: 0,        // missile sélectionné ('*')
        stations: [],        // points d'emport missiles
        bombStations: [],
        missiles: [],
        bombsInAir: [],
        fx: [],
        contacts: [],
        contactsAt: 0,
        targetId: null,
        lastFrame: 0,
        hudAt: 0,
        frameSeq: 0,         // compteur de ticks
        frameNo: 0,          // numéro de l'image de rendu (clé du cache des munitions)
        cal: {},
        calMode: false,
        panelOpen: false,
        markers: [],         // repères visuels affichés en calibrage
        perfOn: false,       // compteur FPS · appels de dessin
        ui: null
    };

    const CAL_STORE = 'gmm_calib_v1';
    let actx = null;

    /* ============================ UTILITAIRES =========================== */

    // Cesium est relu à chaque rappel de rendu : on garde la référence plutôt
    // que de repasser par window (WindowProxy) des centaines de fois par image.
    let CES = null;
    const C = () => (CES || (CES = window.Cesium));
    const viewer = () => window.geofs.api.viewer;
    const mp = () => window.multiplayer || {};

    function log(msg) {
        console.log('%c[MissileMod] ' + msg, 'color:#39ff88;font-family:monospace');
    }

    function warn(msg, e) {
        console.warn('[MissileMod] ' + msg, e || '');
    }

    function toast(text, color) {
        if (!S.ui) return;
        const el = document.createElement('div');
        el.className = 'gmm-toast';
        el.textContent = text;
        el.style.color = color || '#39ff88';
        el.style.borderColor = (color || '#39ff88') + '66';
        S.ui.toasts.appendChild(el);
        setTimeout(() => { el.classList.add('out'); }, 2200);
        setTimeout(() => { el.remove(); }, 2700);
    }

    function waitForGeofs(cb) {
        let tries = 0;
        const t = setInterval(() => {
            tries++;
            const ok = window.geofs && geofs.aircraft && geofs.aircraft.instance &&
                geofs.api && geofs.api.viewer && geofs.api.viewer.scene &&
                window.Cesium && Cesium.Cartesian3 && Cesium.Entity;
            if (ok) {
                clearInterval(t);
                cb();
            } else if (tries > 240) {
                clearInterval(t);
                console.error('[MissileMod] GeoFS non détecté — le script doit tourner sur geo-fs.com/geofs.php');
            }
        }, 500);
    }

    /* ======================= CALIBRAGE DES EMPORTS ===================== */
