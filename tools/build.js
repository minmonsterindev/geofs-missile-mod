#!/usr/bin/env node
'use strict';

/* `src/geofs-missile-mod.js` est LE source lisible du mod : un seul fichier,
   qu'on édite et qu'on relit. Les huit fichiers `mod/1.js` … `mod/8.js` en sont
   la découpe, publiée telle quelle parce que le userscript les télécharge
   séparément (huit petites requêtes se mettent en cache indépendamment, et un
   envoi unique de 92 Ko ne passe pas).

   Usage :
     node tools/build.js               régénère mod/1.js … mod/8.js depuis src/
     node tools/build.js --from-parts  reconstitue src/ depuis mod/1..8 (amorçage)
                                       puis régénère la découpe

   La coupe tombe toujours au début d'une ligne vide : jamais dans une chaîne,
   un gabarit ni une expression. Tout est vérifié AVANT la moindre écriture —
   concaténation identique à src/ à l'octet près et source complète compilée —
   donc un échec laisse le dépôt intact. Une partie seule n'est pas un programme
   (elle s'arrête au milieu d'une fonction), c'est pourquoi c'est le source
   entier qui est compilé, pas chaque fragment. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'geofs-missile-mod.js');
const OUT = path.join(ROOT, 'mod');
const COUNT = 8;
const MAX_PART = 14000;   // une partie plus grosse est suspecte
const MIN_PART = 2000;    // et une partie minuscule aussi

function partPath(n) {
    return path.join(OUT, n + '.js');
}

function compile(text, label) {
    try {
        new vm.Script(text, { filename: label });
    } catch (e) {
        console.error('ÉCHEC syntaxe — ' + label + ' : ' + e.message);
        process.exit(1);
    }
}

// Début de chaque ligne vide : seules coupes autorisées.
function cutOffsets(src) {
    const starts = [0];
    for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
    const cuts = [];
    for (let i = 1; i < starts.length; i++) {
        if (src.slice(starts[i - 1], starts[i]).trim() === '') cuts.push(starts[i - 1]);
    }
    return cuts;
}

// Coupes les plus proches possibles de huit parts égales, en gardant de la
// place pour la suite et sans dépasser MAX_PART.
function planCuts(src) {
    const n = src.length;
    const cuts = cutOffsets(src);
    const chosen = [0];
    let from = 0;
    for (let k = 1; k < COUNT; k++) {
        const want = Math.round((k * n) / COUNT);
        const rest = COUNT - k;
        let best = -1;
        for (let i = 0; i < cuts.length; i++) {
            const c = cuts[i];
            if (c - from < MIN_PART) continue;
            if (c - from > MAX_PART) break;
            if (n - c < rest * MIN_PART) break;
            if (best < 0 || Math.abs(c - want) < Math.abs(best - want)) best = c;
        }
        if (best < 0) {
            console.error('ÉCHEC : aucune coupe possible pour la partie ' + (k + 1) +
                ' (à partir de ' + from + ' o) ; augmenter MAX_PART ?');
            process.exit(1);
        }
        chosen.push(best);
        from = best;
    }
    chosen.push(n);
    return chosen;
}

function build(src) {
    compile(src, 'src/geofs-missile-mod.js');

    const cuts = planCuts(src);
    const parts = [];
    for (let k = 0; k < COUNT; k++) parts.push(src.slice(cuts[k], cuts[k + 1]));

    if (parts.join('') !== src) {
        console.error('ÉCHEC : la concaténation des parties ne redonne pas src/');
        process.exit(1);
    }

    fs.mkdirSync(OUT, { recursive: true });
    parts.forEach((t, k) => fs.writeFileSync(partPath(k + 1), t));

    console.log('src/geofs-missile-mod.js : ' + Buffer.byteLength(src) + ' o');
    parts.forEach((t, k) => {
        console.log('  mod/' + (k + 1) + '.js  ' + Buffer.byteLength(t) + ' o');
    });
    console.log('OK  ' + COUNT + ' parties régénérées, concaténation identique à src/');
}

function fromParts() {
    let text = '';
    for (let n = 1; n <= COUNT; n++) text += fs.readFileSync(partPath(n), 'utf8');
    fs.mkdirSync(path.dirname(SRC), { recursive: true });
    fs.writeFileSync(SRC, text);
    console.log('src/ reconstitué depuis ' + COUNT + ' parties : ' + Buffer.byteLength(text) + ' o');
    return text;
}

if (process.argv.indexOf('--from-parts') >= 0) {
    build(fromParts());
} else {
    build(fs.readFileSync(SRC, 'utf8'));
}
