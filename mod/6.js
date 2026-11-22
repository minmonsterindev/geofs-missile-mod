
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
