# GeoFS — Missile & Bomb Mod

Missiles air-air et bombes pour les avions militaires de [GeoFS](https://www.geo-fs.com/).
100 % autonome : aucun modèle 3D ni texture externe, tout est généré (géométrie Cesium et
textures canvas).

Version **1.10.0** : l'aile est lue dans le **maillage réel** de l'avion (glTF), les missiles sont
posés 18 cm sous le dessous de voilure et répartis de la racine au bout. Position calculée au
rendu par une matrice modèle → ECEF. Le calibrage affiche un **repère visible sur chaque
emport**. Validé en jeu sur Su-35, F-16 et Rafale.

## Installation (Tampermonkey)

1. Installe l'extension **Tampermonkey** (Chrome, Edge, Firefox, Opera, Safari).
2. Tableau de bord Tampermonkey → onglet **+** → supprime tout le contenu.
3. Colle l'intégralité de [`geofs-missile-mod.user.js`](geofs-missile-mod.user.js), puis `Ctrl+S`.
4. Vérifie que le script est **activé** (interrupteur vert).
5. Va sur <https://www.geo-fs.com/geofs.php>, choisis un avion et décolle.

La console (`F12`) affiche `[MissileMod] v1.10.0 prêt`.

## Commandes

| Touche | Action |
|--------|--------|
| `L` | Armer / désarmer le système |
| `Q` | Tirer un missile (ou larguer une bombe si l'avion n'a pas de missiles) |
| `*` | Choisir le type de missile (avant l'armement) |
| `²` `$` `!` `:` | Larguer une bombe |
| `U` | Changer de cible |
| `D` | Réarmer (missiles + bombes) |
| `Maj + D` | Mode **calibrage** des points d'emport |

Touches libres uniquement : GeoFS utilise déjà `A B C E F G H J K M N O P R S T V X Z`, les
flèches, `Espace`, `Entrée`, `Tab`, `<` `>`, `;` et les chiffres. Les symboles sont reconnus
même si ta disposition de clavier demande `Maj` ou `AltGr`. Tout est remappable dans
`CFG.keys` (format `'l'`, `'shift+l'` ou tableau de touches).

## Types de missiles (`*`)

Sélection **avant d'armer** : `*` fait défiler les types, le HUD et la couleur des missiles
sous les ailes changent immédiatement. Une fois armé, `*` refuse de changer (il faut
désarmer) et chaque missile déjà tiré garde les performances de son type.

| Missile | Vitesse | Agilité | Portée |
|---------|---------|---------|--------|
| AIM-120 AMRAAM | 900 m/s | 1,6 | 40 km |
| AIM-9X Sidewinder | 760 m/s | 2,8 | 15 km |
| R-77 Adder | 860 m/s | 2,0 | 30 km |
| R-73 Archer | 720 m/s | 3,0 | 12 km |
| MBDA Meteor | 1000 m/s | 1,5 | 60 km |
| AIM-54 Phoenix | 950 m/s | 1,1 | 80 km |

La portée affichée dans le HUD (`Contacts (xx km)`) et le verrouillage automatique suivent le
missile choisi : avec un R-73, pas de lock à 30 km.

## Textures

Aucun fichier distant : chaque missile et chaque bombe reçoit une texture 64×64 dessinée en
canvas au chargement (panneaux, rivets, reflet métallique et bandes d'identification à la
couleur du type). Elle est appliquée via `Cesium.ImageMaterialProperty`, avec repli sur une
couleur unie si le navigateur refuse le canvas.

## Calcul de la position

Une seule matrice fait tout. `playerFrame()` lit la position (`llaLocation`) et l'orientation
(`object3d.worldRotation`, sinon `object3d.rotation`, sinon cap/assiette/roulis), redresse la
base (avant normalisé, vertical rendu perpendiculaire à l'avant), puis construit une matrice
modèle → ECEF dont les colonnes sont (gauche, avant, haut, position).

Un emport n'est plus qu'un point de coordonnées modèle transformé par cette matrice
(`Matrix4.multiplyByPoint`) : plus d'addition de trois axes à la main. Une orientation
légèrement arrondie ne peut donc plus cisailler les emports, et la position comme l'orientation
des missiles sortent de la même base.

Piège Cesium : `new Cesium.Matrix4(a, b, c, …)` **ignore ses arguments** et rend l'identité.
La matrice est donc remplie par `Matrix4.fromColumnMajorArray([...], new Matrix4())`. Sans ça,
les missiles partaient à l'origine de la Terre (bug corrigé en 1.7.0, trouvé en jeu).

Tout est appelé dans la `CallbackProperty` de chaque entité : recalcul à chaque évaluation par
Cesium, aucune image de retard, aucun cache à invalider. Le missile tiré part de la position
courante.

## Emports par appareil

| Appareil | Missiles | Bombes |
|----------|----------|--------|
| F-16 | 6 | 4 |
| F/A-18 | 8 | 4 |
| Su-35 | 12 | — |
| Rafale | 6 | 4 |
| Eurofighter | 8 | 4 |
| F-22 | 8 | 2 |
| F-35 | 6 | 4 |
| F-15 | 8 | 6 |
| F-14 | 8 | — |
| F-4 | 6 | 6 |
| MiG-29 / 31 / 25 | 6 | — |
| A-10 | 6 | 8 |
| Tornado / Gripen / J-20 | 6 | 4 à 6 |
| **B-2 Spirit** | — | **16** |
| **B-52** | — | **20** |
| **B-1B Lancer** | — | **16** |
| **Tu-160** | — | **12** |
| **Tu-95** | — | **8** |
| **Concorde** | — | **8** |

## Placement

Deux sources, dans cet ordre.

**1. Le maillage de l'aile**, lu dans le glTF chargé par Cesium
(`object3d.model._model._cachedGltf.gltf`). Les boîtes englobantes des pièces sont parcourues,
converties en repère Cesium (le glTF est en Y-haut : `(x, y, z) → (x, −z, y)`), et la pièce
retenue est celle qui est large, plate et devant. On en tire la racine, le bout, la corde et
surtout **le dessous de voilure**. Les missiles sont posés 18 cm sous ce dessous, répartis de
la racine vers le bout.

Sur le Su-35 : aile de 2,05 à 6,43 m, dessous à **0,21 m** → missiles à **0,03 m**, collés sous
l'aile. Le maillage arrive après le changement d'appareil, donc le calcul est retenté deux fois
par seconde et les emports sont replacés dès qu'il est disponible.

**2. Repli** si la pièce trouvée n'est pas crédible — l'aile du F-16 est fondue dans le `body`,
et sur le Rafale c'est un volet qui est le plus large : 25 cm sous le plan de voilure annoncé par
les `points.forceSourcePoint`, sinon sous le ventre.

GeoFS ne nomme **aucun pylône** (vérifié dans les `aircraft.json` du Su-35, du F-16, du Rafale et
du B-2) et seul le `body` porte des points de collision. Le train descend 1 à 3 m plus bas que le
fuselage : les bombes sont donc bornées à **1,20 m sous le dessous de voilure** pour ne pas
pendre sous les roues.

Si l'agencement ne colle pas à un appareil, `Maj + D` ouvre le calibrage (les flèches ne
pilotent plus l'avion). Chaque point d'emport affiche alors un **repère** : un point cyan pour
un missile, jaune pour une bombe, dessiné par-dessus le fuselage (test de profondeur désactivé)
et qui suit les réglages en direct. On aligne donc à l'œil sur l'aile, sans lire les chiffres.

| Touche | Effet |
|--------|-------|
| `²` (ou `Maj + ²`) | avancer les emports |
| `,` | reculer |
| `)` / `(` | écarter / resserrer |
| `]` / `[` | descendre / monter |
| `Retour arrière` | réinitialiser |

Les flèches font la même chose et sont neutralisées pendant le calibrage. Toutes ces touches
sont des symboles que GeoFS n'utilise pas : hors calibrage, `²` redevient une touche de bombe.

Réglages sauvegardés par appareil dans le `localStorage`.

## Fonctionnement

- **Guidage missile** : poursuite proportionnelle simplifiée, virage limité par l'agilité du
  type, accélération jusqu'à sa vitesse max, fusée de proximité testée sur le segment
  parcouru entre deux images (pas de « saut » à travers la cible).
- **Bombes** : gravité radiale, traînée, composante ascendante supprimée au largage, impact
  sur la hauteur réelle du terrain (`scene.globe.getHeight`).
- **Cibles** : `multiplayer.users` + `multiplayer.visibleUsers`, position relue à chaque image.
- **Son** : synthèse WebAudio.
- **Robustesse** : chargement unique, repli `requestAnimationFrame`, boucle sous `try/catch`.

## Réglages (`CFG`)

```js
keys: {
  arm: 'l', fire: 'q', type: '*', target: 'u', reload: 'd', calibrate: 'shift+d',
  bomb: ['²', '`', '$', '!', ':', 'shift+q']
}
minLaunchSpeed: 160     // vitesse minimale au tir (m/s)
maxActive: 8            // missiles simultanés max
bombGravity: 9.81       // gravité des bombes (m/s²)
bombDrag: 0.028         // traînée des bombes
bombCooldown: 220       // ms entre deux largages
cooldown: 900           // ms entre deux tirs de missile
lockRange: 40000        // portée radar de secours (sinon celle du missile)
trailPoints: 70         // points de sillage conservés
forceAllAircraft: false
```

Les performances de vol (vitesse, accélération, agilité, portée, durée de vie, fusée de
proximité) ne sont plus dans `CFG` : elles appartiennent à chaque entrée de `MISSILE_TYPES`,
puisque c'est le missile choisi qui les définit.

## Limites connues

- Dégâts **locaux** : GeoFS n'expose aucune API serveur pour détruire l'avion d'un autre
  joueur. L'explosion et le « SPLASH » ne sont visibles que chez toi.
- Missiles et bombes ne sont pas synchronisés en multijoueur.
- Si un appareil n'apparaît pas dans `AIRFRAMES`, active `forceAllAircraft` ou ajoute une entrée.

## Avion bonus — MiG-31 Foxhound (LEGO)

Le dépôt contient `assets/mig31-lego.glb` : le MiG-31 du Mecabricks converti en
glTF léger (843 Ko, 14 232 triangles au lieu de 1,55 M de faces), à l'échelle
réelle (22,70 m de long, 13,81 m d'envergure).

En jeu, la touche **K** masque l'avion GeoFS et affiche ce modèle à la même
place (il vole et se pilote normalement) ; **K** à nouveau rend le modèle d'origine.
