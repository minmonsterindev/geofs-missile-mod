
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
