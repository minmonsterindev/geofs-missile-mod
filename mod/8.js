
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
