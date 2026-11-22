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

    function loadCal() {
        try {
            const raw = window.localStorage && localStorage.getItem(CAL_STORE);
            return raw ? (JSON.parse(raw) || {}) : {};
        } catch (e) { return {}; }
    }

    function saveCal() {
        try {
            if (window.localStorage) localStorage.setItem(CAL_STORE, JSON.stringify(S.cal));
        } catch (e) { }
    }

    function calFor() {
        const key = S.aircraftKey || 'default';
        if (!S.cal[key]) S.cal[key] = { span: 1, u: 0, f: 0 };
        return S.cal[key];
    }

    function calAdjust(field, delta) {
        const c = calFor();
        c[field] = Math.round((c[field] + delta) * 100) / 100;
        if (field === 'span') c.span = Math.max(0.25, Math.min(2.5, c.span));
        else c[field] = Math.max(-40, Math.min(40, c[field]));
        saveCal();
        updateHUD();
        toast('Calibrage : span ' + c.span.toFixed(2) + ' | haut ' + c.u.toFixed(2) + ' m | avant ' + c.f.toFixed(2) + ' m', '#8ef6ff');
    }

    function calReset() {
        const key = S.aircraftKey || 'default';
        S.cal[key] = { span: 1, u: 0, f: 0 };
        saveCal();
        updateHUD();
        toast('Calibrage réinitialisé', '#39ff88');
    }

    /* ========================== GÉOMÉTRIE / REPÈRES ===================== */

    // Le repère d'un avion GeoFS peut être exposé de plusieurs façons.
    // On accepte : tableau de 3 vecteurs, tableau plat de 9 nombres,
    // Cesium.Matrix3 (colonne-major), quaternion {x,y,z,w}.
    function localBasis(wr) {
        const Cesium = C();
        if (!wr) return null;
        try {
            if (wr.length >= 3 && wr[0] && typeof wr[0] === 'object' && wr[0].length >= 3) {
                return [wr[0], wr[1], wr[2]];
            }
            if (typeof wr.w === 'number' && typeof wr.x === 'number' && Cesium.Matrix3) {
                const m = Cesium.Matrix3.fromQuaternion(wr, new Cesium.Matrix3());
                return [
                    [m[0], m[3], m[6]],
                    [m[1], m[4], m[7]],
                    [m[2], m[5], m[8]]
                ];
            }
            if (wr.length === 9) {
                return [
                    [wr[0], wr[1], wr[2]],
                    [wr[3], wr[4], wr[5]],
                    [wr[6], wr[7], wr[8]]
                ];
            }
            if (typeof wr[0] === 'number' && typeof wr[8] === 'number') {
                // Cesium.Matrix3 : [m00,m10,m20, m01,m11,m21, m02,m12,m22]
                return [
                    [wr[0], wr[3], wr[6]],
                    [wr[1], wr[4], wr[7]],
                    [wr[2], wr[5], wr[8]]
                ];
            }
        } catch (e) { }
        return null;
    }

    // Repère reconstruit depuis cap / assiette / roulis (htr en degrés).
    function basisFromHtr(htr) {
        const h = ((htr && htr[0]) || 0) * Math.PI / 180;
        const p = ((htr && htr[1]) || 0) * Math.PI / 180;
        const r = ((htr && htr[2]) || 0) * Math.PI / 180;
        const f0 = [Math.sin(h), Math.cos(h), 0];
        const r0 = [Math.cos(h), -Math.sin(h), 0];
        const u0 = [0, 0, 1];
        const cp = Math.cos(p), sp = Math.sin(p);
        const F = [f0[0] * cp + u0[0] * sp, f0[1] * cp + u0[1] * sp, f0[2] * cp + u0[2] * sp];
        const U1 = [-f0[0] * sp + u0[0] * cp, -f0[1] * sp + u0[1] * cp, -f0[2] * sp + u0[2] * cp];
        const cr = Math.cos(r), sr = Math.sin(r);
        const R = [r0[0] * cr - U1[0] * sr, r0[1] * cr - U1[1] * sr, r0[2] * cr - U1[2] * sr];
        const U = [r0[0] * sr + U1[0] * cr, r0[1] * sr + U1[1] * cr, r0[2] * sr + U1[2] * cr];
        return [R, F, U];
    }

    // Repère de l'avion au moment du rendu. La base du modèle est d'abord
    // redressée (avant normalisé, vertical rendu perpendiculaire), puis on en
    // tire UNE matrice modèle -> ECEF : position et orientation viennent de la
    // même base, aucun décalage possible entre les deux.
    function playerFrame() {
        const Cesium = C();
        const ac = window.geofs.aircraft.instance;
        const lla = ac && ac.llaLocation;
        if (!lla || lla.length < 3) return null;

        const origin = Cesium.Cartesian3.fromDegrees(lla[1], lla[0], lla[2]);
        const enu = Cesium.Transforms.eastNorthUpToFixedFrame(origin);

        let basis = null;
        const od = ac.object3d;
        if (od) basis = localBasis(od.worldRotation) || localBasis(od.rotation);
        if (!basis) basis = basisFromHtr(ac.htr || ac.attitude);

        function unit(v) {
            const m = isFinite(v.x + v.y + v.z) ? Cesium.Cartesian3.magnitude(v) : 0;
            if (!(m > 1e-6)) return null;
            v.x /= m; v.y /= m; v.z /= m;
            return v;
        }

        // Un axe du modèle ramené en ECEF, unitaire, ou l'axe de repli.
        function axis(src, fallback) {
            try {
                const v = new Cesium.Cartesian3(src[0], src[1], src[2]);
                Cesium.Matrix4.multiplyByPointAsVector(enu, v, v);
                const u = unit(v);
                if (u) return u;
            } catch (e) { }
            return unit(new Cesium.Cartesian3(fallback[0], fallback[1], fallback[2]));
        }

        const F = axis(basis[1], [0, 1, 0]);
        // Redressement : le vertical doit être perpendiculaire à l'avant, sinon
        // une worldRotation légèrement arrondie incline tout l'emport.
        const rawU = axis(basis[2], [0, 0, 1]);
        const tilt = Cesium.Cartesian3.dot(F, rawU);
        const U = unit(Cesium.Cartesian3.subtract(
            rawU,
            Cesium.Cartesian3.multiplyByScalar(F, tilt, new Cesium.Cartesian3()),
            new Cesium.Cartesian3()
        )) || rawU;
        // Repère GeoFS : x = gauche. Gauche = haut × avant (repère gaucher).
        const L = Cesium.Cartesian3.cross(U, F, new Cesium.Cartesian3());

        // Colonne-major : (gauche, avant, haut, position). Attention, le
        // constructeur Cesium n'accepte AUCUN argument (il rend l'identité) :
        // il faut remplir la matrice explicitement.
        const cols = [
            L.x, L.y, L.z, 0,
            F.x, F.y, F.z, 0,
            U.x, U.y, U.z, 0,
            origin.x, origin.y, origin.z, 1
        ];
        const matrix = new Cesium.Matrix4();
        if (Cesium.Matrix4.fromColumnMajorArray) Cesium.Matrix4.fromColumnMajorArray(cols, matrix);
        else for (let i = 0; i < 16; i++) matrix[i] = cols[i];
        return { origin, matrix, R: L, F, U, lla };
    }

    // (x, y, z) en coordonnées modèle : x = gauche, y = avant, z = haut.
    function offsetPos(frame, x, y, z) {
        const Cesium = C();
        return Cesium.Matrix4.multiplyByPoint(
            frame.matrix,
            new Cesium.Cartesian3(x, y, z),
            new Cesium.Cartesian3()
        );
    }

    function along(pos, dir, d) {
        const Cesium = C();
        return Cesium.Cartesian3.add(pos, Cesium.Cartesian3.multiplyByScalar(dir, d, new Cesium.Cartesian3()), new Cesium.Cartesian3());
    }

    function quatFromZ(dir) {
        const Cesium = C();
        const up = new Cesium.Cartesian3(0, 0, 1);
        const d = Cesium.Cartesian3.normalize(Cesium.Cartesian3.clone(dir, new Cesium.Cartesian3()), new Cesium.Cartesian3());
        const dot = Cesium.Math.clamp(Cesium.Cartesian3.dot(up, d), -1, 1);
        const axis = Cesium.Cartesian3.cross(up, d, new Cesium.Cartesian3());
        const mag = Cesium.Cartesian3.magnitude(axis);
        if (mag < 1e-7) {
            if (dot > 0) return Cesium.Quaternion.clone(Cesium.Quaternion.IDENTITY, new Cesium.Quaternion());
            return Cesium.Quaternion.fromAxisAngle(new Cesium.Cartesian3(1, 0, 0), Math.PI);
        }
        Cesium.Cartesian3.multiplyByScalar(axis, 1 / mag, axis);
        return Cesium.Quaternion.fromAxisAngle(axis, Math.acos(dot));
    }

    // Distance d'un point à un segment (évite que le missile « saute » la cible).
    function distPointSegment(p, a, b) {
        const Cesium = C();
        const ab = Cesium.Cartesian3.subtract(b, a, new Cesium.Cartesian3());
        const ap = Cesium.Cartesian3.subtract(p, a, new Cesium.Cartesian3());
        const ab2 = Cesium.Cartesian3.dot(ab, ab);
        if (ab2 < 1e-6) return Cesium.Cartesian3.distance(p, a);
        let t = Cesium.Cartesian3.dot(ap, ab) / ab2;
        t = Math.max(0, Math.min(1, t));
        const c = Cesium.Cartesian3.add(a, Cesium.Cartesian3.multiplyByScalar(ab, t, new Cesium.Cartesian3()), new Cesium.Cartesian3());
        return Cesium.Cartesian3.distance(p, c);
    }

    // Hauteur du terrain sous une position (0 si le terrain n'est pas chargé).
    function groundHeight(carto) {
        try {
            const scene = viewer().scene;
            const globe = scene && scene.globe;
            if (globe && typeof globe.getHeight === 'function') {
                const h = globe.getHeight(carto);
                if (typeof h === 'number' && isFinite(h)) return h;
            }
        } catch (e) { }
        return 0;
    }

    function worldToScreen(pos) {
        const Cesium = C();
        const v = viewer();
        const st = Cesium.SceneTransforms;
        const fn = st && (st.worldToWindowCoordinates || st.wgs84ToWindowCoordinates);
        if (!fn) return null;
        try {
            const r = fn.call(st, v.scene, pos);
            if (!r || !isFinite(r.x) || !isFinite(r.y)) return null;
            return r;
        } catch (e) { return null; }
    }

    /* ============================== AUDIO =============================== */

    function audio() {
        if (!actx) {
            try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
        }
        if (actx && actx.state === 'suspended') actx.resume();
        return actx;
    }

    function noiseBurst(dur, freq, q, gain, type) {
        const ctx = audio();
        if (!ctx) return;
        try {
            const len = Math.floor(ctx.sampleRate * dur);
            const buf = ctx.createBuffer(1, len, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < len; i++) {
                const t = i / len;
                d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const filt = ctx.createBiquadFilter();
            filt.type = type || 'bandpass';
            filt.frequency.value = freq;
            filt.Q.value = q;
            const g = ctx.createGain();
            g.gain.value = gain;
            src.connect(filt).connect(g).connect(ctx.destination);
            src.start();
        } catch (e) { warn('audio', e); }
    }

    const playLaunch = () => noiseBurst(1.0, 900, 0.8, 0.32);
    const playBoom = () => noiseBurst(0.9, 140, 0.6, 0.3, 'lowpass');

    /* ============================== HUD ================================= */

    function buildUI() {
        const style = document.createElement('style');
        style.textContent = [
            '.gmm-hud{position:fixed;right:12px;top:70px;z-index:9998;pointer-events:none;',
            'background:rgba(4,14,8,.62);border:1px solid rgba(57,255,136,.35);border-radius:6px;',
            'padding:9px 12px;color:#39ff88;font:12px/1.55 ui-monospace,Consolas,monospace;',
            'letter-spacing:.3px;box-shadow:0 4px 18px rgba(0,0,0,.45);min-width:250px;text-shadow:0 0 6px rgba(57,255,136,.35)}',
            '.gmm-hud b{color:#eafff2;font-weight:600}',
            '.gmm-hud .v{color:#9fffc4}',
            '.gmm-hud .dim{color:#5c8f72}',
            '.gmm-hud .armed{color:#ff5252;text-shadow:0 0 8px rgba(255,82,82,.6)}',
            '.gmm-hud .cal{color:#8ef6ff}',
            '.gmm-hud .keys{margin-top:6px;padding-top:6px;border-top:1px solid rgba(57,255,136,.18);color:#5c8f72;font-size:11px}',
            '.gmm-perf{position:fixed;left:12px;top:70px;z-index:9998;pointer-events:none;display:none;',
            'background:rgba(4,14,8,.62);border:1px solid rgba(57,255,136,.35);border-radius:5px;',
            'padding:4px 8px;color:#39ff88;font:11px/1.45 ui-monospace,Consolas,monospace;',
            'text-shadow:0 0 6px rgba(57,255,136,.35)}',
            '.gmm-perf.on{display:block}',
            '.gmm-perf b{color:#eafff2;font-weight:600}',
            '.gmm-perf .dim{color:#5c8f72}',
            '.gmm-reticle{position:fixed;z-index:9997;pointer-events:none;display:none;width:52px;height:52px;',
            'margin:-26px 0 0 -26px;border:2px solid #ff3b30;border-radius:3px;box-shadow:0 0 10px rgba(255,59,48,.5)}',
            '.gmm-reticle:before,.gmm-reticle:after{content:"";position:absolute;background:#ff3b30}',
            '.gmm-reticle:before{left:50%;top:-9px;width:2px;height:9px}',
            '.gmm-reticle:after{left:50%;bottom:-9px;width:2px;height:9px}',
            '.gmm-reticle span{position:absolute;left:50%;top:-26px;transform:translateX(-50%);white-space:nowrap;',
            'color:#ff6b60;font:10px ui-monospace,monospace;text-shadow:0 0 6px rgba(0,0,0,.9)}',
            '.gmm-toasts{position:fixed;top:120px;left:50%;transform:translateX(-50%);z-index:9999;',
            'display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}',
            '.gmm-toast{padding:6px 14px;border:1px solid;border-radius:5px;background:rgba(0,0,0,.62);',
            'font:12px ui-monospace,Consolas,monospace;transition:opacity .45s,transform .45s}',
            '.gmm-toast.out{opacity:0;transform:translateY(-8px)}',
            '.gmm-panel{position:fixed;left:12px;bottom:98px;z-index:9998;display:none;width:308px;',
            'background:rgba(3,10,6,.97);border:1px solid rgba(57,255,136,.45);border-radius:8px;',
            'padding:10px 12px;color:#9fffc4;font:12px/1.5 ui-monospace,Consolas,monospace;',
            'box-shadow:0 6px 26px rgba(0,0,0,.55)}',
            '.gmm-panel.open{display:block}',
            '.gmm-panel h4{margin:0 0 6px;color:#eafff2;font-size:12px;letter-spacing:.6px;font-weight:600}',
            '.gmm-panel .row{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:2px 0}',
            '.gmm-panel .sep{border-top:1px solid rgba(57,255,136,.18);margin:8px 0;padding-top:7px}',
            '.gmm-panel .v{color:#eafff2}',
            '.gmm-panel .dim{color:#5c8f72}',
            '.gmm-panel .armed{color:#ff5252;text-shadow:0 0 8px rgba(255,82,82,.6)}',
            '.gmm-btn{background:rgba(57,255,136,.1);border:1px solid rgba(57,255,136,.45);color:#9fffc4;',
            'border-radius:4px;padding:3px 9px;font:11px ui-monospace,Consolas,monospace;cursor:pointer}',
            '.gmm-btn:hover{background:rgba(57,255,136,.24)}',
            '.gmm-btn.small{padding:1px 7px;min-width:22px}',
            '.gmm-btn.actif{background:rgba(57,255,136,.42);border-color:#39ff88;color:#04120a;font-weight:700}',
            '.gmm-x{position:absolute;right:6px;top:3px;padding:2px 7px;background:none;border:0;',
            'color:#5c8f72;font:14px/1 ui-monospace,monospace;cursor:pointer}',
            '.gmm-x:hover{color:#eafff2}'
        ].join('');
        document.head.appendChild(style);

        const hud = document.createElement('div');
        hud.className = 'gmm-hud';
        document.body.appendChild(hud);

        const reticle = document.createElement('div');
        reticle.className = 'gmm-reticle';
        reticle.innerHTML = '<span></span>';
        document.body.appendChild(reticle);

        const toasts = document.createElement('div');
        toasts.className = 'gmm-toasts';
        document.body.appendChild(toasts);

        // Compteur FPS / appels de dessin : l'élément existe toujours mais
        // reste masqué tant que le panneau ne l'active pas (voir togglePerf).
        const perf = document.createElement('div');
        perf.className = 'gmm-perf';
        document.body.appendChild(perf);

        // Interface dédiée, ouverte par le bouton de la barre GeoFS (ou U).
        const panel = document.createElement('div');
        panel.className = 'gmm-panel';
        panel.addEventListener('click', ev => {
            const b = ev.target && ev.target.closest ? ev.target.closest('button[data-act]') : null;
            if (!b) return;
            ev.preventDefault();
            ev.stopPropagation();
            const act = b.getAttribute('data-act');
            if (act === 'close') togglePanel(false);
            else if (act === 'perf') togglePerf();
            renderPanel();
        });
        document.body.appendChild(panel);

        S.ui = { hud, reticle, toasts, reticleLabel: reticle.querySelector('span'), panel, perf };
    }

    // 'shift+q' -> 'MAJ+Q' pour l'affichage ; un tableau est listé.
    function keyLabel(binding) {
        if (Array.isArray(binding)) {
            return binding.filter(b => b !== '`' && b !== 'shift+q').map(keyLabel).join(' ');
        }
        return String(binding || '').toUpperCase().replace('SHIFT+', 'MAJ+');
    }

    function aircraftName(ac) {
        if (!ac) return '';
        return (ac.aircraftRecord && ac.aircraftRecord.name) ||
            (ac.definition && ac.definition.name) ||
            ac.name || '';
    }

    function detectProfile(name) {
        for (let i = 0; i < AIRFRAMES.length; i++) {
            if (AIRFRAMES[i].re.test(name)) return AIRFRAMES[i];
        }
        return CFG.forceAllAircraft ? GENERIC_FRAME : null;
    }

    // Boîte de l'aile lue dans le VRAI maillage chargé par Cesium, et non dans
    // les approximations du modèle. C'est la seule source qui donne la hauteur
    // du dessous de voilure au centimètre près.
    //
    // Repère du fichier glTF : Y en haut. Cesium le convertit en Z en haut,
    // donc (x, y, z) glTF devient (x, -z, y) : x = envergure, y = longueur,
    // z = hauteur. C'est exactement le repère des points d'emport.
    function meshWing() {
        // Le maillage d'un avion GeoFS est porté par la partie « body » :
        // `instance.object3d.model` n'existe que sur certains appareils. On
        // essaie donc la racine puis chaque partie, sinon les emports
        // retombent sur les points de collision (sous le ventre).
        const inst = geofs.aircraft.instance;
        const ods = [];
        if (inst && inst.object3d) ods.push(inst.object3d);
        const parts = (inst && inst.parts) || {};
        for (const k in parts) {
            const p = parts[k];
            if (p && p.object3d) ods.push(p.object3d);
        }
        for (let ci = 0; ci < ods.length; ci++) {
            const mdl = ods[ci].model && ods[ci].model._model;
            const glf = mdl && mdl._cachedGltf && mdl._cachedGltf.gltf;
            if (!glf || !glf.nodes || !glf.meshes) continue;
            const found = meshWingIn(glf);
            if (found) return found;
        }
        return null;
    }

    function wingBox() {
        const found = meshWing();
        return found ? found.box : null;
    }

    function meshWingIn(gl) {
        try {

            const I = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
            const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
            const mul = (A, B) => {
                const R = new Array(16);
                for (let c = 0; c < 4; c++) {
                    for (let r = 0; r < 4; r++) {
                        let s = 0;
                        for (let k = 0; k < 4; k++) s += A[k * 4 + r] * B[c * 4 + k];
                        R[c * 4 + r] = s;
                    }
                }
                return R;
            };
            const boxes = [];
            const pboxes = [];       // une boîte par primitive (pièce de maillage)
            const walk = (idx, parent) => {
                const n = gl.nodes[idx];
                if (!n) return;
                const M = mul(parent, n.matrix || I4);
                if (n.mesh !== undefined && gl.meshes[n.mesh]) {
                    let mn0 = 1e9, mn1 = 1e9, mn2 = 1e9, mx0 = -1e9, mx1 = -1e9, mx2 = -1e9;
                    (gl.meshes[n.mesh].primitives || []).forEach(p => {
                        const acc = gl.accessors[p.attributes && p.attributes.POSITION];
                        if (!acc || !acc.min || !acc.max) return;
                        let qn0 = 1e9, qn1 = 1e9, qn2 = 1e9, qx0 = -1e9, qx1 = -1e9, qx2 = -1e9;
                        for (let i = 0; i < 8; i++) {
                            const x = i & 1 ? acc.max[0] : acc.min[0];
                            const y = i & 2 ? acc.max[1] : acc.min[1];
                            const z = i & 4 ? acc.max[2] : acc.min[2];
                            const wx = M[0] * x + M[4] * y + M[8] * z + M[12];
                            const wy = M[1] * x + M[5] * y + M[9] * z + M[13];
                            const wz = M[2] * x + M[6] * y + M[10] * z + M[14];
                            mn0 = Math.min(mn0, wx); mx0 = Math.max(mx0, wx);
                            mn1 = Math.min(mn1, wy); mx1 = Math.max(mx1, wy);
                            mn2 = Math.min(mn2, wz); mx2 = Math.max(mx2, wz);
                            qn0 = Math.min(qn0, wx); qx0 = Math.max(qx0, wx);
                            qn1 = Math.min(qn1, wy); qx1 = Math.max(qx1, wy);
                            qn2 = Math.min(qn2, wz); qx2 = Math.max(qx2, wz);
                        }
                        if (qn0 < 1e8) {
                            // glTF (x, y, z) -> Cesium (x, -z, y)
                            pboxes.push({
                                x0: qn0, x1: qx0,
                                y0: -qx2, y1: -qn2,
                                z0: qn1, z1: qx1
                            });
                        }
                    });
                    if (mn0 < 1e8) {
                        boxes.push({
                            x0: mn0, x1: mx0,
                            y0: -mx2, y1: -mn2,
                            z0: mn1, z1: mx1
                        });
                    }
                }
                (n.children || []).forEach(c => walk(c, M));
            };
            const scene = gl.scenes[gl.scene || 0];
            if (!scene) return null;
            (scene.nodes || []).forEach(i => walk(i, I4));
            if (!boxes.length) return null;

            let half = 0, halfLen = 0;
            boxes.forEach(b => {
                half = Math.max(half, Math.abs(b.x0), Math.abs(b.x1));
                halfLen = Math.max(halfLen, Math.abs(b.y0), Math.abs(b.y1));
            });
            if (!(half > 0.5)) return null;

            // Une aile est large, plate et devant. Le fuselage entier est plus
            // large que l'envergure, le stabilisateur est derrière.
            let wing = null;
            boxes.forEach(b => {
                const w = b.x1 - b.x0;
                const h = b.z1 - b.z0;
                const cy = (b.y0 + b.y1) / 2;
                if (w < 0.25 * half || w > 1.5 * half) return;
                if (h > 0.25 * w) return;
                if (cy < -0.15 * half) return;
                if (!wing || w > wing.x1 - wing.x0) wing = b;
            });

            // Plaques de voilure : fines, loin de l'axe et devant le
            // stabilisateur. Une aile faite de briques n'a pas de boîte
            // englobante crédible, mais ces plaques donnent sa vraie
            // planforme, station par station (voir wingUnder).
            const plates = (pboxes.length ? pboxes : boxes).filter(b => {
                const h = b.z1 - b.z0;
                const cx = (b.x0 + b.x1) / 2;
                const cy = (b.y0 + b.y1) / 2;
                if (h > 0.6) return false;
                if (Math.abs(cx) < 0.3 * half || Math.abs(cx) > 1.05 * half) return false;
                if (cy < -0.7 * halfLen) return false;
                return (b.x1 - b.x0) > 0.10 * half;
            });
            return { box: wing, plates: plates, half: half, halfLen: halfLen };
        } catch (e) { return null; }
    }

    // Corde et dessous de voilure à une station donnée, lus dans les plaques
    // du maillage. Sert quand l'aile n'est pas une boîte unique : une aile en
    // briques est découpée en dizaines de plaques, et poser les
    // missiles à une fraction de la demi-longueur les faisait flotter devant
    // le bord d'attaque, hors de l'aile.
    function wingUnder(plates, xAbs, droop) {
        if (!plates || !plates.length) return null;
        const sel = [];
        for (let i = 0; i < plates.length; i++) {
            const b = plates[i];
            if (xAbs < b.x0 - 0.25 || xAbs > b.x1 + 0.25) continue;
            sel.push(b);
        }
        if (sel.length < 2) return null;
        // Le dessous de voilure est la hauteur la plus fréquente : les trappes
        // de train pendent bien plus bas et fausseraient un simple minimum.
        const zs = sel.map(b => b.z0).sort((a, b) => a - b);
        const med = zs[Math.floor(zs.length / 2)];
        let yLead = -1e9, yTrail = 1e9, zUnder = 1e9, n = 0;
        sel.forEach(b => {
            if (Math.abs(b.z0 - med) > 0.4) return;
            n++;
            if (b.y1 > yLead) yLead = b.y1;
            if (b.y0 < yTrail) yTrail = b.y0;
            if (b.z0 < zUnder) zUnder = b.z0;
        });
        if (n < 2) return null;
        const chord = yLead - yTrail;
        if (!(chord > 0.8)) return null;
        return { y: yLead - 0.5 * chord, z: zUnder - 0.18 - droop };
    }

    // Dimensions réelles de l'appareil, lues dans les points de collision du
    // modèle (repère GeoFS : x = gauche, y = avant, z = haut).
    function aircraftGeometry(profile) {
        const g = {
            halfSpan: (profile && profile.span) || 5.5,
            halfLen: ((profile && profile.span) || 5.5) * 1.1,
            belly: -1.0,
            wingZ: null,         // hauteur du plan de voilure (points de force)
            wing: null,          // boîte du maillage de l'aile (voir wingBox)
            plates: null         // plaques de voilure (voir meshWingIn)
        };
        try {
            const ac = geofs.aircraft.instance;
            const parts = ac && ac.definition && ac.definition.parts;
            if (!Array.isArray(parts)) return g;

            let maxX = 0, maxY = 0, minZ = 0;
            parts.forEach(p => {
                const pts = p && p.collisionPoints;
                if (!Array.isArray(pts)) return;
                pts.forEach(pt => {
                    if (!pt || pt.length < 3) return;
                    if (isFinite(pt[0])) maxX = Math.max(maxX, Math.abs(pt[0]));
                    if (isFinite(pt[1])) maxY = Math.max(maxY, Math.abs(pt[1]));
                    if (isFinite(pt[2])) minZ = Math.min(minZ, pt[2]);
                });
            });
            if (maxX > 1.5) g.halfSpan = maxX;
            if (maxY > 1.5) g.halfLen = maxY;
            if (minZ < -0.2) g.belly = minZ;

            // Hauteur de l'aile : les parties « wing » / « aile » du modèle
            // donnent un point d'application proche du plan de voilure. C'est
            // plus juste que le ventre pour poser les missiles SOUS l'aile.
            let wingZ = null;
            parts.forEach(p => {
                if (!p) return;
                const name = String(p.name || '');
                if (!/wing|aile/i.test(name) || /flap|spoiler|slat|aileron|stab/i.test(name)) return;
                const pt = (p.points && p.points.forceSourcePoint) || p.position;
                if (!Array.isArray(pt) || pt.length < 3) return;
                if (!isFinite(pt[2]) || Math.abs(pt[0]) < 1) return;
                wingZ = (wingZ === null) ? pt[2] : Math.min(wingZ, pt[2]);
            });
            if (wingZ !== null) g.wingZ = wingZ;
        } catch (e) { }
        try {
            const m = meshWing();
            if (m) { g.wing = m.box; g.plates = m.plates; }
        } catch (e) { }
        return g;
    }

    // Le repère est recalculé à chaque image de rendu — jamais réutilisé d'une
    // image sur l'autre, donc rien ne peut retarder — puis partagé par toutes
    // les pièces de cette image : une munition compte une dizaine d'entités et
    // on ne refait pas dix fois la même matrice.
    const frameCache = { n: -1, fr: null };
    function currentFrame() {
        const n = renderFrameNumber();
        if (n === frameCache.n && frameCache.fr) return frameCache.fr;
        const fr = playerFrame();
        frameCache.n = n;
        frameCache.fr = fr;
        return fr;
    }

    function currentType() {
        return MISSILE_TYPES[S.typeIndex % MISSILE_TYPES.length] || MISSILE_TYPES[0];
    }

    // Portée du radar = portée du missile sélectionné.
    function lockRange() {
        return (S.profile && S.profile.missiles) ? currentType().range : CFG.lockRange;
    }

    // Position d'un emport pour l'image courante. Les dix pièces d'une même
    // munition la relisent toutes à chaque évaluation : sans ce cache, chacune
    // refaisait la multiplication matrice + deux allocations, soit vingt
    // allocations par munition et par image pour un résultat identique.
    function stationPos(st, frame) {
        const fr = frame || currentFrame();
        if (!fr) return null;
        const n = renderFrameNumber();
        if (st.pn === n && st.ppos) return st.ppos;
        const cal = calFor();
        st.ppos = offsetPos(fr, st.x * cal.span, st.y + cal.f, st.z + cal.u);
        st.pn = n;
        return st.ppos;
    }

    /* ======================= POINTS D'EMPORT (3D) ====================== */

    // Repères de calibrage : un point par emport, dessiné par-dessus le
    // fuselage (test de profondeur désactivé) pour aligner à l'œil sur l'aile.
    function clearCalMarkers() {
        const v = viewer();
        (S.markers || []).forEach(e => {
            try { v.entities.remove(e); } catch (err) { }
        });
        S.markers = [];
    }

    function buildCalMarkers() {
        const Cesium = C();
        const v = viewer();
        clearCalMarkers();
        if (!v || !Cesium || !Cesium.CallbackProperty) return;

        const add = (st, css) => {
            try {
                S.markers.push(v.entities.add({
                    position: new Cesium.CallbackProperty(
                        () => stationPos(st) || Cesium.Cartesian3.fromDegrees(0, 0, 0), false),
                    point: {
                        pixelSize: 10,
                        color: Cesium.Color.fromCssColorString(css),
                        outlineColor: Cesium.Color.fromCssColorString('#000000'),
                        outlineWidth: 2,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY
                    }
                }));
            } catch (e) { }
        };

        S.stations.forEach(st => add(st, '#00e5ff'));      // missiles : cyan
        S.bombStations.forEach(st => add(st, '#ffd400'));  // bombes   : jaune
    }

    function clearStations() {
        clearCalMarkers();
        S.stations.concat(S.bombStations).forEach(st => freeModel(st.model));
        S.stations = [];
        S.bombStations = [];
    }

    // La position d'un emport ne dépend que de l'avion : toutes les munitions
    // posées partagent la matrice de l'avion. Une affectation par munition et
    // par image, sans allocation ni trigonométrie, remplace le calcul complet
    // que Cesium refaisait pour chaque pièce.
    function placeStations() {
        const fr = currentFrame();
        if (!fr) return;
        const lists = [S.stations, S.bombStations];
        for (let i = 0; i < lists.length; i++) {
            const l = lists[i];
            for (let j = 0; j < l.length; j++) {
                const pr = l[j].model && l[j].model.primitive;
                if (pr) pr.modelMatrix = fr.matrix;
            }
        }
    }

    /* =========================== MODÈLES 3D ============================ */
    // Une munition = un petit jeu de primitives rigides autour d'un même axe :
    // corps, ogive, ceinture, culot, tuyère, quatre ailettes, quatre canards.
    // Repère local : z le long de l'arme, x vers l'ailette de roulis 0.
    //
    // PERFORMANCES. Chaque pièce était une entité Cesium dont la position ET
    // l'orientation étaient des CallbackProperty : Cesium classe alors la pièce
    // comme dynamique et, pour une géométrie dynamique, son
    // DynamicGeometryUpdater DÉTRUIT et RECRÉE un Primitive à chaque image
    // (removeAndDestroy + new Primitive + nouveaux tampons GPU). Un B-52 garé
    // (20 bombes × 8 pièces) faisait donc 160 destructions/recréations de
    // primitives par image, même sans tirer : c'était le lag, et aucune
    // optimisation JavaScript ne pouvait l'enlever.
    //
    // Désormais les pièces sont des GeometryInstance cuites une fois dans un
    // seul Primitive par munition. Cesium ne retouche plus la géométrie : on ne
    // change à chaque image que la matrice modèle de la munition
    // (primitive.modelMatrix), que Cesium recopie dans ses commandes de dessin.
    // Une munition = 1 primitive = 1 appel de dessin, au lieu de 8 à 14 entités
    // dynamiques. Les couleurs sont par instance (PerInstanceColorAppearance) :
    // la texture canvas de 64×64, invisible à cette échelle, disparaît avec le
    // coût d'un matériau par pièce.

    const geomCache = {};
    function pieceGeometry(kind, a, b, c) {
        const key = kind + '|' + a + '|' + b + '|' + c;
        if (geomCache[key]) return geomCache[key];
        const Cesium = C();
        let g = null;
        try {
            const vertexFormat = Cesium.PerInstanceColorAppearance.VERTEX_FORMAT;
            if (kind === 'cyl') {
                g = new Cesium.CylinderGeometry({
                    length: a, topRadius: b, bottomRadius: c,
                    slices: 12, vertexFormat: vertexFormat
                });
            } else {
                g = new Cesium.BoxGeometry({
                    minimum: new Cesium.Cartesian3(-a / 2, -b / 2, -c / 2),
                    maximum: new Cesium.Cartesian3(a / 2, b / 2, c / 2),
                    vertexFormat: vertexFormat
                });
            }
        } catch (e) { warn('géométrie', e); }
        geomCache[key] = g;
        return g;
    }

    const colorCache = {};
    function colorOf(css) {
        const Cesium = C();
        if (!colorCache[css]) colorCache[css] = Cesium.Color.fromCssColorString(css);
        return colorCache[css];
    }

    // Décrit les pièces d'une munition une fois pour toutes : géométrie
    // partagée (mise en cache par type de pièce), couleur et matrice locale
    // (décalage le long de l'axe, décalage radial, roulis).
    function weaponPieces(t, isBomb) {
        const Cesium = C();
        const r = (t.caliber || 0.18) / 2;
        const L = t.length || 3.6;
        const noseLen = t.noseLen || 0.6;
        const tailLen = isBomb ? Math.min(0.55, L * 0.22) : Math.min(0.36, L * 0.10);
        const bodyLen = Math.max(0.2, L - noseLen - tailLen);
        const finSpan = t.finSpan || 0.36;
        const finChord = t.finChord || 0.36;
        const out = [];

        function add(kind, a, b, c, dz, dr, deg, color) {
            const g = pieceGeometry(kind, a, b, c);
            if (!g) return;
            const rad = (deg || 0) * Math.PI / 180;
            const m = new Cesium.Matrix4();
            Cesium.Matrix4.fromRotationTranslation(
                Cesium.Matrix3.fromRotationZ(rad),
                new Cesium.Cartesian3(dr * Math.cos(rad), dr * Math.sin(rad), dz),
                m
            );
            out.push({ g: g, m: m, dz: dz, dr: dr, deg: deg || 0, color: color });
        }

        // corps
        add('cyl', bodyLen, r, r, (tailLen - noseLen) / 2, 0, 0, t.body);
        // ogive (plus arrondie sur une bombe)
        add('cyl', noseLen, isBomb ? r * 0.22 : r * 0.10, r, L / 2 - noseLen / 2, 0, 0, t.nose);
        // ceinture de repérage derrière l'ogive
        add('cyl', 0.09, r * 1.02, r * 1.02, L / 2 - noseLen - 0.06, 0, 0, t.band);
        // culot : convergent pour un missile, boîte d'empennage pour une bombe
        add('cyl', tailLen, r, r * (isBomb ? 0.58 : 0.74), -L / 2 + tailLen / 2, 0, 0,
            isBomb ? '#2b332b' : '#6b7178');
        // tuyère
        if (!isBomb) add('cyl', 0.11, r * 0.60, r * 0.50, -L / 2 + 0.05, 0, 0, '#25282b');
        // ailettes arrière, en croix
        [45, 135, 225, 315].forEach(function (deg) {
            add('box', finSpan, 0.018, finChord, -L / 2 + tailLen * 0.55,
                r + finSpan / 2, deg, isBomb ? '#394139' : '#8d949b');
        });
        // canards avant des missiles à guidage infrarouge
        if (!isBomb && t.canards) {
            [45, 135, 225, 315].forEach(function (deg) {
                add('box', finSpan * 0.45, 0.016, finChord * 0.5,
                    L / 2 - noseLen - 0.24, r + finSpan * 0.16, deg, '#8d949b');
            });
        }
        return out;
    }

    const UNIT_UP = { v: null };
    function unitUp() {
        if (!UNIT_UP.v) UNIT_UP.v = new (C().Cartesian3)(0, 0, 1);
        return UNIT_UP.v;
    }

    // Numéro de l'image de rendu : clé du cache de position d'emport, relevé
    // une fois par tick au lieu d'être relu par chaque pièce.
    function readFrameNumber() {
        const v = window.geofs && geofs.api && geofs.api.viewer;
        const fs = v && v.scene && v.scene.frameState;
        const n = fs && fs.frameNumber;
        return (typeof n === 'number' && isFinite(n)) ? n : S.frameSeq;
    }
    function renderFrameNumber() {
        return S.frameNo;
    }

    // Matrice modèle -> ECEF d'une munition : colonnes (droite, haut, avant,
    // position). Rien n'est alloué : les axes et la matrice vivent sur la
    // munition et sont réécrits sur place.
    function weaponMatrix(w, pos, dir) {
        const Cesium = C();
        if (!dir || !pos) return null;
        const R = w.R || (w.R = new Cesium.Cartesian3());
        const U = w.U || (w.U = new Cesium.Cartesian3());
        Cesium.Cartesian3.cross(unitUp(), dir, R);
        if (Cesium.Cartesian3.magnitude(R) < 1e-5) { R.x = 1; R.y = 0; R.z = 0; }
        Cesium.Cartesian3.normalize(R, R);
        Cesium.Cartesian3.cross(dir, R, U);
        Cesium.Cartesian3.normalize(U, U);
        const m = w.mat;
        m[0] = R.x; m[1] = R.y; m[2] = R.z; m[3] = 0;
        m[4] = U.x; m[5] = U.y; m[6] = U.z; m[7] = 0;
        m[8] = dir.x; m[9] = dir.y; m[10] = dir.z; m[11] = 0;
        m[12] = pos.x; m[13] = pos.y; m[14] = pos.z; m[15] = 1;
        return m;
    }

    // Assemble une munition : un seul Primitive pour toutes ses pièces.
    // `origin` (repère modèle de l'avion) place une munition sur son emport ;
    // sans elle, la munition est à l'origine de sa propre matrice.
    function buildModel(t, isBomb, origin) {
        const Cesium = C();
        const v = viewer();
        const pieces = weaponPieces(t, isBomb);
        const w = {
            pieces: pieces,
            primitive: null,
            mat: new Cesium.Matrix4(),
            R: new Cesium.Cartesian3(),
            U: new Cesium.Cartesian3()
        };
        if (!pieces.length) return w;
        const shift = origin ? Cesium.Matrix4.fromTranslation(origin, new Cesium.Matrix4()) : null;
        const instances = pieces.map(function (p) {
            return new Cesium.GeometryInstance({
                geometry: p.g,
                modelMatrix: shift
                    ? Cesium.Matrix4.multiply(shift, p.m, new Cesium.Matrix4())
                    : p.m,
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(colorOf(p.color))
                }
            });
        });
        if (v && v.scene && v.scene.primitives) {
            try {
                w.primitive = new Cesium.Primitive({
                    geometryInstances: instances,
                    appearance: new Cesium.PerInstanceColorAppearance({
                        translucent: false,
                        closed: true
                    }),
                    asynchronous: false,
                    allowPicking: false,
                    shadows: Cesium.ShadowMode ? Cesium.ShadowMode.DISABLED : 0,
                    // On garde les instances (quelques dizaines d'objets) : le
                    // banc de vérification relit leurs matrices.
                    releaseGeometryInstances: false,
                    modelMatrix: new Cesium.Matrix4()
                });
                v.scene.primitives.add(w.primitive);
            } catch (e) {
                warn('primitive', e);
                w.primitive = null;
            }
        }
        return w;
    }

    function buildMissile(t, origin) {
        return buildModel(t, false, origin);
    }

    function buildBomb(origin) {
        return buildModel(BOMB_TYPE, true, origin);
    }

    // Retire la munition du rendu : plus aucun appel de dessin. La géométrie,
    // mise en cache par type de pièce, reste disponible pour la suivante.
    function freeModel(w) {
        if (!w) return;
        if (w.primitive) {
            try { viewer().scene.primitives.remove(w.primitive); } catch (err) { }
            w.primitive = null;
        }
        w.pieces = [];
    }

    // Un emport vide disparaît du rendu ; le réarmement reconstruit tout le
    // chargement (voir reload).
    function dropStation(st) {
        freeModel(st.model);
        st.model = null;
        st.used = true;
    }

    function makeHardpoint(st, kind) {
        const cal = calFor();
        const origin = new (C().Cartesian3)(st.x * cal.span, st.y + cal.f, st.z + cal.u);
        st.model = kind === 'missile' ? buildMissile(currentType(), origin) : buildBomb(origin);
        st.parts = st.model.pieces;
    }

    function buildStations(profile) {
        clearStations();
        if (!profile) { S.loadout = 0; S.bombs = 0; return; }

        const g = S.geo;
        const wing = g.wing;

        // La boîte trouvée n'est retenue que si elle ressemble vraiment à une
        // aile : assez d'envergure et atteignant le bout. Sinon on tombe sur un
        // volet (Rafale) ou sur rien du tout (F-16, aile fondue dans le body).
        const wingTip = wing ? Math.max(Math.abs(wing.x0), Math.abs(wing.x1)) : 0;
        const wingRoot = wing ? Math.min(Math.abs(wing.x0), Math.abs(wing.x1)) : 0;
        const wingOk = !!wing && (wingTip - wingRoot) > 0.5 * g.halfSpan && wingTip > 0.75 * g.halfSpan;

        // Hauteur sous l'aile. Priorité au maillage validé : le dessous de
        // voilure y est exact (0,21 m sur le Su-35) alors que les points de
        // collision ne décrivent que le fuselage. Repli : 25 cm sous le plan
        // annoncé par le modèle, sinon sous le ventre.
        // Un gros missile pend plus bas : on descend l'axe pour que le dessus du
        // corps reste collé sous la voilure quel que soit le calibre choisi.
        const droop = Math.max(0, currentType().caliber / 2 - 0.10);
        const wingU = (wingOk
            ? wing.z0 - 0.18
            : ((g.wingZ !== null && isFinite(g.wingZ)) ? g.wingZ - 0.25 : g.belly * 0.55)) - droop;

        // --- Missiles : sous les ailes, par paires symétriques ---
        // Les quatre premières paires se répartissent le long de la vraie
        // aile (racine -> bout), les deux dernières vont sous le fuselage.
        // GeoFS ne nomme aucun pylône : il n'y a rien de plus précis à lire.
        const wingSlots = WING_SLOTS.length - 2;
        const n = profile.missiles || 0;
        for (let i = 0; i < n; i++) {
            const side = (i % 2 === 0) ? 1 : -1;
            const k = Math.floor(i / 2);
            let x, y, z;
            if (wingOk && k < wingSlots) {
                // La boîte du maillage est celle d'UNE aile : on repart de sa
                // racine vers son bout, puis l'alternance place l'autre côté.
                x = wingRoot + WING_SLOTS[k][0] * (wingTip - wingRoot);
                y = wing.y0 + 0.55 * (wing.y1 - wing.y0);
                z = wingU;
            } else if (k < wingSlots) {
                // Aile en briques : on mesure la corde et le dessous de
                // voilure à la station, sinon le missile flotte devant l'aile.
                const under = wingUnder(g.plates, WING_SLOTS[k][0] * g.halfSpan, droop);
                x = WING_SLOTS[k][0] * g.halfSpan;
                y = under ? under.y : g.halfLen * WING_SLOTS[k][1];
                z = under ? under.z : wingU;
            } else {
                // sous le fuselage : deux paires décalées, sinon elles se
                // superposent exactement au même point.
                const j = k - wingSlots;
                x = (0.10 + 0.06 * j) * g.halfSpan;
                y = j ? -0.10 * g.halfLen : 0.05 * g.halfLen;
                z = g.belly - 0.22 - 0.04 * j;
            }
            const st = {
                kind: 'missile',
                x: side * x,
                y: y,
                z: z,
                used: false,
                parts: []
            };
            makeHardpoint(st, 'missile');
            S.stations.push(st);
        }

        // --- Bombes : sous le ventre, deux colonnes ---
        // Jamais plus bas que 1,20 m sous le dessous de voilure : sur un
        // bombardier le train touche beaucoup plus bas que la soute.
        const under = wingOk ? wing.z0 : g.wingZ;
        const bombU = ((under !== null && isFinite(under))
            ? Math.max(g.belly - 0.25, under - 1.2)
            : g.belly - 0.25) - Math.max(0, BOMB_TYPE.caliber / 2 - 0.20);
        const nb = profile.bombs || 0;
        const rows = Math.max(1, Math.ceil(nb / 2));
        for (let i = 0; i < nb; i++) {
            const side = (i % 2 === 0) ? 1 : -1;
            const row = Math.floor(i / 2);
            const t = rows > 1 ? row / (rows - 1) : 0.5;
            const st = {
                kind: 'bomb',
                x: side * 0.09 * g.halfSpan,
                y: g.halfLen * (0.22 - 0.42 * t),
                z: bombU,
                used: false,
                parts: []
            };
            makeHardpoint(st, 'bomb');
            S.bombStations.push(st);
        }

        S.loadout = profile.missiles || 0;
        S.bombs = profile.bombs || 0;

        // Les repères de calibrage suivent les emports qu'ils désignent.
        if (S.calMode) buildCalMarkers();
    }

    /* ========================= CIBLES / RADAR ========================== */

    function userLLA(u) {
        if (!u) return null;
        const candidates = [
            u.referencePoint && u.referencePoint.lla,
            u.llaLocation,
            u.lla
        ];
        for (let i = 0; i < candidates.length; i++) {
            const l = candidates[i];
            if (l && l.length >= 2 && isFinite(l[0]) && isFinite(l[1]) && (l[0] !== 0 || l[1] !== 0)) {
                return [l[0], l[1], l[2] || 0];
            }
        }
        return null;
    }

    function refreshContacts() {
        const Cesium = C();
        const fr = playerFrame();
        S.contactsAt = performance.now();
        if (!fr || !window.multiplayer) { S.contacts = []; return; }

        const users = {};
        try { Object.assign(users, mp().users || {}); } catch (e) { }
        try { Object.assign(users, mp().visibleUsers || {}); } catch (e) { }

        const myId = String((geofs.aircraft.instance && geofs.aircraft.instance.id) || '');
        const list = [];
        Object.keys(users).forEach(id => {
            if (id === myId || id === 'selfplayer') return;
            const u = users[id];
            const lla = userLLA(u);
            if (!lla) return;
            let pos;
            try { pos = Cesium.Cartesian3.fromDegrees(lla[1], lla[0], lla[2]); } catch (e) { return; }
            const d = Cesium.Cartesian3.distance(fr.origin, pos);
            if (!isFinite(d)) return;
            list.push({
                id: id,
                name: (u.callsign || u.name || ('#' + id)).toString().slice(0, 16),
                pos: pos,
                lla: lla,
                dist: d
            });
        });
        list.sort((a, b) => a.dist - b.dist);
        S.contacts = list;
    }

    function findContact(id) {
        if (!id) return null;
        for (let i = 0; i < S.contacts.length; i++) {
            if (S.contacts[i].id === id) return S.contacts[i];
        }
        return null;
    }

    // Changement de type de missile : seulement avant l'armement.
    function cycleMissileType() {
        if (!S.ready) return;
        if (!S.profile || !S.profile.missiles) { toast('Cet avion n\'emporte pas de missiles', '#ffce54'); return; }
        if (S.armed) {
            toast('Désarme d\'abord (' + keyLabel(CFG.keys.arm) + ') pour changer de missile', '#ffce54');
            return;
        }
        S.typeIndex = (S.typeIndex + 1) % MISSILE_TYPES.length;
        // Le calibre change : on replace les emports (autorisé, on n'est pas armé).
        if (S.profile) buildStations(S.profile);
        const t = currentType();
        toast('Missile : ' + t.name + ' — portée ' + Math.round(t.range / 1000) + ' km', '#8ef6ff');
        updateHUD();
    }

    function cycleTarget() {
        if (!S.armed) { toast('Système non armé — [' + CFG.keys.arm.toUpperCase() + ']', '#ffce54'); return; }
        const inRange = S.contacts.filter(c => c.dist <= lockRange());
        if (!inRange.length) { toast('Aucun contact dans la portée radar', '#ffce54'); S.targetId = null; return; }
        const idx = inRange.findIndex(c => c.id === S.targetId);
        const next = inRange[(idx + 1) % inRange.length];
        S.targetId = next.id;
        toast('Verrouillé : ' + next.name + ' — ' + (next.dist / 1000).toFixed(1) + ' km', '#8ef6ff');
    }

    function updateLock() {
        if (!S.ui) return;
        const Cesium = C();
        const ret = S.ui.reticle;

        if (!S.armed || !S.targetId) { ret.style.display = 'none'; return; }

        const c = findContact(S.targetId);
        if (!c || c.dist > lockRange() * 1.4) { S.targetId = null; ret.style.display = 'none'; return; }

        const users = (mp().users && mp().users[c.id]) || (mp().visibleUsers && mp().visibleUsers[c.id]);
        const lla = userLLA(users) || c.lla;
        try { c.pos = Cesium.Cartesian3.fromDegrees(lla[1], lla[0], lla[2]); } catch (e) { }

        const scene = viewer().scene;
        const cam = scene && scene.camera;
        if (cam && cam.position && cam.direction) {
            const toTgt = Cesium.Cartesian3.subtract(c.pos, cam.position, new Cesium.Cartesian3());
            const d = Cesium.Cartesian3.magnitude(toTgt);
            if (d > 1 && Cesium.Cartesian3.dot(toTgt, cam.direction) / d < 0.02) {
                ret.style.display = 'none';
                return;
            }
        }

        const sp = worldToScreen(c.pos);
        if (!sp) { ret.style.display = 'none'; return; }

        ret.style.display = 'block';
        ret.style.left = sp.x + 'px';
        ret.style.top = sp.y + 'px';
        const ac = geofs.aircraft.instance;
        const vc = ((ac.trueSpeed || ac.groundSpeed || 0) - 250);
        S.ui.reticleLabel.textContent = c.name + '  ' + (c.dist / 1000).toFixed(1) + 'km  ' +
            (vc > 0 ? '+' : '') + Math.round(vc) + 'm/s';
    }

    /* ============================ MISSILES ============================= */

    function makeTrail(m) {
        const Cesium = C();
        return viewer().entities.add({
            polyline: {
                positions: new Cesium.CallbackProperty(() => m.trailPts, false),
                width: 2.5,
                material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.22,
                    color: Cesium.Color.fromCssColorString('#f2f2f2').withAlpha(0.55)
                }),
                arcType: Cesium.ArcType.NONE
            }
        });
    }

    function fire() {
        if (!S.ready) return;
        if (!S.armed) { toast('Système non armé — [' + CFG.keys.arm.toUpperCase() + ']', '#ffce54'); return; }
        if (!S.profile) { toast('Avion non militaire', '#ffce54'); return; }
        if (!S.profile.missiles) {
            // Bombardier pur : Q largue directement une bombe.
            if (S.profile.bombs) return dropBomb();
            toast('Cet avion n\'emporte aucun armement', '#ffce54');
            return;
        }
        if (S.loadout <= 0) { toast('Plus de missiles — [' + CFG.keys.reload.toUpperCase() + '] pour réarmer', '#ff5a3c'); return; }
        if (S.missiles.length >= CFG.maxActive) { toast('Trop de missiles en vol', '#ffce54'); return; }

        const now = performance.now();
        if (now < S.cooldownUntil) return;
        S.cooldownUntil = now + CFG.cooldown;

        const Cesium = C();
        const fr = playerFrame();
        if (!fr) return;
        const t = currentType();

        const st = S.stations.find(s => !s.used);
        const pos = st ? stationPos(st, fr) : offsetPos(fr, 0, 2.5, -1);
        if (st) dropStation(st);
        if (!pos) return;

        const ac = geofs.aircraft.instance;
        const speed = Math.max(CFG.minLaunchSpeed, ac.trueSpeed || ac.groundSpeed || 0);
        const tgt = S.targetId ? findContact(S.targetId) : null;

        const m = {
            pos: Cesium.Cartesian3.clone(pos, new Cesium.Cartesian3()),
            dir: Cesium.Cartesian3.clone(fr.F, new Cesium.Cartesian3()),
            speed: speed,
            t: 0,
            // Caractéristiques figées au tir : chaque missile garde son type.
            typeName: t.name,
            maxSpeed: t.maxSpeed,
            accel: t.accel,
            turnRate: t.turnRate,
            life: t.life,
            proximity: t.proximity,
            targetId: tgt ? tgt.id : null,
            targetName: tgt ? tgt.name : '',
            trailPts: [],
            vis: null,
            trail: null
        };

        const v = viewer();
        m.vis = {
            model: buildMissile(t),
            flame: v.entities.add({
                position: new Cesium.CallbackProperty(() => along(m.pos, m.dir, -(t.length / 2) - 0.12), false),
                point: {
                    pixelSize: 11,
                    color: Cesium.Color.fromCssColorString('#ffd08a'),
                    outlineColor: Cesium.Color.fromCssColorString('#ff6a00').withAlpha(0.85),
                    outlineWidth: 3
                }
            })
        };
        m.trail = makeTrail(m);
        if (m.vis.model.primitive) {
            m.vis.model.primitive.modelMatrix = weaponMatrix(m.vis.model, m.pos, m.dir);
        }

        S.missiles.push(m);
        S.loadout--;
        playLaunch();
        toast('🚀 ' + t.name + (tgt ? ' → ' + tgt.name : ' — tir direct'), '#8ef6ff');
        updateHUD();
    }

    function removeMissile(m) {
        const v = viewer();
        freeModel(m.vis && m.vis.model);
        try { v.entities.remove(m.vis.flame); } catch (e) { }
        try { v.entities.remove(m.trail); } catch (e) { }
    }

    function updateMissiles(dt) {
        const Cesium = C();
        for (let i = S.missiles.length - 1; i >= 0; i--) {
            const m = S.missiles[i];
            m.t += dt;
            m.speed = Math.min(m.maxSpeed, m.speed + m.accel * dt);

            let tp = null;
            if (m.targetId) {
                const c = findContact(m.targetId);
                if (c) {
                    const users = (mp().users && mp().users[c.id]) || (mp().visibleUsers && mp().visibleUsers[c.id]);
                    const lla = userLLA(users) || c.lla;
                    try { tp = Cesium.Cartesian3.fromDegrees(lla[1], lla[0], lla[2]); } catch (e) { tp = null; }
                }
                if (!tp) m.targetId = null;
            }

            if (tp) {
                const toT = Cesium.Cartesian3.normalize(
                    Cesium.Cartesian3.subtract(tp, m.pos, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );
                const k = Math.min(1, m.turnRate * dt);
                const blend = Cesium.Cartesian3.add(
                    Cesium.Cartesian3.multiplyByScalar(m.dir, 1 - k, new Cesium.Cartesian3()),
                    Cesium.Cartesian3.multiplyByScalar(toT, k, new Cesium.Cartesian3()),
                    new Cesium.Cartesian3()
                );
                const mag = Cesium.Cartesian3.magnitude(blend);
                if (mag > 1e-5) Cesium.Cartesian3.divideByScalar(blend, mag, m.dir);
                else Cesium.Cartesian3.clone(toT, m.dir);
            }

            const prev = Cesium.Cartesian3.clone(m.pos, new Cesium.Cartesian3());
            const step = m.speed * dt;
            Cesium.Cartesian3.add(
                m.pos,
                Cesium.Cartesian3.multiplyByScalar(m.dir, step, new Cesium.Cartesian3()),
                m.pos
            );

            if (m.vis && m.vis.model && m.vis.model.primitive) {
                m.vis.model.primitive.modelMatrix = weaponMatrix(m.vis.model, m.pos, m.dir);
            }

            const carto = Cesium.Cartographic.fromCartesian(m.pos);
            const alt = carto ? carto.height : 0;

            let hit = false, splash = false;
            if (tp && distPointSegment(tp, prev, m.pos) < m.proximity) { hit = true; splash = true; }
            else if (carto && (alt - groundHeight(carto)) < 2) { hit = true; }
            else if (m.t > m.life) { hit = true; }

            if (hit) {
                removeMissile(m);
                S.missiles.splice(i, 1);
                spawnExplosion(m.pos, splash ? 1.25 : 0.85);
                if (splash) toast('💥 SPLASH — ' + (m.targetName || 'cible'), '#ff5a3c');
                continue;
            }

            m.trailPts.push(Cesium.Cartesian3.clone(m.pos, new Cesium.Cartesian3()));
            if (m.trailPts.length > CFG.trailPoints) m.trailPts.shift();
        }
    }

    /* ============================== BOMBES ============================= */

    function dropBomb() {
        if (!S.ready) return;
        if (!S.armed) { toast('Système non armé — [' + CFG.keys.arm.toUpperCase() + ']', '#ffce54'); return; }
        if (!S.profile) { toast('Avion non militaire', '#ffce54'); return; }
        if (!S.profile.bombs) { toast('Cet avion n\'emporte pas de bombes', '#ffce54'); return; }
        if (S.bombs <= 0) { toast('Plus de bombes — [' + CFG.keys.reload.toUpperCase() + '] pour réarmer', '#ff5a3c'); return; }
        if (S.bombsInAir.length >= CFG.maxBombsActive) { toast('Trop de bombes en vol', '#ffce54'); return; }

        const now = performance.now();
        if (now < S.bombCooldownUntil) return;
        S.bombCooldownUntil = now + CFG.bombCooldown;

        const Cesium = C();
        const fr = playerFrame();
        if (!fr) return;

        const st = S.bombStations.find(s => !s.used);
        if (!st) return;
        const pos0 = stationPos(st, fr);
        if (!pos0) return;

        dropStation(st);

        const ac = geofs.aircraft.instance;
        const speed = ac.trueSpeed || ac.groundSpeed || 0;

        // Vitesse initiale = celle de l'avion, mais on supprime toute composante
        // ascendante et on ajoute une petite poussée vers le bas : la bombe ne
        // monte jamais, même si l'appareil est cabré.
        const up = Cesium.Cartesian3.normalize(Cesium.Cartesian3.clone(pos0, new Cesium.Cartesian3()), new Cesium.Cartesian3());
        const vel = Cesium.Cartesian3.multiplyByScalar(fr.F, speed, new Cesium.Cartesian3());
        const vUp = Cesium.Cartesian3.dot(vel, up);
        if (vUp > 0) {
            Cesium.Cartesian3.add(vel, Cesium.Cartesian3.multiplyByScalar(up, -vUp, new Cesium.Cartesian3()), vel);
        }
        Cesium.Cartesian3.add(vel, Cesium.Cartesian3.multiplyByScalar(up, -3, new Cesium.Cartesian3()), vel);

        const v = {
            body: null,
            pos: Cesium.Cartesian3.clone(pos0, new Cesium.Cartesian3()),
            vel: vel,
            dir: Cesium.Cartesian3.normalize(Cesium.Cartesian3.clone(vel, new Cesium.Cartesian3()), new Cesium.Cartesian3()),
            t: 0
        };

        v.model = buildBomb();
        if (v.model.primitive) {
            v.model.primitive.modelMatrix = weaponMatrix(v.model, v.pos, v.dir);
        }

        S.bombsInAir.push(v);
        S.bombs--;
        noiseBurst(0.25, 320, 1.2, 0.12, 'lowpass');
        toast('💣 Bombe larguée — ' + S.bombs + ' restantes', '#ffce54');
        updateHUD();
    }

    function updateBombs(dt) {
        const Cesium = C();
        for (let i = S.bombsInAir.length - 1; i >= 0; i--) {
            const b = S.bombsInAir[i];
            b.t += dt;

            // Gravité vers le bas local (radial ECEF) + traînée.
            const up = Cesium.Cartesian3.normalize(Cesium.Cartesian3.clone(b.pos, new Cesium.Cartesian3()), new Cesium.Cartesian3());
            Cesium.Cartesian3.add(b.vel, Cesium.Cartesian3.multiplyByScalar(up, -CFG.bombGravity * dt, new Cesium.Cartesian3()), b.vel);
            Cesium.Cartesian3.multiplyByScalar(b.vel, Math.max(0, 1 - CFG.bombDrag * dt), b.vel);

            const speed = Cesium.Cartesian3.magnitude(b.vel);
            Cesium.Cartesian3.add(b.pos, Cesium.Cartesian3.multiplyByScalar(b.vel, dt, new Cesium.Cartesian3()), b.pos);

            // La bombe suit sa trajectoire (nez vers le bas).
            if (speed > 1e-3) Cesium.Cartesian3.divideByScalar(b.vel, speed, b.dir);

            if (b.model && b.model.primitive) {
                b.model.primitive.modelMatrix = weaponMatrix(b.model, b.pos, b.dir);
            }

            const carto = Cesium.Cartographic.fromCartesian(b.pos);
            const alt = carto ? carto.height : 0;
            const impact = carto && (alt - groundHeight(carto)) < 2.5;

            if (impact || b.t > CFG.bombLifetime) {
                freeModel(b.model);
                S.bombsInAir.splice(i, 1);
                spawnExplosion(b.pos, impact ? 2.0 : 1.0);
            }
        }
    }

    /* ============================ EXPLOSIONS =========================== */

    function spawnExplosion(pos, scale) {
        const Cesium = C();
        const v = viewer();
        try {
            const fire = v.entities.add({
                position: Cesium.Cartesian3.clone(pos, new Cesium.Cartesian3()),
                ellipsoid: {
                    radii: new Cesium.Cartesian3(1, 1, 1),
                    material: Cesium.Color.fromCssColorString('#ffb100').withAlpha(0.95)
                }
            });
            const smoke = v.entities.add({
                position: Cesium.Cartesian3.clone(pos, new Cesium.Cartesian3()),
                ellipsoid: {
                    radii: new Cesium.Cartesian3(1, 1, 1),
                    material: Cesium.Color.fromCssColorString('#4a4a4a').withAlpha(0.5)
                }
            });
            S.fx.push({ t: 0, dur: 1.1, kind: 'fire', e: fire, scale: scale });
            S.fx.push({ t: 0, dur: scale > 1.5 ? 6.0 : 4.2, kind: 'smoke', e: smoke, scale: scale });
            playBoom();
        } catch (e) { warn('explosion', e); }
    }

    let fxFrame = 0;
    function updateFx(dt) {
        if (!S.fx.length) return;
        // Un effet sur deux images suffit largement à l'œil, et évite de
        // recréer deux propriétés Cesium par particule à chaque image.
        if ((fxFrame++ & 1) && S.fx.length > 2) return;
        const Cesium = C();
        const v = viewer();
        for (let i = S.fx.length - 1; i >= 0; i--) {
            const f = S.fx[i];
            f.t += dt;
            const p = f.t / f.dur;
            if (p >= 1) {
                try { v.entities.remove(f.e); } catch (e) { }
                S.fx.splice(i, 1);
                continue;
            }
            const ease = 1 - Math.pow(1 - p, 3);
            const maxR = (f.kind === 'fire' ? 45 : 130) * f.scale;
            const r = 1 + maxR * ease;
            const base = f.kind === 'fire' ? 0.95 : 0.5;
            try {
                f.e.ellipsoid.radii = new Cesium.ConstantProperty(new Cesium.Cartesian3(r, r, r));
                f.e.ellipsoid.material = new Cesium.ColorMaterialProperty(
                    (f.kind === 'fire'
                        ? Cesium.Color.fromCssColorString('#ff8a00')
                        : Cesium.Color.fromCssColorString('#4a4a4a')).withAlpha(base * (1 - p))
                );
            } catch (e) { }
        }
    }

    /* ============================== HUD MAJ ============================= */

    // Signatures des derniers contenus écrits dans le DOM (anti-lag).
    const HUD = { sig: '', panelSig: '' };

    function updateHUD() {
        if (!S.ui || !S.ready) return;
        const ac = geofs.aircraft.instance;
        const name = S.profile ? S.profile.name : (aircraftName(ac) || 'inconnu');
        const c = S.targetId ? findContact(S.targetId) : null;

        const stateLine = !S.profile
            ? '<span class="dim">avion non militaire</span>'
            : (S.armed ? '<span class="armed">● ARMÉ</span>' : '<span class="dim">○ SAFE</span>');

        let tgtLine = '<span class="dim">aucune</span>';
        if (c) tgtLine = '<b>' + c.name + '</b> <span class="v">' + (c.dist / 1000).toFixed(1) + ' km</span>';

        let loadLine = '';
        if (S.profile) {
            if (S.profile.missiles) {
                loadLine += 'Missiles : <b>' + S.loadout + '</b> / ' + S.profile.missiles +
                    ' <span class="dim">(' + S.missiles.length + ' en vol)</span>';
                loadLine += '<br>Type &nbsp;&nbsp;&nbsp;&nbsp;: <span class="v">' + currentType().name + '</span>' +
                    ' <span class="dim">[' + keyLabel(CFG.keys.type) + ']</span>';
            }
            if (S.profile.bombs) {
                if (loadLine) loadLine += '<br>';
                loadLine += 'Bombes &nbsp;&nbsp;: <b>' + S.bombs + '</b> / ' + S.profile.bombs +
                    ' <span class="dim">(' + S.bombsInAir.length + ' en vol)</span>';
            }
            if (!loadLine) loadLine = '<span class="dim">pas d\'emport</span>';
        } else {
            loadLine = '<span class="dim">—</span>';
        }

        let calLine = '';
        if (S.calMode) {
            const k = calFor();
            calLine = '<div class="cal">CALIBRAGE : span ' + k.span.toFixed(2) +
                ' | haut ' + k.u.toFixed(2) + ' | avant ' + k.f.toFixed(2) +
                '<br>² avancer · , reculer · ) ( écartement · ] [ hauteur · Retour arrière = reset</div>';
        }

        const html =
            '<b>◈ SYSTÈME D\'ARMEMENT</b> &nbsp;' + stateLine + '<br>' +
            'Avion &nbsp;&nbsp;&nbsp;: <span class="v">' + name + '</span><br>' +
            loadLine + '<br>' +
            'Cible &nbsp;&nbsp;&nbsp;: ' + tgtLine + '<br>' +
            'Contacts : <span class="v">' + S.contacts.length + '</span>' +
            ' <span class="dim">(' + Math.round(lockRange() / 1000) + ' km)</span>' +
            calLine +
            '<div class="keys">' +
            '[' + keyLabel(CFG.keys.arm) + '] armer &nbsp; ' +
            '[' + keyLabel(CFG.keys.fire) + '] missile &nbsp; ' +
            '[' + keyLabel(CFG.keys.type) + '] type<br>' +
            '[' + keyLabel(CFG.keys.target) + '] cible &nbsp; ' +
            '[' + keyLabel(CFG.keys.bomb) + '] bombe<br>' +
            '[' + keyLabel(CFG.keys.reload) + '] réarmer &nbsp; ' +
            '[' + keyLabel(CFG.keys.calibrate) + '] calibrage' +
            '</div>';
        // Réécrire le HUD à chaque image coûtait un reflow complet plusieurs
        // fois par seconde (source du lag chez certains joueurs). On construit
        // le texte, et on ne touche au DOM que s'il a changé.
        if (html !== HUD.sig) {
            HUD.sig = html;
            S.ui.hud.innerHTML = html;
        }
        if (S.panelOpen) renderPanel();
    }

    /* =========================== BOUCLE DE JEU ========================= */

    function checkAircraft() {
        const ac = geofs.aircraft.instance;
        if (!ac) return;
        const name = aircraftName(ac);
        const key = String(ac.id || '') + '|' + name;
        if (key === S.aircraftKey) return;
        S.aircraftKey = key;

        S.profile = detectProfile(name);
        S.geo = aircraftGeometry(S.profile || GENERIC_FRAME);
        // les emports dépendent des dimensions de CET avion
        clearStations();
        buildStations(S.profile);
        wingTries = 0;
        S.targetId = null;
        S.armed = false;
        updateHUD();
        if (S.profile) {
            log('Avion détecté : ' + name + ' (' + S.profile.name + ', ' + S.geo.halfSpan.toFixed(1) + ' m de demi-envergure)');
            toast('Emports disponibles — [' + CFG.keys.arm.toUpperCase() + '] pour armer', '#39ff88');
        }
    }

    // Le maillage arrive après le changement d'avion : si la boîte d'aile
    // manquait au moment du calcul, on réessaie (deux fois par seconde) et on
    // replace les emports dès qu'on l'a.
    // Bornée : au-delà de six essais le maillage ne viendra plus, et parcourir
    // tout le glTF deux fois par seconde pour rien coûtait un à-coup régulier.
    let wingAt = 0, wingTries = 0;
    function retryWingBox() {
        if (!S.profile) return;
        if (S.geo.wing && S.geo.plates) return;
        if (wingTries >= 6) return;
        const now = performance.now();
        if (now - wingAt < 500) return;
        wingAt = now;
        wingTries++;
        const m = meshWing();
        if (!m) return;
        const gotBox = !S.geo.wing && m.box;
        const gotPlates = !S.geo.plates && m.plates && m.plates.length;
        if (!gotBox && !gotPlates) return;
        if (!S.stations.concat(S.bombStations).every(st => !st.used)) return;
        if (gotBox) S.geo.wing = m.box;
        if (gotPlates) S.geo.plates = m.plates;
        buildStations(S.profile);
    }

    function tick() {
        if (!S.ready) return;
        S.frameSeq++;
        S.frameNo = readFrameNumber();
        const now = performance.now();
        const dt = Math.min(0.1, (now - (S.lastFrame || now)) / 1000);
        S.lastFrame = now;

        try {
            checkAircraft();
            retryWingBox();
            placeStations();
            if (now - S.contactsAt > 500) refreshContacts();
            updateMissiles(dt);
            updateBombs(dt);
            updateFx(dt);
            updateLock();
            if (now - S.hudAt > 500) { S.hudAt = now; updateHUD(); }
            updatePerf(now);
        } catch (e) {
            warn('tick', e);
        }
    }

    // Une ancienne version enregistrait l'id 9917 (avion bonus retiré du mod)
    // dans la sauvegarde de vol : GeoFS échouerait au lancement suivant avec
    // « Could not load aircraft file ». On répare cet enregistrement.
    function cleanStaleAircraftId() {
        try {
            const raw = localStorage.getItem('flight');
            if (!raw) return;
            const f = JSON.parse(raw);
            if (!f || String(f.aircraftId) !== '9917') return;
            f.aircraftId = String(geofs.aircraft.default);
            localStorage.setItem('flight', JSON.stringify(f));
            log('enregistrement de vol : id 9917 (avion retiré) → avion par défaut');
        } catch (e) {
            warn('enregistrement de vol', e);
        }
    }

    /* ===================== INTERFACE DÉDIÉE (PANNEAU) ================== */

    // Bouton inséré dans la barre du bas de GeoFS, entre « Location » et
    // « Camera » (les deux voisins directs dans .geofs-ui-bottom).
    function installPanelButton() {
        if (document.getElementById('gmm-panel-btn')) return true;
        const cam = document.getElementById('geofs-camera-selector');
        if (!cam || !cam.parentElement) return false;
        const btn = document.createElement('button');
        btn.id = 'gmm-panel-btn';
        btn.className = 'mdl-button mdl-js-button geofs-f-standard-ui';
        btn.textContent = 'Armement';
        btn.title = 'Interface du mod missiles';
        btn.addEventListener('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            togglePanel();
        });
        cam.parentElement.insertBefore(btn, cam);
        return true;
    }

    function togglePanel(force) {
        if (!S.ui || !S.ui.panel) return;
        const open = force === undefined ? !S.panelOpen : !!force;
        S.panelOpen = open;
        S.ui.panel.classList.toggle('open', open);
        if (open) renderPanel();
    }

    function renderPanel() {
        if (!S.ui || !S.ui.panel || !S.panelOpen) return;
        const ac = geofs.aircraft.instance;
        const name = S.profile ? S.profile.name : (aircraftName(ac) || 'inconnu');
        const c = S.targetId ? findContact(S.targetId) : null;
        const h = [];

        h.push('<button class="gmm-x" data-act="close" title="Fermer">✕</button>');
        h.push('<h4>◈ SYSTÈME D\'ARMEMENT <span class="dim">v' + VERSION + '</span></h4>');
        h.push('<div class="row"><span>Avion</span><span class="v">' + name + '</span></div>');
        h.push('<div class="row"><span>État</span><span class="' + (S.armed ? 'armed' : 'dim') + '">' +
            (S.armed ? '● ARMÉ' : '○ SAFE') + '</span></div>');
        h.push('<div class="row"><span>Cible</span><span class="v">' +
            (c ? c.name + ' · ' + (c.dist / 1000).toFixed(1) + ' km' : 'aucune') + '</span></div>');
        if (S.profile && S.profile.missiles) {
            h.push('<div class="row"><span>Missiles</span><span class="v">' + S.loadout + ' / ' + S.profile.missiles + '</span></div>');
            h.push('<div class="row"><span>Type</span><span class="v">' + currentType().name + '</span></div>');
        }
        if (S.profile && S.profile.bombs) {
            h.push('<div class="row"><span>Bombes</span><span class="v">' + S.bombs + ' / ' + S.profile.bombs + '</span></div>');
        }
        h.push('<div class="row"><span>Contacts</span><span class="v">' + S.contacts.length + '</span></div>');
        h.push('<div class="row"><span>Compteur</span>' +
            '<button class="gmm-btn small' + (S.perfOn ? ' actif' : '') + '" data-act="perf" ' +
            'title="Images par seconde et appels de dessin par image">FPS · dessin</button></div>');

        h.push('<div class="sep"></div>');
        h.push('<div class="dim">' + keyLabel(CFG.keys.arm) + ' armer · ' + keyLabel(CFG.keys.fire) + ' tirer · ' +
            keyLabel(CFG.keys.type) + ' type · ' + keyLabel(CFG.keys.bomb[0]) + ' bombe · ' +
            keyLabel(CFG.keys.reload) + ' réarmer</div>');
        const txt = h.join('');
        if (txt !== HUD.panelSig) {
            HUD.panelSig = txt;
            S.ui.panel.innerHTML = txt;
        }
    }

    /* ====================== COMPTEUR FPS / APPELS DE DESSIN ============ */

    // Ordre de Cesium, vérifié dans le build servi par GeoFS : render() vide
    // `frameState.commandList` (updateFrameState), les primitives puis
    // executeCommands le remplissent, et postRender n'est levé qu'ensuite : la
    // liste contient alors l'image qui vient d'être rendue. GeoFS branche
    // geofs.api.addFrameCallback sur `scene.preRender`, donc notre tick tourne
    // AVANT ce vidage : il lirait l'image précédente (0 au premier rendu), ou
    // la liste réduite d'un `scene.pick`, qui vide la liste et n'exécute que la
    // passe de sélection. On échantillonne donc dans postRender, et seulement
    // pour une passe de rendu normale.
    const PERF = { frames: 0, since: 0, min: 0, draws: -1, frame: -1 };

    function perfSample(scene) {
        if (!S.perfOn) return;
        const fs = scene && scene.frameState;
        if (!fs || !fs.commandList || !fs.passes || !fs.passes.render) return;
        PERF.draws = fs.commandList.length;
        PERF.frame = fs.frameNumber;
        PERF.frames++;
    }

    function bindPerf() {
        try {
            const scene = viewer().scene;
            if (scene && scene.postRender) scene.postRender.addEventListener(perfSample);
        } catch (e) { }
    }

    // Mesure par fenêtres de 500 ms : un FPS image par image saute trop pour
    // comparer deux réglages, et le minimum retenu montre les à-coups.
    function togglePerf() {
        S.perfOn = !S.perfOn;
        PERF.frames = 0;
        PERF.since = 0;
        PERF.min = 0;
        PERF.draws = -1;
        PERF.frame = -1;
        if (S.ui && S.ui.perf) {
            S.ui.perf.classList.toggle('on', !!S.perfOn);
            S.ui.perf.textContent = S.perfOn ? 'mesure en cours…' : '';
        }
        if (S.perfOn) toast('Compteur FPS · appels de dessin affiché', '#8ef6ff');
    }

    function updatePerf(now) {
        if (!S.perfOn) return;
        if (!PERF.since) { PERF.since = now; return; }
        const span = now - PERF.since;
        if (span < 500) return;
        const fps = Math.round(PERF.frames * 1000 / span);
        if (PERF.frames) PERF.min = PERF.min ? Math.min(PERF.min, fps) : fps;
        PERF.frames = 0;
        PERF.since = now;
        if (S.ui && S.ui.perf) {
            S.ui.perf.innerHTML = '<b>' + fps + '</b> i/s' +
                ' <span class="dim">min ' + (PERF.min || '—') + '</span>' +
                ' · <b>' + (PERF.draws >= 0 ? PERF.draws : '—') + '</b> appels de dessin';
        }
    }

    /* ============================== TOUCHES ============================ */

    function toggleArm() {
        if (!S.profile) { toast('Cet avion n\'emporte pas d\'armement', '#ffce54'); return; }
        S.armed = !S.armed;
        if (S.armed) {
            refreshContacts();
            const near = S.contacts.find(c => c.dist <= lockRange());
            S.targetId = near ? near.id : null;
            const n = (S.profile.missiles || 0) + (S.profile.bombs || 0);
            toast('ARMÉ — ' + n + ' emports' + (near ? ' — cible : ' + near.name : ' — aucun contact'), '#ff5252');
        } else {
            S.targetId = null;
            toast('SAFE — système désarmé', '#39ff88');
        }
        updateHUD();
    }

    function reload() {
        if (!S.profile) return;
        S.loadout = S.profile.missiles || 0;
        S.bombs = S.profile.bombs || 0;
        // Un emport tiré a été retiré du rendu : on reconstruit le chargement.
        // Les géométries sont en cache, seules les instances sont refaites.
        buildStations(S.profile);
        toast('Réarmement complet — ' + S.loadout + ' missiles, ' + S.bombs + ' bombes', '#8ef6ff');
        updateHUD();
    }

    function toggleCalibration() {
        if (!S.profile) { toast('Aucun emport à calibrer', '#ffce54'); return; }
        S.calMode = !S.calMode;
        if (S.calMode) buildCalMarkers(); else clearCalMarkers();
        toast(S.calMode
            ? 'CALIBRAGE — ² avancer · , reculer · ) ( écarter/resserrer · ] [ descendre/monter · Retour arrière = reset'
            : 'Calibrage terminé (sauvegardé)', S.calMode ? '#8ef6ff' : '#39ff88');
        updateHUD();
    }

    function matchKey(e, binding) {
        const parts = String(binding || '').toLowerCase().split('+').map(s => s.trim());
        const key = parts[parts.length - 1];
        if (!key) return false;
        const pressed = String(e.key || '');

        // Symboles (² $ * ! ; : ...) : ils demandent souvent Maj ou AltGr pour
        // être produits, on ignore donc l'état des modificateurs.
        const isSymbol = key.length === 1 && !/[a-z0-9]/.test(key);
        if (isSymbol) {
            if (e.ctrlKey || e.metaKey || e.altKey) return false;
            return pressed === key || pressed.toLowerCase() === key;
        }

        if (!!e.shiftKey !== (parts.indexOf('shift') >= 0)) return false;
        if (!!e.ctrlKey !== (parts.indexOf('ctrl') >= 0)) return false;
        if (!!e.altKey !== (parts.indexOf('alt') >= 0)) return false;
        if (e.metaKey) return false;
        return pressed.toLowerCase() === key;
    }

    // Une action peut être liée à une touche ou à un tableau de touches.
    function matchAny(e, bindings) {
        if (Array.isArray(bindings)) return bindings.some(b => matchKey(e, b));
        return matchKey(e, bindings);
    }

    function installKeys() {
        document.addEventListener('keydown', e => {
            const tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey) return;

            // Mode calibrage : les flèches pilotent le placement, pas l'avion.
            if (S.calMode) {
                // Touches symboles choisies pour ne rien prendre à GeoFS :
                // « ² » avance, « , » recule, les parenthèses écartent et
                // resserrent, les crochets montent et descendent. Les flèches
                // restent acceptées, elles sont neutralisées dans ce mode.
                const k = e.key;
                let handled = true;
                if (k === '²' || k === '.') calAdjust('f', 0.5);
                else if (k === ',') calAdjust('f', -0.5);
                else if (k === ')' || k === 'ArrowRight') calAdjust('span', 0.03);
                else if (k === '(' || k === 'ArrowLeft') calAdjust('span', -0.03);
                else if (k === '[' || k === 'ArrowUp') calAdjust('u', 0.25);
                else if (k === ']' || k === 'ArrowDown') calAdjust('u', -0.25);
                else if (k === 'Backspace') calReset();
                else handled = false;
                if (handled) {
                    e.preventDefault();
                    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                    return;
                }
            }

            let action = null;
            if (matchAny(e, CFG.keys.arm)) action = toggleArm;
            else if (matchAny(e, CFG.keys.fire)) action = fire;
            else if (matchAny(e, CFG.keys.type)) action = cycleMissileType;
            else if (matchAny(e, CFG.keys.bomb)) action = dropBomb;
            else if (matchAny(e, CFG.keys.target)) action = cycleTarget;
            else if (matchAny(e, CFG.keys.reload)) action = reload;
            else if (matchAny(e, CFG.keys.calibrate)) action = toggleCalibration;
            if (!action) return;

            e.preventDefault();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            action();
        }, true);
    }

    /* ================================ INIT ============================= */

    function init() {
        if (S.ready) return;
        S.ready = true;
        S.cal = loadCal();
        cleanStaleAircraftId();
        buildUI();
        installKeys();
        bindPerf();
        // La barre du bas de GeoFS arrive parfois après le script : on réessaie.
        let tries = 0;
        const btnTimer = setInterval(() => {
            if (installPanelButton() || ++tries > 120) clearInterval(btnTimer);
        }, 500);
        installPanelButton();
        S.lastFrame = performance.now();
        if (typeof geofs.api.addFrameCallback === 'function') {
            geofs.api.addFrameCallback(tick);
        } else {
            const loop = () => { tick(); window.requestAnimationFrame(loop); };
            window.requestAnimationFrame(loop);
        }
        log('v' + VERSION + ' prêt — ' + keyLabel(CFG.keys.arm) + ' armer / ' +
            keyLabel(CFG.keys.fire) + ' missile / ' +
            keyLabel(CFG.keys.type) + ' type / ' +
            keyLabel(CFG.keys.bomb) + ' bombe / ' +
            keyLabel(CFG.keys.target) + ' cible / ' +
            keyLabel(CFG.keys.reload) + ' réarmer / ' +
            keyLabel(CFG.keys.calibrate) + ' calibrage');
        toast('Missile & Bomb Mod chargé — ' + CFG.keys.arm.toUpperCase() + ' pour armer', '#39ff88');
    }

    waitForGeofs(init);
})();
