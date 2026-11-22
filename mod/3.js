
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
            renderPanel();
        });
        document.body.appendChild(panel);

        S.ui = { hud, reticle, toasts, reticleLabel: reticle.querySelector('span'), panel };
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
