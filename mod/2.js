
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
