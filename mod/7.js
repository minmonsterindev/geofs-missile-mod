
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
