
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
