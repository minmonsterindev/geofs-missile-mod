
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
